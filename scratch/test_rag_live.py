import sys, os
sys.path.insert(0, os.path.abspath("."))
import json
from main import app
from starlette.testclient import TestClient

client = TestClient(app)

print("Connecting to /api/voice/live to test query_rag_database...")
with client.websocket_connect("/api/voice/live") as ws:
    ready_msg = ws.receive_json()
    print("Session ready:", ready_msg)
    
    # Send RAG question
    prompt = {
        "type": "TEXT_INPUT",
        "text": "Nova, what are my top recommended career paths and what technical skills do I have?"
    }
    print("Sending RAG prompt...")
    ws.send_json(prompt)
    
    rag_tool_called = False
    
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
                if data.get("name") == "query_rag_database":
                    rag_tool_called = True
            elif event_type == "TEXT_CHUNK":
                print(f"  Text Chunk: {data.get('text')}")
            elif event_type == "TURN_COMPLETE":
                print("Turn completed!")
                break

    print(f"\nRAG Tool Called={rag_tool_called}")
    assert rag_tool_called, "Expected query_rag_database tool to be called"
    print("RAG TEST PASSED!")
