/**
 * Captures raw audio from the microphone and converts it to a 16kHz 16-bit Mono WAV Blob.
 * This bypasses the need for ffmpeg on the backend by avoiding WebM format.
 *
 * Module 9.1: Enhanced silence detection for short command reliability.
 * - minRecordingMs: ignore silence for the first N ms (prevents premature cutoff)
 * - speechDetected: only start silence countdown AFTER speech is heard
 * - Structured logging for diagnostics
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
    
    // Silence detection properties
    this.onSilence = null;
    this.onMaxDuration = null;
    this.silenceThreshold = 0.01; // RMS threshold
    this.silenceDuration = 1800; // ms of silence AFTER speech before triggering (Module 9.1: raised from 1500)
    this.maxDuration = 30000; // ms of max recording
    this.minRecordingMs = 1200; // Module 9.1: minimum recording window before silence detection activates
    this.silenceStart = null;
    this.startTime = null;
    this.stopped = false;
    this.speechDetected = false; // Module 9.1: tracks whether user has actually spoken
  }

  async start() {
    this.pcmBuffers = [];
    this.recordingLength = 0;
    this.stopped = false;
    this.startTime = null;
    this.silenceStart = null;
    this.speechDetected = false;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.sampleRate
    });
    
    // We get actual sample rate (should be 16000 if supported)
    this.sampleRate = this.audioContext.sampleRate;

    this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
    
    // Create a ScriptProcessorNode with a bufferSize of 4096 and a single input and output channel
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    console.log('[MIRRORMIND][VOICE][COMMAND] recording_started=true');

    this.processor.onaudioprocess = (e) => {
      if (this.stopped) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const bufferData = new Float32Array(inputData.length);
      bufferData.set(inputData);
      
      this.pcmBuffers.push(bufferData);
      this.recordingLength += bufferData.length;
      
      // Calculate RMS for silence detection
      if (this.onSilence || this.onMaxDuration) {
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const now = Date.now();
        
        if (!this.startTime) this.startTime = now;
        const elapsed = now - this.startTime;
        
        // Max duration check
        if (this.onMaxDuration && elapsed >= this.maxDuration) {
          this.stopped = true;
          console.log('[MIRRORMIND][VOICE][COMMAND] recording_stopped=true reason=max_duration');
          this.onMaxDuration();
          return;
        }
        
        // Track whether speech has been detected (any frame above threshold)
        if (!this.speechDetected && rms >= this.silenceThreshold) {
          this.speechDetected = true;
          console.log(`[MIRRORMIND][VOICE][COMMAND] speech_detected=true elapsed=${elapsed}ms`);
        }

        // Silence detection — ONLY activates when BOTH conditions are met:
        // 1. Minimum recording time has passed (minRecordingMs)
        // 2. Speech has been detected at least once
        if (this.onSilence && elapsed >= this.minRecordingMs && this.speechDetected) {
          if (rms < this.silenceThreshold) {
            if (!this.silenceStart) this.silenceStart = now;
            else if (now - this.silenceStart >= this.silenceDuration) {
              this.stopped = true;
              console.log(`[MIRRORMIND][VOICE][COMMAND] silence_detected=true duration=${this.silenceDuration}ms`);
              console.log('[MIRRORMIND][VOICE][COMMAND] recording_stopped=true reason=silence');
              this.onSilence();
            }
          } else {
            this.silenceStart = null; // Reset silence timer if we hear noise
          }
        }
      }
    };
    
    this.mediaStreamSource.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    return new Promise((resolve) => {
      this.stopped = true;
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
