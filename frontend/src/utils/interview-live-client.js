/**
 * interview-live-client.js — Full-Duplex Low-Latency Live Audio Client
 *
 * Coordinates:
 * - AudioWorklet continuous 16kHz PCM16 microphone streaming.
 * - Gapless 24kHz PCM16 playback via AudioPlaybackManager.
 * - Instant interruption flushing on server 'interrupted' signal.
 * - Live transcript (candidate + interviewer) and real-time debug metrics.
 * - Auto-reconnect with exponential backoff.
 */

import { AudioWorkletCapture } from './audio-worklet-capture';
import { AudioPlaybackManager } from './audio-playback-manager';

export class InterviewLiveClient {
  constructor({
    wsUrl,
    candidateName,
    userId,
    token,
    onStatusChange = () => {},
    onTranscript = () => {},
    onInterrupted = () => {},
    onMetrics = () => {},
    onMicLevel = () => {},
    onSummary = () => {},
    onError = () => {},
  } = {}) {
    this.wsUrl = wsUrl;
    this.candidateName = candidateName;
    this.userId = userId;
    this.token = token;
    this.onStatusChange = onStatusChange;
    this.onTranscript = onTranscript;
    this.onInterrupted = onInterrupted;
    this.onMetrics = onMetrics;
    this.onMicLevel = onMicLevel;
    this.onSummary = onSummary;
    this.onError = onError;

    this.ws = null;
    this.capture = null;
    this.playback = new AudioPlaybackManager();
    this.isConnected = false;
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.maxReconnectDelayMs = 5000;

    // Metrics tracking
    this.lastChunkTime = 0;
    this.chunkCount = 0;
    this.hardwareSampleRate = 0;
  }

  async start() {
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.pendingAudioQueue = [];

    // 1. Initialize microphone capture via AudioWorklet
    this.capture = new AudioWorkletCapture({
      onChunk: (pcmArrayBuffer) => this._handleOutgoingMicChunk(pcmArrayBuffer),
      onLevel: (rms) => this.onMicLevel(rms),
      onReady: (info) => {
        this.hardwareSampleRate = info.hardwareRate;
        if (this.isConnected) {
          this.onStatusChange('LISTENING');
        }
      },
      onActivityStart: () => {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('[INTERVIEW] Candidate speech detected -> ACTIVITY_START');
          this.ws.send(JSON.stringify({ type: 'ACTIVITY_START' }));
          this.playback.flush();
        }
      },
      onActivityEnd: () => {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('[INTERVIEW] Candidate turn completed -> ACTIVITY_END');
          this.ws.send(JSON.stringify({ type: 'ACTIVITY_END' }));
        }
      },
      onError: (err) => {
        console.error('[INTERVIEW][MIC] Capture error:', err);
        this.onError(err.message || 'Microphone error');
      },
    });

    const micInfo = await this.capture.start();
    this.hardwareSampleRate = micInfo.sampleRate;

    // 2. Connect to the FastAPI WebSocket proxy
    await this._connectWebSocket();
  }

  async _connectWebSocket() {
    return new Promise((resolve) => {
      this.onStatusChange('CONNECTING');

      try {
        const url = this.wsUrl || this._getDefaultWsUrl();
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log('[INTERVIEW][WS] Connected to live interview bridge.');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.onStatusChange(this.capture?.isWorkletReady ? 'LISTENING' : 'CONNECTED');

          // Flush any chunks buffered during handshake
          while (this.pendingAudioQueue.length > 0) {
            const buf = this.pendingAudioQueue.shift();
            this.ws.send(buf);
          }
          resolve();
        };

        this.ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            // Binary frame = 24kHz raw PCM16 audio from Gemini Live
            this.playback.playChunk(event.data);
          } else if (typeof event.data === 'string') {
            // JSON frame = control, transcript, interrupted, or metrics
            try {
              const msg = JSON.parse(event.data);
              this._handleServerControlMessage(msg);
            } catch (err) {
              console.warn('[INTERVIEW][WS] Failed to parse control JSON:', err);
            }
          }
        };

        this.ws.onerror = (err) => {
          console.error('[INTERVIEW][WS] WebSocket error:', err);
          this.onError('Live voice connection error');
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.onStatusChange('DISCONNECTED');
          this._scheduleReconnect();
        };
      } catch (err) {
        this.onError(err.message || 'Connection failed');
        this._scheduleReconnect();
        resolve();
      }
    });
  }

  _handleOutgoingMicChunk(pcmArrayBuffer) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Buffer up to 1.5 seconds of audio during connection handshake
      if (this.pendingAudioQueue.length < 38) {
        this.pendingAudioQueue.push(pcmArrayBuffer);
      }
      return;
    }

    const now = performance.now();
    const intervalMs = this.lastChunkTime ? Math.round(now - this.lastChunkTime) : 40;
    this.lastChunkTime = now;
    this.chunkCount++;

    // Stream binary 16kHz PCM16 chunk directly with zero extra buffering
    this.ws.send(pcmArrayBuffer);

    // Update real-time chunk metrics
    this.onMetrics({
      hardwareSampleRate: this.hardwareSampleRate,
      chunkBytes: pcmArrayBuffer.byteLength,
      chunkIntervalMs: intervalMs,
      totalChunksSent: this.chunkCount,
    });
  }

  _handleServerControlMessage(msg) {
    const type = msg.type;

    if (type === 'INTERRUPTED') {
      // Immediate cancellation of active/queued AI audio playback
      console.log('[INTERVIEW] AI speech interrupted by candidate! Flushing playback queue.');
      this.playback.flush();
      this.onInterrupted();
    } else if (type === 'TRANSCRIPT') {
      this.onTranscript({
        role: msg.role, // 'user' or 'assistant'
        text: msg.text,
        isFinal: msg.isFinal ?? false,
      });
    } else if (type === 'METRICS') {
      this.onMetrics({
        latencyMs: msg.latencyMs,
        tokenUsage: msg.tokenUsage,
      });
    } else if (type === 'SESSION_RESUMED') {
      console.log('[INTERVIEW] Session resumed successfully with handle:', msg.handle);
    } else if (type === 'TURN_COMPLETE') {
      this.onStatusChange('READY_FOR_CANDIDATE');
    } else if (type === 'INTERVIEW_SUMMARY') {
      console.log('[INTERVIEW] Received performance summary from server:', msg.evaluation);
      this.onSummary({
        sessionId: msg.sessionId,
        durationSeconds: msg.durationSeconds,
        evaluation: msg.evaluation,
        transcript: msg.transcript,
      });
    }
  }

  _scheduleReconnect() {
    if (!this.shouldReconnect) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), this.maxReconnectDelayMs);
    console.log(`[INTERVIEW][RECONNECT] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})...`);
    this.onStatusChange('RECONNECTING');

    setTimeout(() => {
      if (this.shouldReconnect) {
        this._connectWebSocket();
      }
    }, delay);
  }

  _getDefaultWsUrl() {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = this.token || localStorage.getItem('token') || '';

    // Candidate identification
    let name = this.candidateName || '';
    let uid = this.userId || '';
    if (!name || !uid) {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const u = JSON.parse(stored);
          if (!name) name = u.name || u.username || '';
          if (!uid) uid = u.id || u._id || '';
        }
      } catch (_) {}
    }

    const queryParams = new URLSearchParams();
    if (token) queryParams.set('token', token);
    if (name) queryParams.set('name', name);
    if (uid) queryParams.set('userId', uid);

    const qs = queryParams.toString();
    return `${wsProtocol}//${host}/api/voice/interview-ws${qs ? '?' + qs : ''}`;
  }

  async endSession() {
    this.shouldReconnect = false;
    if (this.capture) {
      this.capture.stop();
      this.capture = null;
    }
    if (this.playback) {
      this.playback.flush();
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'END_INTERVIEW' }));
      } catch (_) {}
      // Brief pause to allow summary arrival before closing socket
      await new Promise((r) => setTimeout(r, 600));
    }
    this.stop();
  }

  stop() {
    this.shouldReconnect = false;
    this.isConnected = false;

    if (this.capture) {
      this.capture.stop();
      this.capture = null;
    }

    if (this.playback) {
      this.playback.close();
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    this.onStatusChange('DISCONNECTED');
  }
}
