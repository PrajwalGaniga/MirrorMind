"""
Module 9 — Actions Route
POST /api/actions/normalize

Takes collected workflow data and uses the selected LLM to produce
clean structured JSON matching the existing Pydantic schemas.
Only called when the frontend wants LLM normalization (e.g. tech_stack string → list).

The frontend can also save directly without calling this endpoint
if the data is already clean.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
from auth_utils import get_current_user
from services.llm_service import call_llm
import json
import os

router = APIRouter()


class NormalizeRequest(BaseModel):
    workflow_id: str        # e.g. "ADD_PROJECT", "ADD_INTERNSHIP"
    collected_data: Dict[str, Any]
    provider: Optional[str] = "openrouter"
    edit_instruction: Optional[str] = None


NORMALIZE_PROMPTS = {
    "ADD_PROJECT": """
You are a JSON structuring assistant for a student portfolio app.
Given the raw collected answers below, produce a single valid JSON object
matching this exact schema (no extra fields, no markdown, no explanation):

{
  "title": string,
  "description": string,
  "tech_stack": [list of technology strings],
  "github_url": string or null,
  "live_demo_url": string or null
}

Rules:
- tech_stack must be a list of individual technology names (split on commas, spaces, "and", "&")
- github_url and live_demo_url: use null if not provided or if value is "skip"
- title and description: clean up but preserve meaning
- Output ONLY the raw JSON object. No markdown fences. No explanation.
""",
    "ADD_INTERNSHIP": """
You are a JSON structuring assistant for a student portfolio app.
Given the raw collected answers below, produce a single valid JSON object
matching this exact schema (no extra fields, no markdown, no explanation):

{
  "company_name": string,
  "role": string,
  "domain": string,
  "start_date": "ISO 8601 datetime string",
  "end_date": "ISO 8601 datetime string or null",
  "is_current": 0 or 1,
  "description": string or null
}

Rules:
- start_date and end_date: convert human dates like "January 2024" to ISO format "2024-01-01T00:00:00"
- is_current: 1 if end_date is "ongoing", else 0
- end_date: null if ongoing
- Output ONLY the raw JSON object. No markdown fences. No explanation.
""",
}


@router.post("/normalize")
async def normalize_action_data(
    request: NormalizeRequest,
    user_id: str = Depends(get_current_user),
):
    workflow_id = request.workflow_id.upper()

    if workflow_id not in NORMALIZE_PROMPTS:
        raise HTTPException(
            status_code=400,
            detail=f"No normalization prompt defined for workflow '{workflow_id}'"
        )

    system_prompt = NORMALIZE_PROMPTS[workflow_id]
    data_str = json.dumps(request.collected_data, indent=2)

    user_content = f"Raw collected answers:\n{data_str}"
    if request.edit_instruction:
        user_content += f"\n\nAdditional user instruction to apply during refinement:\n{request.edit_instruction}"

    print(
        f"[MIRRORMIND][ACTION]\n"
        f"normalize_request\n"
        f"workflow_id={workflow_id}\n"
        f"user_id={user_id}\n"
        f"fields={list(request.collected_data.keys())}\n"
        f"edit_instruction={request.edit_instruction is not None}\n"
    )

    provider = (request.provider or "openrouter").lower()
    valid_providers = {"openrouter", "ollama"}
    if provider not in valid_providers:
        provider = "openrouter"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    try:
        raw_answer, _ = await call_llm(messages, provider=provider)

        # Strip any accidental markdown fences the LLM adds
        cleaned = raw_answer.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines).strip()

        normalized = json.loads(cleaned)

        print(
            f"[MIRRORMIND][ACTION]\n"
            f"normalize_success\n"
            f"workflow_id={workflow_id}\n"
            f"fields_returned={list(normalized.keys())}\n"
        )

        return {"workflow_id": workflow_id, "normalized": normalized}

    except json.JSONDecodeError as e:
        print(f"[MIRRORMIND][ACTION] normalize_json_parse_failed: {e}")
        # Return raw so frontend can fall back to direct field mapping
        return {
            "workflow_id": workflow_id,
            "normalized": None,
            "raw": raw_answer,
            "error": "LLM output was not valid JSON. Using direct field mapping.",
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Normalization failed: {str(e)}"
        )

