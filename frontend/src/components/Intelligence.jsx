import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, Volume2, Square, Cloud, Monitor, ToggleRight, ToggleLeft } from 'lucide-react';
import api from '../api/axios';
import { AudioRecorder } from '../utils/record-audio';
import { useAuth } from '../context/AuthContext';
import { streamingTTS } from '../utils/streaming-tts';
import { browserTTS } from '../utils/browser-tts';
import { WakeRecognitionManager, matchesWakePhrase } from '../utils/wake-recognition';
import { audioMeter } from '../utils/audio-meter';
import VoiceStatePanel from './VoiceStatePanel';
import ActionPanel from './ActionPanel';
import DocumentViewer from './DocumentViewer';
import { useActionEngine } from '../hooks/useActionEngine';
import { detectIntent, isActionIntent } from '../utils/intentDetector';
import { normalizeCommand } from '../utils/commandNormalizer';
import { GeminiLiveClient } from '../utils/gemini-live-client';
import { useNavigate } from 'react-router-dom';

// ── Animated dots helper ───────────────────────────────────────────────────
function AnimatedMessage({ icon, text }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(iv);
  }, []);
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span>{text}{dots}</span>
    </span>
  );
}

// ── Processing stage definitions ───────────────────────────────────────────
const STAGES = {
  gemini: [
    { icon: '🔎', text: 'Understanding your question' },
    { icon: '📚', text: 'Searching your profile and documents' },
    { icon: '🧠', text: 'Building personalized context' },
    { icon: '✨', text: 'Consulting Gemini 3.1 Flash Lite' },
    { icon: '📝', text: 'Preparing your answer' },
  ],
  openrouter: [
    { icon: '🔎', text: 'Understanding your question' },
    { icon: '📚', text: 'Searching your profile and documents' },
    { icon: '🧠', text: 'Building personalized context' },
    { icon: '☁',  text: 'Asking OpenRouter' },
    { icon: '✨', text: 'Preparing your answer' },
  ],
  ollama: [
    { icon: '🔎', text: 'Understanding your question' },
    { icon: '📚', text: 'Searching your profile and documents' },
    { icon: '🧠', text: 'Building personalized context' },
    { icon: '💻', text: 'Waking up Local Ollama' },
    { icon: '🤖', text: 'MirrorMind is thinking locally' },
    { icon: '✨', text: 'Preparing your answer' },
  ],
};

const STAGE_DELAYS = {
  gemini:     [600, 800, 800, 0, 0],
  openrouter: [800, 1200, 1000, 0, 0],
  ollama:     [800, 1200, 1000, 1200, 0, 0],
};

const SUGGESTIONS = [
  'What skills should I improve for backend development?',
  'What does my resume say about my backend experience?',
  'Which skills am I missing for an AI/ML role?',
  'What should I learn next?',
  'Summarize my uploaded project experience.',
];

// ── Formatted LLM response renderer ───────────────────────────────────────
const FormattedResponse = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ lineHeight: '1.7', fontSize: 15 }}>
      {lines.map((line, i) => {
        let content = line;
        let isBullet = false;
        let isNumbered = false;

        if (content.trim().startsWith('- ')) {
          isBullet = true;
          content = content.replace(/^\s*-\s/, '');
        } else if (/^\s*\d+\.\s/.test(content)) {
          isNumbered = true;
        }

        const parts = content.split(/(\*\*.*?\*\*)/g);
        const renderedParts = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginLeft: 16, marginBottom: 6 }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>•</span>
              <div>{renderedParts}</div>
            </div>
          );
        }
        if (isNumbered) {
          return <div key={i} style={{ marginLeft: 8, marginBottom: 6, marginTop: 12 }}>{renderedParts}</div>;
        }
        return <div key={i} style={{ minHeight: '1rem', marginBottom: 8 }}>{renderedParts}</div>;
      })}
    </div>
  );
};

// ── Provider badge ─────────────────────────────────────────────────────────
function ProviderBadge({ provider, model }) {
  if (provider === 'gemini') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(37,99,235,0.12)', color: '#2563eb', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
        ✨ Gemini · {model || 'gemini-3.1-flash-lite'}
      </span>
    );
  }
  if (provider === 'ollama') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(82,196,26,0.12)', color: '#52c41a', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
        <Monitor size={13} /> Local Ollama · {model || 'qwen3:8b'}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(99,102,241,0.12)', color: '#6366f1', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
      <Cloud size={13} /> OpenRouter
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Intelligence() {
  const [question, setQuestion]           = useState('');
  const [provider, setProvider]           = useState('gemini');

  const [loading, setLoading]             = useState(false);
  const [stageIndex, setStageIndex]       = useState(0);
  const [error, setError]                 = useState(null);
  const [result, setResult]               = useState(null);
  const [elapsedTime, setElapsedTime]     = useState(0);

  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Voice state machine ──────────────────────────────────────────────────
  const [handsFree, setHandsFree]               = useState(true); // Always ON by default for hands-free Nova
  const [voiceState, setVoiceState]             = useState('IDLE');
  const [wakeStatus, setWakeStatus]             = useState('STOPPED'); // ACTIVE | RECONNECTING | STOPPED | MIC_ERROR
  const [voiceError, setVoiceError]             = useState('');
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [novaResponseText, setNovaResponseText]   = useState('');
  const [liveAudioLevel, setLiveAudioLevel]       = useState(0);
  const [liveSpeaker, setLiveSpeaker]             = useState('idle');
  const [silenceSeconds, setSilenceSeconds]       = useState(30);
  
  const [voiceDiagnostics, setVoiceDiagnostics] = useState(null);
  const liveClientRef = useRef(null);
  const silence4sTimerRef = useRef(null);

  // ── Action Engine ────────────────────────────────────────────────────────
  const startRecordingRef = useRef(null);
  
  const engine = useActionEngine({
    navigate,
    user,
    onSpeak: async (text, expectedState) => {
      try { await browserTTS.speak(text); } catch (err) {}
      if (handsFreeRef.current) {
         const vState = expectedState || voiceStateRef.current;
         if (vState === 'ACTION_COLLECTING') {
            startRecordingRef.current?.(true);
         } else if (vState === 'ACTION_PREVIEW') {
            wakeRecMgrRef.current?.start('confirm');
         } else if (vState === 'WAKE_LISTENING' || vState === 'IDLE') {
            wakeRecMgrRef.current?.start('wake');
         }
      }
    },
    onSetVoiceState: setVoiceState,
  });

  // ── Refs ────────────────────────────────────────────────────────────────
  const recorderRef          = useRef(null);
  const timerRef             = useRef(null);
  const stageTimerRef        = useRef(null);
  const wakeRecMgrRef        = useRef(null);  // WakeRecognitionManager instance
  const confTimeoutRef       = useRef(null);

  // Stable refs for async callbacks
  const voiceStateRef        = useRef(voiceState);
  const handsFreeRef         = useRef(handsFree);
  const pendingTranscriptRef = useRef(pendingTranscript);
  const providerRef          = useRef(provider);
  const activeActionRef      = useRef(engine.activeAction);

  useEffect(() => { voiceStateRef.current = voiceState;
    console.log(`[MIRRORMIND][VOICE] state=${voiceState}`);
  }, [voiceState]);
  useEffect(() => { handsFreeRef.current = handsFree; },         [handsFree]);
  useEffect(() => { pendingTranscriptRef.current = pendingTranscript; }, [pendingTranscript]);
  useEffect(() => { providerRef.current = provider; },           [provider]);
  useEffect(() => { activeActionRef.current = engine.activeAction; }, [engine.activeAction]);

  // ── Final query submission after silence debounce ─────────────────────────
  const handleFinalQuerySubmit = (text) => {
    if (!text || !text.trim()) return;
    if (silence4sTimerRef.current) clearTimeout(silence4sTimerRef.current);
    wakeRecMgrRef.current?.stop();
    setNovaResponseText('');
    setVoiceState('NOVA_LIVE_ACTIVE');

    // If live audio WebSocket is connected, audio was already streamed in real time.
    // Do NOT send duplicate text query, which causes duplicate turns and 2.8s delay!
    if (liveClientRef.current && liveClientRef.current.isConnected) {
      console.log(`[NOVA] Live audio WebSocket active. Turn driven natively by audio stream: "${text}"`);
    } else {
      console.log(`[NOVA] Fallback submitting text query: "${text}"`);
    }
  };

  // ── Wake recognition result handler ─────────────────────────────────────
  // Defined with useCallback so it's stable across renders.
  const handleWakeResult = useCallback((transcript, mode) => {
    const currentState = voiceStateRef.current;

    if (mode === 'wake' && currentState === 'WAKE_LISTENING') {
      if (matchesWakePhrase(transcript)) {
        console.log(`[MIRRORMIND][VOICE] wake_word_detected transcript="${transcript}"`);
        handleWakeWordDetected();
      }
    } else if (mode === 'query' && (currentState === 'NOVA_LIVE_ACTIVE' || currentState === 'LISTENING_FOR_QUERY')) {
      // User is speaking: update live transcript in real-time on screen
      setPendingTranscript(transcript);
      liveClientRef.current?.resetSilenceTimer();

      // Reset the silence timer — 2800ms gives comfortable conversational pause time
      if (silence4sTimerRef.current) clearTimeout(silence4sTimerRef.current);
      silence4sTimerRef.current = setTimeout(() => {
        handleFinalQuerySubmit(transcript);
      }, 2800);
    } else if (mode === 'confirm' && (currentState === 'AWAITING_CONFIRMATION' || currentState === 'ACTION_PREVIEW' || currentState === 'AWAITING_ACTION_CONFIRM')) {
      console.log(`[MIRRORMIND][VOICE] confirmation_received="${transcript}"`);
      handleConfirmation(transcript);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWakeStatusChange = useCallback((status) => {
    console.log(`[MIRRORMIND][WAKE_MGR] status=${status}`);
    setWakeStatus(status);
    if (status === 'MIC_ERROR') {
      setVoiceError('Microphone unavailable or permission denied.');
      setVoiceState('ERROR');
      setHandsFree(false);
    }
  }, []);

  // ── Initialize/destroy WakeRecognitionManager on mount ──────────────────
  useEffect(() => {
    wakeRecMgrRef.current = new WakeRecognitionManager({
      onResult:      handleWakeResult,
      onStateChange: handleWakeStatusChange,
    });
    return () => {
      if (wakeRecMgrRef.current) wakeRecMgrRef.current.stop();
    };
  }, [handleWakeResult, handleWakeStatusChange]);

  // ── Start / stop wake listener based on handsFree toggle ────────────────
  useEffect(() => {
    if (handsFree) {
      console.log(`[MIRRORMIND][VOICE] Hands-Free Mode ENABLED`);
      streamingTTS.initAudio();
      setVoiceState('WAKE_LISTENING');
      setVoiceError('');
      wakeRecMgrRef.current?.start('wake');
    } else {
      console.log(`[MIRRORMIND][VOICE] Hands-Free Mode DISABLED`);
      cleanUpVoiceState();
    }
    // cleanUpVoiceState is stable (uses refs only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree]);

  // ── Cleanup helper (uses refs, safe in callbacks) ────────────────────────
  const cleanUpVoiceState = () => {
    if (silence4sTimerRef.current) clearTimeout(silence4sTimerRef.current);
    liveClientRef.current?.disconnect();
    setLiveAudioLevel(0);
    setLiveSpeaker('idle');
    setPendingTranscript('');
    setNovaResponseText('');
    wakeRecMgrRef.current?.stop();
    streamingTTS.stop();
    browserTTS.stop();
    audioMeter.disconnect();
    if (recorderRef.current) recorderRef.current.stop().catch(() => {});
    if (confTimeoutRef.current) clearTimeout(confTimeoutRef.current);
    setVoiceState('IDLE');
    setWakeStatus('STOPPED');
    console.log(`[MIRRORMIND][VOICE] cleanup_complete`);
  };

  // ── Wake word detected → Greet user via Native Gemini Voice & Activate Nova Live ──
  const handleWakeWordDetected = async () => {
    wakeRecMgrRef.current?.stop();
    setWakeStatus('STOPPED');

    setVoiceState('GREETING');
    setResult(null);
    setQuestion('');
    setPendingTranscript('');
    setNovaResponseText('');
    setVoiceDiagnostics(null);

    try {
      if (!liveClientRef.current) {
        liveClientRef.current = new GeminiLiveClient({
          silenceTimeoutSeconds: 30,
          onAudioLevel: (level, speaker) => {
            setLiveAudioLevel(level);
            if (speaker) setLiveSpeaker(speaker);
          },
          onSilenceTick: (secs) => {
            setSilenceSeconds(secs);
          },
          onTextChunk: (text) => {
            setNovaResponseText((prev) => (prev ? prev + ' ' + text : text));
          },
          onToolStart: (toolName, toolArgs) => {
            setVoiceState('NOVA_TOOL_CALLING');
            console.log(`[NOVA] Executing tool: ${toolName}`, toolArgs);
          },
          onUIAction: (action, data) => {
            console.log(`[NOVA] UI Action triggered: ${action}`, data);
            if (action === 'NAVIGATE' && data.path) {
              navigate(data.path);
            } else if (action === 'OPEN_DOCUMENT' && data.doc) {
              engine.openDocumentById?.(data.doc);
            } else if (action === 'PROJECT_ADDED') {
              setVoiceState('NOVA_LIVE_ACTIVE');
              setNovaResponseText((prev) => (prev ? prev + '\n✨ Project added to your portfolio!' : '✨ Project added to your portfolio!'));
            } else if (action === 'INTERNSHIP_ADDED' || action === 'PROFILE_UPDATED') {
              setVoiceState('NOVA_LIVE_ACTIVE');
            }
          },
          onStatusChange: (status) => {
            console.log(`[NOVA] Live status: ${status}`);
            if (status === 'READY' || status === 'TURN_COMPLETE' || status === 'PLAYBACK_COMPLETE') {
              // Nova finished turn / greeting: transition to active and listen for next query
              setVoiceState('NOVA_LIVE_ACTIVE');
              if (handsFreeRef.current) {
                wakeRecMgrRef.current?.start('query');
              }
            } else if (status === 'SILENCE_TIMEOUT') {
              console.log('[NOVA] 30s silence timeout. Sleeping live audio.');
              returnToWakeListening();
            }
          },
          onError: (errMsg) => {
            console.warn(`[NOVA] Error: ${errMsg}`);
            setVoiceError(errMsg);
            returnToWakeListening();
          },
        });
      }

      // Connect with autoGreet = true: Gemini Live speaks greeting in ITS OWN REALISTIC VOICE!
      const token = localStorage.getItem('token') || '';
      await liveClientRef.current.connect(token, { autoGreet: true });

      if (liveClientRef.current.micStream) {
        audioMeter.connect(liveClientRef.current.micStream);
      }
    } catch (err) {
      console.error('[NOVA] Failed to connect live client:', err);
      returnToWakeListening();
    }
  };

  // ── Start recording user query ────────────────────────────────────────────
  const startRecording = async (useSilenceDetection = false) => {
    startRecordingRef.current = startRecording;
    try {
      setVoiceError('');
      setVoiceState('LISTENING_FOR_QUERY');
      setResult(null);

      recorderRef.current = new AudioRecorder();

      if (useSilenceDetection) {
        recorderRef.current.onSilence      = () => stopRecording();
        recorderRef.current.onMaxDuration  = () => stopRecording();
      }

      await recorderRef.current.start();

      // Attach the audio meter to the live stream
      if (recorderRef.current.stream) {
        audioMeter.connect(recorderRef.current.stream);
      }
    } catch (err) {
      setVoiceError('Microphone permission denied or unavailable.');
      setVoiceState('ERROR');
      setWakeStatus('MIC_ERROR');
      if (handsFreeRef.current) setHandsFree(false);
    }
  };

  // ── Stop recording → transcribe ───────────────────────────────────────────
  const stopRecording = async () => {
    if (!recorderRef.current) return;

    audioMeter.disconnect();
    setVoiceState('TRANSCRIBING');

    try {
      const wavBlob = await recorderRef.current.stop();
      if (!wavBlob || wavBlob.size === 0) throw new Error('Empty recording.');

      const formData = new FormData();
      formData.append('audio', wavBlob, 'recording.wav');

      const res = await api.post('/api/voice/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!res.data.text || !res.data.text.trim()) throw new Error('Could not understand audio.');

      const transcribedText = res.data.text.trim();
      console.log(`[MIRRORMIND][VOICE] transcript="${transcribedText}"`);

      const currentAction = activeActionRef.current;
      const isCollecting = currentAction && currentAction.status === 'COLLECTING';

      // Guard against capturing the wake phrase itself or very short/noise clips
      const clean = transcribedText.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const isTooShort     = clean.length < 3 && !['ok', 'no', 'hi'].includes(clean);
      const isNoise        = [
        'yes', 'okay', 'ok', 'thank you', 'thanks', 'hello', 'bye', 'yep', 'yup', 'no',
        'okay prashva', 'thanks for watching', 'subscribe', 'thank you for watching',
        'you', 'yeah'
      ].includes(clean);
      const isWakePhraseItself = matchesWakePhrase(clean);

      if (isTooShort || isNoise || isWakePhraseItself) {
        console.log(`[MIRRORMIND][VOICE] transcript_valid=false reason=${isWakePhraseItself ? 'wake_phrase' : 'too_short_or_noise'} text="${clean}"`);
        if (handsFreeRef.current) {
          if (isCollecting) {
            setVoiceState('ACTION_COLLECTING');
            try { await browserTTS.speak("I didn't catch that clearly. Could you repeat your answer?"); } catch(e){}
            startRecording(true);
          } else {
            await speakBrowser("I didn't catch a question. Please try again.", 'ERROR');
            returnToWakeListening();
          }
        } else {
          throw new Error('Invalid or empty audio detected.');
        }
        return;
      }

      console.log(`[MIRRORMIND][VOICE] transcript_valid=true`);
      setQuestion(transcribedText);
      setPendingTranscript(transcribedText);
      
      if (isCollecting) {
         // Feed directly to handleAsk to process step, skipping RAG routing
         console.log(`[MIRRORMIND][VOICE] currently collecting, bypassing routing`);
         handleAsk(null, transcribedText);
         return;
      }

      // --- MODULE 9.1: EARLY INTENT DETECTION FOR ROUTING ---
      const intentResult = detectIntent(transcribedText);
      
      setVoiceDiagnostics({
        rawTranscript: transcribedText,
        normalizedText: normalizeCommand(transcribedText),
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        suggestion: intentResult.suggestion,
      });

      if (handsFreeRef.current) {
        // If it's a known action, skip the generic "You said X. Should I proceed?"
        // and go straight to execution (the Action Engine will do its own preview/confirm).
        if (isActionIntent(intentResult.intent)) {
          console.log(`[MIRRORMIND][VOICE] routing directly to action: ${intentResult.intent}`);
          handleAsk(null, transcribedText);
          return;
        }

        // If it's UNKNOWN but we have a fuzzy suggestion, ask about the suggestion
        if (intentResult.intent === 'UNKNOWN' && intentResult.suggestion) {
          const confText = `I didn't catch that clearly. Did you want me to ${intentResult.suggestion}?`;
          setVoiceState('CONFIRMING_TTS');
          try { await browserTTS.speak(confText); } catch(e){}
          setVoiceState('AWAITING_CONFIRMATION');
          wakeRecMgrRef.current?.start('confirm');
          // Start timeout
          confTimeoutRef.current = setTimeout(async () => {
            if (voiceStateRef.current === 'AWAITING_CONFIRMATION') {
              wakeRecMgrRef.current?.stop();
              try { await browserTTS.speak("I'll wait. Say Hello MirrorMind whenever you need me."); } catch(_) {}
              returnToWakeListening();
            }
          }, 10000);
          return;
        }

        // Fallback for Information Query
        const confText = `You said: ${transcribedText}. Should I proceed?`;
        setVoiceState('CONFIRMING_TTS');
        try {
          await browserTTS.speak(confText);
        } catch (err) {
          console.warn('[MIRRORMIND][CONFIRM_TTS] failed, skipping', err);
        }
        if (handsFreeRef.current) {
          setVoiceState('AWAITING_CONFIRMATION');
          wakeRecMgrRef.current?.start('confirm');
          // Auto-timeout if no confirmation received in 10 s
          confTimeoutRef.current = setTimeout(async () => {
            if (voiceStateRef.current === 'AWAITING_CONFIRMATION') {
              wakeRecMgrRef.current?.stop();
              try {
                await browserTTS.speak("I'll wait. Say Hello MirrorMind whenever you need me.");
              } catch (_) {}
              returnToWakeListening();
            }
          }, 10000);
        }
      } else {
        handleAsk(null, transcribedText);
      }

    } catch (err) {
      audioMeter.disconnect();
      const msg = err.response?.data?.detail || err.message || 'Transcription failed.';
      setVoiceError(msg);
      setVoiceState('ERROR');
      console.error(`[MIRRORMIND][AUDIO][ERROR] transcript_failed`, err);
      if (handsFreeRef.current) {
        setTimeout(() => {
          if (handsFreeRef.current) returnToWakeListening();
        }, 3000);
      }
    }
  };

  // ── Handle yes/no confirmation ────────────────────────────────────────────
  const handleConfirmation = async (transcript) => {
    if (confTimeoutRef.current) clearTimeout(confTimeoutRef.current);
    wakeRecMgrRef.current?.stop();

    if (engine.activeAction && engine.activeAction.status === 'PREVIEW') {
       await engine.handleConfirmationInput(transcript);
       return;
    }

    const yesWords = ['yes', 'yeah', 'okay', 'ok', 'sure', 'go ahead', 'proceed', 'tell me', 'ask', 'continue', 'do it'];
    const noWords  = ['no', 'cancel', 'stop', 'not now', 'dont', 'do not'];

    const hasYes = yesWords.some(w => transcript.includes(w));
    const hasNo  = noWords.some(w => transcript.includes(w));

    if (hasNo) {
      console.log(`[MIRRORMIND][VOICE] confirmed=false`);
      try { await browserTTS.speak("Okay. I'll wait."); } catch (_) {}
      returnToWakeListening();
    } else if (hasYes) {
      console.log(`[MIRRORMIND][VOICE] confirmed=true`);
      
      // If we confirmed a suggestion, use that instead of the raw transcript
      const currentDiagnostics = setVoiceDiagnostics((prev) => {
         if (prev && prev.intent === 'UNKNOWN' && prev.suggestion) {
            handleAsk(null, prev.suggestion);
         } else {
            handleAsk(null, pendingTranscriptRef.current);
         }
         return prev; // don't actually mutate state here, just use the value
      });
      // We read it via updater to avoid stale closures, handleAsk is called inside
    } else {
      // Unclear — ask again
      setVoiceState('CONFIRMING_TTS');
      try { await browserTTS.speak("I didn't catch that. Please say yes or no."); } catch (_) {}
      if (handsFreeRef.current) {
        setVoiceState('AWAITING_CONFIRMATION');
        wakeRecMgrRef.current?.start('confirm');
        confTimeoutRef.current = setTimeout(async () => {
          if (voiceStateRef.current === 'AWAITING_CONFIRMATION') {
            wakeRecMgrRef.current?.stop();
            try { await browserTTS.speak("I'll wait. Say Hello MirrorMind whenever you need me."); } catch (_) {}
            returnToWakeListening();
          }
        }, 10000);
      }
    }
  };

  // ── Return to wake-word listening ─────────────────────────────────────────
  const returnToWakeListening = () => {
    if (silence4sTimerRef.current) clearTimeout(silence4sTimerRef.current);
    liveClientRef.current?.disconnect();
    setLiveAudioLevel(0);
    setLiveSpeaker('idle');
    setPendingTranscript('');
    setNovaResponseText('');
    audioMeter.disconnect();
    if (!handsFreeRef.current) return;
    setVoiceState('WAKE_LISTENING');
    setVoiceError('');
    wakeRecMgrRef.current?.start('wake');
  };

  // ── Helper: speak with browser TTS, set state ─────────────────────────────
  const speakBrowser = async (text, stateName) => {
    setVoiceState(stateName);
    try { await browserTTS.speak(text); } catch (err) {
      console.warn('[MIRRORMIND][BROWSER_TTS] speak failed', err);
    }
  };

  // ── Processing stage animation ────────────────────────────────────────────
  const runStages = (prov) => {
    const stages = STAGES[prov] || STAGES.openrouter;
    const delays = STAGE_DELAYS[prov] || STAGE_DELAYS.openrouter;
    let idx = 0;
    setStageIndex(0);
    const advance = () => {
      idx += 1;
      if (idx < stages.length - 1) {
        setStageIndex(idx);
        stageTimerRef.current = setTimeout(advance, delays[idx] || 1000);
      } else {
        setStageIndex(idx);
      }
    };
    stageTimerRef.current = setTimeout(advance, delays[0] || 800);
  };

  const stopStages = () => {
    if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
  };

  // ── Main ask handler ──────────────────────────────────────────────────────
  const handleAction = async (intentResult) => {
    const { intent, payload } = intentResult;

    if (intent === 'NAVIGATE') {
      await engine.startAction(intent, payload);
      return;
    }

    if (intent === 'CLOSE_DOCUMENT') {
      engine.closeDocument();
      return;
    }

    if (intent === 'OPEN_DOCUMENT') {
      try {
        const { data: docs } = await api.get('/api/documents');
        const res = engine.handleDocumentOpen(payload.query, docs);
        if (res.found) {
          await engine.startAction(intent, { ...payload, doc: res.doc });
        } else if (res.candidates?.length > 1) {
          try { await browserTTS.speak("I found multiple matching documents."); } catch(err){}
        } else {
          try { await browserTTS.speak("I couldn't find a matching document."); } catch(err){}
        }
      } catch (err) {
        try { await browserTTS.speak("Failed to load documents."); } catch(err){}
      }
      return;
    }

    if (intent === 'EDIT_PROFILE') {
      try {
         const { data: prof } = await api.get('/api/students/profile');
         await engine.startAction(intent, payload, prof);
      } catch (err) {}
      return;
    }

    await engine.startAction(intent, payload);
  };

  const handleAsk = async (e, customQuestion = null, overrideProvider = null) => {
    if (e) e.preventDefault();
    const q = customQuestion || question;
    if (!q.trim() || loading) return;

    // Use ref to avoid stale closures from event listeners
    const currentAction = activeActionRef.current;

    // 1. Classify intent first
    const intentResult = detectIntent(q);

    // If we are currently collecting an action
    if (currentAction && currentAction.status === 'COLLECTING') {
       if (isActionIntent(intentResult.intent)) {
          const res = await engine.handleInterruption(intentResult.intent, intentResult.payload);
          if (res.interrupted) return;
       }
       setQuestion('');
       setPendingTranscript('');
       await engine.submitStep(q);
       return;
    }

    // If we are in PREVIEW and they typed something, treat as confirmation input
    if (currentAction && currentAction.status === 'PREVIEW') {
       setQuestion('');
       setPendingTranscript('');
       await engine.handleConfirmationInput(q);
       return;
    }

    if (intentResult.intent === 'UNKNOWN') {
       setQuestion('');
       setPendingTranscript('');
       const msg = "I didn't understand that as an action. Did you want to add a project, open a document, edit your profile, or something else?";
       try { await browserTTS.speak(msg); } catch (e) {}
       if (handsFreeRef.current) returnToWakeListening();
       return;
    }

    if (intentResult.intent !== 'INFORMATION_QUERY') {
       setQuestion('');
       setPendingTranscript('');
       return handleAction(intentResult);
    }

    console.log(`[MIRRORMIND][VOICE] sending_to_intelligence=true question="${q.substring(0, 80)}"`);
    const activeProvider = overrideProvider || providerRef.current;

    setLoading(true);
    setError(null);
    setResult(null);
    setElapsedTime(0);
    runStages(activeProvider);
    setVoiceState('THINKING');

    timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);

    try {
      const response = await api.post('/api/intelligence/ask', {
        question: q,
        top_k: 5,
        provider: activeProvider,
      });

      console.log(`[MIRRORMIND][VOICE] LLM response received`);
      const llmAnswer = response.data.answer;

      setResult(response.data);
      setLoading(false);
      stopStages();
      if (timerRef.current) clearInterval(timerRef.current);

      if (handsFreeRef.current || customQuestion) {
        setVoiceState('SPEAKING');
        try {
          // streamingTTS handles cleanTextForSpeech internally
          await streamingTTS.speak(llmAnswer);
        } catch (ttsErr) {
          console.warn('[MIRRORMIND][TTS] streamingTTS failed, falling back to browserTTS', ttsErr);
          try { await browserTTS.speak(llmAnswer); } catch (_) {}
        }
        if (handsFreeRef.current) {
          returnToWakeListening();
        } else {
          setVoiceState('IDLE');
        }
      } else {
        setVoiceState('IDLE');
      }

    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === 'object') {
        setError({
          code: detail.error_code,
          message: detail.error,
          detail: detail.detail,
          suggestion: detail.suggestion,
          provider: detail.provider || activeProvider,
        });
      } else {
        setError({
          message: typeof detail === 'string' ? detail : 'Failed to get a response.',
          provider: activeProvider,
        });
      }
      setVoiceState('ERROR');
      if (handsFreeRef.current) {
        setTimeout(() => {
          if (handsFreeRef.current) returnToWakeListening();
        }, 3000);
      }
      setLoading(false);
      stopStages();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // ── Mic button click (non-hands-free manual mode) ─────────────────────────
  const handleMicClick = async () => {
    if (voiceState === 'LISTENING_FOR_QUERY') {
      stopRecording();
    } else if (['SPEAKING', 'SPEECH_PAUSED', 'GREETING', 'CONFIRMING_TTS'].includes(voiceState)) {
      streamingTTS.stop();
      browserTTS.stop();
      setHandsFree(false);
      cleanUpVoiceState();
    } else {
      setHandsFree(false);
      startRecording();
    }
  };

  const handleSuggestionClick = (s) => {
    setQuestion(s);
    setResult(null);
    setError(null);
  };

  const currentStages = STAGES[provider] || STAGES.openrouter;
  const currentStage  = currentStages[Math.min(stageIndex, currentStages.length - 1)];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="card" style={{ marginBottom: 24, padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 32 }}>🧠</div>
        <h2 style={{ fontSize: 24, margin: 0 }}>MirrorMind Intelligence</h2>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontWeight: 600 }}>
        Your personal academic and career intelligence assistant.
      </p>

      {/* ── Provider + Hands-Free controls ── */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
            AI Engine
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setProvider('gemini')}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
                border: provider === 'gemini' ? '2px solid #2563eb' : '2px solid var(--border-color)',
                background: provider === 'gemini' ? 'rgba(37,99,235,0.1)' : 'var(--bg-secondary)',
                color: provider === 'gemini' ? '#2563eb' : 'var(--text-secondary)',
                boxShadow: provider === 'gemini' ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
              }}
            >
              ✨ Gemini 3.1 Flash Lite
              {provider === 'gemini' && <span style={{ fontSize: 10, background: '#2563eb', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>Selected</span>}
            </button>

            <button
              type="button"
              onClick={() => setProvider('openrouter')}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
                border: provider === 'openrouter' ? '2px solid #6366f1' : '2px solid var(--border-color)',
                background: provider === 'openrouter' ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                color: provider === 'openrouter' ? '#6366f1' : 'var(--text-secondary)',
                boxShadow: provider === 'openrouter' ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
              }}
            >
              <Cloud size={16} />
              OpenRouter
              {provider === 'openrouter' && <span style={{ fontSize: 10, background: '#6366f1', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>Selected</span>}
            </button>

            <button
              type="button"
              onClick={() => setProvider('ollama')}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
                border: provider === 'ollama' ? '2px solid #52c41a' : '2px solid var(--border-color)',
                background: provider === 'ollama' ? 'rgba(82,196,26,0.08)' : 'var(--bg-secondary)',
                color: provider === 'ollama' ? '#52c41a' : 'var(--text-secondary)',
                boxShadow: provider === 'ollama' ? '0 0 0 3px rgba(82,196,26,0.12)' : 'none',
              }}
            >
              <Monitor size={16} />
              Local Ollama
              {provider === 'ollama' && <span style={{ fontSize: 10, background: '#52c41a', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>Selected</span>}
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            {provider === 'gemini'
              ? '✨ Google Gemini 3.1 Flash Lite — Fast, accurate reasoning across RAG & DB data.'
              : provider === 'openrouter'
              ? '☁ Cloud AI — Fast, reliable, no local setup required.'
              : '💻 Local AI — qwen3:8b running on this machine. May be slower.'}
          </div>

        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10, textAlign: 'right' }}>
            Nova Voice Agent
          </div>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '10px 18px', borderRadius: 8,
              fontWeight: 700, fontSize: 13,
              border: '2px solid #2563eb',
              background: 'rgba(37,99,235,0.08)',
              color: '#2563eb',
              boxShadow: '0 0 0 3px rgba(37,99,235,0.12)',
              marginLeft: 'auto',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', display: 'inline-block', boxShadow: '0 0 8px #2563eb' }}></span>
            🎙️ Nova Live · Always Active
          </div>
        </div>
      </div>

      {/* ── Voice State Panel (hands-free only) ── */}
      {handsFree && (
        <VoiceStatePanel
          voiceState={voiceState}
          wakeStatus={wakeStatus}
          pendingTranscript={pendingTranscript}
          novaResponseText={novaResponseText}
          provider={provider}
          voiceError={voiceError}
          diagnostics={voiceDiagnostics}
          liveAudioLevel={liveAudioLevel}
          liveSpeaker={liveSpeaker}
          silenceSeconds={silenceSeconds}
          onEndLiveSession={returnToWakeListening}
        />
      )}

      {/* ── Error display ── */}
      {error && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: 10, background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.3)' }}>
          <div style={{ fontWeight: 700, color: '#ff4d4f', marginBottom: 6, fontSize: 15 }}>
            {error.code === 'OLLAMA_TIMEOUT'        && '⏱ Local Ollama timed out'}
            {error.code === 'OLLAMA_CONNECT_ERROR'  && '🔌 Cannot connect to Local Ollama'}
            {error.code === 'OPENROUTER_TIMEOUT'    && '⏱ OpenRouter timed out'}
            {!error.code                            && '❌ Request failed'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{error.message}</div>
          {error.detail     && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{error.detail}</div>}
          {error.suggestion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{error.suggestion}</span>
              {(error.code === 'OLLAMA_TIMEOUT' || error.code === 'OLLAMA_CONNECT_ERROR') && (
                <button className="btn btn-secondary" style={{ padding: '4px 14px', fontSize: 13, height: 'auto' }}
                  onClick={() => { setProvider('openrouter'); setError(null); }}>
                  ☁ Switch to OpenRouter
                </button>
              )}
              {error.code === 'OPENROUTER_TIMEOUT' && (
                <button className="btn btn-secondary" style={{ padding: '4px 14px', fontSize: 13, height: 'auto' }}
                  onClick={() => { setProvider('ollama'); setError(null); }}>
                  💻 Switch to Local Ollama
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Action Panel ── */}
      {engine.activeAction && (
        <ActionPanel
          activeAction={engine.activeAction}
          onSubmitStep={engine.submitStep}
          onCancel={() => engine.cancelAction(false)}
          onConfirm={engine.confirmAction}
          onConfirmInput={engine.handleConfirmationInput}
          handsFree={handsFree}
        />
      )}

      {/* ── Query form ── */}
      <form onSubmit={(e) => handleAsk(e, null)} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <textarea
            className="form-input"
            placeholder="Ask MirrorMind anything about your skills, projects, documents or career..."
            rows="4"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{ resize: 'vertical', flex: 1 }}
            disabled={loading || voiceState === 'LISTENING_FOR_QUERY' || voiceState === 'TRANSCRIBING'}
          />
          <button
            type="button"
            className={`btn btn-secondary ${voiceState !== 'IDLE' && voiceState !== 'ERROR' ? 'pulse' : ''}`}
            onClick={handleMicClick}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64,
              backgroundColor: voiceState === 'LISTENING_FOR_QUERY' ? '#ff4d4f'
                : ['SPEAKING', 'SPEECH_PAUSED', 'GREETING', 'CONFIRMING_TTS'].includes(voiceState) ? '#52c41a'
                : undefined,
              color: ['LISTENING_FOR_QUERY', 'SPEAKING', 'SPEECH_PAUSED', 'GREETING', 'CONFIRMING_TTS'].includes(voiceState) ? '#fff' : undefined,
              border: ['LISTENING_FOR_QUERY', 'SPEAKING', 'SPEECH_PAUSED', 'GREETING', 'CONFIRMING_TTS'].includes(voiceState) ? 'none' : undefined,
              transition: 'background-color 0.3s',
            }}
            disabled={voiceState === 'TRANSCRIBING' || voiceState === 'THINKING' || loading}
            title={
              voiceState === 'LISTENING_FOR_QUERY' ? 'Stop recording'
              : ['SPEAKING', 'SPEECH_PAUSED', 'GREETING', 'CONFIRMING_TTS'].includes(voiceState) ? 'Stop speaking'
              : 'Use voice'
            }
          >
            {voiceState === 'LISTENING_FOR_QUERY' ? <Square size={24} />
              : ['SPEAKING', 'SPEECH_PAUSED', 'GREETING', 'CONFIRMING_TTS'].includes(voiceState) ? <Volume2 size={24} />
              : <Mic size={24} />}
          </button>
        </div>

        {/* Non-hands-free inline status (simple one-liner) */}
        {!handsFree && voiceState !== 'IDLE' && (
          <div style={{ marginTop: 8, fontSize: 14, color: voiceState === 'ERROR' ? '#ff4d4f' : 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {voiceState === 'LISTENING_FOR_QUERY' && <><span style={{ backgroundColor: '#ff4d4f', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> 🎤 Listening...</>}
            {voiceState === 'TRANSCRIBING'        && <><Loader2 size={14} className="spin" /> 📝 Understanding your speech...</>}
            {voiceState === 'THINKING'            && <><Loader2 size={14} className="spin" /> 🧠 MirrorMind is thinking...</>}
            {voiceState === 'SPEAKING'            && <><Volume2 size={14} /> 🔊 MirrorMind is responding...</>}
            {voiceState === 'ERROR'               && <span>{voiceError}</span>}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !question.trim() || voiceState === 'LISTENING_FOR_QUERY' || voiceState === 'TRANSCRIBING'}
          style={{ marginTop: 16, width: '100%', maxWidth: 200 }}
        >
          {loading ? 'Processing...' : 'Ask MirrorMind'}
        </button>
      </form>

      {/* ── Loading / stage progress ── */}
      {loading && (
        <div style={{
          marginBottom: 24, padding: '24px 28px',
          border: '1px solid var(--border-color)', borderRadius: 12,
          background: 'var(--bg-secondary)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Loader2 size={22} className="spin" style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              <AnimatedMessage icon={currentStage.icon} text={currentStage.text} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {currentStages.map((stage, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                color: i <= stageIndex ? 'var(--text-secondary)' : 'var(--text-muted)',
                opacity: i <= stageIndex ? 1 : 0.4,
                fontWeight: i === stageIndex ? 700 : 400,
                transition: 'all 0.3s',
              }}>
                <span>{stage.icon}</span>
                <span>{i < stageIndex ? '✓' : i === stageIndex ? '●' : '○'}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Using <strong>{provider === 'gemini' ? 'Google Gemini 3.1 Flash Lite' : provider === 'ollama' ? 'Local Ollama · qwen3:8b' : 'OpenRouter'}</strong>
            {' '}· {elapsedTime}s elapsed
            {provider === 'ollama' && elapsedTime > 10 && (
              <span style={{ marginLeft: 8, color: '#fa8c16' }}>⚠ Local model may take 30–120s</span>
            )}
          </div>

        </div>
      )}

      {/* ── Suggested questions ── */}
      {!result && !loading && !error && (
        <div>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.05em' }}>
            Suggested Questions
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: 13, height: 'auto', borderRadius: 'var(--radius-full)', border: '2px solid var(--border-color)' }}
                onClick={() => handleSuggestionClick(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LLM Response ── */}
      {result && !loading && (
        <div style={{ marginTop: 32, borderTop: '2px dashed var(--border-subtle)', paddingTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✨</span> MirrorMind Response
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Engine:</span>
              <ProviderBadge provider={result.provider} model={result.model} />
            </div>
          </div>

          <div className="profile-text-output" style={{ marginBottom: 32 }}>
            <FormattedResponse text={result.answer} />
          </div>

          <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.05em' }}>
            Evidence Used
          </h3>
          {result.sources && result.sources.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.sources.map((source, idx) => (
                <div key={idx} className="dev-pred-card" style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                  <div className="dev-pred-info">
                    <div className="dev-pred-label" style={{ fontSize: 14 }}>📄 {source.filename}</div>
                    {(source.page_start || source.page_end) && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Page {source.page_start}{source.page_end && source.page_end !== source.page_start ? ` – ${source.page_end}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              No uploaded document evidence was used for this answer.
            </div>
          )}
        </div>
      )}
      {/* ── Document Viewer ── */}
      <DocumentViewer document={engine.openDocument} onClose={engine.closeDocument} />
    </div>
  );
}
