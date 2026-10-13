import asyncio
from google import genai
from google.genai import types

API_KEY = "REDACTED_KEY"

async def test_native_methods():
    client = genai.Client(api_key=API_KEY, http_options={'api_version': 'v1alpha'})
    config = {
        "response_modalities": ["AUDIO"],
        "tools": [{"function_declarations": [
            {
                "name": "ping",
                "description": "Ping test",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {"msg": {"type": "STRING"}},
                    "required": ["msg"]
                }
            }
        ]}]
    }
    
    async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-latest", config=config) as session:
        # test sending realtime audio input (silent 16kHz PCM bytes)
        silence = b'\x00\x00' * 1600 # 0.1s of 16-bit 16kHz PCM
        await session.send_realtime_input(audio={"data": silence, "mime_type": "audio/pcm;rate=16000"})
        print("send_realtime_input passed!")
        
        # test send_client_content
        await session.send_client_content(
            turns=[types.Content(parts=[types.Part.from_text(text="call the ping tool with msg 'hello'")])],
            turn_complete=True
        )
        print("send_client_content passed!")
        
        async for resp in session.receive():
            if resp.tool_call:
                fc = resp.tool_call.function_calls[0]
                print(f"Tool call received: {fc.name} with id {fc.id}")
                await session.send_tool_response(
                    function_responses=[types.FunctionResponse(name=fc.name, id=fc.id, response={"result": "pong"})]
                )
                print("send_tool_response passed!")
            if resp.server_content and resp.server_content.turn_complete:
                print("All native methods verified!")
                break

asyncio.run(test_native_methods())
