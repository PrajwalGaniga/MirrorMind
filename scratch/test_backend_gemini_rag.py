import asyncio
import os
import sys
from dotenv import load_dotenv

backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
load_dotenv(os.path.join(backend_dir, ".env"))
sys.path.insert(0, backend_dir)

from db import database
from services.rag_service import generate_rag_response

async def test_rag():
    print("Testing generate_rag_response with Gemini...", flush=True)
    student = await database.students.find_one()
    if not student:
        print("No student found in DB, using mock test user", flush=True)
        user_id = "test_user"
    else:
        user_id = student["user_id"]
        print(f"Testing with student user_id: {user_id} ({student.get('name')})", flush=True)

    res = await generate_rag_response(
        user_id=user_id,
        question="What technical skills and career paths do I have in my profile?",
        db=database,
        top_k=3,
        provider="gemini"
    )
    print("\n--- RAG RESULT ---", flush=True)
    print("Provider:", res.get("provider"), flush=True)
    print("Model:", res.get("model"), flush=True)
    print("Answer:\n", res.get("answer"), flush=True)
    print("\nSources:", res.get("sources"), flush=True)

asyncio.run(test_rag())
