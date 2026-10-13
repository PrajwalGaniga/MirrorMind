import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mic, MicOff, Send, Sparkles, CheckCircle2, Clock, PlayCircle, Loader2, Volume2, ShieldCheck } from 'lucide-react';
import { useNova } from '../context/NovaContext';
import NovaAvatar3D from './NovaAvatar3D';
import { GeminiLiveClient } from '../utils/gemini-live-client';

function getToolLabel(toolName, args = {}) {
  switch (toolName) {
    case 'add_project':
      return `Adding project: "${args?.title || 'New Project'}"...`;
    case 'add_internship':
      return `Recording internship at ${args?.company_name || 'organization'}...`;
    case 'update_profile':
      return `Updating profile (${args?.field || 'field'})...`;
    case 'query_rag_database':
      return 'Consulting RAG database & records...';
    case 'navigate_ui':
      return `Navigating to ${args?.destination || 'screen'}...`;
    default:
      return `Running: ${toolName}...`;
  }
}

export default function NovaDrawer() {
  const navigate = useNavigate();
  const {
    isOpen,
    closeNova,
    activities,
    addActivity,
    updateActivity,
    initialQuery,
    setInitialQuery,
    assistantState,
    setAssistantState,
    handsFree,
  } = useNova();

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'nova',
      text: "Hello! I'm Nova, your AI career co-pilot. I can evaluate your interview readiness, log projects to your portfolio, or guide your preparation. What would you like to do?",
      time: 'Just now',
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [speakerMode, setSpeakerMode] = useState(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('nova_speaker_mode') === 'true';
  });

  const liveClientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentMsgRef = useRef('');
  const msgIdRef = useRef(null);
  const toolActivityMap = useRef({});

  const toggleSpeakerMode = () => {
    setSpeakerMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nova_speaker_mode', next ? 'true' : 'false');
      } catch (_) {}
      if (liveClientRef.current) {
        liveClientRef.current.setSpeakerMode(next);
      }
      return next;
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTool]);

  const handleUIAction = useCallback((action, data) => {
    console.log(`[NOVA][DRAWER] UI Action received: ${action}`, data);
    if (action === 'NAVIGATE' && data?.destination) {
      let dest = data.destination.toLowerCase().trim();
      if (!dest.startsWith('/')) dest = '/' + dest;
      navigate(dest);
      addActivity(`Navigated to ${dest}`, 'completed');
    } else if (action === 'PROJECT_ADDED') {
      const projTitle = data?.project?.title || 'New Project';
      addActivity(`Added project: ${projTitle}`, 'completed');
      window.dispatchEvent(new CustomEvent('mirrormind:project-added', { detail: data?.project }));
    } else if (action === 'INTERNSHIP_ADDED') {
      const comp = data?.internship?.company_name || 'Experience';
      addActivity(`Added internship at ${comp}`, 'completed');
      window.dispatchEvent(new CustomEvent('mirrormind:internship-added', { detail: data?.internship }));
    } else if (action === 'PROFILE_UPDATED') {
      addActivity(`Profile updated: ${data.field} = ${data.value}`, 'completed');
      window.dispatchEvent(new CustomEvent('mirrormind:profile-updated', { detail: data }));
    }
  }, [navigate, addActivity]);

  // Connect Gemini Live WebSocket when drawer is opened
  useEffect(() => {
    if (!isOpen) {
      if (liveClientRef.current) {
        liveClientRef.current.disconnect();
        liveClientRef.current = null;
      }
      setIsConnected(false);
      setActiveTool(null);
      setAssistantState('idle');
      return;
    }

    const token = localStorage.getItem('token') || '';

    const client = new GeminiLiveClient({
      speakerMode,
      silenceTimeoutSeconds: 45,
      onAudioLevel: (level, speaker) => {
        if (speaker === 'agent' && level > 0.02) {
          setAssistantState('speaking');
        } else if (speaker === 'user' && level > 0.025) {
          setAssistantState('listening');
        }
      },
      onTextChunk: (chunk) => {
        currentMsgRef.current = (currentMsgRef.current ? currentMsgRef.current + ' ' : '') + chunk;
        setMessages((prev) => {
          if (!msgIdRef.current) {
            msgIdRef.current = Date.now();
            return [
              ...prev,
              { id: msgIdRef.current, sender: 'nova', text: currentMsgRef.current, time: 'Just now' },
            ];
          }
          return prev.map((m) =>
            m.id === msgIdRef.current ? { ...m, text: currentMsgRef.current } : m
          );
        });
      },
      onToolStart: (toolName, toolArgs) => {
        const label = getToolLabel(toolName, toolArgs);
        setActiveTool(label);
        setAssistantState('processing');
        const actId = addActivity(label, 'in_progress');
        toolActivityMap.current[toolName] = actId;
      },
      onUIAction: (action, data) => {
        handleUIAction(action, data);
      },
      onStatusChange: (status) => {
        console.log(`[NOVA][DRAWER] Live status: ${status}`);
        if (status === 'READY') {
          setIsConnected(true);
        } else if (status === 'TURN_COMPLETE' || status === 'PLAYBACK_COMPLETE') {
          setAssistantState('idle');
          setActiveTool(null);
          msgIdRef.current = null;
          currentMsgRef.current = '';
        } else if (status === 'SILENCE_TIMEOUT') {
          setIsConnected(false);
          setAssistantState('idle');
        }
      },
      onError: (errMsg) => {
        console.warn(`[NOVA][DRAWER] Live client error: ${errMsg}`);
        setAssistantState('idle');
        setActiveTool(null);
      },
    });

    liveClientRef.current = client;

    const startSession = async () => {
      try {
        const initial = initialQuery;
        if (initial) {
          setInitialQuery('');
          // User spoke query with wake word: append user bubble and send text
          setMessages((prev) => [
            ...prev,
            { id: Date.now(), sender: 'user', text: initial, time: 'Just now' },
          ]);
          setAssistantState('processing');
          await client.connect(token, { autoGreet: false });
          setIsConnected(true);
          client.sendText(initial);
        } else {
          // Speak personalized voice greeting natively!
          await client.connect(token, { autoGreet: true });
          setIsConnected(true);
        }
      } catch (err) {
        console.warn('[NOVA][DRAWER] Connection attempt error:', err);
      }
    };

    startSession();

    return () => {
      client.disconnect();
      liveClientRef.current = null;
    };
  }, [isOpen, initialQuery, handleUIAction, setInitialQuery, setAssistantState, addActivity]);

  const handleSendMessage = (textToSend) => {
    const text = (textToSend || inputVal).trim();
    if (!text) return;

    setInputVal('');
    const userMsgId = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text, time: 'Just now' },
    ]);

    setAssistantState('processing');
    addActivity(`Processing: "${text.slice(0, 30)}..."`, 'in_progress');

    // Send through persistent Gemini Live WebSocket
    if (liveClientRef.current && liveClientRef.current.isConnected) {
      msgIdRef.current = null;
      currentMsgRef.current = '';
      liveClientRef.current.sendText(text);
    } else {
      // Reconnect and send
      const token = localStorage.getItem('token') || '';
      liveClientRef.current?.connect(token).then(() => {
        msgIdRef.current = null;
        currentMsgRef.current = '';
        liveClientRef.current?.sendText(text);
        setIsConnected(true);
      });
    }
  };

  const toggleMic = async () => {
    if (liveClientRef.current?.isConnected) {
      liveClientRef.current.disconnect();
      setIsConnected(false);
      setAssistantState('idle');
    } else {
      setAssistantState('listening');
      const token = localStorage.getItem('token') || '';
      try {
        if (!liveClientRef.current) {
          // Reinitialize if null
          return;
        }
        await liveClientRef.current.connect(token, { autoGreet: false });
        setIsConnected(true);
      } catch (err) {
        console.warn('[NOVA][DRAWER] Reconnect failed:', err);
        setAssistantState('idle');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={closeNova}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={styles.novaLogoBadge}>
              <Sparkles size={16} color="#FFFFFF" />
            </div>
            <div>
              <div style={styles.headerTitle}>Nova Assistant</div>
              <div style={styles.headerSubtitle}>
                <span style={styles.statusDot} /> Online · Real-Time Co-Pilot
              </div>
            </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={toggleSpeakerMode}
              title="Speaker Mode: When enabled, prevents acoustic echo by muting the mic while Nova speaks through loudspeakers. Turn-taking is strictly sequential (barge-in disabled)."
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 9px',
                borderRadius: '8px',
                border: speakerMode ? '1px solid #2563EB' : '1px solid #E2E8F0',
                backgroundColor: speakerMode ? '#EFF6FF' : '#F8FAFC',
                color: speakerMode ? '#2563EB' : '#64748B',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Volume2 size={13} color={speakerMode ? '#2563EB' : '#64748B'} />
              <span>Speaker {speakerMode ? 'ON' : 'OFF'}</span>
            </button>
            <button style={styles.closeBtn} onClick={closeNova}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 3D Holographic Assistant Banner */}
        <div style={styles.avatarSection}>
          <NovaAvatar3D state={assistantState} size={140} />
          <div style={styles.avatarLabel}>
            {assistantState === 'listening' && '🎙️ Listening to you...'}
            {assistantState === 'processing' && '🧠 Analyzing context...'}
            {assistantState === 'speaking' && '🔊 Speaking...'}
            {assistantState === 'idle' && 'Ready · Ask me anything'}
          </div>

          {/* Quick Suggestions */}
          <div style={styles.chipsRow}>
            {['Am I ready for an interview?', 'Add project to portfolio', 'Analyze my skill gaps'].map((chip, idx) => (
              <button
                key={idx}
                style={styles.chip}
                onClick={() => handleSendMessage(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Active Tool Calling Pill */}
        {activeTool && (
          <div style={styles.toolPill}>
            <Loader2 size={14} className="spin" />
            <span>{activeTool}</span>
          </div>
        )}

        {/* Conversation Stream */}
        <div style={styles.chatArea}>
          {messages.map((m) => {
            const isNova = m.sender === 'nova';
            return (
              <div
                key={m.id}
                style={{
                  ...styles.messageRow,
                  justifyContent: isNova ? 'flex-start' : 'flex-end',
                }}
              >
                {isNova && (
                  <div style={styles.novaAvatarSmall}>
                    <Sparkles size={12} color="#2563EB" />
                  </div>
                )}
                <div
                  style={{
                    ...styles.messageBubble,
                    ...(isNova ? styles.novaBubble : styles.userBubble),
                  }}
                >
                  <div style={styles.messageText}>{m.text}</div>
                  <div style={styles.messageTime}>{m.time}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Background Activity Section */}
        <div style={styles.activitySection}>
          <div style={styles.activityHeader}>
            <Clock size={13} color="#64748B" />
            <span>Recent System Activity</span>
          </div>
          <div style={styles.activityList}>
            {activities.slice(0, 3).map((act) => (
              <div key={act.id} style={styles.activityItem}>
                <CheckCircle2 size={13} color="#10B981" />
                <span style={styles.activityTitle}>{act.title}</span>
                <span style={styles.activityTime}>{act.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hands-Free Notification Tag */}
        <div style={styles.handsFreeTag}>
          <Mic size={12} color={handsFree ? '#10B981' : '#64748B'} />
          <span>
            {handsFree
              ? 'Hands-Free Active: Say "Hey Nova" to resume anytime'
              : 'Hands-Free Off · Push mic to talk'}
          </span>
        </div>

        {/* Input Bar */}
        <div style={styles.inputArea}>
          <button
            style={{
              ...styles.micBtn,
              backgroundColor: assistantState === 'listening' ? '#EF4444' : isConnected ? '#2563EB' : '#EFF6FF',
              color: assistantState === 'listening' || isConnected ? '#FFFFFF' : '#2563EB',
            }}
            onClick={toggleMic}
            title={isConnected ? 'Connected to Gemini Live (Click to mute)' : 'Click to connect Live Voice'}
          >
            {assistantState === 'listening' ? <Mic size={18} className="pulse-mic" /> : isConnected ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <input
            style={styles.input}
            placeholder="Type a message or instruction..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button
            style={styles.sendBtn}
            onClick={() => handleSendMessage()}
            disabled={!inputVal.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'flex-end',
    animation: 'fadeIn 0.2s ease-out',
  },
  drawer: {
    width: '100%',
    maxWidth: '420px',
    height: '100%',
    backgroundColor: '#FFFFFF',
    boxShadow: '-10px 0 35px rgba(15, 23, 42, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid #E2E8F0',
    animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #F1F5F9',
  },
  novaLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: '10px',
    backgroundColor: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
  },
  headerTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: '11px',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10B981',
    display: 'inline-block',
  },
  closeBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#F8FAFC',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 20px 10px',
    background: 'linear-gradient(180deg, #F0F7FF 0%, #FFFFFF 100%)',
    borderBottom: '1px solid #F1F5F9',
  },
  avatarLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#2563EB',
    marginTop: '6px',
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    justifyContent: 'center',
    marginTop: '12px',
  },
  chip: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '20px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#334155',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  toolPill: {
    margin: '8px 20px 0',
    padding: '8px 12px',
    backgroundColor: '#FEF3C7',
    borderRadius: '8px',
    border: '1px solid #FDE68A',
    color: '#92400E',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  novaAvatarSmall: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '2px',
  },
  messageBubble: {
    maxWidth: '82%',
    padding: '10px 14px',
    borderRadius: '16px',
    fontSize: '13px',
    lineHeight: '1.45',
  },
  novaBubble: {
    backgroundColor: '#F8FAFC',
    color: '#1E293B',
    border: '1px solid #E2E8F0',
    borderTopLeftRadius: '4px',
  },
  userBubble: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    borderTopRightRadius: '4px',
  },
  messageText: {
    wordBreak: 'break-word',
  },
  messageTime: {
    fontSize: '10px',
    opacity: 0.7,
    marginTop: '4px',
    textAlign: 'right',
  },
  activitySection: {
    padding: '10px 20px',
    backgroundColor: '#F8FAFC',
    borderTop: '1px solid #E2E8F0',
  },
  activityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748B',
    marginBottom: '6px',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#334155',
  },
  activityTitle: {
    flex: 1,
    overflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activityTime: {
    fontSize: '10px',
    color: '#94A3B8',
  },
  handsFreeTag: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '6px 16px',
    backgroundColor: '#F8FAFC',
    borderTop: '1px solid #F1F5F9',
    fontSize: '11px',
    fontWeight: '500',
    color: '#64748B',
  },
  inputArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    borderTop: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  micBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  input: {
    flex: 1,
    height: '38px',
    padding: '0 12px',
    fontSize: '13px',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    outline: 'none',
    color: '#0F172A',
  },
  sendBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};
