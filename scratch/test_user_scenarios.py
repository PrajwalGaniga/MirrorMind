import asyncio
from google import genai
from google.genai import types

API_KEY = "REDACTED_KEY"

NOVA_TOOLS = [{
    "function_declarations": [
        {
            "name": "add_project",
            "description": "Add a new project to the student's portfolio. Call this IMMEDIATELY whenever the user mentions adding a project or gives a project title.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING", "description": "Project title or name"},
                    "description": {"type": "STRING", "description": "Brief summary"},
                    "tech_stack": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "Technologies"}
                },
                "required": ["title"]
            }
        },
        {
            "name": "query_rag_database",
            "description": "Retrieve factual data from the student's profile, resume, academic records, skills, or projects.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "query": {"type": "STRING", "description": "Search keywords or query"}
                },
                "required": ["query"]
            }
        }
    ]
}]

SYSTEM_INSTRUCTION = """You are Nova, MirrorMind's personal AI academic and career co-pilot.
You speak naturally, warmly, and concisely (1 to 2 sentences per turn).

CRITICAL TOOL CALLING RULES:
1. When the user says 'add project', 'add a new project', or mentions creating a project, you MUST IMMEDIATELY call the add_project tool. If no title was provided yet, use title='New Project'.
2. When the user asks about their resume, portfolio, projects, skills, GPA, records, or documents, you MUST IMMEDIATELY call query_rag_database with their query.
3. When a tool finishes executing, acknowledge it concisely in 1 sentence.
"""

async def test_scenarios():
    client = genai.Client(api_key=API_KEY, http_options={"api_version": "v1alpha"})
    config = {"response_modalities": ["AUDIO"], "tools": NOVA_TOOLS, "system_instruction": SYSTEM_INSTRUCTION}
    
    async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-latest", config=config) as session:
        async def handle_turn(prompt):
            print(f"\n--- Sending: '{prompt}' ---")
            await session.send_client_content(
                turns=[types.Content(parts=[types.Part.from_text(text=prompt)])],
                turn_complete=True
            )
            async for r in session.receive():
                if r.tool_call:
                    for fc in r.tool_call.function_calls:
                        print(f"[TOOL_CALL] {fc.name} with {fc.args}")
                        resp = (
                            {"status": "success", "details": "Major project found: MirrorMind AI co-pilot with React and FastAPI."}
                            if fc.name == "query_rag_database"
                            else {"status": "success", "message": "Project added"}
                        )
                        await session.send_tool_response(
                            function_responses=[types.FunctionResponse(name=fc.name, id=fc.id, response=resp)]
                        )
                if r.server_content and r.server_content.turn_complete:
                    print("[TURN_COMPLETE]")
                    break

        # Test Scenario 1: 'I wanted to add a new project'
        await handle_turn("I wanted to add a new project")
        
        # Test Scenario 2: 'can you search my portfolio or else my resume and check for the major project that I have done in that list any one of the project'
        await handle_turn("can you search my portfolio or else my resume and check for the major project that I have done in that list any one of the project")

asyncio.run(test_scenarios())
