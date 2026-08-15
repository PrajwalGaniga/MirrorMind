import os
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from google import genai

from db import get_db
from auth_utils import verify_extension_api_key, get_current_user
from models.db_models import ExtensionActivityLog, ErrorLog

router = APIRouter()


# ── Part A: verify-key ────────────────────────────────────────────────────────

@router.post("/verify-key")
async def verify_key(
    user_id: str = Depends(verify_extension_api_key),
):
    """
    Accepts X-Extension-Key header, validated by the shared dependency.
    The dependency already updates last_used_at and raises 401 on failure.
    Returns user_id only — no key material exposed.
    """
    return {"valid": True, "user_id": user_id}


# ── Part C: activity logging ──────────────────────────────────────────────────

class ActivityPayload(BaseModel):
    event_type: str
    file_path: str


@router.post("/activity", status_code=201)
async def log_activity(
    payload: ActivityPayload,
    user_id: str = Depends(verify_extension_api_key),
    db = Depends(get_db),
):
    now = datetime.utcnow()
    log_entry = ExtensionActivityLog(
        user_id=user_id,
        event_type=payload.event_type,
        file_path=payload.file_path,
        created_at=now,
    )
    
    doc = log_entry.model_dump()
    doc["_id"] = doc.pop("id")
    await db.extension_activity_log.insert_one(doc)

    print(
        f"[EXTENSION ACTIVITY] user_id={user_id} event={payload.event_type} "
        f"file={payload.file_path} at={now.isoformat()}"
    )

    return {"id": doc["_id"]}


# ── Error logging with fingerprint dedup ─────────────────────────────────────

class ErrorPayload(BaseModel):
    file_path: str
    error_message: str
    line: int
    source: str | None = None
    error_code: str | None = None
    fingerprint: str
    code_context: str | None = None
    full_line: str | None = None


@router.post("/error", status_code=201)
async def log_error(
    payload: ErrorPayload,
    user_id: str = Depends(verify_extension_api_key),
    db = Depends(get_db),
):
    # Dedup check: same user + same fingerprint → skip insert
    existing = await db.error_logs.find_one({"user_id": user_id, "fingerprint": payload.fingerprint})

    if existing:
        print(
            f"[ERROR DEDUP] user_id={user_id} fingerprint={payload.fingerprint}"
            " — already logged, skipping"
        )
        return {"id": existing.get("_id"), "duplicate": True, "hint": existing.get("hint")}

    # New error — call Gemini
    hint = None
    explanation = None
    corrected_block = None
    gemini_fetched_at = None

    prompt = f"""
Here is a snippet of Python code with an error on line {payload.line}: 
{payload.code_context}

The error is: {payload.error_message} (source: {payload.source}).

Respond with JSON only: {{"hint": "...", "explanation": "...", "corrected_block": "..."}} where corrected_block is the corrected version of ONLY the erroring line/block, grounded in the actual code shown, not a generic example.
"""

    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            elif text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            data = json.loads(text)
            hint = data.get("hint")
            explanation = data.get("explanation")
            corrected_block = data.get("corrected_block")
            gemini_fetched_at = datetime.utcnow()
        except Exception as e:
            print(f"[GEMINI ERROR] failed to fetch or parse response: {e}")

    now = datetime.utcnow()
    entry = ErrorLog(
        user_id=user_id,
        file_path=payload.file_path,
        error_message=payload.error_message,
        line=payload.line,
        source=payload.source,
        error_code=str(payload.error_code) if payload.error_code is not None else None,
        fingerprint=payload.fingerprint,
        hint=hint,
        explanation=explanation,
        corrected_block=corrected_block,
        gemini_fetched_at=gemini_fetched_at,
        code_context=payload.code_context,
        created_at=now,
    )
    
    doc = entry.model_dump()
    doc["_id"] = doc.pop("id")
    await db.error_logs.insert_one(doc)

    print(
        f'[NEW ERROR] user_id={user_id} file={payload.file_path} line={payload.line} '
        f'message="{payload.error_message}" source={payload.source} '
        f'fingerprint={payload.fingerprint} gemini_called={gemini_fetched_at is not None}'
    )

    return {"id": doc["_id"], "duplicate": False, "hint": hint}


# ── Part B: Dashboard Fetch Endpoints ────────────────────────────────────────

@router.get("/errors")
async def list_errors(
    status: str = "active",
    user_id: str = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
    db = Depends(get_db)
):
    query = {"user_id": user_id}
    
    if status == "active":
        query["resolved_via"] = None
    elif status == "history":
        two_days_ago = datetime.utcnow() - timedelta(days=2)
        query["resolved_via"] = {"$ne": None}
        query["hidden_by_user"] = False
        query["resolved_at"] = {"$gt": two_days_ago}
        
    cursor = db.error_logs.find(query).sort("created_at", -1).skip(offset).limit(limit)
    errors = await cursor.to_list(length=limit)
    
    return [
        {
            "id": err.get("_id"),
            "file_path": err.get("file_path"),
            "error_message": err.get("error_message"),
            "line": err.get("line"),
            "source": err.get("source"),
            "hint": err.get("hint"),
            "resolved_via": err.get("resolved_via"),
            "created_at": err.get("created_at")
        }
        for err in errors
    ]

@router.get("/errors/{error_id}/reveal")
async def reveal_error(
    error_id: str,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    error = await db.error_logs.find_one({"_id": error_id, "user_id": user_id})
    if not error:
        raise HTTPException(status_code=404, detail="Error log not found")
        
    return {
        "corrected_block": error.get("corrected_block"),
        "explanation": error.get("explanation")
    }

class ResolvePayload(BaseModel):
    resolved_via: str

@router.patch("/errors/{error_id}/resolve")
async def resolve_error(
    error_id: str,
    payload: ResolvePayload,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    if payload.resolved_via not in ["hint", "full_fix"]:
        raise HTTPException(status_code=400, detail="Invalid resolved_via value")
        
    result = await db.error_logs.update_one(
        {"_id": error_id, "user_id": user_id},
        {"$set": {"resolved_via": payload.resolved_via, "resolved_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Error log not found")

    return {"status": "ok"}

@router.delete("/errors/{error_id}")
async def delete_error(
    error_id: str,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    result = await db.error_logs.update_one(
        {"_id": error_id, "user_id": user_id},
        {"$set": {"hidden_by_user": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Error log not found")

    return {"status": "ok"}
