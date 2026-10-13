import os
import asyncio
import httpx
import time
from typing import Dict, Any, List
from google import genai
from google.genai import types

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

VALID_PROVIDERS = {"gemini", "openrouter", "ollama"}


async def call_llm(messages: List[Dict[str, str]], provider: str | None = None) -> tuple[str, float]:
    """
    Sends a chat completion request to the specified LLM provider.
    provider: 'gemini', 'openrouter', or 'ollama'. If None, falls back to LLM_PROVIDER env var (defaults to 'gemini').
    Returns (answer, llm_ms).
    """
    if provider is None:
        provider = os.getenv("LLM_PROVIDER", "gemini").lower()

    if provider not in VALID_PROVIDERS:
        raise ValueError(f"Invalid provider '{provider}'. Must be one of: {', '.join(VALID_PROVIDERS)}")

    start_time = time.time()

    if provider == "gemini":
        ans = await _call_gemini(messages)
    elif provider == "ollama":
        ans = await _call_ollama(messages)
    else:
        ans = await _call_openrouter(messages)

    llm_ms = (time.time() - start_time) * 1000
    return ans, llm_ms


async def _call_gemini(messages: List[Dict[str, str]]) -> str:
    api_key = os.getenv("GEMINI_PAID_API_KEY") or os.getenv("GEMINI_API_KEY_RAG_DB") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_PAID_API_KEY or GEMINI_API_KEY is not configured.")

    primary_model = os.getenv("GEMINI_RAG_MODEL", "gemini-3.1-flash-lite").strip()
    candidate_models = [primary_model]
    for fallback in ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-pro-preview"]:
        if fallback not in candidate_models:
            candidate_models.append(fallback)


    system_prompt = None
    user_contents = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "system":
            system_prompt = content
        elif role == "user":
            user_contents.append(content)
        elif role == "assistant":
            user_contents.append(f"Assistant: {content}")

    full_prompt = "\n\n".join(user_contents)

    client = genai.Client(api_key=api_key)
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.3
    ) if system_prompt else types.GenerateContentConfig(temperature=0.3)

    last_error = None
    for model in candidate_models:
        print(f"\n[MIRRORMIND][GEMINI]\nmodel={model}\nrequest_started=true\n")
        try:
            gemini_start = time.time()
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=model,
                contents=full_prompt,
                config=config
            )
            gemini_ms = (time.time() - gemini_start) * 1000
            print(f"[MIRRORMIND][GEMINI]\nmodel={model}\nresponse_received=true\n")
            print(f"[MIRRORMIND][TIMING]\ngemini_ms={gemini_ms:.0f}\n")
            if response and response.text:
                return response.text.strip()
            else:
                raise RuntimeError("Empty response received from Gemini.")
        except Exception as e:
            err_str = str(e)
            last_error = err_str
            print(f"[MIRRORMIND][GEMINI][WARNING]\nmodel={model} failed: {err_str}")
            # If 503 unavailable or 429 quota, try next candidate model
            if "503" in err_str or "UNAVAILABLE" in err_str or "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                continue
            # For other fatal errors like invalid key, raise immediately
            if "API_KEY_INVALID" in err_str or "400" in err_str or "401" in err_str:
                raise RuntimeError(f"Gemini API Error: {err_str}")
            continue

    print(f"\n[MIRRORMIND][GEMINI][ERROR]\ntype=AllGeminiModelsFailed\nlast_error={last_error}\n")
    raise RuntimeError(f"Gemini generation failed on all models. Last error: {last_error}")


async def _call_ollama(messages: List[Dict[str, str]]) -> str:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
    timeout_seconds = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))
    endpoint = f"{base_url}/api/chat"

    print(f"\n[MIRRORMIND][OLLAMA]\nendpoint={endpoint}\nmodel={model}\nstream=false\nthink=false\ntimeout_seconds={timeout_seconds}\n")

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "think": False,
        "options": {
            "temperature": 0.3
        }
    }

    ollama_start = time.time()
    try:
        async with httpx.AsyncClient(timeout=float(timeout_seconds)) as client:
            response = await client.post(endpoint, json=payload)
            response.raise_for_status()
            data = response.json()

            ollama_ms = (time.time() - ollama_start) * 1000
            print(f"[MIRRORMIND][OLLAMA]\nresponse_received=true\n")
            print(f"[MIRRORMIND][TIMING]\nollama_ms={ollama_ms:.0f}\n")
            return data["message"]["content"].strip()

    except httpx.ReadTimeout:
        ollama_ms = (time.time() - ollama_start) * 1000
        print(f"\n[MIRRORMIND][OLLAMA][ERROR]\ntype=ReadTimeout\ntimeout_seconds={timeout_seconds}\nollama_ms={ollama_ms:.0f}\n")
        raise RuntimeError(f"OLLAMA_TIMEOUT:{timeout_seconds}")
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        resp_text = e.response.text[:500]
        print(f"\n[MIRRORMIND][OLLAMA][ERROR]\ntype={e.__class__.__name__}\nstatus_code={status_code}\nresponse={resp_text}\n")
        raise RuntimeError(f"Ollama HTTP error {status_code}: {resp_text}")
    except httpx.ConnectError as e:
        print(f"\n[MIRRORMIND][OLLAMA][ERROR]\ntype=ConnectError\nmessage=Connection refused to {base_url}\n")
        raise RuntimeError("OLLAMA_CONNECT_ERROR")
    except Exception as e:
        print(f"\n[MIRRORMIND][OLLAMA][ERROR]\ntype={e.__class__.__name__}\nmessage={str(e)}\n")
        raise RuntimeError(f"Ollama error: {str(e)}")


async def _call_openrouter(messages: List[Dict[str, str]]) -> str:
    keys_str = os.getenv("OPENROUTER_API_KEYS") or os.getenv("OPENROUTER_API_KEY")
    models_str = os.getenv("OPENROUTER_MODELS") or os.getenv("OPENROUTER_MODEL")

    if not keys_str:
        raise ValueError("OPENROUTER_API_KEYS is not configured.")
    if not models_str:
        raise ValueError("OPENROUTER_MODELS is not configured.")

    api_keys = [k.strip() for k in keys_str.split(",") if k.strip()]
    models = [m.strip() for m in models_str.split(",") if m.strip()]

    last_error = None

    for api_key in api_keys:
        for model in models:
            print(f"\n[MIRRORMIND][OPENROUTER]\nmodel={model}\nrequest_started=true\n")

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "MirrorMind"
            }

            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.3
            }

            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(OPENROUTER_URL, headers=headers, json=payload)

                    if response.status_code == 401 or response.status_code == 403:
                        last_error = f"Authentication error ({response.status_code}) with key ending in ...{api_key[-4:]}"
                        print(f"[MIRRORMIND][OPENROUTER][WARNING] {last_error}")
                        break # Try next API key

                    if response.status_code == 429:
                        last_error = f"Rate limit exceeded for key ending in ...{api_key[-4:]}"
                        print(f"[MIRRORMIND][OPENROUTER][WARNING] {last_error}")
                        break # Try next API key

                    response.raise_for_status()

                    data = response.json()
                    if "choices" in data and len(data["choices"]) > 0:
                        print(f"[MIRRORMIND][OPENROUTER]\nresponse_received=true\n")
                        return data["choices"][0]["message"]["content"].strip()
                    else:
                        raise RuntimeError("Invalid response structure from OpenRouter.")
            
            except httpx.TimeoutException:
                last_error = f"Timeout for model {model}"
                print(f"\n[MIRRORMIND][OPENROUTER][WARNING] {last_error}")
                continue # Try next model
            except httpx.HTTPError as e:
                last_error = f"HTTP error {getattr(e.response, 'status_code', 'unknown')} for model {model}"
                print(f"\n[MIRRORMIND][OPENROUTER][WARNING] {last_error}")
                continue # Try next model
            except Exception as e:
                last_error = f"Unexpected error {str(e)} for model {model}"
                print(f"\n[MIRRORMIND][OPENROUTER][WARNING] {last_error}")
                continue # Try next model

    print(f"\n[MIRRORMIND][OPENROUTER][ERROR]\ntype=AllFallbacksFailed\nlast_error={last_error}\n")
    raise RuntimeError(f"OpenRouter exhausted all API keys and models. Last error: {last_error}")
