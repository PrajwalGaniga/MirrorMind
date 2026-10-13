import sys
from google import genai

key = "REDACTED_KEY"
client = genai.Client(api_key=key)

for m in ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"]:
    print(f"Testing {m}...", flush=True)
    try:
        resp = client.models.generate_content(
            model=m,
            contents="Say 'Hello MirrorMind'"
        )
        print(f"SUCCESS with {m}: {resp.text.strip()}", flush=True)
        break
    except Exception as e:
        print(f"Error with {m}: {e}", flush=True)
