import os
from google import genai

API_KEY = "REDACTED_KEY"

client = genai.Client(api_key=API_KEY)

try:
    print("Listing models with the provided API key...")
    models = list(client.models.list())
    print(f"Total models returned: {len(models)}")
    
    audio_models = []
    all_model_info = []

    for m in models:
        name = getattr(m, 'name', '') or str(m)
        display_name = getattr(m, 'display_name', '')
        desc = getattr(m, 'description', '')
        methods = getattr(m, 'supported_generation_methods', [])
        
        info = {
            "name": name,
            "display_name": display_name,
            "description": desc,
            "methods": methods
        }
        all_model_info.append(info)
        
        # Check if audio or multimodal
        desc_lower = (desc or "").lower()
        name_lower = (name or "").lower()
        if any(term in name_lower or term in desc_lower for term in ['audio', 'live', 'realtime', 'flash', 'speech', 'voice']):
            audio_models.append(info)

    print("\n--- Potential Audio / Flash / Realtime Models ---")
    for am in audio_models:
        print(f"Model: {am['name']}")
        print(f"  Display: {am['display_name']}")
        print(f"  Methods: {am['methods']}")
        print(f"  Desc: {am['description'][:100]}...")
        print()

except Exception as e:
    print(f"Error querying models: {e}")
