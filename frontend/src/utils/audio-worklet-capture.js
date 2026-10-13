/**
 * audio-worklet-capture.js — Web Audio API AudioWorklet Microphone Capture
 *
 * Configures getUserMedia with hardware AEC/NS/AGC, loads the AudioWorkletProcessor,
 * streams downsampled 16kHz PCM16 chunks via callback, and measures mic RMS level.
 */

import { voiceLog } from './logger';

export class AudioWorkletCapture {
  constructor({
    onChunk = () => {},
    onLevel = () => {},
    onActivityStart = () => {},
    onActivityEnd = () => {},
    onReady = () => {},
    onError = () => {},
    pauseToleranceMs = 2800,
    enableVAD = true,
  } = {}) {
    this.onChunk = onChunk;
    this.onLevel = onLevel;
    this.onActivityStart = onActivityStart;
    this.onActivityEnd = onActivityEnd;
    this.onReady = onReady;
    this.onError = onError;
    this.pauseToleranceMs = pauseToleranceMs;
    this.enableVAD = enableVAD;

    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.zeroGainNode = null;
    this.analyserNode = null;
    this.isRecording = false;
    this.isWorkletReady = false;

    // Adaptive noise floor calibration state
    this.isCalibrating = enableVAD;
    this.calibrationSamples = [];
    this.noiseFloor = 0.005;
    this.speechThreshold = 0.015;
    this.thresholdMultiplier = 2.4;

    // Turn activity state
    this.isUserSpeaking = false;
    this.silenceTimeoutId = null;

    this.animFrameId = null;
  }

  async start() {
    if (this.isRecording) return;

    try {
      // 1. Request microphone with explicit config-driven constraints
      const getBoolEnv = (val, defaultVal = true) => {
        if (val === undefined || val === null || val === '') return defaultVal;
        return val !== 'false' && val !== '0' && val !== false;
      };

      const echoCancellation = getBoolEnv(import.meta.env?.VITE_AUDIO_ECHO_CANCELLATION, true);
      const noiseSuppression = getBoolEnv(import.meta.env?.VITE_AUDIO_NOISE_SUPPRESSION, true);
      const autoGainControl = getBoolEnv(import.meta.env?.VITE_AUDIO_AUTO_GAIN_CONTROL, true);

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      });

      // Log actual applied settings via track.getSettings()
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      const appliedSettings = audioTrack ? audioTrack.getSettings() : {};
      voiceLog.push('MIC', 'TRACK_SETTINGS', appliedSettings);
      console.debug('[MIC][SETTINGS] getUserMedia applied track settings:', appliedSettings);

      // 2. Instantiate AudioContext
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtxClass();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 3. Load AudioWorklet module
      await this.audioContext.audioWorklet.addModule('/audio-recorder-worklet.js');

      // 4. Create nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-recorder-worklet');

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.4;

      this.sourceNode.connect(this.analyserNode);
      this.sourceNode.connect(this.workletNode);

      // Zero-gain node keeps audio rendering thread alive in all browsers
      // without ever routing microphone audio to the speakers.
      this.zeroGainNode = this.audioContext.createGain();
      this.zeroGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.workletNode.connect(this.zeroGainNode);
      this.zeroGainNode.connect(this.audioContext.destination);

      // 5. Worklet message port handler
      this.workletNode.port.onmessage = (event) => {
        const msg = event.data;
        if (!msg) return;

        if (msg.type === 'WORKLET_READY') {
          console.log(`[AUDIO_WORKLET] Ready! Native HW: ${msg.hardwareRate} Hz -> Target: ${msg.targetRate} Hz`);
          this.isWorkletReady = true;
          this.onReady({
            hardwareRate: msg.hardwareRate,
            targetRate: msg.targetRate,
          });
          // Activate recording and flush pre-roll buffer
          this.workletNode.port.postMessage({ type: 'START_RECORDING' });
          return;
        }

        if (msg instanceof ArrayBuffer && msg.byteLength > 0) {
          if (this.isRecording) {
            this.onChunk(msg);
          }
        }
      };

      this.isRecording = true;
      this.isCalibrating = this.enableVAD;
      this.calibrationSamples = [];
      const calibrationEnd = performance.now() + 2000; // First 2 seconds of session noise

      this._startLevelMonitor(calibrationEnd);

      return {
        sampleRate: this.audioContext.sampleRate,
      };
    } catch (err) {
      this.stop();
      this.onError(err);
      throw err;
    }
  }

  _startLevelMonitor(calibrationEnd) {
    const dataArray = new Uint8Array(128);

    const checkLevel = () => {
      if (!this.isRecording || !this.analyserNode) return;

      this.analyserNode.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      this.onLevel(rms);

      if (this.enableVAD) {
        // Adaptive calibration during initial 2 seconds
        if (this.isCalibrating) {
          this.calibrationSamples.push(rms);
          if (performance.now() >= calibrationEnd) {
            this.isCalibrating = false;
            if (this.calibrationSamples.length > 0) {
              const avg = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
              this.noiseFloor = Math.max(0.003, avg);
              this.speechThreshold = Math.max(0.012, this.noiseFloor * this.thresholdMultiplier);
              voiceLog.push('WORKLET', 'CALIBRATION_DONE', { noiseFloor: this.noiseFloor.toFixed(4), speechThreshold: this.speechThreshold.toFixed(4) });
              console.log(`[AUDIO][CALIBRATION] Noise Floor: ${this.noiseFloor.toFixed(4)} | Adaptive Speech Threshold: ${this.speechThreshold.toFixed(4)} (factor=${this.thresholdMultiplier})`);
            }
          }
        } else {
          // Active candidate turn detection
          if (rms >= this.speechThreshold) {
            if (!this.isUserSpeaking) {
              this.isUserSpeaking = true;
              voiceLog.push('WORKLET', 'ACTIVITY_START', { rms: rms.toFixed(4), threshold: this.speechThreshold.toFixed(4) });
              this.onActivityStart();
            }
            if (this.silenceTimeoutId) {
              clearTimeout(this.silenceTimeoutId);
              this.silenceTimeoutId = null;
            }
          } else if (this.isUserSpeaking) {
            if (!this.silenceTimeoutId) {
              this.silenceTimeoutId = setTimeout(() => {
                this.isUserSpeaking = false;
                this.silenceTimeoutId = null;
                voiceLog.push('WORKLET', 'ACTIVITY_END', { pauseToleranceMs: this.pauseToleranceMs });
                this.onActivityEnd();
              }, this.pauseToleranceMs);
            }
          }
        }
      }

      this.animFrameId = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  }

  stop() {
    this.isRecording = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.zeroGainNode) {
      try {
        this.zeroGainNode.disconnect();
      } catch (_) {}
      this.zeroGainNode = null;
    }

    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
      } catch (_) {}
      this.workletNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch (_) {}
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }

    this.onLevel(0);
  }
}
