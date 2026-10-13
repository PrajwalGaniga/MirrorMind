/**
 * interview-live-client.js — Full-Duplex Low-Latency Live Audio Client
 *
 * Coordinates:
 * - AudioWorklet continuous 16kHz PCM16 microphone streaming.
 * - Gapless 24kHz PCM16 playback via AudioPlaybackManager.
 * - Connection state machine: idle -> connecting -> connected -> reconnecting -> failed.
 * - Auto-reconnect with exponential backoff, jitter, and 30s stable connection reset.
 * - Online/offline & visibility change event handling.
 * - Instant interruption flushing on server 'interrupted' signal.
 * - Live transcript (candidate + interviewer) and real-time debug metrics.
 */

import { AudioWorkletCapture } from './audio-worklet-capture';
import { AudioPlaybackManager } from './audio-playback-manager';
import { voiceLog } from './logger';

const MAX_RECONNECT_ATTEMPTS = parseInt(import.meta.env?.VITE_VOICE_MAX_RECONNECTS || '6', 10);

export class InterviewLiveClient {
  constructor({
    wsUrl,
    candidateName,
    userId,
    token,
    useManualVad,
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
    this.useManualVad = (useManualVad !== undefined)
      ? Boolean(useManualVad)
      : (import.meta.env?.VITE_USE_MANUAL_VAD === 'true');
    this.onStatusChange = onStatusChange;
    this.onTranscript = onTranscript;
    this.onInterrupted = onInterrupted;
    this.onMetrics = onMetrics;
    this.onMicLevel = onMicLevel;
    this.onSummary = onSummary;
    this.onError = onError;

    // Connection state machine: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
    this.state = 'idle';

    this.ws = null;
    this.capture = null;
    this.playback = new AudioPlaybackManager();
    this.isConnected = false;
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.maxReconnects = MAX_RECONNECT_ATTEMPTS;
    this.reconnectTimer = null;
    this.stableConnectionTimer = null;
    this.pendingAudioQueue = [];

    // Metrics tracking
    this.lastChunkTime = 0;
    this.chunkCount = 0;
    this.hardwareSampleRate = 0;
    this._lastRms = 0;

    // Online/offline and visibility handlers
    this._handleOnline = () => {
      console.log('[INTERVIEW][NET] Network restored online.');
      voiceLog.push('INTERVIEW', 'NETWORK_ONLINE', {});
      if (this.state === 'reconnecting' || this.state === 'failed') {
        this.retry();
      }
    };

    this._handleOffline = () => {
      console.log('[INTERVIEW][NET] Network offline.');
      voiceLog.push('INTERVIEW', 'NETWORK_OFFLINE', {});
      this._setState('reconnecting', { reason: 'offline' });
    };

    this._handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[INTERVIEW][VISIBILITY] Tab became visible.');
        this.playback.resume();
        if (this.state === 'reconnecting' || (!this.isConnected && this.shouldReconnect)) {
          this.retry();
        }
      }
    };
  }

  _setState(newState, payload = {}) {
    if (this.state === newState && newState !== 'reconnecting') return;
    this.state = newState;
    voiceLog.push('INTERVIEW', 'STATE_CHANGE', { state: newState, ...payload });
    this.onStatusChange(newState, payload);
  }

  async start() {
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.pendingAudioQueue = [];

    this._setupWindowListeners();

    // 1. Initialize microphone capture via AudioWorklet
    this.capture = new AudioWorkletCapture({
      enableVAD: this.useManualVad,
      onChunk: (pcmArrayBuffer) => this._handleOutgoingMicChunk(pcmArrayBuffer),
      onLevel: (rms) => {
        this._lastRms = rms;
        this.onMicLevel(rms);
      },
      onReady: (info) => {
        this.hardwareSampleRate = info.hardwareRate;
      },
      onActivityStart: () => {
        if (!this.useManualVad) return;
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('[INTERVIEW] Candidate speech detected -> ACTIVITY_START');
          voiceLog.push('INTERVIEW', 'ACTIVITY_START', { rms: this._lastRms?.toFixed(4) });
          this.ws.send(JSON.stringify({ type: 'ACTIVITY_START' }));
        }
      },
      onActivityEnd: () => {
        if (!this.useManualVad) return;
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('[INTERVIEW] Candidate turn completed -> ACTIVITY_END');
          voiceLog.push('INTERVIEW', 'ACTIVITY_END', {});
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
      this._setState('connecting');

      try {
        const url = this.wsUrl || this._getDefaultWsUrl();

        if (this.ws) {
          try {
            this.ws.onclose = null;
            this.ws.close();
          } catch (_) {}
        }

        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          voiceLog.push('INTERVIEW', 'WS_OPEN', {});
          console.log('[INTERVIEW][WS] Connected to live interview bridge.');
          this.isConnected = true;
          this._setState('connected');

          // Reset reconnect attempts after 30 seconds of stable connection
          if (this.stableConnectionTimer) clearTimeout(this.stableConnectionTimer);
          this.stableConnectionTimer = setTimeout(() => {
            if (this.isConnected) {
              console.log('[INTERVIEW] Connection stable for 30s. Reconnect counter reset to 0.');
              voiceLog.push('INTERVIEW', 'RECONNECT_RESET', {});
              this.reconnectAttempts = 0;
            }
          }, 30000);

          // Flush any mic chunks buffered during handshake
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
            try {
              const msg = JSON.parse(event.data);
              this._handleServerControlMessage(msg);
            } catch (err) {
              console.warn('[INTERVIEW][WS] JSON parse error:', err);
            }
          }
        };

        this.ws.onerror = (err) => {
          voiceLog.push('INTERVIEW', 'WS_ERROR', {});
          console.error('[INTERVIEW][WS] WebSocket error:', err);
        };

        this.ws.onclose = (event) => {
          voiceLog.push('INTERVIEW', 'WS_CLOSE', { code: event?.code, reason: event?.reason });
          this.isConnected = false;

          if (this.stableConnectionTimer) {
            clearTimeout(this.stableConnectionTimer);
            this.stableConnectionTimer = null;
          }

          if (this.shouldReconnect) {
            this._scheduleReconnect();
          } else {
            this._setState('idle');
          }
          resolve();
        };
      } catch (err) {
        this.onError(err.message || 'Connection failed');
        if (this.shouldReconnect) {
          this._scheduleReconnect();
        }
        resolve();
      }
    });
  }

  _handleOutgoingMicChunk(pcmArrayBuffer) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Buffer up to ~2 seconds of audio (60 chunks) during connection handshake
      if (this.pendingAudioQueue.length < 60) {
        this.pendingAudioQueue.push(pcmArrayBuffer);
      } else {
        this.pendingAudioQueue.shift();
        this.pendingAudioQueue.push(pcmArrayBuffer);
      }
      return;
    }

    const now = performance.now();
    const intervalMs = this.lastChunkTime ? Math.round(now - this.lastChunkTime) : 40;
    this.lastChunkTime = now;
    this.chunkCount++;

    this.ws.send(pcmArrayBuffer);

    this.onMetrics({
      hardwareSampleRate: this.hardwareSampleRate,
      chunkBytes: pcmArrayBuffer.byteLength,
      chunkIntervalMs: intervalMs,
      totalChunksSent: this.chunkCount,
    });
  }

  _handleServerControlMessage(msg) {
    const type = msg.type;

    if (type === 'STATUS' && msg.status === 'CONNECTED') {
      this._setState('connected', msg);
    } else if (type === 'SESSION_READY') {
      console.log('[INTERVIEW] Session ready with model:', msg.model);
      this._setState('connected', msg);
    } else if (type === 'RECONNECTING') {
      console.log('[INTERVIEW] Server notified RECONNECTING:', msg);
      this._setState('reconnecting', msg);
    } else if (type === 'PING') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } else if (type === 'INTERRUPTED') {
      console.log('[INTERVIEW] AI speech interrupted by candidate! Flushing playback queue.');
      this.playback.flush('server_interrupted');
      this.onInterrupted();
    } else if (type === 'TRANSCRIPT') {
      this.onTranscript({
        role: msg.role,
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
    } else if (type === 'ERROR') {
      console.error('[INTERVIEW] Server error:', msg.message);
      this.onError(msg.message);
    }
  }

  _scheduleReconnect() {
    if (!this.shouldReconnect) return;

    if (this.reconnectAttempts >= this.maxReconnects) {
      console.warn(`[INTERVIEW] Max reconnect attempts (${this.maxReconnects}) exhausted.`);
      voiceLog.push('INTERVIEW', 'RECONNECT_FAILED', { attempts: this.reconnectAttempts });
      this._setState('failed', { error: 'Reconnection attempts exhausted. Please click Retry.' });
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff with jitter: 1000 * 1.5^n + random(0-500ms), capped at 10s
    const delay = Math.min(10000, Math.round(1000 * Math.pow(1.5, this.reconnectAttempts - 1) + Math.random() * 500));
    voiceLog.push('INTERVIEW', 'RECONNECT_ATTEMPT', { attempt: this.reconnectAttempts, max: this.maxReconnects, delayMs: delay });
    console.log(`[INTERVIEW][RECONNECT] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnects})...`);

    this._setState('reconnecting', { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnects, delayMs: delay });

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this._connectWebSocket();
      }
    }, delay);
  }

  retry() {
    console.log('[INTERVIEW] Manual retry triggered.');
    voiceLog.push('INTERVIEW', 'MANUAL_RETRY', {});
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts = 0;
    this.shouldReconnect = true;
    this.playback.resume();
    this._connectWebSocket();
  }

  _getDefaultWsUrl() {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = this.token || localStorage.getItem('token') || '';

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

  _setupWindowListeners() {
    window.addEventListener('online', this._handleOnline);
    window.addEventListener('offline', this._handleOffline);
    document.addEventListener('visibilitychange', this._handleVisibilityChange);
  }

  _removeWindowListeners() {
    window.removeEventListener('online', this._handleOnline);
    window.removeEventListener('offline', this._handleOffline);
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);
  }

  async endSession() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.stableConnectionTimer) clearTimeout(this.stableConnectionTimer);

    if (this.capture) {
      try { this.capture.stop(); } catch (_) {}
      this.capture = null;
    }
    if (this.playback) {
      this.playback.flush('manual');
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'END_INTERVIEW' }));
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 600));
    }
    this.stop();
  }

  stop() {
    this.shouldReconnect = false;
    this.isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.stableConnectionTimer) {
      clearTimeout(this.stableConnectionTimer);
      this.stableConnectionTimer = null;
    }

    this._removeWindowListeners();

    if (this.capture) {
      try { this.capture.stop(); } catch (_) {}
      this.capture = null;
    }

    if (this.playback) {
      this.playback.close();
    }

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    this._setState('idle');
  }
}
