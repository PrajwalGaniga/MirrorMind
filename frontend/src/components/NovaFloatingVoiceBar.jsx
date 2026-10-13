import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Square, Loader2, ChevronRight, CheckCircle2, Sparkles, X, Volume2, Mic } from 'lucide-react';
import { useNova } from '../context/NovaContext';

export default function NovaFloatingVoiceBar() {
  const navigate = useNavigate();
  const {
    assistantState,
    liveText,
    audioLevel,
    stopSpeaking,
    activeTool,
    toolProgress,
    isVoiceActive,
    openNova,
  } = useNova();

  const [showDetailPopover, setShowDetailPopover] = useState(false);

  // Automatically display live field progress popover when a project is being populated
  useEffect(() => {
    if (activeTool === 'add_project' || toolProgress?.fields) {
      setShowDetailPopover(true);
    }
  }, [activeTool, toolProgress]);

  // Generate 20 wave bar heights dynamically based on audioLevel
  const numBars = 20;
  const [waveHeights, setWaveHeights] = useState(() => Array(numBars).fill(6));

  useEffect(() => {
    if (assistantState === 'speaking' || assistantState === 'listening') {
      const level = Math.max(0.12, Math.min(1.0, (audioLevel || 0) * 3.5));
      const newHeights = Array.from({ length: numBars }, (_, idx) => {
        // Bell-curve distribution for natural audio visualizer look
        const distFromCenter = Math.abs(idx - numBars / 2) / (numBars / 2);
        const bellFactor = Math.cos(distFromCenter * (Math.PI / 2.2));
        const randomJitter = 0.8 + Math.random() * 0.4;
        const h = Math.round(6 + level * 28 * bellFactor * randomJitter);
        return Math.max(5, Math.min(36, h));
      });
      setWaveHeights(newHeights);
    } else {
      setWaveHeights(Array(numBars).fill(6));
    }
  }, [audioLevel, assistantState]);

  // If voice is inactive and no active tool, hide the floating bar
  if (!isVoiceActive && !activeTool && assistantState === 'idle') {
    return null;
  }

  // Display text: either live spoken stream from Gemini, or active tool message
  const displayText =
    liveText ||
    toolProgress?.message ||
    (activeTool === 'add_project'
      ? "Sure, I'm adding that project for you. I'll set it up with the right tech stack and update your dashboard."
      : activeTool === 'switch_to_interview_mode'
      ? 'Right away! Switching to technical mock interview mode with Alex.'
      : 'Ready. How can I help you?');

  const progressLabel =
    activeTool === 'add_project'
      ? 'Adding Project...'
      : activeTool === 'switch_to_interview_mode'
      ? 'Opening Interview...'
      : assistantState === 'processing'
      ? 'Processing...'
      : 'Active >';

  return (
    <div style={styles.floatingContainer}>
      {/* Live Detail Popover when user clicks the progress pill or when project is filling */}
      {showDetailPopover && (
        <div style={styles.popoverCard}>
          <div style={styles.popoverHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="#38BDF8" />
              <span style={styles.popoverTitle}>
                {activeTool === 'add_project' ? 'Adding Project Details' : 'Nova Background Task'}
              </span>
            </div>
            <button style={styles.popoverClose} onClick={() => setShowDetailPopover(false)}>
              <X size={14} />
            </button>
          </div>

          {activeTool === 'add_project' && toolProgress?.fields ? (
            <div style={styles.fieldsContainer}>
              <div style={styles.fieldRow}>
                <span style={styles.fieldKey}>Title:</span>
                <span style={styles.fieldVal}>{toolProgress.fields.title || 'Detecting...'}</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldKey}>Tech Stack:</span>
                <div style={styles.techTagsRow}>
                  {(toolProgress.fields.tech_stack || []).length > 0 ? (
                    toolProgress.fields.tech_stack.map((t, i) => (
                      <span key={i} style={styles.techTag}>
                        {t}
                      </span>
                    ))
                  ) : (
                    <span style={styles.fieldValMuted}>Extracting stack...</span>
                  )}
                </div>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldKey}>Description:</span>
                <span style={styles.fieldValDesc}>
                  {toolProgress.fields.description || 'Configuring project summary...'}
                </span>
              </div>
              <div style={styles.popoverFooter}>
                <CheckCircle2 size={13} color="#10B981" />
                <span>MongoDB & Semantic RAG Synced</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '8px 0', fontSize: '12px', color: '#94A3B8' }}>
              {toolProgress?.message || 'Co-pilot is executing this operation live.'}
            </div>
          )}
        </div>
      )}

      {/* Main Pill Frame */}
      <div style={styles.pillFrame}>
        {/* Left: Mascot Avatar & Spoken Transcript */}
        <div style={styles.leftSection} onClick={openNova} title="Click to open Nova Assistant">
          {/* Circular mascot avatar */}
          <div style={styles.avatarHalo}>
            <div style={styles.avatarCircle}>
              {/* Cute Nova Robot Face SVG */}
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Headset arc */}
                <path d="M7 19C7 12.3726 12.3726 7 19 7C25.6274 7 31 12.3726 31 19" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
                {/* Left earcup */}
                <rect x="4" y="16" width="5" height="10" rx="2.5" fill="#38BDF8" />
                {/* Right earcup */}
                <rect x="29" y="16" width="5" height="10" rx="2.5" fill="#38BDF8" />
                {/* Head shape */}
                <rect x="8.5" y="11" width="21" height="18" rx="9" fill="#1E293B" stroke="#60A5FA" strokeWidth="1.5" />
                {/* Glowing cyan eyes */}
                <ellipse cx="14" cy="19" rx="2.4" ry="2.8" fill="#38BDF8" />
                <ellipse cx="24" cy="19" rx="2.4" ry="2.8" fill="#38BDF8" />
                {/* Friendly smile */}
                <path d="M16 23C17 24.2 21 24.2 22 23" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Transcript text block */}
          <div style={styles.textBlock}>
            <div style={styles.nameRow}>
              <span style={styles.novaName}>Nova</span>
              <span style={styles.statusDot} />
              <span style={styles.statusLabel}>
                {assistantState === 'speaking'
                  ? 'Speaking...'
                  : assistantState === 'listening'
                  ? 'Listening...'
                  : assistantState === 'processing'
                  ? 'Processing...'
                  : 'Ready'}
              </span>
            </div>
            <div style={styles.liveSubtitle}>{displayText}</div>
          </div>
        </div>

        {/* Center: Dynamic Audio Waveform */}
        <div style={styles.waveformContainer}>
          {waveHeights.map((h, idx) => (
            <div
              key={idx}
              style={{
                ...styles.waveBar,
                height: `${h}px`,
                opacity: assistantState === 'idle' ? 0.35 : 0.9,
              }}
            />
          ))}
        </div>

        {/* Right: Stop Button & Action Pill */}
        <div style={styles.rightSection}>
          {/* Stop / Interrupt Button */}
          <button
            style={styles.stopButton}
            onClick={stopSpeaking}
            title="Interrupt / Stop Nova Speaking"
          >
            <div style={styles.stopSquare} />
          </button>

          {/* Processing / Progress Pill */}
          <button
            style={styles.progressPill}
            onClick={() => setShowDetailPopover((prev) => !prev)}
            title="Click to view real-time field progress"
          >
            <Loader2 size={13} className="spin" color="#38BDF8" />
            <span>{progressLabel}</span>
            <ChevronRight size={13} color="#94A3B8" />
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  floatingContainer: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9998,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'auto',
    animation: 'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  pillFrame: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    padding: '10px 20px',
    minWidth: '580px',
    maxWidth: '860px',
    width: '64vw',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    boxShadow: '0 12px 40px rgba(15, 23, 42, 0.4), 0 0 25px rgba(37, 99, 235, 0.22)',
    borderRadius: '9999px',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  },
  avatarHalo: {
    position: 'relative',
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(37, 99, 235, 0.1) 70%)',
    border: '1.5px solid rgba(56, 189, 248, 0.6)',
    boxShadow: '0 0 16px rgba(56, 189, 248, 0.35)',
    flexShrink: 0,
  },
  avatarCircle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
    overflow: 'hidden',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  },
  novaName: {
    fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
    fontSize: '13.5px',
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: '-0.01em',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#38BDF8',
    boxShadow: '0 0 8px #38BDF8',
    display: 'inline-block',
  },
  statusLabel: {
    fontSize: '11.5px',
    fontWeight: '600',
    color: '#38BDF8',
  },
  liveSubtitle: {
    fontSize: '12.5px',
    lineHeight: '1.35',
    color: '#E2E8F0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '380px',
  },
  waveformContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    height: '38px',
    padding: '0 10px',
    flexShrink: 0,
  },
  waveBar: {
    width: '3px',
    borderRadius: '3px',
    background: 'linear-gradient(180deg, #38BDF8 0%, #2563EB 100%)',
    transition: 'height 0.08s ease, opacity 0.2s',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  stopButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 14px rgba(37, 99, 235, 0.45)',
    transition: 'transform 0.15s, background-color 0.15s',
  },
  stopSquare: {
    width: '11px',
    height: '11px',
    backgroundColor: '#FFFFFF',
    borderRadius: '2.5px',
  },
  progressPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    height: '34px',
    padding: '0 13px',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    borderRadius: '9999px',
    color: '#E2E8F0',
    fontSize: '11.5px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  popoverCard: {
    marginBottom: '10px',
    width: '360px',
    backgroundColor: '#0F172A',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '16px',
    padding: '14px 18px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(37, 99, 235, 0.2)',
    animation: 'fadeInUp 0.2s ease-out',
    alignSelf: 'flex-end',
  },
  popoverHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(51, 65, 85, 0.6)',
    paddingBottom: '8px',
    marginBottom: '10px',
  },
  popoverTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#F8FAFC',
  },
  popoverClose: {
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  fieldKey: {
    fontSize: '10.5px',
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  fieldVal: {
    fontSize: '12.5px',
    fontWeight: '600',
    color: '#F1F5F9',
  },
  fieldValDesc: {
    fontSize: '11.5px',
    color: '#94A3B8',
    lineHeight: '1.4',
  },
  fieldValMuted: {
    fontSize: '11.5px',
    color: '#64748B',
    fontStyle: 'italic',
  },
  techTagsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '2px',
  },
  techTag: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '12px',
    padding: '2px 8px',
  },
  popoverFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '6px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(51, 65, 85, 0.4)',
    fontSize: '10.5px',
    fontWeight: '600',
    color: '#10B981',
  },
};
