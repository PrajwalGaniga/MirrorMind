from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from bson import ObjectId
from db import users_collection
from auth_utils import create_access_token
from models.user import UserRegister, UserLogin

router = APIRouter()


@router.post("/register")
def register(data: UserRegister):
    existing = users_collection.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "name": data.name,
        "email": data.email,
        "password": data.password,  # plain text — demo only
        "created_at": datetime.utcnow(),
    }
    result = users_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token({"sub": user_id, "email": data.email})
    return {
        "token": token,
        "user": {"id": user_id, "name": data.name, "email": data.email},
    }


@router.post("/login")
def login(data: UserLogin):
    user = users_collection.find_one({"email": data.email})
    if not user or user["password"] != data.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id, "email": data.email})
    return {
        "token": token,
        "user": {"id": user_id, "name": user["name"], "email": user["email"]},
    }
