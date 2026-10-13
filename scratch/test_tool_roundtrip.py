import asyncio
from google import genai

API_KEY = "REDACTED_KEY"

def add_project(title: str, description: str, tech_stack: list[str]) -> str:
    """Add a new project to student portfolio when the user wants to add or record a project.
    
    Args:
        title: The name of the project.
        description: A short description of the project.
        tech_stack: The list of programming languages and frameworks used.
    """
    return f"Project '{title}' has been successfully added to the database."

async def test_python_func():
    client = genai.Client(api_key=API_KEY, http_options={'api_version': 'v1alpha'})
    config = {
        "response_modalities": ["AUDIO"],
        "tools": [{"function_declarations": [
            {
                "name": "add_project",
                "description": "Add a new project to student portfolio when the user wants to add or record a project.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "title": {"type": "STRING", "description": "The name of the project."},
                        "description": {"type": "STRING", "description": "A short description of the project."},
                        "tech_stack": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "Technologies used."}
                    },
                    "required": ["title", "description", "tech_stack"]
                }
            }
        ]}],
        "system_instruction": "You are Nova, an AI assistant. When the user asks to add a project, call the add_project tool immediately."
    }
    
    try:
        async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-latest", config=config) as session:
            print("Connected! Sending prompt...")
            await session.send(input="Nova, please add a new project: Title is MirrorMind, description is an AI career assistant, tech stack is React and FastAPI.", end_of_turn=True)
            async for resp in session.receive():
                if resp.tool_call:
                    print(f"Tool call received: {resp.tool_call}")
                    # Send response back
                    for fc in resp.tool_call.function_calls:
                        print(f"Executing {fc.name} with {fc.args}")
                        tool_resp = {
                            "output": {"status": "success", "message": f"Project {fc.args.get('title')} added successfully."}
                        }
                        await session.send(input={"function_responses": [{"response": tool_resp, "id": fc.id}]})
                if resp.server_content and resp.server_content.turn_complete:
                    print("Turn complete!")
                    break
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_python_func())
