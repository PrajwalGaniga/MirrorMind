from google import genai

key = "REDACTED_KEY"
client = genai.Client(api_key=key)

for m in ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]:
    print(f"Testing {m}...", flush=True)
    try:
        resp = client.models.generate_content(
            model=m,
            contents="Say 'MirrorMind Ready' in 2 words"
        )
        print(f"SUCCESS with {m}: {resp.text.strip()}", flush=True)
        break
    except Exception as e:
        print(f"Error with {m}: {e}", flush=True)
