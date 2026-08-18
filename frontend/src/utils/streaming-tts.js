export function cleanTextForSpeech(text) {
  if (!text) return '';
  let cleaned = text;

  // Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`/g, '');

  // Remove markdown headings
  cleaned = cleaned.replace(/^#+\s+/gm, '');

  // Remove bold and italic markers
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/__/g, '');
  cleaned = cleaned.replace(/_/g, '');

  // Remove markdown list markers
  cleaned = cleaned.replace(/^\s*-\s+/gm, '');
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');

  // Replace excessive dashes/newlines with a single space or pause
  cleaned = cleaned.replace(/-{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{2,}/g, '. ');
  cleaned = cleaned.replace(/\n/g, ' ');

  // Normalize spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

class StreamingTTS {
  constructor() {
    this.audioCtx = null;
    this.ws = null;
    this.nextStartTime = 0;
    this.sampleRate = 22050; // lessac-medium
    this._speaking = false;
    this._paused = false;
    this.currentResolve = null;
    this.currentReject = null;
    this.scheduledSources = [];
  }

  initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
    }
  }

  _cleanup() {
    this.scheduledSources.forEach(source => {
      try { source.stop(); } catch(e) {}
      try { source.disconnect(); } catch(e) {}
    });
    this.scheduledSources = [];
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._speaking = false;
    this._paused = false;
  }

  speak(text) {
    return new Promise((resolve, reject) => {
      this.stop(); // cancel existing

      this.currentResolve = resolve;
      this.currentReject = reject;
      this._speaking = true;

      try {
        this.initAudio();
        // Reset timing
        this.nextStartTime = this.audioCtx.currentTime + 0.1;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Derive host from api base or current host. Using api/axios host usually.
        // Hardcoding standard dev port if not found for simplicity:
        const host = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws') : `${protocol}//localhost:8000`;
        const wsUrl = `${host}/api/voice/ws/tts`;

        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
          console.log(`[MIRRORMIND][STREAMING_TTS] WebSocket connected`);
          const cleanedText = cleanTextForSpeech(text);
          this.ws.send(cleanedText);
        };

        this.ws.onmessage = (event) => {
          if (typeof event.data === "string") {
            if (event.data === "__END__") {
              console.log(`[MIRRORMIND][STREAMING_TTS] Stream ended`);
              // Wait for audio to finish playing before resolving
              const timeRemaining = Math.max(0, this.nextStartTime - this.audioCtx.currentTime);
              setTimeout(() => {
                if (this._speaking) {
                  this._speaking = false;
                  if (this.currentResolve) this.currentResolve();
                }
              }, timeRemaining * 1000 + 100);
            }
            return;
          }

          const int16 = new Int16Array(event.data);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
          }

          const buffer = this.audioCtx.createBuffer(1, float32.length, this.sampleRate);
          buffer.copyToChannel(float32, 0);

          const source = this.audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.audioCtx.destination);

          const startAt = Math.max(this.audioCtx.currentTime, this.nextStartTime);
          source.start(startAt);
          this.nextStartTime = startAt + buffer.duration;
          
          this.scheduledSources.push(source);
        };

        this.ws.onerror = (e) => {
          console.error(`[MIRRORMIND][STREAMING_TTS] WebSocket error`, e);
          if (this.currentReject) this.currentReject(new Error("WebSocket streaming failed"));
          this._cleanup();
        };

        this.ws.onclose = () => {
          console.log(`[MIRRORMIND][STREAMING_TTS] WebSocket closed`);
        };

      } catch (err) {
        if (this.currentReject) this.currentReject(err);
        this._cleanup();
      }
    });
  }

  pause() {
    if (this.audioCtx && this.audioCtx.state === 'running' && this._speaking) {
      this.audioCtx.suspend();
      this._paused = true;
    }
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended' && this._paused) {
      this.audioCtx.resume();
      this._paused = false;
    }
  }

  stop() {
    this._cleanup();
    if (this.currentResolve) {
      this.currentResolve(); // Resolve to prevent hanging Promises
      this.currentResolve = null;
      this.currentReject = null;
    }
    // ensure audio ctx resumes if it was paused when stopped
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  isSpeaking() {
    return this._speaking;
  }
}

export const streamingTTS = new StreamingTTS();
