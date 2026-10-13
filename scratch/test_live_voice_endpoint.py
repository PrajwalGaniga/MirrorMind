import asyncio
import json
import websockets

async def test_live_endpoint():
    url = "ws://localhost:8000/api/voice/live"
    print(f"Connecting to {url}...")
    try:
        async with websockets.connect(url) as ws:
            print("WebSocket connected successfully!")
            
            # Wait for SESSION_READY
            msg = await ws.recv()
            data = json.loads(msg)
            print(f"Received from server: {data}")
            assert data.get("type") == "SESSION_READY", "Expected SESSION_READY"
            
            # Send a command to add a project
            test_prompt = {
                "type": "TEXT_INPUT",
                "text": "Nova, please add a new project: Title is Cloud Orchestrator, description is a Kubernetes cluster manager built with Go and Docker."
            }
            print("Sending text input to trigger tool call...")
            await ws.send(json.dumps(test_prompt))
            
            tool_called = False
            ui_action_received = False
            
            for _ in range(15):
                msg = await asyncio.wait_for(ws.recv(), timeout=15)
                if isinstance(msg, bytes):
                    print(f"Received audio bytes chunk: {len(msg)} bytes")
                else:
                    data = json.loads(msg)
                    print(f"Server event: {data.get('type')}")
                    if data.get("type") == "TOOL_START":
                        print(f"  Tool name: {data.get('name')}")
                        print(f"  Tool args: {data.get('args')}")
                        tool_called = True
                    elif data.get("type") == "UI_ACTION":
                        print(f"  UI Action: {data.get('action')}")
                        ui_action_received = True
                    elif data.get("type") == "TURN_COMPLETE":
                        print("Turn complete from server!")
                        break
            
            print(f"\nVerification summary: Tool Called={tool_called}, UI Action Received={ui_action_received}")
            assert tool_called, "Tool call was not triggered"
            assert ui_action_received, "UI action was not received"
            print("ALL ENDPOINT CHECKS PASSED!")
            
    except Exception as e:
        print(f"Error testing live endpoint: {e}")

asyncio.run(test_live_endpoint())
