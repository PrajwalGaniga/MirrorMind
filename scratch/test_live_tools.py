import asyncio
from google import genai
from google.genai import types

API_KEY = "REDACTED_KEY"

async def test_live_tools():
    client = genai.Client(api_key=API_KEY, http_options={'api_version': 'v1alpha'})
    
    # Define tool declaration
    tools = [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="add_project",
                    description="Add a new project to student portfolio when user asks to record or add a project",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={
                            "title": types.Schema(type="STRING", description="Project name"),
                            "description": types.Schema(type="STRING", description="Brief description"),
                            "tech_stack": types.Schema(type="ARRAY", items=types.Schema(type="STRING"), description="Technologies used"),
                        },
                        required=["title", "description", "tech_stack"]
                    )
                ),
                types.FunctionDeclaration(
                    name="query_rag_database",
                    description="Query the student's profile, resume, projects, skills, or career predictions from the database and FAISS index",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={
                            "query": types.Schema(type="STRING", description="Search query or question about the student"),
                        },
                        required=["query"]
                    )
                )
            ]
        )
    ]
    
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        tools=tools,
        system_instruction=types.Content(
            parts=[types.Part.from_text(
                text="You are Nova, MirrorMind's hands-free voice AI. Speak concisely and naturally. When the user wants to add a project or ask about their profile, call the appropriate tool. Once an action is done, confirm in one friendly sentence without repeatedly asking for confirmation."
            )]
        )
    )
    
    print("Connecting to live session with tools...")
    try:
        async with client.aio.live.connect(model="gemini-3.1-flash-live-preview", config=config) as session:
            print("Connected! Sending message to trigger tool call...")
            await session.send_client_content(
                turns=[types.Content(parts=[types.Part.from_text(text="Hey Nova, please add my project called MirrorMind. It is built with React and FastAPI to predict student careers.")])],
                turn_complete=True
            )
            async for response in session.receive():
                server_content = response.server_content
                if server_content:
                    if server_content.model_turn:
                        for part in server_content.model_turn.parts:
                            if part.text:
                                print(f"Model text: {part.text}")
                    if server_content.turn_complete:
                        print("Turn complete from server content.")
                
                tool_call = response.tool_call
                if tool_call:
                    print(f"\n>>> TOOL CALL RECEIVED! <<<")
                    for fc in tool_call.function_calls:
                        print(f"Function: {fc.name}")
                        print(f"Call ID: {fc.id}")
                        print(f"Args: {fc.args}")
                    print("Tool call verified successfully!")
                    break
    except Exception as e:
        print(f"Error during tool test: {e}")

asyncio.run(test_live_tools())
