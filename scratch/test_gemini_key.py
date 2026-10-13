from google import genai

key = "REDACTED_KEY"
client = genai.Client(api_key=key)

try:
    print("Testing gemini-3.8-flash...")
    resp = client.models.generate_content(
        model="gemini-3.8-flash",
        contents="Hello"
    )
    print("Response:", resp.text)
except Exception as e:
    print("gemini-3.8-flash error:", e)
