import asyncio
import sys
from pathlib import Path

backend_dir = str(Path(__file__).parent.parent / "backend")
sys.path.append(backend_dir)

from services.voice_service import STTService, TTSService

async def test_tts():
    print("\n--- TEST 1: Piper TTS ---")
    try:
        wav_bytes = TTSService.synthesize_speech("Hello, this is MirrorMind testing local voice capabilities.")
        print(f"Success! Generated {len(wav_bytes)} bytes of WAV audio.")
    except Exception as e:
        print(f"TTS Error: {e}")

async def test_stt():
    print("\n--- TEST 2: Whisper STT ---")
    try:
        # Load the pipeline to make sure it downloads
        import numpy as np
        # Create a dummy 1-second 16kHz sine wave to simulate silence/noise
        t = np.linspace(0, 1, 16000, False)
        # We need it as bytes like WAV
        import io, wave
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            audio = (np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
            wf.writeframes(audio.tobytes())
            
        text = STTService.transcribe_wav(wav_io.getvalue())
        print(f"Success! STT transcribed a dummy sine wave as: '{text}'")
    except Exception as e:
        print(f"STT Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_tts())
    asyncio.run(test_stt())
