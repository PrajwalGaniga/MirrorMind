from google import genai

key = "REDACTED_KEY"
client = genai.Client(api_key=key)

try:
    models = client.models.list()
    for m in models:
        print(m.name)
except Exception as e:
    print("List models error:", e)
