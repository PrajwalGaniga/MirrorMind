import os
import httpx
import time
from typing import Dict, Any, List

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

VALID_PROVIDERS = {"openrouter", "ollama"}


async def call_llm(messages: List[Dict[str, str]], provider: str | None = None) -> tuple[str, float]:
    """
    Sends a chat completion request to the specified LLM provider.
    provider: 'openrouter' or 'ollama'. If None, falls back to LLM_PROVIDER env var.
    Returns (answer, llm_ms).
    NO silent fallback — if the selected provider fails, the error propagates.
    """
    if provider is None:
        provider = os.getenv("LLM_PROVIDER", "openrouter").lower()

    if provider not in VALID_PROVIDERS:
        raise ValueError(f"Invalid provider '{provider}'. Must be one of: {', '.join(VALID_PROVIDERS)}")

    start_time = time.time()

    if provider == "ollama":
        ans = await _call_ollama(messages)
    else:
        ans = await _call_openrouter(messages)

    llm_ms = (time.time() - start_time) * 1000
    return ans, llm_ms


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
