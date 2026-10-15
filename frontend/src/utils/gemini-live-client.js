/**
 * gemini-live-client.js — Client-Side Google Gemini Live Audio Bridge for Nova
 *
 * Establishes a persistent, bidirectional WebSocket connection with /api/voice/live:
 * - Streams live microphone audio (16kHz 16-bit PCM) to Gemini Live via AudioWorklet.
 * - Gaplessly plays back real-time 24kHz PCM audio streams from Gemini Live.
 * - Connection state machine: idle -> connecting -> connected -> reconnecting -> failed.
 * - Exponential backoff with jitter and 30s stable connection counter reset.
 * - Idle timeout (default 5 min) with visible "Still there?" prompt at 30s remaining.
 * - AudioContext resume on user gesture / incoming audio chunk; full cleanup on disconnect.
 * - Online/offline and visibilitychange listeners for automatic recovery.
 */

import { voiceLog } from './logger';
import { AudioWorkletCapture } from './audio-worklet-capture';
import { API_BASE_URL } from '../api/axios';

const DEFAULT_IDLE_TIMEOUT = parseInt(import.meta.env?.VITE_NOVA_IDLE_TIMEOUT_SEC || '300', 10);
const MAX_RECONNECT_ATTEMPTS = parseInt(import.meta.env?.VITE_VOICE_MAX_RECONNECTS || '6', 10);

export class GeminiLiveClient {
  constructor({
    onAudioLevel = () => {},
    onTextChunk = () => {},
    onToolStart = () => {},
    onToolProgress = () => {},
    onUIAction = () => {},
    onStatusChange = () => {},
    onSilenceTick = () => {},
    onIdleWarning = () => {},
    onError = () => {},
    silenceTimeoutSeconds = DEFAULT_IDLE_TIMEOUT,
    speakerMode = false,
  } = {}) {
    this.onAudioLevel = onAudioLevel;
    this.onTextChunk = onTextChunk;
    this.onToolStart = onToolStart;
    this.onToolProgress = onToolProgress;
    this.onUIAction = onUIAction;
    this.onStatusChange = onStatusChange;
    this.onSilenceTick = onSilenceTick;
    this.onIdleWarning = onIdleWarning;
    this.onError = onError;
    this.idleTimeoutSeconds = silenceTimeoutSeconds || DEFAULT_IDLE_TIMEOUT;

    // Connection state machine: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
    this.state = 'idle';

    this.ws = null;
    this.capture = null;
    this.micAnalyser = null;
    this.speakerMode = speakerMode || (typeof localStorage !== 'undefined' && localStorage.getItem('nova_speaker_mode') === 'true');

    this.playContext = null;
    this.playAnalyser = null;
    this.nextPlayTime = 0;
    this.activeSources = [];
    this.isConnected = false;
    this.isMuted = false;
    this.isTurnComplete = false;
    this.isManualDisconnect = false;

    // Reconnection parameters
    this.reconnectAttempts = 0;
    this.maxReconnects = MAX_RECONNECT_ATTEMPTS;
    this.reconnectTimer = null;
    this.stableConnectionTimer = null;

    // Stored credentials for reconnect
    this.lastToken = '';
    this.lastOptions = {};

    // Idle watchdog state
    this.idleSecondsRemaining = this.idleTimeoutSeconds;
    this.idleInterval = null;
    this.isIdleWarningActive = false;

    // Audio animation monitor
    this.monitorRafId = null;

    // Network / tab visibility event listeners
    this._handleOnline = () => {
      console.log('[NOVA][NET] Browser came online.');
      voiceLog.push('NOVA', 'NETWORK_ONLINE', {});
      if (this.state === 'reconnecting' || this.state === 'failed') {
        this.retry();
      }
    };

    this._handleOffline = () => {
      console.log('[NOVA][NET] Browser went offline.');
      voiceLog.push('NOVA', 'NETWORK_OFFLINE', {});
      this._setState('reconnecting', { reason: 'offline' });
    };

    this._handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[NOVA][VISIBILITY] Page became visible.');
        this.resumeContext();
        if (this.state === 'reconnecting' || (!this.isConnected && !this.isManualDisconnect && this.state !== 'idle')) {
          this.retry();
        }
      }
    };
  }

  _setState(newState, payload = {}) {
    if (this.state === newState && newState !== 'reconnecting') return;
    this.state = newState;
    voiceLog.push('NOVA', 'STATE_CHANGE', { state: newState, ...payload });
    this.onStatusChange(newState, payload);
  }

  /**
   * Connect to the backend Live Voice WebSocket.
   * @param {string} token - Student authentication JWT token
   * @param {object} options - Options { autoGreet: boolean }
   */
  async connect(token = '', options = {}) {
    this.lastToken = token;
    this.lastOptions = options;
    this.autoGreet = options.autoGreet || false;
    this.isManualDisconnect = false;

    this._setupWindowListeners();
    await this._doConnect();
  }

  async _doConnect() {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.autoGreet) this.startGreeting();
      return;
    }

    try {
      this._setState('connecting');

      const apiUrl = API_BASE_URL;
      const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
      const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsUrl = `${wsProtocol}//${host}/api/voice/live?token=${encodeURIComponent(this.lastToken || '')}`;

      if (this.ws) {
        try {
          this.ws.onclose = null;
          this.ws.close();
        } catch (_) {}
      }

      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = async () => {
        voiceLog.push('NOVA', 'WS_OPEN', { url: wsUrl });
        console.log('[NOVA][CLIENT] Persistent WebSocket opened to Gemini Live.');
        this.isConnected = true;

        this._startSilenceWatchdog();
        await this._startMicCapture();
        this._startAudioMonitor();

        // Start 30s stable connection reset timer
        if (this.stableConnectionTimer) clearTimeout(this.stableConnectionTimer);
        this.stableConnectionTimer = setTimeout(() => {
          if (this.isConnected) {
            console.log('[NOVA][CLIENT] Connection stable for 30s. Reconnect attempts counter reset to 0.');
            voiceLog.push('NOVA', 'RECONNECT_RESET', {});
            this.reconnectAttempts = 0;
          }
        }, 30000);
      };

      this.ws.onmessage = async (event) => {
        this.resetSilenceTimer();

        if (event.data instanceof ArrayBuffer) {
          // Received 24kHz raw PCM audio from Gemini Live
          this._playPcmAudio(event.data);
        } else if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);
            this._handleJsonMessage(data);
          } catch (err) {
            console.warn('[NOVA][CLIENT] JSON parse error:', err);
          }
        }
      };

      this.ws.onerror = (err) => {
        voiceLog.push('NOVA', 'WS_ERROR', {});
        console.error('[NOVA][CLIENT] WebSocket error:', err);
      };

      this.ws.onclose = (event) => {
        voiceLog.push('NOVA', 'WS_CLOSE', { code: event?.code, reason: event?.reason });
        console.log('[NOVA][CLIENT] WebSocket closed.');
        this.isConnected = false;

        if (this.stableConnectionTimer) {
          clearTimeout(this.stableConnectionTimer);
          this.stableConnectionTimer = null;
        }

        if (!this.isManualDisconnect) {
          this._scheduleReconnect();
        } else {
          this._setState('idle');
        }
      };
    } catch (err) {
      console.error('[NOVA][CLIENT] Connection initialization error:', err);
      this.onError(err.message || 'Failed to initialize live voice.');
      if (!this.isManualDisconnect) {
        this._scheduleReconnect();
      }
    }
  }

  _scheduleReconnect() {
    if (this.isManualDisconnect) return;

    if (this.reconnectAttempts >= this.maxReconnects) {
      console.warn(`[NOVA][CLIENT] Max reconnect attempts (${this.maxReconnects}) exhausted.`);
      voiceLog.push('NOVA', 'RECONNECT_FAILED', { attempts: this.reconnectAttempts });
      this._setState('failed', { error: 'Reconnection failed after maximum attempts. Please click Retry.' });
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff with jitter: 1000 * 1.5^n + random(0-500ms), capped at 10s
    const delay = Math.min(10000, Math.round(1000 * Math.pow(1.5, this.reconnectAttempts - 1) + Math.random() * 500));
    voiceLog.push('NOVA', 'RECONNECT_ATTEMPT', { attempt: this.reconnectAttempts, max: this.maxReconnects, delayMs: delay });
    console.log(`[NOVA][CLIENT] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnects})...`);

    this._setState('reconnecting', { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnects, delayMs: delay });

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualDisconnect) {
        this._doConnect();
      }
    }, delay);
  }

  /**
   * User or UI manual retry trigger when in failed state.
   */
  retry() {
    console.log('[NOVA][CLIENT] Manual retry triggered.');
    voiceLog.push('NOVA', 'MANUAL_RETRY', {});
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts = 0;
    this.isManualDisconnect = false;
    this.resumeContext();
    this._doConnect();
  }

  /**
   * Starts the inactivity watchdog (default 5 min) with visible prompt at 30s remaining.
   */
  _startSilenceWatchdog() {
    this._stopSilenceWatchdog();
    this.idleSecondsRemaining = this.idleTimeoutSeconds;
    this.isIdleWarningActive = false;
    this.onSilenceTick(this.idleSecondsRemaining);

    this.idleInterval = setInterval(() => {
      this.idleSecondsRemaining -= 1;
      this.onSilenceTick(Math.max(0, this.idleSecondsRemaining));

      // 30s warning before idle disconnect
      if (this.idleSecondsRemaining <= 30 && !this.isIdleWarningActive && this.idleSecondsRemaining > 0) {
        this.isIdleWarningActive = true;
        voiceLog.push('NOVA', 'IDLE_PROMPT', { remainingSec: this.idleSecondsRemaining });
        this.onIdleWarning(this.idleSecondsRemaining, true);
        this.onStatusChange('IDLE_PROMPT', { remainingSec: this.idleSecondsRemaining });
      }

      if (this.idleSecondsRemaining <= 0) {
        voiceLog.push('NOVA', 'IDLE_TIMEOUT', { timeoutSeconds: this.idleTimeoutSeconds });
        console.log(`[NOVA][CLIENT] ${this.idleTimeoutSeconds}s idle timeout reached.`);
        this._stopSilenceWatchdog();
        this.onStatusChange('IDLE_TIMEOUT');
        this.disconnect();
      }
    }, 1000);
  }

  /**
   * Resets the idle timeout back to full duration whenever user or agent is active.
   */
  resetSilenceTimer() {
    if (!this.isConnected) return;
    this.idleSecondsRemaining = this.idleTimeoutSeconds;
    if (this.isIdleWarningActive) {
      this.isIdleWarningActive = false;
      this.onIdleWarning(this.idleTimeoutSeconds, false);
      this.onStatusChange('IDLE_RESUMED');
    }
    this.onSilenceTick(this.idleSecondsRemaining);
  }

  _stopSilenceWatchdog() {
    if (this.idleInterval) {
      clearInterval(this.idleInterval);
      this.idleInterval = null;
    }
    this.isIdleWarningActive = false;
  }

  startGreeting() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[NOVA][CLIENT] Requesting native Gemini Live greeting...');
      this.resetSilenceTimer();
      this.ws.send(JSON.stringify({ type: 'START_GREETING' }));
    }
  }

  /**
   * Handles server JSON event packets
   */
  _handleJsonMessage(data) {
    const type = data.type;
    this.resetSilenceTimer();

    if (type === 'SESSION_READY') {
      console.log(`[NOVA][CLIENT] Session ready with model: ${data.model}, user: ${data.user_name}`);
      this._setState('connected', data);
      if (this.autoGreet) {
        this.startGreeting();
      }
    } else if (type === 'RECONNECTING') {
      console.log('[NOVA][CLIENT] Server notified RECONNECTING:', data);
      this._setState('reconnecting', data);
    } else if (type === 'SESSION_RESUMED') {
      console.log('[NOVA][CLIENT] Session resumed handle:', data.handle);
    } else if (type === 'PING') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } else if (type === 'TEXT_CHUNK') {
      this.onTextChunk(data.text);
    } else if (type === 'TOOL_START') {
      console.log(`[NOVA][CLIENT] Tool started: ${data.name}`);
      this.onToolStart(data.name, data.args);
    } else if (type === 'TOOL_PROGRESS') {
      console.log(`[NOVA][CLIENT] Tool progress: ${data.tool}`, data);
      this.onToolProgress(data);
    } else if (type === 'UI_ACTION') {
      console.log(`[NOVA][CLIENT] UI Action received: ${data.action}`, data);
      this.onUIAction(data.action, data);
    } else if (type === 'INTERRUPTED') {
      console.log('[NOVA][CLIENT] Model playback interrupted.');
      this._flushAudioPlayback('server_interrupted');
      this.onStatusChange('INTERRUPTED');
    } else if (type === 'TURN_COMPLETE') {
      console.log('[NOVA][CLIENT] Turn complete. Keeping persistent session active.');
      this.isTurnComplete = true;
      if (this.activeSources.length === 0) {
        this.isTurnComplete = false;
        this.onStatusChange('TURN_COMPLETE');
      }
    } else if (type === 'ERROR') {
      console.error('[NOVA][CLIENT] Server error:', data.message);
      this.onError(data.message);
    }
  }

  /**
   * Immediately stops active audio playback.
   */
  interrupt() {
    this._flushAudioPlayback('manual');
  }

  /**
   * Captures raw microphone audio via AudioWorkletCapture (16kHz PCM 16-bit).
   */
  async _startMicCapture() {
    try {
      if (this.capture) {
        try { this.capture.stop(); } catch (_) {}
      }

      this.capture = new AudioWorkletCapture({
        enableVAD: false,
        onChunk: (pcmArrayBuffer) => this._handleOutgoingMicChunk(pcmArrayBuffer),
        onLevel: (rms) => {
          if (rms > 0.015) {
            this.resetSilenceTimer();
          }
        },
        onError: (err) => {
          console.error('[NOVA][MIC] Capture error:', err);
          this.onError('Microphone permission denied or unavailable.');
        },
      });

      await this.capture.start();
      this.micAnalyser = this.capture.analyserNode;
    } catch (err) {
      console.error('[NOVA][CLIENT] Microphone capture error:', err);
      this.onError('Microphone permission denied or unavailable.');
    }
  }

  /**
   * Routes outgoing 16kHz PCM16 mic frames to the WebSocket.
   */
  _handleOutgoingMicChunk(pcmArrayBuffer) {
    if (!this.isConnected || this.isMuted) return;

    if (this.speakerMode && this.activeSources.length > 0) {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(pcmArrayBuffer);
    }
  }

  /**
   * Ensure AudioContext is initialized and resumed on user gestures.
   */
  async resumeContext() {
    if (this.playContext && this.playContext.state === 'suspended') {
      try {
        await this.playContext.resume();
        voiceLog.push('NOVA', 'AUDIO_CONTEXT_RESUME', { trigger: 'gesture_or_visibility' });
        console.log('[NOVA][AUDIO] Playback AudioContext resumed.');
      } catch (err) {
        console.warn('[NOVA][AUDIO] Resume failed:', err);
      }
    }
  }

  /**
   * Plays incoming 24kHz 16-bit Mono PCM audio seamlessly.
   */
  _playPcmAudio(arrayBuffer) {
    if (!this.playContext) {
      this.playContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000,
      });
      this.nextPlayTime = this.playContext.currentTime;

      voiceLog.push('NOVA', 'PLAYBACK_CONTEXT', {
        requestedRate: 24000,
        actualRate: this.playContext.sampleRate,
      });
      console.debug(`[NOVA][PLAYBACK] AudioContext initialized. Rate: ${this.playContext.sampleRate}Hz`);

      this.playAnalyser = this.playContext.createAnalyser();
      this.playAnalyser.fftSize = 256;
      this.playAnalyser.smoothingTimeConstant = 0.8;
      this.playAnalyser.connect(this.playContext.destination);
    }

    try {
      // Resume if suspended on incoming audio chunk
      if (this.playContext.state === 'suspended') {
        voiceLog.push('NOVA', 'AUDIO_CONTEXT_RESUME', { trigger: 'first_audio_chunk' });
        this.playContext.resume().then(() => {
          console.log('[NOVA][AUDIO] Playback context auto-resumed on audio chunk.');
        }).catch((e) => console.warn('[NOVA][AUDIO] Resume note:', e));
      }

      const int16View = new Int16Array(arrayBuffer);
      const float32Data = new Float32Array(int16View.length);

      for (let i = 0; i < int16View.length; i++) {
        float32Data[i] = int16View[i] / 32768.0;
      }

      const audioBuffer = this.playContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.copyToChannel(float32Data, 0);

      const source = this.playContext.createBufferSource();
      source.buffer = audioBuffer;

      if (this.playAnalyser) {
        source.connect(this.playAnalyser);
      } else {
        source.connect(this.playContext.destination);
      }

      const currentTime = this.playContext.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
      source.start(startTime);

      this.nextPlayTime = startTime + audioBuffer.duration;
      this.activeSources.push(source);

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) this.activeSources.splice(idx, 1);
        try { source.disconnect(); } catch (_) {}
        if (this.activeSources.length === 0 && this.isTurnComplete) {
          this.isTurnComplete = false;
          console.log('[NOVA][CLIENT] Playback complete. Ready for next query.');
          this.onStatusChange('PLAYBACK_COMPLETE');
        }
      };
    } catch (err) {
      console.error('[NOVA][PLAYBACK][DECODE_ERROR] Failed to decode audio chunk:', err);
      voiceLog.push('NOVA', 'DECODE_ERROR', { error: err?.message || String(err), byteLength: arrayBuffer.byteLength });
    }
  }

  /**
   * 60FPS audio level monitor for the visualizer.
   */
  _startAudioMonitor() {
    const dataArray = new Uint8Array(128);

    const loop = () => {
      if (!this.isConnected) return;

      if (this.activeSources.length > 0 && this.playAnalyser) {
        // Nova is speaking
        this.playAnalyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        this.onAudioLevel(rms, 'agent');
      } else if (this.micAnalyser && !this.isMuted) {
        // User speaking or room background
        this.micAnalyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const speaker = rms > 0.02 ? 'user' : 'idle';
        this.onAudioLevel(rms, speaker);
      } else {
        this.onAudioLevel(0, 'idle');
      }

      this.monitorRafId = requestAnimationFrame(loop);
    };

    loop();
  }

  _stopAudioMonitor() {
    if (this.monitorRafId) {
      cancelAnimationFrame(this.monitorRafId);
      this.monitorRafId = null;
    }
  }

  /**
   * Stop active audio playback immediately when interrupted.
   */
  _flushAudioPlayback(reason = 'unknown') {
    voiceLog.push('NOVA', 'FLUSH', { reason, activeSources: this.activeSources.length });
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    }
    this.activeSources = [];
    if (this.playContext) {
      this.nextPlayTime = this.playContext.currentTime;
    }
  }

  /**
   * Send a text message to Nova directly.
   */
  sendText(text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.resetSilenceTimer();
      this.ws.send(JSON.stringify({ type: 'TEXT_INPUT', text }));
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
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

  /**
   * Disconnect and clean up all audio and network resources with zero memory leaks.
   */
  disconnect() {
    this.isManualDisconnect = true;
    this.isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.stableConnectionTimer) {
      clearTimeout(this.stableConnectionTimer);
      this.stableConnectionTimer = null;
    }

    this._stopSilenceWatchdog();
    this._stopAudioMonitor();
    this._flushAudioPlayback('disconnect');
    this._removeWindowListeners();

    if (this.capture) {
      try {
        this.capture.stop();
      } catch (_) {}
      this.capture = null;
    }
    this.micAnalyser = null;

    if (this.playAnalyser) {
      try {
        this.playAnalyser.disconnect();
      } catch (_) {}
      this.playAnalyser = null;
    }

    if (this.playContext) {
      try {
        this.playContext.close();
      } catch (_) {}
      this.playContext = null;
    }

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    this._setState('idle');
    this.onAudioLevel(0, 'idle');
  }

  setSpeakerMode(enabled) {
    this.speakerMode = Boolean(enabled);
    try {
      localStorage.setItem('nova_speaker_mode', this.speakerMode ? 'true' : 'false');
    } catch (_) {}
    voiceLog.push('NOVA', 'SPEAKER_MODE', { enabled: this.speakerMode });
  }
}
