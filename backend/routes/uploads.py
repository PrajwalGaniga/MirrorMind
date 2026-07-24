import os
import hashlib
import hmac
import time
from fastapi import APIRouter, Depends
from dotenv import load_dotenv
from auth_utils import get_current_user

load_dotenv()

CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "626445917944175")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "ss5gnsii")

router = APIRouter()


@router.get("/config")
def get_cloudinary_config(user_id: str = Depends(get_current_user)):
    """Return Cloudinary config for direct unsigned uploads from mobile app."""
    return {
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "api_key": CLOUDINARY_API_KEY,
        "upload_preset": "mirrormind_unsigned",  # Create this in Cloudinary dashboard
    }


@router.get("/sign")
def sign_upload(
    folder: str = "mirrormind",
    user_id: str = Depends(get_current_user),
):
    """
    Return a signed upload signature for secure Cloudinary uploads.
    Used if you need signed uploads instead of unsigned preset.
    """
    timestamp = int(time.time())
    params_to_sign = f"folder={folder}&timestamp={timestamp}"

    if CLOUDINARY_API_SECRET:
        signature = hashlib.sha1(
            (params_to_sign + CLOUDINARY_API_SECRET).encode()
        ).hexdigest()
    else:
        signature = ""

    return {
        "timestamp": timestamp,
        "signature": signature,
        "api_key": CLOUDINARY_API_KEY,
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "folder": folder,
    }
