import os

code = """import os
import io
import wave
import numpy as np
import asyncio
from transformers import pipeline

# Global instances to avoid reloading models on every request
_stt_pipeline = None
_piper_voice = None

def get_stt_pipeline():
    global _stt_pipeline
    if _stt_pipeline is None:
        print("[VOICE] Loading Whisper STT model (openai/whisper-tiny)...")
        _stt_pipeline = pipeline("automatic-speech-recognition", model="openai/whisper-tiny")
    return _stt_pipeline

def get_piper_voice():
    global _piper_voice
    if _piper_voice is None:
        models_dir = os.path.join(os.path.dirname(__file__), "..", "models", "piper")
        os.makedirs(models_dir, exist_ok=True)
        model_name = "en_US-lessac-medium"
        onnx_path = os.path.join(models_dir, f"{model_name}.onnx")
        json_path = os.path.join(models_dir, f"{model_name}.onnx.json")
        
        if not os.path.exists(onnx_path) or not os.path.exists(json_path):
            print(f"[VOICE] Downloading Piper TTS model {model_name}...")
            import urllib.request
            base_url = f"https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/{model_name}"
            urllib.request.urlretrieve(f"{base_url}.onnx", onnx_path)
            urllib.request.urlretrieve(f"{base_url}.onnx.json", json_path)
            print("[VOICE] Download complete.")
            
        try:
            from piper import PiperVoice
            print(f"[VOICE] Loading Piper TTS model from {onnx_path}...")
            _piper_voice = PiperVoice.load(onnx_path, config_path=json_path)
        except Exception as e:
            print(f"[VOICE][ERROR] Failed to load Piper TTS model: {e}")
            raise
    return _piper_voice

class STTService:
    @staticmethod
    def transcribe_wav(wav_bytes: bytes) -> str:
        try:
            with wave.open(io.BytesIO(wav_bytes), 'rb') as wf:
                framerate = wf.getframerate()
                nchannels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                frames = wf.readframes(wf.getnframes())
                
            if nchannels != 1:
                print(f"[VOICE][WARNING] Expected mono audio, got {nchannels} channels")
            if sampwidth != 2:
                print(f"[VOICE][WARNING] Expected 16-bit audio, got {sampwidth * 8}-bit")

            audio_array = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            
            pipe = get_stt_pipeline()
            result = pipe({"raw": audio_array, "sampling_rate": framerate})
            return result.get("text", "").strip()
            
        except Exception as e:
            print(f"[VOICE][ERROR] Transcription failed: {str(e)}")
            raise RuntimeError(f"Transcription failed: {str(e)}")

class TTSService:
    @staticmethod
    def synthesize_speech(text: str) -> bytes:
        '''Legacy function for generating full WAV bytes (kept for backwards compatibility if needed)'''
        try:
            voice = get_piper_voice()
            wav_io = io.BytesIO()
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(voice.config.sample_rate)
                voice.synthesize(text, wav_file)
            return wav_io.getvalue()
        except Exception as e:
            print(f"[VOICE][ERROR] TTS synthesis failed: {str(e)}")
            raise RuntimeError(f"Speech synthesis failed: {str(e)}")

    @staticmethod
    def synthesize_to_queue(text: str, queue: asyncio.Queue, loop: asyncio.AbstractEventLoop):
        '''Streams raw PCM bytes to an asyncio queue'''
        try:
            voice = get_piper_voice()
            # Handle API variations for synthesize_stream_raw
            synthesizer = voice.synthesize_stream_raw(text) if hasattr(voice, 'synthesize_stream_raw') else voice.synthesize(text)
            for chunk in synthesizer:
                audio_bytes = chunk.audio_int16_bytes if hasattr(chunk, 'audio_int16_bytes') else chunk
                asyncio.run_coroutine_threadsafe(queue.put(audio_bytes), loop)
        except Exception as e:
            print(f"[VOICE][ERROR] Stream synthesis error: {e}")
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)
"""

with open("backend/services/voice_service.py", "w", encoding="utf-8") as f:
    f.write(code)
