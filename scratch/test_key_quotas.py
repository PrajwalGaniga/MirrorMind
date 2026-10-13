from google import genai
import time

API_KEY = "REDACTED_KEY"
client = genai.Client(api_key=API_KEY)

test_models = [
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash-native-audio-latest",
    "gemini-3.1-flash-live-preview",
]

for m in test_models:
    try:
        t0 = time.time()
        res = client.models.generate_content(
            model=m,
            contents="Hello! Please confirm your model name and say one short greeting in 5 words.",
        )
        elapsed = time.time() - t0
        print(f"SUCCESS on {m} ({elapsed:.2f}s): {res.text.strip()}")
    except Exception as e:
        print(f"FAILED on {m}: {e}")
