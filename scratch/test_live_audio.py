import asyncio
from google import genai

API_KEY = "REDACTED_KEY"

async def test_live():
    client = genai.Client(api_key=API_KEY, http_options={'api_version': 'v1alpha'})
    print("Testing live connection with gemini-2.5-flash-native-audio-latest...")
    try:
        async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-latest", config={"response_modalities": ["AUDIO"]}) as session:
            print("Session established successfully!")
            await session.send(input="Hello, can you hear me?", end_of_turn=True)
            async for response in session.receive():
                server_content = response.server_content
                if server_content is not None:
                    model_turn = server_content.model_turn
                    if model_turn is not None:
                        for part in model_turn.parts:
                            if part.text:
                                print(f"Text response: {part.text}")
                            if part.inline_data:
                                print(f"Received audio bytes: {len(part.inline_data.data)} bytes (mime: {part.inline_data.mime_type})")
                    if server_content.turn_complete:
                        print("Turn complete!")
                        break
    except Exception as e:
        print(f"Live error on gemini-2.5-flash-native-audio-latest: {e}")

asyncio.run(test_live())
