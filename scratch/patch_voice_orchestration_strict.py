import os

code = """import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Volume2, Square, Cloud, Monitor, ToggleRight, ToggleLeft } from 'lucide-react';
import api from '../api/axios';
import { AudioRecorder } from '../utils/record-audio';
import { useAuth } from '../context/AuthContext';

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

const STAGES = {
  openrouter: [
    { icon: '🔎', text: 'Understanding your question' },
    { icon: '📚', text: 'Searching your profile and documents' },
    { icon: '🧠', text: 'Building personalized context' },
    { icon: '☁', text: 'Asking OpenRouter' },
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

const FormattedResponse = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\\n');
  return (
    <div style={{ lineHeight: '1.7', fontSize: 15 }}>
      {lines.map((line, i) => {
        let content = line;
        let isBullet = false;
        let isNumbered = false;

        if (content.trim().startsWith('- ')) {
          isBullet = true;
          content = content.replace(/^\\s*-\\s/, '');
        } else if (/^\\s*\\d+\\.\\s/.test(content)) {
          isNumbered = true;
        }

        const parts = content.split(/(\\*\\*.*?\\*\\*)/g);
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

function ProviderBadge({ provider, model }) {
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

export default function Intelligence() {
  const [question, setQuestion] = useState('');
  const [provider, setProvider] = useState('openrouter');
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const { user } = useAuth();
  const [handsFree, setHandsFree] = useState(false);
  const [voiceState, setVoiceState] = useState('IDLE');
  const [voiceError, setVoiceError] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState('');

  const recorderRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const timerRef = useRef(null);
  const stageTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const confTimeoutRef = useRef(null);

  const voiceStateRef = useRef(voiceState);
  useEffect(() => { 
    voiceStateRef.current = voiceState; 
    console.log(`[MIRRORMIND][VOICE] state=${voiceState}`);
  }, [voiceState]);
  
  const handsFreeRef = useRef(handsFree);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  
  const pendingTranscriptRef = useRef(pendingTranscript);
  useEffect(() => { pendingTranscriptRef.current = pendingTranscript; }, [pendingTranscript]);

  const stopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
  };

  const cleanUpVoiceState = () => {
    stopSpeechRecognition();
    stopPlayback();
    if (recorderRef.current) recorderRef.current.stop().catch(()=>{});
    if (confTimeoutRef.current) clearTimeout(confTimeoutRef.current);
    setVoiceState('IDLE');
    console.log(`[MIRRORMIND][VOICE] cleanup_complete`);
  };

  useEffect(() => {
    if (handsFree) {
      console.log(`[MIRRORMIND][VOICE] Hands-Free Mode ENABLED`);
      setVoiceState('WAKE_LISTENING');
      startSpeechRecognition();
    } else {
      console.log(`[MIRRORMIND][VOICE] Hands-Free Mode DISABLED`);
      cleanUpVoiceState();
    }
    return () => cleanUpVoiceState();
  }, [handsFree]);

  const startSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setVoiceError('Browser does not support local wake-word detection.');
      setHandsFree(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const currentState = voiceStateRef.current;
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.trim().toLowerCase();
        const cleanTranscript = transcript.replace(/[.,!?]/g, '');

        if (currentState === 'WAKE_LISTENING') {
          if (cleanTranscript.includes('hello mirrormind') || cleanTranscript.includes('hello mirror mind')) {
            console.log(`[MIRRORMIND][VOICE] wake_word_detected=true`);
            handleWakeWordDetected();
          }
        } else if (currentState === 'AWAITING_CONFIRMATION') {
          console.log(`[MIRRORMIND][VOICE] confirmation_received="${transcript}"`);
          handleConfirmation(cleanTranscript);
        }
      };

      recognitionRef.current.onend = () => {
        if (handsFreeRef.current && (voiceStateRef.current === 'WAKE_LISTENING' || voiceStateRef.current === 'AWAITING_CONFIRMATION')) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      };
    }
    
    try {
      recognitionRef.current.start();
    } catch (e) {}
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
  };

  // ── 1. Wake Detected -> Greeting ──
  const handleWakeWordDetected = async () => {
    setVoiceState('WAKE_DETECTED');
    setResult(null);
    setQuestion('');
    setPendingTranscript('');
    stopSpeechRecognition();
    
    const greetingText = `Hello ${user?.name || 'there'}. How can I help you?`;
    await playTTS(greetingText, 'GREETING', () => {
      if (handsFreeRef.current) {
        startRecording(true); // Proceed to record user query
      }
    });
  };

  // ── 2. Record User Query ──
  const startRecording = async (useSilenceDetection = false) => {
    try {
      setVoiceError('');
      setVoiceState(handsFreeRef.current ? 'LISTENING_FOR_QUERY' : 'LISTENING_FOR_QUERY');
      setResult(null);
      recorderRef.current = new AudioRecorder();
      
      if (useSilenceDetection) {
        recorderRef.current.onSilence = () => stopRecording();
        recorderRef.current.onMaxDuration = () => stopRecording();
      }
      
      await recorderRef.current.start();
    } catch (err) {
      setVoiceError('Microphone permission denied or unavailable.');
      setVoiceState('ERROR');
      if (handsFreeRef.current) setHandsFree(false);
    }
  };

  // ── 3. Stop Recording -> Transcribe ──
  const stopRecording = async () => {
    if (!recorderRef.current) return;
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
      
      const clean = transcribedText.toLowerCase().replace(/[.,!?]/g, '');
      const invalidPhrases = ['yes', 'okay', 'ok', 'thank you', 'thank you very much', 'thanks', 'hello', 'bye', 'yep', 'yup', 'no'];
      
      if (clean.length < 3 || invalidPhrases.includes(clean)) {
         console.log(`[MIRRORMIND][VOICE] transcript_valid=false`);
         if (handsFreeRef.current) {
            await playTTS("I didn't catch a question. Please try again.", 'ERROR', () => {
               if (handsFreeRef.current) {
                 setVoiceState('WAKE_LISTENING');
                 startSpeechRecognition();
               }
            });
            return;
         } else {
            throw new Error("Invalid or empty question detected.");
         }
      }

      console.log(`[MIRRORMIND][VOICE] transcript_valid=true`);
      setQuestion(transcribedText);
      setPendingTranscript(transcribedText);
      
      if (handsFreeRef.current) {
         // Ask for confirmation
         const confText = `You said: ${transcribedText}. Should I proceed?`;
         await playTTS(confText, 'CONFIRMING_TTS', () => {
            if (handsFreeRef.current) {
               setVoiceState('AWAITING_CONFIRMATION');
               startSpeechRecognition();
               confTimeoutRef.current = setTimeout(() => {
                 if (voiceStateRef.current === 'AWAITING_CONFIRMATION') {
                   playTTS("I'll wait. Say Hello MirrorMind whenever you need me.", 'ERROR', () => {
                      if (handsFreeRef.current) {
                        setVoiceState('WAKE_LISTENING');
                        startSpeechRecognition();
                      }
                   });
                 }
               }, 8000);
            }
         });
      } else {
         // Manual input proceeds directly
         handleAsk(null, transcribedText);
      }

    } catch (err) {
      setVoiceError(err.response?.data?.detail || err.message || 'Transcription failed.');
      setVoiceState('ERROR');
      console.error(`[MIRRORMIND][AUDIO][ERROR] transcript_failed`, err);
      if (handsFreeRef.current) {
        setTimeout(() => {
          if (handsFreeRef.current) {
            setVoiceState('WAKE_LISTENING');
            startSpeechRecognition();
          }
        }, 3000);
      }
    }
  };

  // ── 4. Process Confirmation ──
  const handleConfirmation = (transcript) => {
    if (confTimeoutRef.current) clearTimeout(confTimeoutRef.current);
    
    const yesWords = ['yes', 'yeah', 'okay', 'ok', 'sure', 'go ahead', 'proceed', 'tell me', 'ask', 'continue'];
    const noWords = ['no', 'cancel', 'stop', 'not now'];
    
    const hasYes = yesWords.some(w => transcript.includes(w));
    const hasNo = noWords.some(w => transcript.includes(w));

    if (hasNo) {
      console.log(`[MIRRORMIND][VOICE] confirmed=false`);
      playTTS("Okay. I'll wait for you.", 'ERROR', () => {
         if (handsFreeRef.current) {
           setVoiceState('WAKE_LISTENING');
           startSpeechRecognition();
         }
      });
    } else if (hasYes) {
      console.log(`[MIRRORMIND][VOICE] confirmed=true`);
      stopSpeechRecognition();
      handleAsk(null, pendingTranscriptRef.current);
    } else {
      playTTS("I didn't catch that. Please say yes when you're ready.", 'CONFIRMING_TTS', () => {
         if (handsFreeRef.current) {
           setVoiceState('AWAITING_CONFIRMATION');
           startSpeechRecognition();
         }
      });
    }
  };

  // ── Generic TTS Player ──
  const playTTS = async (text, stateName, onEndedCallback) => {
    stopSpeechRecognition(); // ALWAYS pause ears when mouth is moving
    try {
      console.log(`[MIRRORMIND][AUDIO] TTS request started. text="${text}"`);
      setVoiceState(stateName);
      const response = await api.post('/api/voice/synthesize', { text }, { responseType: 'blob' });
      console.log(`[MIRRORMIND][AUDIO] TTS response received. size=${response.data.size}`);
      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      
      audio.onended = () => { 
        console.log(`[MIRRORMIND][AUDIO] audio playback ended`);
        URL.revokeObjectURL(audioUrl); 
        onEndedCallback();
      };
      console.log(`[MIRRORMIND][AUDIO] audio.play() started`);
      await audio.play();
      console.log(`[MIRRORMIND][AUDIO] audio playback started`);
    } catch (err) {
      console.error(`[MIRRORMIND][AUDIO][ERROR] playback_failed:`, err);
      if (err.name === 'NotAllowedError') {
         setVoiceError('Browser blocked automatic audio playback. Click once anywhere on the page to enable voice responses.');
      } else {
         setVoiceError('Audio playback failed.');
      }
      setVoiceState('ERROR');
      setTimeout(() => {
        onEndedCallback();
      }, 2000); // Wait 2 seconds on error before calling callback
    }
  };

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

  const handleAsk = async (e, customQuestion = null, overrideProvider = null) => {
    if (e) e.preventDefault();
    const q = customQuestion || question;
    if (!q.trim() || loading) return;

    console.log(`[MIRRORMIND][VOICE] sending_to_intelligence=true`);
    const activeProvider = overrideProvider || provider;

    setLoading(true);
    setError(null);
    setResult(null);
    setElapsedTime(0);
    runStages(activeProvider);

    timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);

    setVoiceState('THINKING');

    try {
      const response = await api.post('/api/intelligence/ask', {
        question: q,
        top_k: 5,
        provider: activeProvider,
      });

      setResult(response.data);

      if (handsFreeRef.current || customQuestion) {
        await playTTS(response.data.answer, 'SPEAKING', () => {
           console.log(`[MIRRORMIND][VOICE] returning_to_wake_listener=true`);
           if (handsFreeRef.current) {
             setVoiceState('WAKE_LISTENING');
             startSpeechRecognition();
           } else {
             setVoiceState('IDLE');
           }
        });
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
          if (handsFreeRef.current) {
            setVoiceState('WAKE_LISTENING');
            startSpeechRecognition();
          }
        }, 3000);
      }
    } finally {
      setLoading(false);
      stopStages();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleSuggestionClick = (s) => {
    setQuestion(s);
    setResult(null);
    setError(null);
  };

  const handleMicClick = async () => {
    if (voiceState === 'LISTENING_FOR_QUERY') stopRecording();
    else if (voiceState === 'SPEAKING' || voiceState === 'GREETING' || voiceState === 'CONFIRMING_TTS') {
      setHandsFree(false);
      stopPlayback();
    } else {
      setHandsFree(false);
      startRecording();
    }
  };

  const currentStages = STAGES[provider] || STAGES.openrouter;
  const currentStage = currentStages[Math.min(stageIndex, currentStages.length - 1)];

  return (
    <div className="card" style={{ marginBottom: 24, padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 32 }}>🧠</div>
        <h2 style={{ fontSize: 24, margin: 0 }}>MirrorMind Intelligence</h2>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontWeight: 600 }}>
        Your personal academic and career intelligence assistant.
      </p>

      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
            AI Engine
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
            {provider === 'openrouter'
              ? '☁ Cloud AI — Fast, reliable, no local setup required.'
              : '💻 Local AI — qwen3:8b running on this machine. May be slower.'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10, textAlign: 'right' }}>
            Hands-Free Mode
          </div>
          <button
            type="button"
            onClick={() => {
              setHandsFree(!handsFree);
              if (!handsFree) {
                // Initialize audio to bypass autoplay policy
                const audio = new Audio();
                audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
                audio.volume = 0.01;
                audio.play().catch((err) => { console.error(`[MIRRORMIND][AUDIO][ERROR] Initial autoplay block:`, err) });
              }
            }}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
              border: handsFree ? '2px solid #52c41a' : '2px solid var(--border-color)',
              background: handsFree ? 'rgba(82,196,26,0.08)' : 'var(--bg-secondary)',
              color: handsFree ? '#52c41a' : 'var(--text-secondary)',
              boxShadow: handsFree ? '0 0 0 3px rgba(82,196,26,0.12)' : 'none',
              marginLeft: 'auto',
            }}
          >
            {handsFree ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {handsFree ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: 10, background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.3)' }}>
          <div style={{ fontWeight: 700, color: '#ff4d4f', marginBottom: 6, fontSize: 15 }}>
            {error.code === 'OLLAMA_TIMEOUT' && '⏱ Local Ollama timed out'}
            {error.code === 'OLLAMA_CONNECT_ERROR' && '🔌 Cannot connect to Local Ollama'}
            {error.code === 'OPENROUTER_TIMEOUT' && '⏱ OpenRouter timed out'}
            {!error.code && '❌ Request failed'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{error.message}</div>
          {error.detail && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{error.detail}</div>}
          {error.suggestion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{error.suggestion}</span>
              {(error.code === 'OLLAMA_TIMEOUT' || error.code === 'OLLAMA_CONNECT_ERROR') && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 14px', fontSize: 13, height: 'auto' }}
                  onClick={() => { setProvider('openrouter'); setError(null); }}
                >
                  ☁ Switch to OpenRouter
                </button>
              )}
              {error.code === 'OPENROUTER_TIMEOUT' && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 14px', fontSize: 13, height: 'auto' }}
                  onClick={() => { setProvider('ollama'); setError(null); }}
                >
                  💻 Switch to Local Ollama
                </button>
              )}
            </div>
          )}
        </div>
      )}

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
              backgroundColor: voiceState === 'LISTENING_FOR_QUERY' ? '#ff4d4f' : (voiceState === 'SPEAKING' || voiceState === 'GREETING' || voiceState === 'CONFIRMING_TTS') ? '#52c41a' : undefined,
              color: (voiceState === 'LISTENING_FOR_QUERY' || voiceState === 'SPEAKING' || voiceState === 'GREETING' || voiceState === 'CONFIRMING_TTS') ? '#fff' : undefined,
              border: (voiceState === 'LISTENING_FOR_QUERY' || voiceState === 'SPEAKING' || voiceState === 'GREETING' || voiceState === 'CONFIRMING_TTS') ? 'none' : undefined,
              transition: 'background-color 0.3s',
            }}
            disabled={voiceState === 'TRANSCRIBING' || voiceState === 'THINKING' || loading}
            title={voiceState === 'LISTENING_FOR_QUERY' ? 'Stop recording' : (voiceState === 'SPEAKING' || voiceState === 'GREETING' || voiceState === 'CONFIRMING_TTS') ? 'Stop speaking' : 'Use voice'}
          >
            {voiceState === 'LISTENING_FOR_QUERY' ? <Square size={24} /> : (voiceState === 'SPEAKING' || voiceState === 'GREETING' || voiceState === 'CONFIRMING_TTS') ? <Volume2 size={24} /> : <Mic size={24} />}
          </button>
        </div>

        {voiceState !== 'IDLE' && (
          <div style={{ marginTop: 8, fontSize: 14, color: voiceState === 'ERROR' ? '#ff4d4f' : 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {voiceState === 'WAKE_LISTENING' && handsFree && <><span style={{ backgroundColor: '#1890ff', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> ● Listening for "Hello MirrorMind"...</>}
            {voiceState === 'WAKE_DETECTED' && <><span style={{ backgroundColor: '#52c41a', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> ● Wake word detected</>}
            {voiceState === 'GREETING' && <><Volume2 size={14} /> 🔊 MirrorMind is greeting you...</>}
            {voiceState === 'LISTENING_FOR_QUERY' && <><span style={{ backgroundColor: '#ff4d4f', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> 🎤 Listening to you...</>}
            {voiceState === 'TRANSCRIBING' && <><Loader2 size={14} className="spin" /> 📝 Understanding your speech...</>}
            {voiceState === 'CONFIRMING_TTS' && <><Volume2 size={14} /> 🔊 Asking for confirmation...</>}
            {voiceState === 'AWAITING_CONFIRMATION' && <><span style={{ backgroundColor: '#fa8c16', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> ● You said: "{pendingTranscript}" — Should I proceed?</>}
            {voiceState === 'THINKING' && <><Loader2 size={14} className="spin" /> 🧠 MirrorMind is thinking...</>}
            {voiceState === 'SPEAKING' && <><Volume2 size={14} /> 🔊 MirrorMind is responding...</>}
            {voiceState === 'ERROR' && <span>{voiceError}</span>}
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
            Using <strong>{provider === 'ollama' ? 'Local Ollama · qwen3:8b' : 'OpenRouter'}</strong>
            {' '}· {elapsedTime}s elapsed
            {provider === 'ollama' && elapsedTime > 10 && (
              <span style={{ marginLeft: 8, color: '#fa8c16' }}>⚠ Local model may take 30–120s</span>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
}
"""

with open("frontend/src/components/Intelligence.jsx", "w", encoding="utf-8") as f:
    f.write(code)
