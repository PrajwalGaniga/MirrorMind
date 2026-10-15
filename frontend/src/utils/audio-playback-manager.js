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
    this.leadCushionSec = 0.10; // 100ms jitter buffer to eliminate packet starvation & buzzing vibration
    this.turnStartTime = 0;
    this.turnAudioDuration = 0;
    this.turnChunkCount = 0;
  }

  _initContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtxClass();
      this.nextStartTime = this.audioContext.currentTime;
    }
    if (this.audioContext.state === 'suspended') {
      voiceLog.push('PLAYBACK', 'AUDIO_CONTEXT_RESUME', { previousState: this.audioContext.state });
      this.audioContext.resume().then(() => {
        console.log('[PLAYBACK] AudioContext resumed successfully.');
      }).catch((e) => {
        console.warn('[PLAYBACK] Failed to resume AudioContext:', e);
      });
    }
  }

  async resume() {
    this._initContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        voiceLog.push('PLAYBACK', 'AUDIO_CONTEXT_RESUME', { trigger: 'user_gesture' });
      } catch (err) {
        console.warn('[PLAYBACK] Manual resume failed:', err);
      }
    }
  }

  /**
   * Schedule incoming 24kHz PCM16 ArrayBuffer chunk onto the playback timeline.
   * Employs a 100ms jitter cushion to guarantee gapless audio without robotic vibration.
   * @param {ArrayBuffer} pcmArrayBuffer - Raw 24kHz 16-bit Mono PCM bytes
   */
  playChunk(pcmArrayBuffer) {
    if (!pcmArrayBuffer || pcmArrayBuffer.byteLength < 2) {
      voiceLog.push('PLAYBACK', 'DECODE_SKIP', { reason: 'empty_or_short_chunk', bytes: pcmArrayBuffer?.byteLength || 0 });
      return;
    }

    try {
      this._initContext();

      // Guard against odd byte lengths (Int16Array requires multiple of 2)
      const byteLen = pcmArrayBuffer.byteLength;
      const validBytes = byteLen - (byteLen % 2);
      const int16View = new Int16Array(pcmArrayBuffer, 0, validBytes / 2);
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

      const currentTime = this.audioContext.currentTime;
      const isIdle = this.activeSources.size === 0 || this.nextStartTime <= currentTime;

      let startTime;
      if (isIdle) {
        // Initial lead cushion (100ms) absorbs network packet jitter
        // so subsequent chunks connect seamlessly without starvation gaps
        startTime = currentTime + this.leadCushionSec;
        this.turnStartTime = performance.now();
        this.turnAudioDuration = 0;
        this.turnChunkCount = 0;
        console.log(`[PLAYBACK] Speech started with ${(this.leadCushionSec * 1000).toFixed(0)}ms jitter cushion.`);
      } else {
        startTime = this.nextStartTime;
      }

      // If network burst caused timeline to drift too far ahead (> 300ms), gently sync back
      if (startTime - currentTime > 0.30) {
        console.warn(`[PLAYBACK] Timeline drift (${((startTime - currentTime) * 1000).toFixed(0)}ms). Re-anchoring.`);
        startTime = currentTime + this.leadCushionSec;
      }

      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;
      this.turnAudioDuration += audioBuffer.duration;
      this.turnChunkCount++;
      this.activeSources.add(source);

      source.onended = () => {
        this.activeSources.delete(source);
        try {
          source.disconnect();
        } catch (_) {}

        if (this.activeSources.size === 0) {
          const wallClockSec = (performance.now() - this.turnStartTime) / 1000;
          const speedRatio = this.turnAudioDuration / (wallClockSec || 1);
          console.log(
            `[PLAYBACK] Turn speech concluded. Total audio: ${this.turnAudioDuration.toFixed(2)}s | Wall clock: ${wallClockSec.toFixed(2)}s | Playback rate: ${speedRatio.toFixed(2)}x | Chunks: ${this.turnChunkCount}`
          );
          voiceLog.push('PLAYBACK', 'TURN_CONCLUDED', {
            audioDurationSec: this.turnAudioDuration,
            wallClockSec,
            speedRatio,
            chunks: this.turnChunkCount,
          });
        }
      };
    } catch (err) {
      console.error('[PLAYBACK][DECODE_ERROR] Failed to decode/schedule audio chunk:', err);
      voiceLog.push('PLAYBACK', 'DECODE_ERROR', {
        error: err?.message || String(err),
        byteLength: pcmArrayBuffer.byteLength,
      });
    }
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
