import asyncio
from google import genai

API_KEY = "REDACTED_KEY"

async def test():
    client = genai.Client(api_key=API_KEY, http_options={'api_version': 'v1alpha'})
    config = {"response_modalities": ["AUDIO"]}
    async with client.aio.live.connect(model="gemini-3.1-flash-live-preview", config=config) as session:
        print("Testing session.send with input string...")
        try:
            await session.send(input="Hello from test", end_of_turn=True)
            print("session.send succeeded!")
            async for resp in session.receive():
                if resp.server_content and resp.server_content.turn_complete:
                    print("Turn complete!")
                    break
        except Exception as e:
            print("session.send failed:", e)

asyncio.run(test())
