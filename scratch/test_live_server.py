import sys, os
sys.path.insert(0, os.path.abspath("."))
import asyncio
from main import app
from starlette.testclient import TestClient

client = TestClient(app)
res = client.get("/")
print("Root response:", res.json())

# Check websocket
try:
    with client.websocket_connect("/api/voice/live") as websocket:
        data = websocket.receive_json()
        print("WS received:", data)
except Exception as e:
    print("WS error:", e)
