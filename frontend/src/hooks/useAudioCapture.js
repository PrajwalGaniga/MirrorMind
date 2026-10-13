import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioWorkletCapture } from '../utils/audio-worklet-capture';

/**
 * useAudioCapture — React hook for AudioWorklet microphone capture
 * Delivers 16 kHz PCM16 mono chunks, RMS volume meter, and hardware sample rate info.
 */
export function useAudioCapture({ onChunk, onError } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [hardwareSampleRate, setHardwareSampleRate] = useState(null);
  const captureRef = useRef(null);

  const startCapture = useCallback(async () => {
    try {
      if (!captureRef.current) {
        captureRef.current = new AudioWorkletCapture({
          onChunk: (chunk) => {
            if (onChunk) onChunk(chunk);
          },
          onLevel: (level) => {
            setMicLevel(level);
          },
          onError: (err) => {
            console.error('[useAudioCapture] Error:', err);
            if (onError) onError(err);
          },
        });
      }

      const info = await captureRef.current.start();
      setHardwareSampleRate(info.sampleRate);
      setIsRecording(true);
      return info;
    } catch (err) {
      setIsRecording(false);
      throw err;
    }
  }, [onChunk, onError]);

  const stopCapture = useCallback(() => {
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }
    setIsRecording(false);
    setMicLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      if (captureRef.current) {
        captureRef.current.stop();
      }
    };
  }, []);

  return {
    isRecording,
    micLevel,
    hardwareSampleRate,
    startCapture,
    stopCapture,
  };
}
