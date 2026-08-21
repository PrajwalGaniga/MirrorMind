import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';

export default function VoiceDiagnosticsPanel({ diagnostics }) {
  const [expanded, setExpanded] = useState(false);

  if (!diagnostics) return null;

  const {
    rawTranscript = '',
    normalizedText = '',
    intent = '',
    confidence = 0,
    suggestion = '',
  } = diagnostics;

  const getConfidenceColor = (conf) => {
    if (conf >= 0.85) return '#52c41a'; // Green
    if (conf >= 0.5) return '#faad14';  // Yellow
    return '#ff4d4f';                   // Red
  };

  return (
    <div style={{
      marginTop: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 8,
      overflow: 'hidden',
      fontFamily: 'monospace',
      fontSize: 12,
    }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: 'rgba(0,0,0,0.02)',
          borderBottom: expanded ? '1px solid var(--border-color)' : 'none',
          color: 'var(--text-secondary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Terminal size={14} />
          <span style={{ fontWeight: 600 }}>Voice Diagnostics</span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {expanded && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'inline-block', width: 90 }}>RAW:</span>
            <span style={{ color: 'var(--text-primary)' }}>"{rawTranscript}"</span>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'inline-block', width: 90 }}>NORMALIZED:</span>
            <span style={{ color: 'var(--text-primary)' }}>"{normalizedText}"</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', display: 'inline-block', width: 90 }}>INTENT:</span>
            <span style={{ 
              fontWeight: 'bold', 
              color: intent === 'UNKNOWN' ? '#ff4d4f' : 'var(--text-primary)',
              marginRight: 8
            }}>
              {intent || '—'}
            </span>
            {intent && (
              <span style={{
                padding: '2px 6px',
                borderRadius: 4,
                background: `${getConfidenceColor(confidence)}20`,
                color: getConfidenceColor(confidence),
                fontSize: 11
              }}>
                conf: {confidence.toFixed(2)}
              </span>
            )}
          </div>

          {suggestion && (
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'inline-block', width: 90 }}>SUGGESTION:</span>
              <span style={{ color: '#faad14' }}>"{suggestion}"</span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
