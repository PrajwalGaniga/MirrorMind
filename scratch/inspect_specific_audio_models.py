from google import genai
import json

API_KEY = "REDACTED_KEY"
client = genai.Client(api_key=API_KEY)

interesting_models = [
    "gemini-2.5-flash-native-audio-latest",
    "gemini-3.1-flash-live-preview",
    "gemini-3.8-live",
    "gemini-3.5-transcribe-live",
    "gemini-2.5-flash-preview-tts",
    "gemini-3.1-flash-tts-preview",
    "gemini-3.8-flash-tts",
    "gemini-3.8-flash-lite-tts",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash"
]

print("=== DETAILED MODEL INSPECTION ===")
for m_name in interesting_models:
    try:
        model_obj = client.models.get(model=m_name)
        print(f"\nModel: {m_name}")
        print(f"  Display Name: {getattr(model_obj, 'display_name', 'N/A')}")
        print(f"  Description: {getattr(model_obj, 'description', 'N/A')}")
        print(f"  Input Token Limit: {getattr(model_obj, 'input_token_limit', 'N/A')}")
        print(f"  Output Token Limit: {getattr(model_obj, 'output_token_limit', 'N/A')}")
        print(f"  Supported Generation Methods: {getattr(model_obj, 'supported_generation_methods', 'N/A')}")
    except Exception as e:
        print(f"Error fetching {m_name}: {e}")
