import asyncio
import os
import sys
from pathlib import Path

backend_dir = str(Path(__file__).parent.parent / "backend")
sys.path.append(backend_dir)

from db import client
from services.rag_service import generate_rag_response

async def test_rag():
    try:
        db = client.mirrormind
        
        # Get first student with some profile data
        student = await db.students.find_one({})
        if not student:
            print("No students found in DB.")
            return
            
        user_id = student.get("user_id")
        print(f"Testing with user_id: {user_id}")
        
        question = "What should I learn next for backend development?"
        
        response = await generate_rag_response(user_id, question, db, top_k=5)
        
        print("\n=== TEST RESULTS ===")
        print("Model Used:", response.get("model"))
        print("Context Chunks Used:", response.get("context_chunks_used"))
        print("Context Truncated:", response.get("context_truncated"))
        print("Answer preview:", response.get("answer")[:200] + "...")
        
    except Exception as e:
        print(f"Error testing RAG: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_rag())
