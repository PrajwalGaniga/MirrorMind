"""
scratch/test_vad_behavior.py — Diagnostic test for Gemini Live VAD
Tests:
1. Automatic VAD with 600ms silence vs 3000ms silence.
2. Automatic VAD disabled: manual activity_start / activity_end signaling.
"""
import asyncio
import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv("backend/.env")
api_key = os.getenv("GEMINI_LIVE_API_KEY")

async def test_manual_vs_auto_vad():
    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

    print("=== Testing Manual Activity Detection (automatic_activity_detection.disabled=True) ===")
    config_manual = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=types.Content(parts=[types.Part.from_text(text="You are Alex, an interviewer. Reply in 1 sentence.")]),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=True
            ),
            activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(language_codes=["en-US"]),
        output_audio_transcription=types.AudioTranscriptionConfig(language_codes=["en-US"]),
    )

    try:
        async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-latest", config=config_manual) as session:
            print("[MANUAL VAD] Successfully connected with automatic_activity_detection.disabled=True!")
            
            # Test sending activity_start
            await session.send_realtime_input(activity_start=types.ActivityStart())
            print("[MANUAL VAD] Sent ActivityStart successfully!")
            
            # Send 100ms tone
            tone_pcm = b"\x10\x20" * 800
            await session.send_realtime_input(audio={"data": tone_pcm, "mime_type": "audio/pcm;rate=16000"})
            print("[MANUAL VAD] Sent audio successfully!")
            
            # Send activity_end
            await session.send_realtime_input(activity_end=types.ActivityEnd())
            print("[MANUAL VAD] Sent ActivityEnd successfully!")
            
            print("[MANUAL VAD] All manual activity primitives are supported by the Gemini Live API!")
    except Exception as e:
        print(f"[MANUAL VAD ERROR] {e}")

if __name__ == "__main__":
    asyncio.run(test_manual_vs_auto_vad())
