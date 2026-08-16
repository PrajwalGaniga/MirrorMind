/**
 * Captures raw audio from the microphone and converts it to a 16kHz 16-bit Mono WAV Blob.
 * This bypasses the need for ffmpeg on the backend by avoiding WebM format.
 */
export class AudioRecorder {
  constructor() {
    this.audioContext = null;
    this.stream = null;
    this.mediaStreamSource = null;
    this.processor = null;
    this.pcmBuffers = [];
    this.recordingLength = 0;
    this.sampleRate = 16000; // Required by Whisper
  }

  async start() {
    this.pcmBuffers = [];
    this.recordingLength = 0;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.sampleRate
    });
    
    // We get actual sample rate (should be 16000 if supported)
    this.sampleRate = this.audioContext.sampleRate;

    this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
    
    // Create a ScriptProcessorNode with a bufferSize of 4096 and a single input and output channel
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const bufferData = new Float32Array(inputData.length);
      bufferData.set(inputData);
      
      this.pcmBuffers.push(bufferData);
      this.recordingLength += bufferData.length;
    };
    
    this.mediaStreamSource.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.processor) return resolve(null);
      
      this.processor.disconnect();
      this.mediaStreamSource.disconnect();
      
      this.stream.getTracks().forEach(track => track.stop());
      
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      
      // Flatten the buffers into a single Float32Array
      const flatBuffer = new Float32Array(this.recordingLength);
      let offset = 0;
      for (let i = 0; i < this.pcmBuffers.length; i++) {
        flatBuffer.set(this.pcmBuffers[i], offset);
        offset += this.pcmBuffers[i].length;
      }
      
      // Resample to exactly 16000Hz if the AudioContext couldn't enforce it
      const resampledBuffer = this._resample(flatBuffer, this.sampleRate, 16000);
      
      const wavBlob = this._encodeWAV(resampledBuffer, 16000);
      resolve(wavBlob);
    });
  }

  _resample(buffer, fromRate, toRate) {
    if (fromRate === toRate) return buffer;
    const ratio = fromRate / toRate;
    const newLen = Math.round(buffer.length / ratio);
    const resampled = new Float32Array(newLen);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < resampled.length) {
      let nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      resampled[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return resampled;
  }

  _encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    
    // RIFF chunk descriptor
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this._writeString(view, 8, 'WAVE');
    
    // FMT sub-chunk
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    
    // Data sub-chunk
    this._writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    
    // Write 16-bit PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    return new Blob([view], { type: 'audio/wav' });
  }

  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
