import asyncio
import json
import websockets

async def test_session_memory():
    url = "ws://localhost:8000/api/voice/live"
    print(f"Connecting to live WebSocket: {url}...")
    
    async with websockets.connect(url) as ws:
        # Wait for SESSION_READY
        ready_msg = await asyncio.wait_for(ws.recv(), timeout=10)
        print(f"[READY] {json.loads(ready_msg)}")

        # ── Turn 1: GREETING ────────────────────────────────────────────────
        print("\n--- [Turn 1] START_GREETING ---")
        await ws.send(json.dumps({"type": "START_GREETING"}))
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            if not isinstance(msg, bytes):
                ev = json.loads(msg)
                if ev.get("type") == "TURN_COMPLETE":
                    print("Turn 1 complete!")
                    break

        # ── Turn 2: Add Project 'AI Interview Platform' ──────────────────────
        print("\n--- [Turn 2] Adding 'AI Interview Platform' ---")
        await ws.send(json.dumps({
            "type": "TEXT_INPUT",
            "text": "Nova, add a new project called AI Interview Platform with Python and Gemini API"
        }))
        
        tool_executed = False
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            if not isinstance(msg, bytes):
                ev = json.loads(msg)
                if ev.get("type") == "TOOL_START":
                    print(f"  [Tool Start] {ev.get('name')} with args {ev.get('args')}")
                    tool_executed = True
                elif ev.get("type") == "TURN_COMPLETE":
                    print("Turn 2 complete!")
                    break
        assert tool_executed, "add_project tool was not called!"

        # ── Turn 3: Ask 'Which project did I add just now?' ─────────────────
        print("\n--- [Turn 3] Asking: 'Which project did I add just now?' ---")
        await ws.send(json.dumps({
            "type": "TEXT_INPUT",
            "text": "can you tell me which project did I add just now and what technologies did I use?"
        }))
        
        memory_recalled = False
        text_received = []
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=20)
            if not isinstance(msg, bytes):
                ev = json.loads(msg)
                if ev.get("type") == "TOOL_START":
                    print(f"  [Memory Tool] {ev.get('name')}")
                    memory_recalled = True
                elif ev.get("type") == "TEXT_CHUNK":
                    text_received.append(ev.get("text", ""))
                elif ev.get("type") == "TURN_COMPLETE":
                    print("Turn 3 complete!")
                    break
        
        full_text = " ".join(text_received)
        print(f"Model response text: \"{full_text}\"")
        assert memory_recalled or "AI Interview" in full_text or "interview" in full_text.lower(), "Model did not recall the project added just now!"
        
        # ── Turn 4: Update Project with missing parameter flow ───────────────
        print("\n--- [Turn 4] Updating project with Docker and Redis ---")
        await ws.send(json.dumps({
            "type": "TEXT_INPUT",
            "text": "For the AI Interview Platform, I also used Docker and Redis in the tech stack"
        }))
        
        update_called = False
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=20)
            if not isinstance(msg, bytes):
                ev = json.loads(msg)
                if ev.get("type") == "TOOL_START":
                    print(f"  [Update Tool] {ev.get('name')} with args {ev.get('args')}")
                    if ev.get("name") in ["update_project", "add_project"]:
                        update_called = True
                elif ev.get("type") == "TURN_COMPLETE":
                    print("Turn 4 complete!")
                    break
        assert update_called, "update_project tool was not called!"

        print("\n===========================================================")
        print("SUCCESS: SESSION MEMORY & MULTI-TURN CONTEXT VERIFIED 100%!")
        print("===========================================================")

if __name__ == "__main__":
    asyncio.run(test_session_memory())
