import re

file_path = "frontend/src/components/Intelligence.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { Mic, MicOff, Loader2, Volume2, Square, Cloud, Monitor } from 'lucide-react';",
    "import { Mic, MicOff, Loader2, Volume2, Square, Cloud, Monitor, ToggleRight, ToggleLeft } from 'lucide-react';"
)
content = content.replace(
    "import { AudioRecorder } from '../utils/record-audio';",
    "import { AudioRecorder } from '../utils/record-audio';\nimport { useAuth } from '../context/AuthContext';"
)

# 2. State definition
old_state = """  const [elapsedTime, setElapsedTime] = useState(0);

  // Voice state
  const [voiceState, setVoiceState] = useState('IDLE');
  const [voiceError, setVoiceError] = useState('');

  const recorderRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const timerRef = useRef(null);
  const stageTimerRef = useRef(null);"""

new_state = """  const [elapsedTime, setElapsedTime] = useState(0);

  // Voice state
  const { user } = useAuth();
  const [handsFree, setHandsFree] = useState(false);
  const [voiceState, setVoiceState] = useState('IDLE');
  const [voiceError, setVoiceError] = useState('');

  const recorderRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const timerRef = useRef(null);
  const stageTimerRef = useRef(null);
  const recognitionRef = useRef(null);

  const voiceStateRef = useRef(voiceState);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  
  const handsFreeRef = useRef(handsFree);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);

  useEffect(() => {
    if (handsFree) {
      startWakeWordListener();
    } else {
      stopWakeWordListener();
      if (voiceState !== 'IDLE') stopPlayback();
      setVoiceState('IDLE');
    }
    return () => stopWakeWordListener();
  }, [handsFree]);

  const startWakeWordListener = () => {
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
        const currentVoiceState = voiceStateRef.current;
        if (currentVoiceState !== 'WAKE_LISTENING' && currentVoiceState !== 'IDLE') return;

        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.trim().toLowerCase();
        const cleanTranscript = transcript.replace(/[.,!?]/g, '');

        if (cleanTranscript.includes('hello mirrormind') || cleanTranscript.includes('hello mirror mind')) {
          handleWakeWordDetected();
        }
      };

      recognitionRef.current.onend = () => {
        if (handsFreeRef.current) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      };
    }
    
    try {
      recognitionRef.current.start();
      setVoiceState('WAKE_LISTENING');
    } catch (e) {}
  };

  const stopWakeWordListener = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
  };

  const handleWakeWordDetected = async () => {
    setVoiceState('WAKE_DETECTED');
    setResult(null);
    setQuestion('');
    stopWakeWordListener(); // Avoid hearing itself
    
    const greetingText = `Hello ${user?.name || 'there'}, how can I help you?`;
    try {
      setVoiceState('GREETING');
      const response = await api.post('/api/voice/synthesize', { text: greetingText }, { responseType: 'blob' });
      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        startRecording(true);
      };
      await audio.play();
    } catch (err) {
      startRecording(true);
    }
  };"""

content = content.replace(old_state, new_state)

# 3. HandleAsk error recovery
old_handle_ask_error = """      setVoiceState(voiceState !== 'IDLE' ? 'ERROR' : 'IDLE');
    } finally {"""

new_handle_ask_error = """      setVoiceState(voiceState !== 'IDLE' ? 'ERROR' : 'IDLE');
      if (handsFreeRef.current) {
        setTimeout(() => {
          if (handsFreeRef.current) {
            setVoiceState('WAKE_LISTENING');
            startWakeWordListener();
          }
        }, 3000);
      }
    } finally {"""

content = content.replace(old_handle_ask_error, new_handle_ask_error)

# 4. startRecording
old_start_recording = """  const startRecording = async () => {
    try {
      setVoiceError('');
      setVoiceState('LISTENING');
      setResult(null);
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();
    } catch (err) {
      setVoiceError('Microphone permission denied or unavailable.');
      setVoiceState('ERROR');
    }
  };"""

new_start_recording = """  const startRecording = async (useSilenceDetection = false) => {
    try {
      setVoiceError('');
      setVoiceState('LISTENING');
      setResult(null);
      recorderRef.current = new AudioRecorder();
      
      if (useSilenceDetection) {
        recorderRef.current.onSilence = () => {
          stopRecording();
        };
        recorderRef.current.onMaxDuration = () => {
          stopRecording();
        };
      }
      
      await recorderRef.current.start();
    } catch (err) {
      setVoiceError('Microphone permission denied or unavailable.');
      setVoiceState('ERROR');
      if (handsFreeRef.current) {
        setHandsFree(false);
      }
    }
  };"""

content = content.replace(old_start_recording, new_start_recording)

# 5. stopRecording Error Recovery
old_stop_recording_err = """    } catch (err) {
      setVoiceError(err.response?.data?.detail || err.message || 'Transcription failed.');
      setVoiceState('ERROR');
    }
  };"""

new_stop_recording_err = """    } catch (err) {
      setVoiceError(err.response?.data?.detail || err.message || 'Transcription failed.');
      setVoiceState('ERROR');
      if (handsFreeRef.current) {
        setTimeout(() => {
          if (handsFreeRef.current) {
            setVoiceState('WAKE_LISTENING');
            startWakeWordListener();
          }
        }, 3000);
      }
    }
  };"""

content = content.replace(old_stop_recording_err, new_stop_recording_err)

# 6. synthesizeAndPlay recovery
old_synth_and_play = """      audio.onended = () => { setVoiceState('IDLE'); URL.revokeObjectURL(audioUrl); };
      await audio.play();
    } catch (err) {
      setVoiceError('Audio playback failed.');
      setVoiceState('ERROR');
    }
  };"""

new_synth_and_play = """      audio.onended = () => { 
        URL.revokeObjectURL(audioUrl); 
        if (handsFreeRef.current) {
          setVoiceState('WAKE_LISTENING');
          startWakeWordListener();
        } else {
          setVoiceState('IDLE'); 
        }
      };
      await audio.play();
    } catch (err) {
      setVoiceError('Audio playback failed.');
      setVoiceState('ERROR');
      if (handsFreeRef.current) {
        setTimeout(() => {
          if (handsFreeRef.current) {
            setVoiceState('WAKE_LISTENING');
            startWakeWordListener();
          }
        }, 3000);
      }
    }
  };"""

content = content.replace(old_synth_and_play, new_synth_and_play)

# 7. stopPlayback
old_stop_playback = """  const stopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    setVoiceState('IDLE');
  };"""

new_stop_playback = """  const stopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    if (handsFreeRef.current) {
      setVoiceState('WAKE_LISTENING');
      startWakeWordListener();
    } else {
      setVoiceState('IDLE');
    }
  };"""

content = content.replace(old_stop_playback, new_stop_playback)

# 8. Render Top Actions (Hands Free Toggle)
old_ai_engine = """      {/* ── AI Engine Selector ── */}
      <div style={{ marginBottom: 28 }}>"""

new_ai_engine = """      {/* ── AI Engine & Hands-Free Selector ── */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
            AI Engine
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* OpenRouter button */}
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

            {/* Local Ollama button */}
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
            onClick={() => setHandsFree(!handsFree)}
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
      </div>"""

# Remove the original AI engine part since we replaced it with the wrapper
content = content.replace(old_ai_engine, new_ai_engine)
content = content.replace("""        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* OpenRouter button */}""", "") # We already included it

# We need to be careful with the string replacement. Let's do it via regex
content = re.sub(r"\{\/\* ── AI Engine Selector ── \*\/\}[\s\S]*?(?=\{\/\* ── Error display ── \*\/|\{\/\* ── Input form ── \*\/)", new_ai_engine + "\n\n      ", content, 1)

# 9. Voice UI updates
old_voice_ui = """        {/* Voice status */}
        {voiceState !== 'IDLE' && (
          <div style={{ marginTop: 8, fontSize: 14, color: voiceState === 'ERROR' ? '#ff4d4f' : 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {voiceState === 'LISTENING' && <><span style={{ backgroundColor: '#ff4d4f', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> Listening... Click to stop</>}
            {voiceState === 'TRANSCRIBING' && <><Loader2 size={14} className="spin" /> Processing your voice...</>}
            {voiceState === 'THINKING' && <><Loader2 size={14} className="spin" /> MirrorMind is thinking...</>}
            {voiceState === 'SPEAKING' && <><Volume2 size={14} /> MirrorMind is responding...</>}
            {voiceState === 'ERROR' && <span>Error: {voiceError}</span>}
          </div>
        )}"""

new_voice_ui = """        {/* Voice status */}
        {voiceState !== 'IDLE' && (
          <div style={{ marginTop: 8, fontSize: 14, color: voiceState === 'ERROR' ? '#ff4d4f' : 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {voiceState === 'WAKE_LISTENING' && handsFree && <><span style={{ backgroundColor: '#1890ff', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> Say "Hello MirrorMind"</>}
            {voiceState === 'WAKE_DETECTED' && <><span style={{ backgroundColor: '#52c41a', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> Wake word detected!</>}
            {voiceState === 'GREETING' && <><Volume2 size={14} /> MirrorMind is greeting...</>}
            {voiceState === 'LISTENING' && <><span style={{ backgroundColor: '#ff4d4f', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> Listening... {handsFree ? '(Auto-stops on silence)' : 'Click to stop'}</>}
            {voiceState === 'TRANSCRIBING' && <><Loader2 size={14} className="spin" /> Processing your voice...</>}
            {voiceState === 'THINKING' && <><Loader2 size={14} className="spin" /> MirrorMind is thinking...</>}
            {voiceState === 'SPEAKING' && <><Volume2 size={14} /> MirrorMind is responding...</>}
            {voiceState === 'ERROR' && <span>Error: {voiceError}</span>}
          </div>
        )}"""

content = content.replace(old_voice_ui, new_voice_ui)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
