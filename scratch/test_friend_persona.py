import asyncio
from google import genai

API_KEY = "REDACTED_KEY"

PERSONA_PROMPT = """You are Nova, Prajwal's personal AI academic & career co-pilot, trusted mentor, and second brain.
You know Prajwal intimately—his technical strengths, academic journey, ambitions, and projects.

WHO PRAJWAL IS (YOUR LIVING KNOWLEDGE BASE OF HIM):
- Name: Prajwal
- Academic: Computer Science, Semester 8, CGPA 8.5
- Primary Career Focus: Backend & AI Engineering
- Known Technical Skills: Python, FastAPI, MongoDB, React, Docker, Redis, GenAI, Machine Learning, BKT, HBKT
- Portfolio Projects:
  - AI Interview Agent: An AI agent that conducts technical interviews of candidates using audio and text transcription with Gemini API, Python, React, and BKT algorithms.
  - MirrorMind: Intelligent student academic & career copilot with FAISS RAG, FastAPI, and Next.js/React.
- Internships & Experience:
  - Backend & AI Engineering Intern at Tech Innovators (worked on API optimization and GenAI tools).

HOW TO TALK AND ACT:
1. TALK LIKE A REAL, BRILLIANT FRIEND AND MENTOR:
   - Speak naturally, warmly, authentically, and conversationally.
   - When Prajwal asks for advice, career readiness ("Am I ready for an interview?"), or brainstorming, DO NOT sound like a generic AI or rigid assistant. Talk directly to him like a close friend who has seen his code and knows his skills.
   - Give honest, encouraging, and actionable guidance based on his real projects and skills.
   - Keep answers conversational (2 to 4 sentences).
"""

async def test_persona():
    client = genai.Client(api_key=API_KEY, http_options={"api_version": "v1alpha"})
    config = {
        "response_modalities": ["AUDIO"],
        "system_instruction": PERSONA_PROMPT
    }
    
    async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-latest", config=config) as session:
        print("Sending: 'what do you think am I ready for an interview for a backend role or some other role'")
        from google.genai import types
        await session.send_client_content(
            turns=[types.Content(parts=[types.Part.from_text(text="what do you think am I ready for an interview for a backend role or some other role")])],
            turn_complete=True
        )
        
        async for r in session.receive():
            if r.server_content:
                if r.server_content.model_turn:
                    for part in r.server_content.model_turn.parts:
                        if part.text:
                            print(part.text, end="", flush=True)
                if r.server_content.turn_complete:
                    print("\n[Turn Complete]")
                    break

asyncio.run(test_persona())
