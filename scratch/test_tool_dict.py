import asyncio
from google import genai
from google.genai import types

API_KEY = "REDACTED_KEY"

async def test_live_tools_dict():
    client = genai.Client(api_key=API_KEY, http_options={'api_version': 'v1alpha'})
    
    # Try dict format or simple function
    config = {
        "response_modalities": ["AUDIO"],
        "tools": [
            {
                "function_declarations": [
                    {
                        "name": "add_project",
                        "description": "Add a new project to student portfolio",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "title": {"type": "STRING", "description": "Project title"},
                                "description": {"type": "STRING", "description": "Project description"},
                                "tech_stack": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "Tech used"}
                            },
                            "required": ["title", "description", "tech_stack"]
                        }
                    }
                ]
            }
        ]
    }
    
    try:
        async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-latest", config=config) as session:
            print("Connected with dict config!")
            await session.send(input="Add my project MirrorMind with React and FastAPI to my portfolio", end_of_turn=True)
            async for resp in session.receive():
                if resp.tool_call:
                    print(f"Tool call: {resp.tool_call}")
                    break
                if resp.server_content and resp.server_content.turn_complete:
                    print("Turn complete without tool call.")
                    break
    except Exception as e:
        print(f"Error with dict config: {e}")

asyncio.run(test_live_tools_dict())
