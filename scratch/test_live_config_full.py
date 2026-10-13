import asyncio, os, sys
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv('backend/.env')
api_key = os.getenv('GEMINI_LIVE_API_KEY') or os.getenv('GEMINI_API_KEY')

async def test_live_config():
    client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=types.Content(parts=[types.Part.from_text(text='You are a senior tech interviewer. Keep responses to 1-2 sentences.')]),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name='Aoede')
            )
        ),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                prefix_padding_ms=100,
                silence_duration_ms=600,
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        session_resumption=types.SessionResumptionConfig(),
        context_window_compression=types.ContextWindowCompressionConfig(
            sliding_window=types.SlidingWindow(target_tokens=4096)
        ),
    )
    
    print('Connecting to gemini-2.5-flash-native-audio-latest...', flush=True)
    async with client.aio.live.connect(model='gemini-2.5-flash-native-audio-latest', config=config) as session:
        print('Connected successfully!', flush=True)
        # Test sending silence
        pcm_100ms = b'\x00\x00' * 1600 # 1600 samples = 100ms of 16kHz 16-bit mono PCM
        await session.send_realtime_input(audio={'data': pcm_100ms, 'mime_type': 'audio/pcm;rate=16000'})
        print('Sent 100ms PCM chunk successfully!', flush=True)
        
        async for msg in session.receive():
            print(f'Received message: {msg}', flush=True)
            if msg.setup_complete:
                print('Received setup_complete!', flush=True)
            if msg.session_resumption_update:
                print(f'Received session_resumption_update! handle = {msg.session_resumption_update.new_handle}', flush=True)
            if msg.server_content:
                print(f'Received server_content: interrupted={msg.server_content.interrupted}, turn_complete={msg.server_content.turn_complete}', flush=True)
                break
        print('Finished test!', flush=True)

if __name__ == '__main__':
    asyncio.run(test_live_config())
