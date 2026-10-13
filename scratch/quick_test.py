from google import genai
import sys

API_KEY = "REDACTED_KEY"
client = genai.Client(api_key=API_KEY)

for m in ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-native-audio-latest"]:
    print(f"Testing {m}...", flush=True)
    try:
        res = client.models.generate_content(
            model=m,
            contents="Hello! Confirm your name.",
        )
        print(f"[{m}] SUCCESS: {res.text[:100]}", flush=True)
    except Exception as e:
        print(f"[{m}] ERROR: {e}", flush=True)
