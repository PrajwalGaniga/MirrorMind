import asyncio
from google import genai

API_KEY = "REDACTED_KEY"

async def test_live_31():
    client = genai.Client(api_key=API_KEY, http_options={'api_version': 'v1alpha'})
    print("Testing live connection with gemini-3.1-flash-live-preview...")
    try:
        async with client.aio.live.connect(model="gemini-3.1-flash-live-preview", config={"response_modalities": ["AUDIO"]}) as session:
            print("Session established successfully on gemini-3.1-flash-live-preview!")
            await session.send(input="Hello from MirrorMind!", end_of_turn=True)
            async for response in session.receive():
                server_content = response.server_content
                if server_content is not None:
                    model_turn = server_content.model_turn
                    if model_turn is not None:
                        for part in model_turn.parts:
                            if part.text:
                                print(f"Text response: {part.text}")
                            if part.inline_data:
                                print(f"Audio chunk: {len(part.inline_data.data)} bytes")
                    if server_content.turn_complete:
                        print("Turn complete on 3.1!")
                        break
    except Exception as e:
        print(f"Live error on gemini-3.1-flash-live-preview: {e}")

asyncio.run(test_live_31())
