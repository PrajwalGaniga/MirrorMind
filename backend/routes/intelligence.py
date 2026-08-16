from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from auth_utils import get_current_user
from db import get_db
from services.rag_service import generate_rag_response

router = APIRouter()

VALID_PROVIDERS = {"openrouter", "ollama"}

# Error codes raised by llm_service mapped to user-facing messages
OLLAMA_ERROR_MESSAGES = {
    "OLLAMA_TIMEOUT": {
        "error": "Local Ollama did not respond within the allowed time.",
        "detail": "Your RAG context was successfully prepared, but the local model did not respond in time.",
        "suggestion": "Try OpenRouter for a faster response."
    },
    "OLLAMA_CONNECT_ERROR": {
        "error": "Cannot connect to Local Ollama.",
        "detail": "Ollama does not appear to be running on this machine.",
        "suggestion": "Start Ollama locally, or switch to OpenRouter."
    },
}
OPENROUTER_ERROR_MESSAGES = {
    "OPENROUTER_TIMEOUT": {
        "error": "OpenRouter did not respond in time.",
        "detail": "The cloud AI service timed out.",
        "suggestion": "Try again, or use Local Ollama if it is running."
    },
}


class AskRequest(BaseModel):
    question: str
    top_k: int = Field(default=5, ge=1, le=10)
    provider: Optional[str] = "openrouter"  # Frontend always sends this explicitly


@router.post("/ask")
async def ask_intelligence(
    request: AskRequest,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    # Validate provider
    provider = (request.provider or "openrouter").lower().strip()
    if provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider '{provider}'. Must be one of: {', '.join(VALID_PROVIDERS)}"
        )

    print(
        f"\n[MIRRORMIND][INTELLIGENCE]\n"
        f"provider={provider}\n"
        f"question_received=true\n"
        f"user_id={user_id}\n"
    )

    try:
        results = await generate_rag_response(
            user_id=user_id,
            question=request.question,
            db=db,
            top_k=request.top_k,
            provider=provider,
        )
        return results

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except RuntimeError as e:
        err_str = str(e)

        # Parse structured error codes from llm_service
        if err_str.startswith("OLLAMA_TIMEOUT:"):
            timeout_secs = err_str.split(":")[1]
            msg = OLLAMA_ERROR_MESSAGES["OLLAMA_TIMEOUT"]
            raise HTTPException(status_code=504, detail={
                "success": False,
                "provider": provider,
                "error_code": "OLLAMA_TIMEOUT",
                "timeout_seconds": timeout_secs,
                **msg
            })
        elif err_str == "OLLAMA_CONNECT_ERROR":
            msg = OLLAMA_ERROR_MESSAGES["OLLAMA_CONNECT_ERROR"]
            raise HTTPException(status_code=503, detail={
                "success": False,
                "provider": provider,
                "error_code": "OLLAMA_CONNECT_ERROR",
                **msg
            })
        elif err_str == "OPENROUTER_TIMEOUT":
            msg = OPENROUTER_ERROR_MESSAGES["OPENROUTER_TIMEOUT"]
            raise HTTPException(status_code=504, detail={
                "success": False,
                "provider": provider,
                "error_code": "OPENROUTER_TIMEOUT",
                **msg
            })
        else:
            raise HTTPException(status_code=502, detail={
                "success": False,
                "provider": provider,
                "error": err_str,
                "suggestion": "Check backend logs for details."
            })

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail={
            "success": False,
            "provider": provider,
            "error": "Internal server error during response generation.",
        })
