import os
import io
import wave
import numpy as np
from transformers import pipeline

# Global instances to avoid reloading models on every request
_stt_pipeline = None

def get_stt_pipeline():
    global _stt_pipeline
    if _stt_pipeline is None:
        print("[VOICE] Loading Whisper STT model (openai/whisper-tiny)...")
        _stt_pipeline = pipeline("automatic-speech-recognition", model="openai/whisper-tiny")
    return _stt_pipeline

class STTService:
    @staticmethod
    def transcribe_wav(wav_bytes: bytes) -> str:
        """
        Transcribes 16kHz 16-bit Mono WAV PCM data using Whisper.
        """
        try:
            # Parse WAV bytes
            with wave.open(io.BytesIO(wav_bytes), 'rb') as wf:
                framerate = wf.getframerate()
                nchannels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                frames = wf.readframes(wf.getnframes())
                
            if nchannels != 1:
                print(f"[VOICE][WARNING] Expected mono audio, got {nchannels} channels")
                
            if sampwidth != 2:
                print(f"[VOICE][WARNING] Expected 16-bit audio, got {sampwidth * 8}-bit")

            # Convert raw bytes to float32 numpy array normalized between -1.0 and 1.0
            audio_array = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            
            pipe = get_stt_pipeline()
            # The pipeline expects a dictionary with "raw" audio and sampling rate
            result = pipe({"raw": audio_array, "sampling_rate": framerate})
            return result.get("text", "").strip()
            
        except Exception as e:
            print(f"[VOICE][ERROR] Transcription failed: {str(e)}")
            raise RuntimeError(f"Transcription failed: {str(e)}")

class TTSService:
    @staticmethod
    def synthesize_speech(text: str) -> bytes:
        """
        Synthesizes text to speech using piper-tts and returns WAV bytes.
        """
        # Create voices directory
        models_dir = os.path.join(os.path.dirname(__file__), "..", "models", "piper")
        os.makedirs(models_dir, exist_ok=True)
        
        # We will use en_US-lessac-medium
        model_name = "en_US-lessac-medium"
        onnx_path = os.path.join(models_dir, f"{model_name}.onnx")
        json_path = os.path.join(models_dir, f"{model_name}.onnx.json")
        
        # Download the model if it doesn't exist
        if not os.path.exists(onnx_path) or not os.path.exists(json_path):
            print(f"[VOICE] Downloading Piper TTS model {model_name}...")
            import urllib.request
            base_url = f"https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/{model_name}"
            urllib.request.urlretrieve(f"{base_url}.onnx", onnx_path)
            urllib.request.urlretrieve(f"{base_url}.onnx.json", json_path)
            print("[VOICE] Download complete.")
            
        try:
            import piper
            from piper import PiperVoice
            
            # Load voice
            voice = PiperVoice.load(onnx_path, config_path=json_path)
            
            # Synthesize directly to a byte stream
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
