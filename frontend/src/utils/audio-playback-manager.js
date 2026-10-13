/**
 * audio-playback-manager.js — Gapless 24 kHz Web Audio PCM Playback with Immediate Interruption Flushing
 *
 * Schedules incoming 24kHz 16-bit PCM binary chunks onto an uninterrupted timeline.
 * Tracks every active AudioBufferSourceNode and flushes all audio instantly when interrupted.
 */

import { voiceLog } from './logger';

export class AudioPlaybackManager {
  constructor() {
    this.audioContext = null;
    this.nextStartTime = 0;
    this.activeSources = new Set();
    this.targetSampleRate = 24000;
  }

  _initContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtxClass();
      this.nextStartTime = this.audioContext.currentTime;
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * Schedule incoming 24kHz PCM16 ArrayBuffer chunk onto the playback timeline.
   * @param {ArrayBuffer} pcmArrayBuffer - Raw 24kHz 16-bit Mono PCM bytes
   */
  playChunk(pcmArrayBuffer) {
    if (!pcmArrayBuffer || pcmArrayBuffer.byteLength < 2) return;

    this._initContext();

    const int16View = new Int16Array(pcmArrayBuffer);
    const float32Data = new Float32Array(int16View.length);

    // Convert Int16 [-32768, 32767] to normalized Float32 [-1.0, 1.0]
    for (let i = 0; i < int16View.length; i++) {
      float32Data[i] = int16View[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(
      1,
      float32Data.length,
      this.targetSampleRate
    );
    audioBuffer.copyToChannel(float32Data, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // Gapless scheduling
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    source.start(startTime);

    this.nextStartTime = startTime + audioBuffer.duration;
    this.activeSources.add(source);

    source.onended = () => {
      this.activeSources.delete(source);
      try {
        source.disconnect();
      } catch (_) {}
    };
  }

  /**
   * CRITICAL: Immediately stops and clears all scheduled and playing audio sources.
   * Resets nextStartTime so new AI speech begins with zero lag.
   * @param {string} reason - Reason for flushing ('server_interrupted', 'activity_start', 'manual', etc.)
   */
  flush(reason = 'unknown') {
    voiceLog.push('PLAYBACK', 'FLUSH', { reason, activeCount: this.activeSources.size });
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop(0);
        source.disconnect();
      } catch (_) {}
    }
    this.activeSources.clear();

    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
  }

  close() {
    this.flush('close');
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }
  }
}
