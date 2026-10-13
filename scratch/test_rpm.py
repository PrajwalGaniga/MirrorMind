from google import genai
import time

API_KEY = "REDACTED_KEY"
client = genai.Client(api_key=API_KEY)

print("Testing rapid requests on gemini-3.1-flash-lite to test RPM headroom...")
success_count = 0
for i in range(5):
    try:
        t0 = time.time()
        res = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=f"Count {i+1}. Respond with only the number.",
        )
        print(f"Req {i+1}: {res.text.strip()} ({time.time()-t0:.2f}s)")
        success_count += 1
    except Exception as e:
        print(f"Req {i+1} failed: {e}")
        break

print(f"\nCompleted {success_count} consecutive requests without error.")
