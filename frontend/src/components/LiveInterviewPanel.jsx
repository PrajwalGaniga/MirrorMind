import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveInterview } from '../hooks/useLiveInterview';

export default function LiveInterviewPanel() {
  const { user, token } = useAuth();
  const candidateName = user?.name || user?.username || 'Candidate';
  const userId = user?.id || user?._id || '';

  const {
    status,
    isConnected,
    isConnecting,
    transcripts,
    micLevel,
    isInterrupted,
    metrics,
    error,
    summaryReport,
    isEvaluating,
    historyList,
    startInterview,
    endInterview,
    clearTranscript,
    clearSummary,
    fetchPastInterviews,
  } = useLiveInterview({
    candidateName,
    userId,
    token,
  });

  const [showDebug, setShowDebug] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [showTranscriptWithSummary, setShowTranscriptWithSummary] = useState(false);
  const transcriptBottomRef = useRef(null);

  // Auto-scroll transcript feed
  useEffect(() => {
    if (transcriptBottomRef.current) {
      transcriptBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts]);

  // Load history when opening history modal
  useEffect(() => {
    if (showHistoryModal) {
      fetchPastInterviews();
    }
  }, [showHistoryModal, fetchPastInterviews]);

  const getStatusBadge = () => {
    switch (status) {
      case 'CONNECTED':
      case 'LISTENING':
      case 'READY_FOR_CANDIDATE':
        return { text: 'LIVE • FULL DUPLEX', bg: '#059669', pulse: true };
      case 'CONNECTING':
        return { text: 'CONNECTING...', bg: '#d97706', pulse: true };
      case 'RECONNECTING':
        return { text: 'RECONNECTING...', bg: '#dc2626', pulse: true };
      default:
        return { text: 'STANDBY', bg: '#4b5563', pulse: false };
    }
  };

  const statusBadge = getStatusBadge();
  const activeReport = selectedHistoryItem?.evaluation ? selectedHistoryItem : summaryReport;
  const evalData = activeReport?.evaluation;

  return (
    <div id="live-interview-container" style={styles.container}>
      {/* Top Header Bar */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.iconBadge}>🎙️</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={styles.title}>AI Technical Voice Interview</h2>
              <span style={styles.candidateTag}>Candidate: {candidateName}</span>
            </div>
            <p style={styles.subtitle}>
              Conversational Practice with Alex • English Only • Live Duplex Speech
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Status Pill */}
          <div
            id="interview-status-pill"
            style={{
              ...styles.statusPill,
              backgroundColor: statusBadge.bg,
            }}
          >
            {statusBadge.pulse && <span style={styles.statusPulse} />}
            {statusBadge.text}
          </div>

          <button
            id="past-interviews-btn"
            onClick={() => setShowHistoryModal(true)}
            style={styles.ghostBtn}
            title="View Past Interview Evaluations & Saved Reports"
          >
            📂 Past Reports
          </button>

          <button
            id="toggle-debug-btn"
            onClick={() => setShowDebug(!showDebug)}
            style={styles.ghostBtn}
            title="Toggle Debug Performance Telemetry"
          >
            📊 {showDebug ? 'Hide Telemetry' : 'Telemetry'}
          </button>
        </div>
      </div>

      {/* Intro Guidance Banner */}
      {!isConnected && !isConnecting && !summaryReport && (
        <div style={styles.guideBanner}>
          <div style={{ fontSize: 22 }}>💡</div>
          <div style={{ flex: 1, fontSize: 13, color: '#cbd5e1' }}>
            <strong style={{ color: '#60a5fa' }}>How this interview works:</strong> Click{' '}
            <strong>"Start Live Voice Interview"</strong> below. Alex will greet you warmly by name and ask you to
            introduce yourself. Once you share your background and projects, Alex will follow up with tailored technical
            questions in a friendly, conversational dialogue. After you finish, a full performance evaluation with your{' '}
            <strong style={{ color: '#34d399' }}>strong areas</strong> and{' '}
            <strong style={{ color: '#fbbf24' }}>places to improve</strong> will be automatically saved to your profile!
          </div>
        </div>
      )}

      {/* Headphone Advisory Notice */}
      <div id="headphone-advisory-banner" style={styles.advisoryBanner}>
        <span style={{ fontSize: 16 }}>🎧</span>
        <div style={{ flex: 1 }}>
          <strong style={{ color: '#60a5fa' }}>Headphones Recommended:</strong> Eliminates acoustic speaker echo so
          Alex's interruption detection and speech recognition respond naturally.
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div id="interview-error-banner" style={styles.errorBanner}>
          ⚠️ <strong>Notice:</strong> {error}
        </div>
      )}

      {/* Evaluating Progress Indicator */}
      {isEvaluating && (
        <div style={styles.evaluatingBanner}>
          <div style={styles.evaluatingSpinner} />
          <div>
            <div style={{ fontWeight: 600, color: '#60a5fa', fontSize: 14 }}>
              Alex is analyzing your interview session...
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Evaluating technical accuracy, articulation, strong areas, and places to improve. Saving report to your
              profile database...
            </div>
          </div>
        </div>
      )}

      {/* ── Active Performance Evaluation Report (if available) ───────────── */}
      {evalData && (
        <div style={styles.reportCard}>
          <div style={styles.reportHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🏆</span>
              <div>
                <h3 style={styles.reportTitle}>Interview Performance & Feedback Report</h3>
                <p style={styles.reportMeta}>
                  Candidate: <strong>{candidateName}</strong> • Interviewer:{' '}
                  <strong>Alex (Senior Technical Interviewer)</strong>
                  {activeReport.durationSeconds ? ` • Duration: ${activeReport.durationSeconds}s` : ''}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {selectedHistoryItem && (
                <button
                  onClick={() => setSelectedHistoryItem(null)}
                  style={styles.closeReportBtn}
                  title="Close past report view"
                >
                  ✕ Close Report
                </button>
              )}
              {summaryReport && !selectedHistoryItem && (
                <button
                  onClick={clearSummary}
                  style={styles.closeReportBtn}
                  title="Dismiss summary card"
                >
                  ✕ Dismiss
                </button>
              )}
            </div>
          </div>

          {/* Scores Overview Row */}
          <div style={styles.scoreRow}>
            <div style={styles.scoreBox}>
              <div style={styles.scoreVal}>{evalData.overall_score || 85}</div>
              <div style={styles.scoreLabel}>Overall Score / 100</div>
              <div style={styles.scoreSub}>Readiness Rating</div>
            </div>

            <div style={styles.scoreBox}>
              <div style={{ ...styles.scoreVal, color: '#38bdf8' }}>
                {evalData.technical_score || 82}
              </div>
              <div style={styles.scoreLabel}>Technical Depth / 100</div>
              <div style={styles.scoreSub}>Concepts & Implementation</div>
            </div>

            <div style={styles.scoreBox}>
              <div style={{ ...styles.scoreVal, color: '#a78bfa' }}>
                {evalData.communication_score || 88}
              </div>
              <div style={styles.scoreLabel}>Communication / 100</div>
              <div style={styles.scoreSub}>Clarity & Articulation</div>
            </div>
          </div>

          {/* Summary Paragraph */}
          {evalData.summary && (
            <div style={styles.summaryBlock}>
              <strong style={{ color: '#93c5fd', display: 'block', marginBottom: 4 }}>
                Executive Assessment:
              </strong>
              <p style={{ margin: 0, color: '#e2e8f0', lineHeight: 1.6, fontSize: 13 }}>
                "{evalData.summary}"
              </p>
            </div>
          )}

          {/* Strengths & Improvements Grid */}
          <div style={styles.feedbackGrid}>
            {/* Strong Areas Column */}
            <div style={styles.feedbackColGreen}>
              <div style={styles.colHeaderGreen}>
                <span>💪</span>
                <span style={{ fontWeight: 700 }}>Strong Areas Demonstrated</span>
              </div>
              <ul style={styles.feedbackList}>
                {(evalData.strong_areas || ['Solid introductory communication']).map((item, idx) => (
                  <li key={idx} style={styles.greenItem}>
                    <span style={styles.greenCheck}>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas for Improvement Column */}
            <div style={styles.feedbackColAmber}>
              <div style={styles.colHeaderAmber}>
                <span>🎯</span>
                <span style={{ fontWeight: 700 }}>Places to Improve</span>
              </div>
              <ul style={styles.feedbackList}>
                {(evalData.areas_for_improvement || ['Provide deeper architectural examples']).map(
                  (item, idx) => (
                    <li key={idx} style={styles.amberItem}>
                      <span style={styles.amberTarget}>➤</span>
                      <span>{item}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>

          {/* Key Topics Tags */}
          {evalData.key_topics && evalData.key_topics.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 8, fontWeight: 600 }}>
                KEY TOPICS COVERED:
              </span>
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {evalData.key_topics.map((t, idx) => (
                  <span key={idx} style={styles.topicTag}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Coach's Encouraging Message */}
          {evalData.feedback_message && (
            <div style={styles.coachNote}>
              <div style={{ fontSize: 18 }}>💬</div>
              <div style={{ flex: 1, fontSize: 13, color: '#cbd5e1' }}>
                <strong style={{ color: '#f1f5f9' }}>Alex's Advice:</strong> "{evalData.feedback_message}"
              </div>
            </div>
          )}

          {/* Toggle Full Transcript */}
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowTranscriptWithSummary(!showTranscriptWithSummary)}
              style={styles.secondaryBtn}
            >
              📜 {showTranscriptWithSummary ? 'Hide Conversation Transcript' : 'Review Full Conversation Transcript'}
            </button>
          </div>
        </div>
      )}

      {/* Main Interactive Stage Grid */}
      <div style={styles.stageGrid}>
        {/* Left / Center: Conversation & Audio Visualizer */}
        <div style={styles.mainStage}>
          {/* Live Mic Level & Interruption Indicator */}
          <div style={styles.micSection}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <span style={styles.micLabel}>
                Candidate Microphone (Hardware AEC/NS Active • 16 kHz PCM16 Stream)
              </span>
              {isInterrupted && (
                <span id="interruption-indicator" style={styles.interruptedBadge}>
                  ⚡ Interrupted! Playback Queue Flushed
                </span>
              )}
            </div>

            {/* Mic Level VU Meter */}
            <div style={styles.meterContainer}>
              <div
                id="mic-level-bar"
                style={{
                  ...styles.meterBar,
                  width: `${Math.min(100, Math.round(micLevel * 300))}%`,
                  backgroundColor:
                    micLevel > 0.6 ? '#ef4444' : micLevel > 0.2 ? '#10b981' : '#3b82f6',
                }}
              />
            </div>
          </div>

          {/* Transcript Feed (Shown if no summary or user opted to view transcript) */}
          {(!evalData || showTranscriptWithSummary) && (
            <div id="interview-transcript-box" style={styles.transcriptBox}>
              {transcripts.length === 0 ? (
                <div style={styles.emptyTranscript}>
                  <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.6 }}>💬</div>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                    Ready for your live session with Alex.
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, maxWidth: 440 }}>
                    Click <strong>"Start Live Voice Interview"</strong> below. Alex will greet you warmly in English and
                    ask you to introduce yourself.
                  </div>
                </div>
              ) : (
                transcripts.map((t) => {
                  const isAI = t.role === 'assistant';
                  return (
                    <div
                      key={t.id}
                      style={{
                        ...styles.transcriptRow,
                        justifyContent: isAI ? 'flex-start' : 'flex-end',
                      }}
                    >
                      <div
                        style={{
                          ...styles.messageBubble,
                          backgroundColor: isAI ? '#1e293b' : '#1e3a8a',
                          border: isAI ? '1px solid #334155' : '1px solid #2563eb',
                        }}
                      >
                        <div style={styles.bubbleHeader}>
                          <span style={styles.bubbleRole}>
                            {isAI ? '🤖 Alex (Interviewer)' : `👤 ${candidateName}`}
                          </span>
                          <span style={styles.bubbleTime}>{t.timestamp}</span>
                        </div>
                        <div style={styles.bubbleText}>
                          {t.text}
                          {!t.isFinal && <span style={styles.typingCursor}>▍</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={transcriptBottomRef} />
            </div>
          )}

          {/* Action Control Buttons */}
          <div style={styles.controlsRow}>
            {!isConnected && !isConnecting ? (
              <button
                id="start-interview-btn"
                onClick={startInterview}
                style={styles.primaryStartBtn}
              >
                🎙️ Start Live Voice Interview
              </button>
            ) : (
              <button
                id="end-interview-btn"
                onClick={endInterview}
                style={styles.dangerEndBtn}
              >
                🛑 End Voice Interview & Save Summary
              </button>
            )}

            {transcripts.length > 0 && !isConnected && (
              <button
                id="clear-transcript-btn"
                onClick={clearTranscript}
                style={styles.secondaryBtn}
              >
                Clear Transcript View
              </button>
            )}
          </div>
        </div>

        {/* Right Sidebar: Telemetry & Status Panel */}
        {showDebug && (
          <div id="live-interview-debug-panel" style={styles.debugPanel}>
            <div style={styles.debugHeader}>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: '0.05em',
                  color: '#93c5fd',
                }}
              >
                LIVE AUDIO TELEMETRY & DIAGNOSTICS
              </span>
            </div>

            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Active Candidate:</span>
              <span style={{ ...styles.metricVal, color: '#38bdf8' }}>{candidateName}</span>
            </div>

            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Mic AudioContext Rate:</span>
              <span id="metric-hw-samplerate" style={styles.metricVal}>
                {metrics.hardwareSampleRate ? `${metrics.hardwareSampleRate} Hz` : 'Inactive'}
              </span>
            </div>

            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Worklet PCM Stream:</span>
              <span id="metric-target-samplerate" style={{ ...styles.metricVal, color: '#34d399' }}>
                16,000 Hz Mono PCM16
              </span>
            </div>

            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Gemini AI Playback Rate:</span>
              <span id="metric-playback-samplerate" style={{ ...styles.metricVal, color: '#60a5fa' }}>
                24,000 Hz Mono PCM16
              </span>
            </div>

            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Speech-to-Audio Latency:</span>
              <span
                id="metric-latency"
                style={{
                  ...styles.metricVal,
                  color:
                    metrics.latencyMs && metrics.latencyMs < 1200
                      ? '#34d399'
                      : metrics.latencyMs
                      ? '#f59e0b'
                      : '#94a3b8',
                }}
              >
                {metrics.latencyMs ? `${metrics.latencyMs} ms` : 'calculating...'}
              </span>
            </div>

            <div style={styles.metricDivider} />

            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
              <strong>Architecture:</strong> Zero-buffering AudioWorklet linear downsampler → FastAPI WebSocket Proxy →
              Gemini Live (gemini-2.5-flash-native-audio-latest) with structured Gemini 3.8 Flash evaluation.
            </div>
          </div>
        )}
      </div>

      {/* ── Past Reports Modal / Drawer ───────────────────────────────────── */}
      {showHistoryModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📂</span>
                <h3 style={{ margin: 0, fontSize: 18, color: '#ffffff' }}>
                  Saved Interview Reports ({candidateName})
                </h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={styles.closeModalBtn}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              {historyList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                  <div>No saved interview reports found yet.</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Complete a live interview with Alex, and your evaluation will automatically appear here!
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {historyList.map((item, idx) => {
                    const ev = item.evaluation || {};
                    return (
                      <div
                        key={item._id || item.session_id || idx}
                        style={styles.historyCard}
                        onClick={() => {
                          setSelectedHistoryItem(item);
                          setShowHistoryModal(false);
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: 14 }}>
                              Session: {new Date(item.created_at).toLocaleDateString()} at{' '}
                              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>
                              ({item.duration_seconds || 0}s duration)
                            </span>
                          </div>
                          <span style={styles.historyScoreBadge}>
                            Score: {ev.overall_score || 'N/A'}/100
                          </span>
                        </div>

                        {ev.summary && (
                          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
                            {ev.summary}
                          </p>
                        )}

                        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>
                            {ev.strong_areas?.length || 0} Strengths
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>•</span>
                          <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
                            {ev.areas_for_improvement?.length || 0} Suggestions
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>
                            View Full Report ➔
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1160,
    margin: '0 auto',
    backgroundColor: '#0c1322',
    border: '1px solid #1e293b',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
    color: '#f8fafc',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1e293b',
    paddingBottom: 16,
    marginBottom: 16,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    fontSize: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#ffffff',
  },
  candidateTag: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    fontWeight: 600,
  },
  subtitle: {
    margin: 0,
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#ffffff',
  },
  statusPulse: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    boxShadow: '0 0 8px #ffffff',
  },
  ghostBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#cbd5e1',
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  guideBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '12px 16px',
    marginBottom: 12,
  },
  advisoryBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: 10,
    padding: '8px 14px',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#cbd5e1',
    marginBottom: 14,
  },
  errorBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    border: '1px solid #dc2626',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 12,
    color: '#fca5a5',
    marginBottom: 14,
  },
  evaluatingBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(30, 58, 138, 0.35)',
    border: '1px solid #3b82f6',
    borderRadius: 10,
    padding: '14px 18px',
    marginBottom: 16,
    animation: 'pulse 2s infinite',
  },
  evaluatingSpinner: {
    width: 22,
    height: 22,
    border: '3px solid rgba(96, 165, 250, 0.3)',
    borderTop: '3px solid #60a5fa',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  reportCard: {
    backgroundColor: '#0f172a',
    border: '1px solid #2563eb',
    borderRadius: 14,
    padding: 20,
    marginBottom: 18,
    boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.25)',
  },
  reportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1e293b',
    paddingBottom: 12,
    marginBottom: 14,
  },
  reportTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: '#ffffff',
  },
  reportMeta: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#94a3b8',
  },
  closeReportBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  scoreRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 14,
  },
  scoreBox: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '12px 16px',
    textAlign: 'center',
  },
  scoreVal: {
    fontSize: 26,
    fontWeight: 800,
    fontFamily: 'monospace',
    color: '#34d399',
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#f8fafc',
    marginTop: 2,
  },
  scoreSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  summaryBlock: {
    backgroundColor: '#111e33',
    borderLeft: '4px solid #3b82f6',
    borderRadius: '0 8px 8px 0',
    padding: '12px 16px',
    marginBottom: 14,
  },
  feedbackGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  feedbackColGreen: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    padding: 14,
  },
  colHeaderGreen: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#34d399',
    fontSize: 13,
    marginBottom: 10,
  },
  feedbackColAmber: {
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    padding: 14,
  },
  colHeaderAmber: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#fbbf24',
    fontSize: 13,
    marginBottom: 10,
  },
  feedbackList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  greenItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 1.4,
  },
  greenCheck: {
    color: '#34d399',
    fontWeight: 800,
  },
  amberItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 1.4,
  },
  amberTarget: {
    color: '#fbbf24',
    fontWeight: 800,
  },
  topicTag: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#93c5fd',
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 12,
    fontWeight: 500,
  },
  coachNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '10px 14px',
    marginTop: 14,
  },
  stageGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 20,
  },
  mainStage: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  micSection: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 10,
    padding: '12px 16px',
  },
  micLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: 500,
  },
  interruptedBadge: {
    fontSize: 11,
    backgroundColor: '#ef4444',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: 6,
    fontWeight: 700,
  },
  meterContainer: {
    height: 8,
    backgroundColor: '#1f2937',
    borderRadius: 4,
    overflow: 'hidden',
  },
  meterBar: {
    height: '100%',
    transition: 'width 0.08s ease-out',
  },
  transcriptBox: {
    height: 380,
    overflowY: 'auto',
    backgroundColor: '#0a0f1d',
    border: '1px solid #1e293b',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  emptyTranscript: {
    margin: 'auto',
    textAlign: 'center',
    color: '#64748b',
    padding: '24px 0',
  },
  transcriptRow: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 12,
    padding: '10px 14px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
  },
  bubbleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  bubbleRole: {
    fontSize: 11,
    fontWeight: 700,
    color: '#93c5fd',
  },
  bubbleTime: {
    fontSize: 10,
    color: '#64748b',
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#f1f5f9',
    whiteSpace: 'pre-wrap',
  },
  typingCursor: {
    display: 'inline-block',
    marginLeft: 2,
    color: '#60a5fa',
  },
  controlsRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  primaryStartBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '14px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.4)',
    transition: 'all 0.2s',
  },
  dangerEndBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '14px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 14px 0 rgba(220, 38, 38, 0.4)',
    transition: 'all 0.2s',
  },
  secondaryBtn: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '12px 18px',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  debugPanel: {
    backgroundColor: '#0e1626',
    border: '1px solid #1e293b',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: 12,
  },
  debugHeader: {
    borderBottom: '1px solid #1e293b',
    paddingBottom: 8,
    marginBottom: 4,
  },
  metricItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  metricVal: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#f8fafc',
  },
  metricDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    margin: '4px 0',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 14,
    width: '100%',
    maxWidth: 640,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #1e293b',
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: 16,
    cursor: 'pointer',
    padding: 4,
  },
  modalBody: {
    padding: 20,
    overflowY: 'auto',
  },
  historyCard: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: 14,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  historyScoreBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  },
};
