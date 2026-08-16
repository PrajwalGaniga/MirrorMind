import httpx
import asyncio

async def test_think():
    base_url = "http://localhost:11434"
    model = "qwen3:8b"
    
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Hello! What is 2 + 2? Think carefully."}],
        "stream": False,
        "think": False,
        "options": {"temperature": 0.3}
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(f"{base_url}/api/chat", json=payload)
        content = r.json().get("message", {}).get("content", "")
        print("Response Content:")
        print(content)
        
        if "<think>" in content:
            print("\nRESULT: Thinking output IS present.")
        else:
            print("\nRESULT: Thinking output is NOT present.")

asyncio.run(test_think())
