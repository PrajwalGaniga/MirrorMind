import { useEffect, useRef, useCallback } from 'react';
import { Loader2, Cloud, Monitor } from 'lucide-react';
import { audioMeter } from '../utils/audio-meter';
import VoiceDiagnosticsPanel from './VoiceDiagnosticsPanel';

// ── Constants ──────────────────────────────────────────────────────────────
const BAR_COUNT = 10;

// Maps voiceState → panel CSS modifier class
function panelClass(voiceState, wakeStatus) {
  if (voiceState === 'ERROR') return 'state-error';
  if (voiceState === 'WAKE_LISTENING') {
    return wakeStatus === 'RECONNECTING' ? 'state-reconnecting' : 'state-listening';
  }
  if (voiceState === 'WAKE_DETECTED') return 'state-detected';
  if (voiceState === 'GREETING') return 'state-speaking';
  if (voiceState === 'LISTENING_FOR_QUERY') return 'state-listening';
  if (voiceState === 'TRANSCRIBING') return 'state-thinking';
  if (voiceState === 'CONFIRMING_TTS') return 'state-confirming';
  if (voiceState === 'AWAITING_CONFIRMATION') return 'state-confirming';
  if (voiceState === 'THINKING') return 'state-thinking';
  if (voiceState === 'SPEAKING') return 'state-speaking';
  if (voiceState === 'SPEECH_PAUSED') return 'state-confirming';
  if (voiceState === 'ACTION_COLLECTING') return 'state-action-collect';
  if (voiceState === 'ACTION_PREVIEW') return 'state-action-preview';
  if (voiceState === 'AWAITING_ACTION_CONFIRM') return 'state-confirming';
  if (voiceState === 'ACTION_EXECUTING') return 'state-thinking';
  return '';
}

// ── Mic badge ─────────────────────────────────────────────────────────────
function MicBadge({ status }) {
  const configs = {
    ACTIVE:      { cls: 'active',   label: 'MIC ACTIVE',   dot: true  },
    RECONNECTING:{ cls: 'starting', label: 'RECONNECTING', dot: false },
    STOPPED:     { cls: 'off',      label: 'MIC OFF',      dot: false },
    MIC_ERROR:   { cls: 'error',    label: 'MIC ERROR',    dot: false },
  };
  const cfg = configs[status] || configs.STOPPED;
  return (
    <span className={`mic-badge ${cfg.cls}`}>
      {cfg.dot && <span className="mic-badge-dot" />}
      {cfg.label}
    </span>
  );
}

// ── Live audio meter ────────────────────────────────────────────────────────
function AudioMeter({ active }) {
  const barsRef = useRef([]);
  const rafRef  = useRef(null);

  const animate = useCallback(() => {
    if (!active) return;
    const level = audioMeter.getLevel(); // 0–1
    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      // Create a natural-looking bar pattern centred on i=BAR_COUNT/2
      const offset = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2); // 0 at centre
      const noise  = (Math.random() * 0.15);                         // tiny flicker
      const height = Math.max(3, (level * (1 - offset * 0.5) + noise) * 30);
      bar.style.height = `${height}px`;
    });
    rafRef.current = requestAnimationFrame(animate);
  }, [active]);

  useEffect(() => {
    if (active) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Reset bars to baseline
      barsRef.current.forEach(bar => { if (bar) bar.style.height = '3px'; });
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, animate]);

  return (
    <div className="audio-meter" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          className="audio-meter-bar"
          ref={el => { barsRef.current[i] = el; }}
          style={{ height: '3px' }}
        />
      ))}
    </div>
  );
}

// ── Provider badge (inside panel) ──────────────────────────────────────────
function ProviderTag({ provider }) {
  if (!provider) return null;
  if (provider === 'ollama') {
    return (
      <span className="vsp-provider ollama">
        <Monitor size={11} /> Local Ollama
      </span>
    );
  }
  return (
    <span className="vsp-provider openrouter">
      <Cloud size={11} /> OpenRouter
    </span>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────
/**
 * VoiceStatePanel — renders the full voice-state UI when Hands-Free mode is ON.
 *
 * Props:
 *   voiceState        string  — current voice FSM state
 *   wakeStatus        string  — ACTIVE | RECONNECTING | STOPPED | MIC_ERROR
 *   pendingTranscript string  — transcript waiting for confirmation
 *   provider          string  — 'openrouter' | 'ollama'
 *   voiceError        string  — error message when voiceState === 'ERROR'
 *   diagnostics       object  — voice pipeline debug info
 */
export default function VoiceStatePanel({
  voiceState,
  wakeStatus,
  pendingTranscript,
  provider,
  voiceError,
  diagnostics
}) {
  const meterActive =
    voiceState === 'WAKE_LISTENING' ||
    voiceState === 'LISTENING_FOR_QUERY' ||
    voiceState === 'ACTION_COLLECTING';

  const reconnecting =
    voiceState === 'WAKE_LISTENING' && wakeStatus === 'RECONNECTING';

  const pClass = panelClass(voiceState, wakeStatus);

  // ── State-specific content ───────────────────────────────────────────────
  let icon, label, sublabel, extraContent;

  if (reconnecting) {
    icon = <span className="vsp-reconnect-icon">↻</span>;
    label = 'Reconnecting microphone…';
    sublabel = 'Will resume listening shortly';
  } else {
    switch (voiceState) {
      case 'WAKE_LISTENING':
        icon = '🟢';
        label = 'MIRRORMIND IS LISTENING';
        sublabel = 'Say "Hello MirrorMind"';
        break;
      case 'WAKE_DETECTED':
        icon = '✨';
        label = 'Wake word detected!';
        sublabel = 'Getting ready…';
        break;
      case 'GREETING':
        icon = '🔊';
        label = 'MirrorMind is greeting you…';
        break;
      case 'LISTENING_FOR_QUERY':
        icon = '🎤';
        label = 'Listening for your question…';
        sublabel = 'Speak now';
        break;
      case 'TRANSCRIBING':
        icon = <Loader2 size={20} className="spin" />;
        label = 'Understanding what you said…';
        break;
      case 'CONFIRMING_TTS':
        icon = '🔊';
        label = 'Reading back your query…';
        break;
      case 'AWAITING_CONFIRMATION':
        icon = '❓';
        label = 'Waiting for your confirmation';
        sublabel = 'Say "yes" to proceed · "no" to cancel';
        if (pendingTranscript) {
          extraContent = (
            <div className="vsp-transcript">
              <strong>You said:</strong> "{pendingTranscript}"
            </div>
          );
        }
        break;
      case 'ACTION_COLLECTING':
        icon = '📝';
        label = 'MirrorMind is taking notes…';
        sublabel = 'Speak your answer';
        break;
      case 'ACTION_PREVIEW':
        icon = '🔊';
        label = 'Reading back your action…';
        break;
      case 'AWAITING_ACTION_CONFIRM':
        icon = '❓';
        label = 'Ready to save?';
        sublabel = 'Say "yes" to confirm or "no" to cancel';
        break;
      case 'ACTION_EXECUTING':
        icon = <Loader2 size={20} className="spin" />;
        label = 'Saving your changes…';
        break;
      case 'THINKING':
        icon = <Loader2 size={20} className="spin" />;
        label = 'MirrorMind is thinking…';
        extraContent = <ProviderTag provider={provider} />;
        break;
      case 'SPEAKING':
        icon = '🔊';
        label = 'MirrorMind is speaking…';
        sublabel = 'Say "stop" to interrupt · "pause" to pause';
        extraContent = <ProviderTag provider={provider} />;
        break;
      case 'SPEECH_PAUSED':
        icon = '⏸';
        label = 'Response paused';
        sublabel = 'Say "continue" or "resume" to carry on';
        break;
      case 'ERROR':
        icon = '⚠';
        label = voiceError || 'An error occurred';
        break;
      default:
        icon = '●';
        label = voiceState;
    }
  }

  return (
    <div>
      <div className={`voice-state-panel ${pClass}`} role="status" aria-live="polite">
        {/* Header row: icon + label + mic badge */}
        <div className="vsp-header">
          <span className="vsp-icon">{icon}</span>
          <div style={{ flex: 1 }}>
            <div className="vsp-label">{label}</div>
            {sublabel && <div className="vsp-sublabel">{sublabel}</div>}
          </div>
          <MicBadge status={
            voiceState === 'ERROR' && wakeStatus === 'MIC_ERROR' ? 'MIC_ERROR' :
            meterActive ? 'ACTIVE' :
            reconnecting ? 'RECONNECTING' :
            wakeStatus
          } />
        </div>

        {/* Live audio meter — only when mic is actually open */}
        {meterActive && <AudioMeter active={meterActive} />}

        {/* Extra content (transcript, provider badge) */}
        {extraContent}
      </div>
      
      {diagnostics && <VoiceDiagnosticsPanel diagnostics={diagnostics} />}
    </div>
  );
}
