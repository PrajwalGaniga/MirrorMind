import asyncio
import json
import websockets

async def test_multiturn_ws():
    url = "ws://localhost:8000/api/voice/live"
    print(f"Connecting to live backend WebSocket: {url}...")
    
    async with websockets.connect(url) as ws:
        # 1. Receive SESSION_READY
        init_msg = await asyncio.wait_for(ws.recv(), timeout=10)
        data = json.loads(init_msg)
        print(f"[READY] {data}")
        assert data.get("type") == "SESSION_READY"

        # ── Turn 1: START_GREETING ──────────────────────────────────────────
        print("\n--- [Turn 1] Sending START_GREETING ---")
        await ws.send(json.dumps({"type": "START_GREETING"}))
        
        greeting_audio_bytes = 0
        turn1_done = False
        while not turn1_done:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            if isinstance(msg, bytes):
                greeting_audio_bytes += len(msg)
            else:
                event = json.loads(msg)
                print(f"  Turn 1 event: {event.get('type')}")
                if event.get("type") == "TURN_COMPLETE":
                    turn1_done = True
        
        print(f"[Turn 1 SUCCESS] Greeting received {greeting_audio_bytes} audio bytes. Connection remains open!")
        await asyncio.sleep(0.5)

        # ── Turn 2: User says 'I wanted to add a new project' ─────────────────
        print("\n--- [Turn 2] Sending 'I wanted to add a new project called SuperBot' ---")
        await ws.send(json.dumps({
            "type": "TEXT_INPUT",
            "text": "I wanted to add a new project called SuperBot with Python and FastAPI"
        }))
        
        tool_called = False
        ui_action_received = False
        turn2_audio_bytes = 0
        turn2_done = False
        
        while not turn2_done:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            if isinstance(msg, bytes):
                turn2_audio_bytes += len(msg)
            else:
                event = json.loads(msg)
                etype = event.get("type")
                print(f"  Turn 2 event: {etype}")
                if etype == "TOOL_START":
                    print(f"    -> Tool: {event.get('name')}, Args: {event.get('args')}")
                    if event.get("name") == "add_project":
                        tool_called = True
                elif etype == "UI_ACTION":
                    print(f"    -> UI Action: {event.get('action')}")
                    if event.get("action") == "PROJECT_ADDED":
                        ui_action_received = True
                elif etype == "TURN_COMPLETE":
                    turn2_done = True
        
        print(f"[Turn 2 SUCCESS] Tool called: {tool_called}, UI Action: {ui_action_received}, Audio: {turn2_audio_bytes} bytes!")
        assert tool_called, "add_project tool was not called!"
        assert ui_action_received, "PROJECT_ADDED UI action was not sent!"
        await asyncio.sleep(0.5)

        # ── Turn 3: User queries resume / projects via RAG ───────────────────
        print("\n--- [Turn 3] Sending 'can you search my portfolio or else my resume and check for my projects' ---")
        await ws.send(json.dumps({
            "type": "TEXT_INPUT",
            "text": "can you search my portfolio or else my resume and check for my projects"
        }))
        
        rag_tool_called = False
        turn3_audio_bytes = 0
        turn3_done = False
        
        while not turn3_done:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            if isinstance(msg, bytes):
                turn3_audio_bytes += len(msg)
            else:
                event = json.loads(msg)
                etype = event.get("type")
                print(f"  Turn 3 event: {etype}")
                if etype == "TOOL_START":
                    print(f"    -> Tool: {event.get('name')}, Args: {event.get('args')}")
                    if event.get("name") == "query_rag_database":
                        rag_tool_called = True
                elif etype == "TURN_COMPLETE":
                    turn3_done = True

        print(f"[Turn 3 SUCCESS] RAG Tool called: {rag_tool_called}, Audio: {turn3_audio_bytes} bytes!")
        assert rag_tool_called, "query_rag_database tool was not called!"
        
        print("\n=======================================================")
        print("ALL 3 TURNS COMPLETED OVER THE SAME PERSISTENT WEBSOCKET!")
        print("=======================================================")

if __name__ == "__main__":
    asyncio.run(test_multiturn_ws())
