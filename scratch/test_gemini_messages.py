from google import genai
from google.genai import types
import os

key = "REDACTED_KEY"
client = genai.Client(api_key=key)

messages = [
    {"role": "system", "content": "You are MirrorMind, a career assistant."},
    {"role": "user", "content": "What is Python?"}
]

# Extract system prompt if present
system_prompt = None
contents = []
for msg in messages:
    if msg["role"] == "system":
        system_prompt = msg["content"]
    elif msg["role"] == "user":
        contents.append(msg["content"])
    elif msg["role"] == "assistant":
        contents.append(f"Assistant: {msg['content']}")

config = types.GenerateContentConfig(
    system_instruction=system_prompt,
    temperature=0.3
) if system_prompt else types.GenerateContentConfig(temperature=0.3)

try:
    print("Testing generate_content with system_instruction on gemini-2.5-flash...")
    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="\n\n".join(contents),
        config=config
    )
    print("Result:", resp.text[:100])
except Exception as e:
    print("Error:", e)
