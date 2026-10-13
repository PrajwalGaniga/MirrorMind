import { useState, useRef, useCallback, useEffect } from 'react';
import { InterviewLiveClient } from '../utils/interview-live-client';

/**
 * useLiveInterview — High-performance React hook for full-duplex Gemini Live voice interview
 * with automated introduction, structured AI evaluation persistence, and review.
 */
export function useLiveInterview({ wsUrl, candidateName, userId, token } = {}) {
  const [status, setStatus] = useState('DISCONNECTED'); // DISCONNECTED | CONNECTING | CONNECTED | RECONNECTING
  const [transcripts, setTranscripts] = useState([]);
  const [micLevel, setMicLevel] = useState(0);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [interruptionCount, setInterruptionCount] = useState(0);
  const [metrics, setMetrics] = useState({
    hardwareSampleRate: 0,
    chunkBytes: 1280,
    chunkIntervalMs: 40,
    totalChunksSent: 0,
    latencyMs: null,
    tokenUsage: null,
  });
  const [error, setError] = useState(null);
  const [summaryReport, setSummaryReport] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [historyList, setHistoryList] = useState([]);

  const clientRef = useRef(null);
  const transcriptsRef = useRef([]);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  const fetchPastInterviews = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const authToken = token || localStorage.getItem('token') || '';
      const res = await fetch(`${apiUrl}/api/voice/interviews/history?token=${encodeURIComponent(authToken)}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.interviews || []);
        return data.interviews || [];
      }
    } catch (err) {
      console.warn('[INTERVIEW] Failed to fetch interview history:', err);
    }
    return [];
  }, [token]);

  const fetchLatestEvaluation = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const authToken = token || localStorage.getItem('token') || '';
      const res = await fetch(`${apiUrl}/api/voice/interviews/latest?token=${encodeURIComponent(authToken)}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.evaluation) {
          setSummaryReport({
            sessionId: data.session_id,
            durationSeconds: data.duration_seconds,
            evaluation: data.evaluation,
            transcript: data.transcript,
          });
        }
      }
    } catch (err) {
      console.warn('[INTERVIEW] Failed to fetch latest evaluation:', err);
    }
  }, [token]);

  const startInterview = useCallback(async () => {
    setError(null);
    setSummaryReport(null);
    setIsEvaluating(false);

    if (clientRef.current) {
      clientRef.current.stop();
    }

    const client = new InterviewLiveClient({
      wsUrl,
      candidateName,
      userId,
      token,
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onTranscript: ({ role, text, isFinal }) => {
        setTranscripts((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === role && !last.isFinal) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              text,
              isFinal,
              timestamp: new Date().toLocaleTimeString(),
            };
            return updated;
          }
          return [
            ...prev,
            {
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              role,
              text,
              isFinal,
              timestamp: new Date().toLocaleTimeString(),
            },
          ];
        });
      },
      onInterrupted: () => {
        setIsInterrupted(true);
        setInterruptionCount((c) => c + 1);
        setTimeout(() => setIsInterrupted(false), 1200);
      },
      onMetrics: (newMetrics) => {
        setMetrics((prev) => ({
          ...prev,
          ...newMetrics,
        }));
      },
      onMicLevel: (lvl) => {
        setMicLevel(lvl);
      },
      onSummary: (summaryData) => {
        setIsEvaluating(false);
        setSummaryReport(summaryData);
      },
      onError: (errMessage) => {
        setError(errMessage);
        setIsEvaluating(false);
      },
    });

    clientRef.current = client;

    try {
      await client.start();
    } catch (err) {
      setError(err.message || 'Failed to start live interview');
      setStatus('DISCONNECTED');
    }
  }, [wsUrl, candidateName, userId, token]);

  const endInterview = useCallback(async () => {
    const hadConversation = transcriptsRef.current.length > 0;
    if (hadConversation) {
      setIsEvaluating(true);
    }

    if (clientRef.current) {
      await clientRef.current.endSession();
      clientRef.current = null;
    }

    setStatus('DISCONNECTED');
    setMicLevel(0);

    // If server didn't push summary over WS before socket closed, fetch latest from DB
    if (hadConversation) {
      setTimeout(async () => {
        await fetchLatestEvaluation();
        setIsEvaluating(false);
      }, 1500);
    }
  }, [fetchLatestEvaluation]);

  const clearTranscript = useCallback(() => {
    setTranscripts([]);
  }, []);

  const clearSummary = useCallback(() => {
    setSummaryReport(null);
  }, []);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.stop();
      }
    };
  }, []);

  const retryInterview = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.retry();
    }
  }, []);

  return {
    status,
    isConnected: ['CONNECTED', 'LISTENING', 'READY_FOR_CANDIDATE', 'connected'].includes(status),
    isConnecting: ['CONNECTING', 'RECONNECTING', 'connecting', 'reconnecting'].includes(status),
    isFailed: ['FAILED', 'failed'].includes(status),
    transcripts,
    micLevel,
    isInterrupted,
    interruptionCount,
    metrics,
    error,
    summaryReport,
    isEvaluating,
    historyList,
    startInterview,
    retryInterview,
    endInterview,
    clearTranscript,
    clearSummary,
    fetchPastInterviews,
    fetchLatestEvaluation,
  };
}
