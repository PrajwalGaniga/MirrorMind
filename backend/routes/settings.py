from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import secrets
import hashlib
from datetime import datetime

from db import get_db
from auth_utils import get_current_user
from models.db_models import ExtensionAPIKey

router = APIRouter()

@router.get("/api-key")
def get_api_key(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    api_key = db.query(ExtensionAPIKey).filter_by(user_id=user_id, revoked=False).first()
    if not api_key:
        return {"exists": False}
    
    return {
        "exists": True,
        "key_prefix": api_key.key_prefix,
        "created_at": api_key.created_at,
        "last_used_at": api_key.last_used_at
    }

@router.post("/api-key")
def generate_api_key(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_key = db.query(ExtensionAPIKey).filter_by(user_id=user_id).first()
    if existing_key and not existing_key.revoked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active API key already exists. Please regenerate if needed."
        )
    
    raw_key = f"ext_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:8]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    if existing_key:
        existing_key.key_prefix = key_prefix
        existing_key.key_hash = key_hash
        existing_key.created_at = datetime.utcnow()
        existing_key.last_used_at = None
        existing_key.revoked = False
        db.commit()
    else:
        new_key = ExtensionAPIKey(
            user_id=user_id,
            key_prefix=key_prefix,
            key_hash=key_hash
        )
        db.add(new_key)
        db.commit()
    
    return {
        "message": "API key created successfully",
        "raw_key": raw_key
    }

@router.post("/api-key/regenerate")
def regenerate_api_key(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_key = db.query(ExtensionAPIKey).filter_by(user_id=user_id).first()
    
    raw_key = f"ext_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:8]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    
    if existing_key:
        existing_key.key_prefix = key_prefix
        existing_key.key_hash = key_hash
        existing_key.created_at = datetime.utcnow()
        existing_key.last_used_at = None
        existing_key.revoked = False
        db.commit()
    else:
        new_key = ExtensionAPIKey(
            user_id=user_id,
            key_prefix=key_prefix,
            key_hash=key_hash
        )
        db.add(new_key)
        db.commit()
    
    return {
        "message": "API key regenerated successfully",
        "raw_key": raw_key
    }
