import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { WakeRecognitionManager, matchesWakePhrase, extractWakeQuery, requestMicrophonePermission } from '../utils/wake-recognition';
import { GeminiLiveClient } from '../utils/gemini-live-client';

const NovaContext = createContext(null);

function playWakeChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
}

export function NovaProvider({ children }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [handsFree, setHandsFree] = useState(() => {
    return localStorage.getItem('nova_hands_free') !== 'false';
  });
  const [wakeStatus, setWakeStatus] = useState('ACTIVE'); // 'ACTIVE' | 'DETECTED' | 'IN_CONVERSATION' | 'MIC_ERROR' | 'STOPPED'
  const [assistantState, setAssistantState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking'
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveText, setLiveText] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [activeTool, setActiveTool] = useState(null);
  const [toolProgress, setToolProgress] = useState(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');
  const [lastWakeWordTime, setLastWakeWordTime] = useState(null);

  const [activities, setActivities] = useState([
    { id: 1, title: 'Profile loaded and analyzed', status: 'completed', time: 'Just now' },
    { id: 2, title: 'Knowledge base RAG index connected', status: 'completed', time: 'Just now' },
    { id: 3, title: 'Career prediction evaluated (100% Full Stack)', status: 'completed', time: '5m ago' },
  ]);

  const wakeMgrRef = useRef(null);
  const liveClientRef = useRef(null);
  const wakeDebounceTimer = useRef(null);
  const handsFreeRef = useRef(handsFree);
  const isOpenRef = useRef(isOpen);

  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const addActivity = useCallback((title, status = 'in_progress') => {
    const id = Date.now();
    setActivities((prev) => [
      { id, title, status, time: 'Just now' },
      ...prev.slice(0, 9),
    ]);
    return id;
  }, []);

  const updateActivity = useCallback((id, status) => {
    setActivities((prev) =>
      prev.map((act) => (act.id === id ? { ...act, status } : act))
    );
  }, []);

  // ── Stop Speaking / Barge-In ─────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    console.log('[NOVA] User stopped playback / barged in.');
    liveClientRef.current?.interrupt();
    setAssistantState('idle');
    setAudioLevel(0);
  }, []);

  // ── Send user text to Nova ──────────────────────────────────────────────
  const sendUserText = useCallback((text) => {
    if (!text || !text.trim()) return;
    setLiveText('');
    setAssistantState('processing');
    addActivity(`Processing: "${text.slice(0, 30)}..."`, 'in_progress');

    if (liveClientRef.current && liveClientRef.current.isConnected) {
      liveClientRef.current.sendText(text);
    } else {
      startLiveVoice({ autoGreet: false, query: text });
    }
  }, [addActivity]);

  // ── Connect & Start Gemini Live Voice Session ────────────────────────────
  const startLiveVoice = useCallback(async ({ autoGreet = true, query = '' } = {}) => {
    const token = localStorage.getItem('token') || '';
    setIsVoiceActive(true);

    if (liveClientRef.current && liveClientRef.current.isConnected) {
      if (query) {
        setAssistantState('processing');
        liveClientRef.current.sendText(query);
      } else if (autoGreet) {
        liveClientRef.current.startGreeting();
      }
      return;
    }

    try {
      setAssistantState('listening');
      const client = new GeminiLiveClient({
        silenceTimeoutSeconds: 50,
        onAudioLevel: (level, speaker) => {
          setAudioLevel(level);
          if (speaker === 'agent' && level > 0.02) {
            setAssistantState('speaking');
          } else if (speaker === 'user' && level > 0.025) {
            setAssistantState('listening');
          }
        },
        onTextChunk: (chunk) => {
          setLiveText((prev) => (prev ? prev + ' ' : '') + chunk);
        },
        onToolStart: (toolName, toolArgs) => {
          setActiveTool(toolName);
          setAssistantState('processing');
          addActivity(`Executing: ${toolName}...`, 'in_progress');
          if (toolName === 'add_project') {
            setToolProgress({
              tool: 'add_project',
              step: 'filling_fields',
              fields: {
                title: toolArgs?.title || 'Drafting Title...',
                tech_stack: toolArgs?.tech_stack || [],
                description: toolArgs?.description || 'Drafting Description...',
              },
              message: toolArgs?.title ? `Adding project: ${toolArgs.title}` : 'Adding new project...',
            });
          }
        },
        onToolProgress: (progressData) => {
          console.log('[NOVA] Tool progress:', progressData);
          setToolProgress(progressData);
          if (progressData?.message) {
            setLiveText(progressData.message);
          }
        },
        onUIAction: (action, data) => {
          console.log(`[NOVA] UI Action: ${action}`, data);
          if (action === 'NAVIGATE' && (data?.destination || data?.path)) {
            const dest = data.destination || data.path;
            navigate(dest);
            addActivity(`Navigated to ${dest}`, 'completed');
          } else if (action === 'PROJECT_ADDED') {
            const title = data?.project?.title || data?.fields?.title || 'New Project';
            addActivity(`Added project: ${title}`, 'completed');
            window.dispatchEvent(new CustomEvent('mirrormind:project-added', { detail: data?.project }));
          } else if (action === 'INTERNSHIP_ADDED') {
            const comp = data?.internship?.company_name || 'Experience';
            addActivity(`Added internship at ${comp}`, 'completed');
            window.dispatchEvent(new CustomEvent('mirrormind:internship-added', { detail: data?.internship }));
          } else if (action === 'PROFILE_UPDATED') {
            addActivity(`Profile updated: ${data.field}`, 'completed');
            window.dispatchEvent(new CustomEvent('mirrormind:profile-updated', { detail: data }));
          }
        },
        onStatusChange: (status) => {
          console.log(`[NOVA] Status changed: ${status}`);
          if (status === 'READY') {
            setIsVoiceActive(true);
          } else if (status === 'TURN_COMPLETE' || status === 'PLAYBACK_COMPLETE' || status === 'INTERRUPTED') {
            setAssistantState('idle');
            setAudioLevel(0);
          } else if (status === 'SILENCE_TIMEOUT') {
            setIsVoiceActive(false);
            setAssistantState('idle');
            setAudioLevel(0);
            setActiveTool(null);
            setToolProgress(null);
          }
        },
        onError: (err) => {
          console.warn('[NOVA] Live client error:', err);
          setAssistantState('idle');
          setAudioLevel(0);
        },
      });

      liveClientRef.current = client;

      if (query) {
        setAssistantState('processing');
        await client.connect(token, { autoGreet: false });
        client.sendText(query);
      } else {
        await client.connect(token, { autoGreet });
      }
    } catch (err) {
      console.error('[NOVA] Failed to initialize live voice:', err);
      setAssistantState('idle');
    }
  }, [addActivity]);

  // ── Wake Word Detection Handler ──────────────────────────────────────────
  const handleWakePhraseDetected = useCallback((rawTranscript = '') => {
    const now = Date.now();
    if (wakeDebounceTimer.current && now - wakeDebounceTimer.current < 2500) {
      return; // Debounce duplicate triggers within 2.5s
    }
    wakeDebounceTimer.current = now;

    const extracted = extractWakeQuery(rawTranscript);
    console.log('[NOVA][WAKE] Wake phrase detected! phrase=', extracted.wakePhrase, 'query=', extracted.query);

    playWakeChime();

    setWakeStatus('DETECTED');
    setLastWakeWordTime(now);
    setInitialQuery(extracted.query || '');
    setIsVoiceActive(true);

    // Pause background recognition to prevent mic collision with live audio
    try {
      wakeMgrRef.current?.stop();
    } catch (_) {}

    // Connect and speak immediately
    startLiveVoice({ autoGreet: !extracted.query, query: extracted.query });

    setTimeout(() => {
      setWakeStatus('IN_CONVERSATION');
    }, 1500);
  }, [startLiveVoice]);

  const openNova = useCallback((query = '') => {
    setInitialQuery(query || '');
    setIsOpen(true);
    setWakeStatus('IN_CONVERSATION');
    wakeMgrRef.current?.stop();
    startLiveVoice({ autoGreet: !query, query });
  }, [startLiveVoice]);

  const closeNova = useCallback(() => {
    setIsOpen(false);
    setInitialQuery('');

    // Resume background wake recognition if handsFree is active
    if (handsFreeRef.current) {
      setTimeout(() => {
        try {
          wakeMgrRef.current?.start('wake');
          setWakeStatus('ACTIVE');
        } catch (_) {}
      }, 500);
    } else {
      setWakeStatus('STOPPED');
    }
  }, []);

  const toggleNova = useCallback(() => {
    if (isOpenRef.current) {
      closeNova();
    } else {
      openNova();
    }
  }, [closeNova, openNova]);

  // ── Explicit Hands-Free Permission & Toggle ─────────────────────────────
  const enableHandsFree = useCallback(async () => {
    const granted = await requestMicrophonePermission();
    if (granted) {
      setHandsFree(true);
      localStorage.setItem('nova_hands_free', 'true');
      if (!isOpenRef.current) {
        wakeMgrRef.current?.start('wake');
        setWakeStatus('ACTIVE');
      }
      return true;
    } else {
      setWakeStatus('MIC_ERROR');
      return false;
    }
  }, []);

  const toggleHandsFree = useCallback(async () => {
    if (!handsFree) {
      await enableHandsFree();
    } else {
      setHandsFree(false);
      localStorage.setItem('nova_hands_free', 'false');
      wakeMgrRef.current?.stop();
      setWakeStatus('STOPPED');
      if (liveClientRef.current) {
        liveClientRef.current.disconnect();
        setIsVoiceActive(false);
      }
    }
  }, [handsFree, enableHandsFree]);

  // ── Start / Stop Wake Word Manager ────────────────────────────────────────
  useEffect(() => {
    if (!wakeMgrRef.current) {
      wakeMgrRef.current = new WakeRecognitionManager({
        onResult: (transcript, mode) => {
          setLiveTranscript(transcript);
          if (matchesWakePhrase(transcript)) {
            handleWakePhraseDetected(transcript);
          }
        },
        onStateChange: (status) => {
          // If drawer is currently open, don't overwrite IN_CONVERSATION
          if (!isOpenRef.current) {
            setWakeStatus(status);
          }
        },
      });
    }

    if (handsFree && !isOpen && !isVoiceActive) {
      try {
        wakeMgrRef.current.start('wake');
        setWakeStatus('ACTIVE');
      } catch (err) {
        console.warn('[NOVA][WAKE] Failed to start wake manager:', err);
      }
    } else if (!handsFree || isVoiceActive) {
      wakeMgrRef.current?.stop();
      if (!handsFree) setWakeStatus('STOPPED');
    }

    return () => {
      wakeMgrRef.current?.stop();
    };
  }, [handsFree, isOpen, isVoiceActive, handleWakePhraseDetected]);

  // ── Browser gesture listener for initial mic activation ───────────────────
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (handsFreeRef.current && !isOpenRef.current && !isVoiceActive && (!wakeMgrRef.current?.isRunning())) {
        try {
          wakeMgrRef.current?.start('wake');
          setWakeStatus('ACTIVE');
        } catch (_) {}
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [isVoiceActive]);

  return (
    <NovaContext.Provider
      value={{
        isOpen,
        openNova,
        closeNova,
        toggleNova,
        handsFree,
        toggleHandsFree,
        enableHandsFree,
        wakeStatus,
        assistantState,
        setAssistantState,
        liveTranscript,
        setLiveTranscript,
        liveText,
        setLiveText,
        audioLevel,
        activeTool,
        toolProgress,
        isVoiceActive,
        setIsVoiceActive,
        stopSpeaking,
        sendUserText,
        startLiveVoice,
        initialQuery,
        setInitialQuery,
        lastWakeWordTime,
        activities,
        addActivity,
        updateActivity,
      }}
    >
      {children}
    </NovaContext.Provider>
  );
}

export function useNova() {
  const ctx = useContext(NovaContext);
  if (!ctx) throw new Error('useNova must be used within NovaProvider');
  return ctx;
}
