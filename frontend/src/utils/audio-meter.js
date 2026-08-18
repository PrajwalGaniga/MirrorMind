/**
 * AudioMeterManager
 *
 * Connects a Web Audio AnalyserNode to a live MediaStream and provides
 * a getLevel() method that returns a normalized 0–1 RMS value.
 *
 * Usage:
 *   audioMeter.connect(stream);       // call after getUserMedia succeeds
 *   const rms = audioMeter.getLevel(); // call on each animation frame
 *   audioMeter.disconnect();           // call when mic closes
 *
 * This is intentionally separate from AudioRecorder so the meter can be
 * attached/detached independently of the recording session.
 */
class AudioMeterManager {
  constructor() {
    this._audioCtx = null;
    this._analyser = null;
    this._source = null;
    this._dataArray = null;
    this._connected = false;
  }

  /**
   * Attach analyser to the given MediaStream.
   * Safe to call multiple times — disconnects any previous connection first.
   * @param {MediaStream} stream
   */
  connect(stream) {
    this.disconnect(); // tear down any existing connection

    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this._analyser = this._audioCtx.createAnalyser();
      this._analyser.fftSize = 256;
      this._analyser.smoothingTimeConstant = 0.6;

      this._source = this._audioCtx.createMediaStreamSource(stream);
      this._source.connect(this._analyser);
      // Do NOT connect analyser to destination — we don't want to hear the mic.

      this._dataArray = new Uint8Array(this._analyser.frequencyBinCount);
      this._connected = true;

      console.log('[MIRRORMIND][AUDIO_METER] connected');
    } catch (err) {
      console.warn('[MIRRORMIND][AUDIO_METER] connect_failed', err);
      this._connected = false;
    }
  }

  /**
   * Returns a normalized RMS amplitude in the range 0–1.
   * Returns 0 when not connected.
   */
  getLevel() {
    if (!this._connected || !this._analyser) return 0;

    this._analyser.getByteTimeDomainData(this._dataArray);

    let sum = 0;
    const len = this._dataArray.length;
    for (let i = 0; i < len; i++) {
      const v = (this._dataArray[i] - 128) / 128; // normalize to -1..1
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / len) * 3); // amplify slightly, cap at 1
  }

  /**
   * Disconnect and clean up all Web Audio nodes.
   */
  disconnect() {
    if (this._source) {
      try { this._source.disconnect(); } catch (_) {}
      this._source = null;
    }
    if (this._analyser) {
      try { this._analyser.disconnect(); } catch (_) {}
      this._analyser = null;
    }
    if (this._audioCtx) {
      try { this._audioCtx.close(); } catch (_) {}
      this._audioCtx = null;
    }
    this._dataArray = null;
    this._connected = false;
  }

  get isConnected() {
    return this._connected;
  }
}

export const audioMeter = new AudioMeterManager();
