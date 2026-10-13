import { useEffect, useRef, useCallback } from 'react';
import { Loader2, Cloud, Monitor } from 'lucide-react';
import VoiceDiagnosticsPanel from './VoiceDiagnosticsPanel';
import NovaWaveVisualizer from './NovaWaveVisualizer';

// Maps voiceState → panel CSS modifier class
function panelClass(voiceState, wakeStatus) {
  if (voiceState === 'ERROR') return 'state-error';
  if (voiceState === 'WAKE_LISTENING') {
    return wakeStatus === 'RECONNECTING' ? 'state-reconnecting' : 'state-listening';
  }
  if (voiceState === 'WAKE_DETECTED') return 'state-detected';
  if (voiceState === 'NOVA_LIVE_ACTIVE') return 'state-nova-live';
  if (voiceState === 'NOVA_TOOL_CALLING') return 'state-thinking';
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

// ── Provider badge (inside panel) ──────────────────────────────────────────
function ProviderTag({ provider }) {
  if (!provider) return null;
  if (provider === 'gemini') {
    return (
      <span className="vsp-provider gemini" style={{ color: '#2563eb', background: 'rgba(37,99,235,0.08)' }}>
        ✨ Gemini 3.1 Flash Lite
      </span>
    );
  }
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

/**
 * VoiceStatePanel — renders the hands-free voice interface with the Nova fluid wave.
 */
export default function VoiceStatePanel({
  voiceState,
  wakeStatus,
  pendingTranscript,
  novaResponseText = '',
  provider,
  voiceError,
  diagnostics,
  liveAudioLevel = 0,
  liveSpeaker = 'idle',
  silenceSeconds = null,
  onEndLiveSession,
}) {
  const isNovaLive =
    voiceState === 'NOVA_LIVE_ACTIVE' ||
    voiceState === 'NOVA_TOOL_CALLING';

  const isWakeListening = voiceState === 'WAKE_LISTENING';

  const reconnecting =
    voiceState === 'WAKE_LISTENING' && wakeStatus === 'RECONNECTING';

  const pClass = panelClass(voiceState, wakeStatus);

  // ── State-specific header labels ─────────────────────────────────────────
  let icon, label, sublabel, extraContent;

  if (reconnecting) {
    icon = <span className="vsp-reconnect-icon">↻</span>;
    label = 'Reconnecting microphone…';
    sublabel = 'Will resume listening shortly';
  } else {
    switch (voiceState) {
      case 'WAKE_LISTENING':
        icon = '🟢';
        label = 'NOVA IS LISTENING';
        sublabel = 'Say "Hey Nova" or "Hello Nova" to talk';
        break;
      case 'WAKE_DETECTED':
        icon = '✨';
        label = 'Nova wake word detected!';
        sublabel = 'Connecting persistent audio stream…';
        break;
      case 'NOVA_LIVE_ACTIVE':
        icon = '🎙️';
        label = 'NOVA LIVE AUDIO STREAMING';
        sublabel = 'Talk naturally to update your portfolio, query RAG, or navigate';
        break;
      case 'NOVA_TOOL_CALLING':
        icon = '🛠️';
        label = 'Nova is taking action…';
        sublabel = 'Saving data via Gemini 3.1 Flash Lite';
        break;
      case 'GREETING':
        icon = '🔊';
        label = 'Nova is greeting you…';
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
    <div style={{ marginBottom: 20 }}>
      {/* ── Nova Voice Wave Visualizer (Matches Reference Images) ── */}
      {isNovaLive ? (
        <NovaWaveVisualizer
          active={true}
          amplitude={liveAudioLevel}
          speaker={liveSpeaker}
          height={160}
          silenceSeconds={silenceSeconds}
          onEndSession={onEndLiveSession}
        />
      ) : isWakeListening ? (
        <NovaWaveVisualizer
          active={false}
          amplitude={0}
          speaker="idle"
          height={90}
          silenceSeconds={null}
        />
      ) : null}

      <div className={`voice-state-panel ${pClass}`} role="status" aria-live="polite">
        {/* Header row: icon + label + mic badge */}
        <div className="vsp-header">
          <span className="vsp-icon">{icon}</span>
          <div style={{ flex: 1 }}>
            <div className="vsp-label">{label}</div>
            {sublabel && <div className="vsp-sublabel">{sublabel}</div>}
          </div>
          <MicBadge
            status={
              voiceState === 'ERROR' && wakeStatus === 'MIC_ERROR'
                ? 'MIC_ERROR'
                : isNovaLive || isWakeListening
                ? 'ACTIVE'
                : reconnecting
                ? 'RECONNECTING'
                : wakeStatus
            }
          />
        </div>

        {/* Live speech from user (shows words as user is talking) */}
        {pendingTranscript && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(37,99,235,0.06)',
              border: '1px solid rgba(37,99,235,0.25)',
              fontSize: 14,
              color: '#1e293b',
              lineHeight: 1.5,
              display: 'flex',
              gap: 8,
              alignItems: 'baseline',
            }}
          >
            <strong style={{ color: '#2563eb', flexShrink: 0 }}>🎙️ You:</strong>
            <span style={{ color: '#0f172a', fontWeight: 500 }}>"{pendingTranscript}"</span>
          </div>
        )}

        {/* Word-by-word streaming response from Nova */}
        {novaResponseText && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(0,242,254,0.08) 0%, rgba(37,99,235,0.06) 100%)',
              border: '1px solid rgba(0,242,254,0.3)',
              fontSize: 14,
              color: '#0f172a',
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: '#0284c7', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✨ Nova:</span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{novaResponseText}</div>
          </div>
        )}

        {/* Extra content (transcript, provider badge) */}
        {extraContent}
      </div>

      {diagnostics && <VoiceDiagnosticsPanel diagnostics={diagnostics} />}
    </div>
  );
}
