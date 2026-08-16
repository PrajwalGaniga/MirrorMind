import httpx
import asyncio
import json

async def test_ollama():
    base_url = "http://localhost:11434"
    model = "qwen3:8b"
    
    # Test 1: no think param
    payload1 = {
        "model": model,
        "messages": [{"role": "user", "content": "Hello"}],
        "stream": False,
        "options": {}
    }
    
    # Test 2: think: False in options
    payload2 = {
        "model": model,
        "messages": [{"role": "user", "content": "Hello"}],
        "stream": False,
        "options": {"think": False}
    }
    
    # Test 3: think: False at top level
    payload3 = {
        "model": model,
        "messages": [{"role": "user", "content": "Hello"}],
        "stream": False,
        "think": False,
        "options": {}
    }

    async with httpx.AsyncClient() as client:
        r1 = await client.post(f"{base_url}/api/chat", json=payload1)
        print("Test 1 response:")
        print(r1.json().get("message", {}).get("content", ""))
        
        r2 = await client.post(f"{base_url}/api/chat", json=payload2)
        print("Test 2 response:")
        print(r2.json().get("message", {}).get("content", ""))

        r3 = await client.post(f"{base_url}/api/chat", json=payload3)
        print("Test 3 response:")
        print(r3.json().get("message", {}).get("content", ""))

asyncio.run(test_ollama())
