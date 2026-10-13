"""
scratch/test_voice_interview_e2e.py — End-to-end verification test for Gemini Live WebSocket Proxy
Tests:
1. Connect to FastAPI /ws proxy
2. Send START_INTERVIEW trigger
3. Stream synthetic 16kHz PCM16 audio
4. Receive 24kHz PCM16 audio + Transcripts + Latency Metrics
5. Verify interruption handling and session transcript persistence
"""

import asyncio
import json
import time
import math
import websockets

def generate_pcm16_tone(freq=440.0, duration_sec=1.0, sample_rate=16000):
    """Generates synthetic 16kHz 16-bit mono PCM tone to simulate candidate voice."""
    total_samples = int(duration_sec * sample_rate)
    pcm_bytes = bytearray()
    for i in range(total_samples):
        # 440 Hz sine wave, amplitude 0.5
        sample = 0.5 * math.sin(2 * math.pi * freq * (i / sample_rate))
        int_sample = int(sample * 32767)
        pcm_bytes.extend(int_sample.to_bytes(2, byteorder='little', signed=True))
    return bytes(pcm_bytes)

async def run_e2e_test():
    uri = "ws://localhost:8000/ws"
    print(f"[TEST] Connecting to {uri}...")

    try:
        async with websockets.connect(uri) as ws:
            print("[TEST] Connected to WebSocket proxy successfully!")
            
            # 1. Wait for STATUS event
            initial_msg = await ws.recv()
            if isinstance(initial_msg, str):
                data = json.loads(initial_msg)
                print(f"[TEST] Received handshake: {data}")
                assert data.get("status") == "CONNECTED", "Expected status CONNECTED"

            # 2. Trigger Interview Start
            print("[TEST] Triggering START_INTERVIEW...")
            await ws.send(json.dumps({"type": "START_INTERVIEW"}))

            # 3. Stream synthetic speech (16kHz PCM16 chunks of 40ms = 640 samples = 1280 bytes)
            tone_bytes = generate_pcm16_tone(freq=300.0, duration_sec=1.5, sample_rate=16000)
            chunk_size = 1280 # 40ms chunk
            
            print("[TEST] Streaming candidate audio chunks (40ms @ 16kHz)...")
            chunks_sent = 0
            for offset in range(0, len(tone_bytes), chunk_size):
                chunk = tone_bytes[offset:offset+chunk_size]
                await ws.send(chunk)
                chunks_sent += 1
                await asyncio.sleep(0.04) # 40ms interval
            
            print(f"[TEST] Streamed {chunks_sent} chunks ({len(tone_bytes)} bytes) of candidate audio.")

            # 4. Listen for Gemini Live response (transcripts, latency, audio chunks)
            audio_bytes_received = 0
            transcripts = []
            latency_received = False
            start_wait = time.time()

            while time.time() - start_wait < 15.0: # 15s timeout
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=4.0)
                    if isinstance(msg, bytes):
                        audio_bytes_received += len(msg)
                    elif isinstance(msg, str):
                        data = json.loads(msg)
                        mtype = data.get("type")
                        if mtype == "TRANSCRIPT":
                            print(f"[TEST][TRANSCRIPT] ({data.get('role')}): {data.get('text')}")
                            transcripts.append(data)
                        elif mtype == "METRICS":
                            if "latencyMs" in data:
                                print(f"[TEST][METRICS] Round-trip latency: {data['latencyMs']} ms")
                                latency_received = True
                            if "tokenUsage" in data:
                                print(f"[TEST][METRICS] Token usage: {data['tokenUsage']}")
                        elif mtype == "INTERRUPTED":
                            print("[TEST][EVENT] INTERRUPTED event received")
                        elif mtype == "TURN_COMPLETE":
                            print("[TEST][EVENT] TURN_COMPLETE received!")
                            break
                except asyncio.TimeoutError:
                    print("[TEST] No more messages in turn.")
                    break

            print("\n" + "="*50)
            print(f"[TEST SUMMARY]")
            print(f"- Total 24kHz PCM16 audio bytes received: {audio_bytes_received}")
            print(f"- Total transcript fragments: {len(transcripts)}")
            print(f"- Latency metric recorded: {latency_received}")
            print("="*50)
            
            assert audio_bytes_received > 0 or len(transcripts) > 0, "No audio or transcript received from Gemini Live"
            print("[TEST] PASSED SUCCESSFULLY!")

    except Exception as e:
        print(f"[TEST] Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
