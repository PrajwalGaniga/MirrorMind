import asyncio
from google import genai

API_KEY = "REDACTED_KEY"

async def check_session_methods():
    client = genai.Client(api_key=API_KEY, http_options={'api_version': 'v1alpha'})
    config = {"response_modalities": ["AUDIO"]}
    async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-latest", config=config) as session:
        methods = [m for m in dir(session) if not m.startswith('_')]
        print(f"Session methods: {methods}")

asyncio.run(check_session_methods())
