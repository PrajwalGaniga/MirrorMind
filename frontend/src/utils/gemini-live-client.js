/**
 * gemini-live-client.js — Client-Side Google Gemini Live Audio Bridge for Nova
 *
 * Establishes a persistent, bidirectional WebSocket connection with /api/voice/live:
 * - Streams live microphone audio (16kHz 16-bit PCM) to Gemini Live.
 * - Gaplessly plays back real-time 24kHz PCM audio streams from Gemini Live.
 * - Handles live tool actions (navigation, document opening, portfolio updates).
 * - Implements conversational barge-in / interruption flushing.
 * - Persistent connection across conversation turns (only sleeps after extended silence, e.g. 60s).
 * - Real-time dual-direction audio level analysis for fluid wave visualization.
 */

export class GeminiLiveClient {
  constructor({
    onAudioLevel = () => {},
    onTextChunk = () => {},
    onToolStart = () => {},
    onToolProgress = () => {},
    onUIAction = () => {},
    onStatusChange = () => {},
    onSilenceTick = () => {},
    onError = () => {},
    silenceTimeoutSeconds = 30,
  } = {}) {
    this.onAudioLevel = onAudioLevel;
    this.onTextChunk = onTextChunk;
    this.onToolStart = onToolStart;
    this.onToolProgress = onToolProgress;
    this.onUIAction = onUIAction;
    this.onStatusChange = onStatusChange;
    this.onSilenceTick = onSilenceTick;
    this.onError = onError;
    this.silenceTimeoutSeconds = silenceTimeoutSeconds;

    this.ws = null;
    this.micStream = null;
    this.micContext = null;
    this.micProcessor = null;
    this.micAnalyser = null;

    this.playContext = null;
    this.playAnalyser = null;
    this.nextPlayTime = 0;
    this.activeSources = [];
    this.isConnected = false;
    this.isMuted = false;
    this.isTurnComplete = false;

    // Silence watchdog state
    this.silenceTimer = null;
    this.silenceSecondsRemaining = silenceTimeoutSeconds;
    this.silenceInterval = null;

    // Continuous audio animation monitor
    this.monitorRafId = null;
  }

  /**
   * Connect to the backend Live Voice WebSocket.
   * @param {string} token - Student authentication JWT token
   * @param {object} options - Options { autoGreet: boolean }
   */
  async connect(token = '', { autoGreet = false } = {}) {
    this.autoGreet = autoGreet;
    if (this.isConnected) {
      if (autoGreet) this.startGreeting();
      return;
    }

    try {
      this.onStatusChange('CONNECTING');

      // Determine WebSocket protocol and host
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
      const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsUrl = `${wsProtocol}//${host}/api/voice/live?token=${encodeURIComponent(token)}`;

      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = async () => {
        console.log('[NOVA][CLIENT] Persistent WebSocket connected to Gemini Live.');
        this.isConnected = true;
        this.onStatusChange('ACTIVE');
        this._startSilenceWatchdog();
        await this._startMicCapture();
        this._startAudioMonitor();
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
            console.warn('[NOVA][CLIENT] Parse error:', err);
          }
        }
      };

      this.ws.onerror = (err) => {
        console.error('[NOVA][CLIENT] WebSocket error:', err);
        this.onError('Live voice connection error.');
      };

      this.ws.onclose = () => {
        console.log('[NOVA][CLIENT] WebSocket closed.');
        this.disconnect();
      };
    } catch (err) {
      console.error('[NOVA][CLIENT] Connection initialization failed:', err);
      this.onError(err.message || 'Failed to initialize live voice.');
      this.disconnect();
    }
  }

  /**
   * Starts the 60-second inactivity watchdog.
   */
  _startSilenceWatchdog() {
    this._stopSilenceWatchdog();
    this.silenceSecondsRemaining = this.silenceTimeoutSeconds;
    this.onSilenceTick(this.silenceSecondsRemaining);

    this.silenceInterval = setInterval(() => {
      this.silenceSecondsRemaining -= 1;
      this.onSilenceTick(Math.max(0, this.silenceSecondsRemaining));

      if (this.silenceSecondsRemaining <= 0) {
        console.log(`[NOVA][CLIENT] ${this.silenceTimeoutSeconds}s silence timeout reached. Sleeping gracefully.`);
        this._stopSilenceWatchdog();
        this.onStatusChange('SILENCE_TIMEOUT');
        this.disconnect();
      }
    }, 1000);
  }

  /**
   * Resets the silence timeout back to full duration whenever user or agent is active.
   */
  resetSilenceTimer() {
    if (!this.isConnected) return;
    this.silenceSecondsRemaining = this.silenceTimeoutSeconds;
    this.onSilenceTick(this.silenceSecondsRemaining);
  }

  _stopSilenceWatchdog() {
    if (this.silenceInterval) {
      clearInterval(this.silenceInterval);
      this.silenceInterval = null;
    }
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
      this.onStatusChange('READY', data);
      if (this.autoGreet) {
        this.startGreeting();
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
      this._flushAudioPlayback();
      this.onStatusChange('INTERRUPTED');
    } else if (type === 'TURN_COMPLETE') {
      // KEEP WEBSOCKET OPEN! Do not disconnect on turn complete.
      console.log('[NOVA][CLIENT] Turn complete. Keeping persistent session active.');
      this.isTurnComplete = true;
      if (this.activeSources.length === 0) {
        this.isTurnComplete = false;
        this.onStatusChange('TURN_COMPLETE');
      }
    } else if (type === 'ERROR') {
      this.onError(data.message);
    }
  }

  /**
   * Immediately stops active audio playback and notifies server.
   */
  interrupt() {
    this._flushAudioPlayback();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'INTERRUPT' }));
      } catch (_) {}
    }
  }

  /**
   * Captures raw microphone audio, downsamples to 16kHz PCM 16-bit, and streams via WS.
   */
  async _startMicCapture() {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });

      const source = this.micContext.createMediaStreamSource(this.micStream);

      // Create AnalyserNode for high-res mic level visualization
      this.micAnalyser = this.micContext.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micAnalyser.smoothingTimeConstant = 0.8;
      source.connect(this.micAnalyser);

      // 2048 buffer size gives ~128ms latency per audio packet
      this.micProcessor = this.micContext.createScriptProcessor(2048, 1, 1);

      this.micProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || this.isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Compute RMS audio level
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        // If user is actively speaking, reset the silence timeout
        if (rms > 0.015) {
          this.resetSilenceTimer();
        }

        // Conversational Barge-In: if user speaks while agent is speaking, flush playback
        if (rms > 0.04 && this.activeSources.length > 0) {
          this._flushAudioPlayback();
        }

        // Convert Float32 to 16-bit PCM Little Endian
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Send binary PCM frame over WebSocket
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(pcm16.buffer);
        }
      };

      source.connect(this.micProcessor);
      this.micProcessor.connect(this.micContext.destination);
    } catch (err) {
      console.error('[NOVA][CLIENT] Microphone capture error:', err);
      this.onError('Microphone permission denied or unavailable.');
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

      // Create AnalyserNode for audio output visualization
      this.playAnalyser = this.playContext.createAnalyser();
      this.playAnalyser.fftSize = 256;
      this.playAnalyser.smoothingTimeConstant = 0.8;
      this.playAnalyser.connect(this.playContext.destination);
    }

    if (this.playContext.state === 'suspended') {
      this.playContext.resume();
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
      if (this.activeSources.length === 0 && this.isTurnComplete) {
        this.isTurnComplete = false;
        console.log('[NOVA][CLIENT] Playback complete. Ready for next query.');
        this.onStatusChange('PLAYBACK_COMPLETE');
      }
    };
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
  _flushAudioPlayback() {
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
   * Send a text message to Nova directly if needed.
   */
  sendText(text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.resetSilenceTimer();
      this.ws.send(JSON.stringify({ type: 'TEXT_INPUT', text }));
    }
  }

  /**
   * Toggle mute microphone.
   */
  setMuted(muted) {
    this.isMuted = muted;
  }

  /**
   * Disconnect and clean up all audio and network resources.
   */
  disconnect() {
    this.isConnected = false;
    this._stopSilenceWatchdog();
    this._stopAudioMonitor();
    this._flushAudioPlayback();

    if (this.micProcessor) {
      try {
        this.micProcessor.disconnect();
      } catch (_) {}
      this.micProcessor = null;
    }

    if (this.micAnalyser) {
      try {
        this.micAnalyser.disconnect();
      } catch (_) {}
      this.micAnalyser = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.micContext) {
      try {
        this.micContext.close();
      } catch (_) {}
      this.micContext = null;
    }

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
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    this.onStatusChange('DISCONNECTED');
    this.onAudioLevel(0, 'idle');
  }
}
