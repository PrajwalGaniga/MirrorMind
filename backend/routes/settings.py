from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import secrets
import hashlib
from datetime import datetime
from pydantic import BaseModel

from db import get_db
from auth_utils import get_current_user
from models.db_models import ExtensionAPIKey, User

router = APIRouter()

class RegenerateRequest(BaseModel):
    password: str

@router.get("/api-key")
async def get_api_key(
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return {"exists": False}
    
    api_key_data = user.get("extension_api_key")
    if not api_key_data or api_key_data.get("revoked"):
        return {"exists": False}
    
    return {
        "exists": True,
        "key_prefix": api_key_data.get("key_prefix"),
        "created_at": api_key_data.get("created_at"),
        "last_used_at": api_key_data.get("last_used_at")
    }

@router.post("/api-key")
async def generate_api_key(
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    existing_key = user.get("extension_api_key")
    if existing_key and not existing_key.get("revoked"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active API key already exists. Please regenerate if needed."
        )
    
    raw_key = f"ext_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    new_key_data = {
        "key_prefix": key_prefix,
        "key_hash": key_hash,
        "created_at": datetime.utcnow(),
        "last_used_at": None,
        "revoked": False
    }
    
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"extension_api_key": new_key_data}}
    )
    
    return {
        "message": "API key created successfully",
        "raw_key": raw_key
    }

@router.post("/api-key/regenerate")
async def regenerate_api_key(
    req: RegenerateRequest,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    import bcrypt
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
        
    stored = user.get("password", "")
    is_valid = False
    
    if stored.startswith("$2b$"):
        if bcrypt.checkpw(req.password.encode('utf-8'), stored.encode('utf-8')):
            is_valid = True
    else:
        if stored == req.password:
            is_valid = True
            
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )

    raw_key = f"ext_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    new_key_data = {
        "key_prefix": key_prefix,
        "key_hash": key_hash,
        "created_at": datetime.utcnow(),
        "last_used_at": None,
        "revoked": False
    }
    
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"extension_api_key": new_key_data}}
    )
    
    return {
        "message": "API key regenerated successfully",
        "raw_key": raw_key
    }
