/**
 * audio-recorder-worklet.js — Low-latency 16 kHz PCM16 AudioWorkletProcessor
 *
 * Runs on the dedicated audio rendering thread:
 * 1. Takes raw microphone audio frames (Float32, default 128 frames/block at hardware sampleRate).
 * 2. Downsamples dynamically to exactly 16,000 Hz using linear interpolation.
 * 3. Quantizes Float32 [-1.0, 1.0] -> Int16 Little-Endian [-32768, 32767].
 * 4. Emits binary ArrayBuffers every 40 ms (640 samples = 1280 bytes) with zero-copy transfer.
 */

class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.chunkSize = 640; // 40ms at 16kHz
    this.chunkBuffer = new Int16Array(this.chunkSize);
    this.chunkIndex = 0;

    // Resampling state across process() calls
    this.resampleRatio = sampleRate / this.targetSampleRate;
    this.sourcePhase = 0;
    this.lastInputSample = 0;

    // 1-second circular pre-roll buffer (25 chunks * 640 samples = 16,000 samples = 1 sec)
    this.preRollMaxChunks = 25;
    this.preRollQueue = [];
    this.isActive = false;

    this.port.onmessage = (e) => {
      const data = e.data;
      if (data && data.type === 'START_RECORDING') {
        this.isActive = true;
        // Immediately flush buffered pre-roll chunks to prevent initial speech clipping
        while (this.preRollQueue.length > 0) {
          const preChunk = this.preRollQueue.shift();
          this.port.postMessage(preChunk.buffer, [preChunk.buffer]);
        }
      } else if (data && data.type === 'STOP_RECORDING') {
        this.isActive = false;
        this.preRollQueue = [];
      }
    };

    // Confirm worklet initialization to main thread
    this.port.postMessage({ type: 'WORKLET_READY', hardwareRate: sampleRate, targetRate: this.targetSampleRate });
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channelData = input[0];
    const inputLength = channelData.length;

    // Resample from hardware sampleRate to 16kHz
    while (this.sourcePhase < inputLength) {
      const index = Math.floor(this.sourcePhase);
      const frac = this.sourcePhase - index;

      const s0 = index === 0 ? this.lastInputSample : channelData[index - 1];
      const s1 = channelData[index];

      // Linear interpolation for clean downsampling
      const interpolated = s0 + frac * (s1 - s0);

      // Quantize to 16-bit signed PCM
      const clamped = Math.max(-1.0, Math.min(1.0, interpolated));
      const pcm16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      this.chunkBuffer[this.chunkIndex++] = pcm16;

      // When 40ms (640 samples) are collected:
      if (this.chunkIndex >= this.chunkSize) {
        if (this.isActive) {
          this.port.postMessage(this.chunkBuffer.buffer, [this.chunkBuffer.buffer]);
        } else {
          // Retain in 1-second circular pre-roll buffer
          if (this.preRollQueue.length >= this.preRollMaxChunks) {
            this.preRollQueue.shift();
          }
          this.preRollQueue.push(this.chunkBuffer);
        }
        this.chunkBuffer = new Int16Array(this.chunkSize);
        this.chunkIndex = 0;
      }

      this.sourcePhase += this.resampleRatio;
    }

    this.sourcePhase -= inputLength;
    this.lastInputSample = channelData[inputLength - 1];

    return true;
  }
}

registerProcessor('audio-recorder-worklet', AudioRecorderProcessor);
