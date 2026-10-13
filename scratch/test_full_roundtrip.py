import sys, os
sys.path.insert(0, os.path.abspath("."))
import json
from main import app
from starlette.testclient import TestClient

client = TestClient(app)

print("Connecting to /api/voice/live via TestClient...")
with client.websocket_connect("/api/voice/live") as ws:
    ready_msg = ws.receive_json()
    print("Session ready event:", ready_msg)
    assert ready_msg.get("type") == "SESSION_READY"
    
    # Send request to add project
    prompt = {
        "type": "TEXT_INPUT",
        "text": "Nova, please add a new project: Title is Cloud Orchestrator, description is a Kubernetes cluster manager built with Go and Docker."
    }
    print("Sending prompt to Nova...")
    ws.send_json(prompt)
    
    tool_triggered = False
    ui_action_seen = False
    turn_finished = False
    
    for _ in range(25):
        msg = ws.receive()
        if "bytes" in msg and msg["bytes"]:
            print(f"Received audio bytes: {len(msg['bytes'])} bytes")
        elif "text" in msg and msg["text"]:
            data = json.loads(msg["text"])
            event_type = data.get("type")
            print(f"Server event: {event_type}")
            if event_type == "TOOL_START":
                print(f"  Tool Name: {data.get('name')}")
                print(f"  Args: {data.get('args')}")
                tool_triggered = True
            elif event_type == "UI_ACTION":
                print(f"  UI Action: {data.get('action')}")
                ui_action_seen = True
            elif event_type == "TEXT_CHUNK":
                print(f"  Text Chunk: {data.get('text')}")
            elif event_type == "TURN_COMPLETE":
                print("Turn completed!")
                turn_finished = True
                break

    print(f"\nFinal Test Results: Tool Triggered={tool_triggered}, UI Action={ui_action_seen}, Turn Finished={turn_finished}")
    assert tool_triggered, "Expected tool to be triggered"
    assert ui_action_seen, "Expected UI action event to be sent"
    print("ALL TESTS PASSED!")
