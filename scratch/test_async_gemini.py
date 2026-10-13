import asyncio
import os
import time
from google import genai
from google.genai import types

key = "REDACTED_KEY"

async def test_gemini_call():
    client = genai.Client(api_key=key)
    system_prompt = "You are MirrorMind, an AI career assistant."
    full_prompt = "Hello! In one sentence, what is a database?"
    
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.3
    )

    models_to_try = ["gemini-3.8-flash", "gemini-2.5-flash-lite"]
    for m in models_to_try:
        try:
            print(f"Trying {m}...", flush=True)
            # Run in thread so FastAPI event loop is never blocked
            resp = await asyncio.to_thread(
                client.models.generate_content,
                model=m,
                contents=full_prompt,
                config=config
            )
            print(f"Success with {m}: {resp.text.strip()}", flush=True)
            return resp.text.strip()
        except Exception as e:
            print(f"Failed with {m}: {e}", flush=True)

asyncio.run(test_gemini_call())
