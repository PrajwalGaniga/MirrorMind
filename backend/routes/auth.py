from fastapi import APIRouter, HTTPException, Depends
from db import get_db
from auth_utils import create_access_token
from models.user import UserRegister, UserLogin
from models.db_models import User
import bcrypt

router = APIRouter()


@router.post("/register")
async def register(data: UserRegister, db = Depends(get_db)):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_user = User(
        name=data.name,
        email=data.email,
        password=hashed,
    )
    user_dict = new_user.model_dump()
    user_dict["_id"] = user_dict.pop("id")
    await db.users.insert_one(user_dict)

    token = create_access_token({"sub": new_user.id, "email": new_user.email})
    return {
        "token": token,
        "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email},
    }


@router.post("/login")
async def login(data: UserLogin, db = Depends(get_db)):
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    stored = user.get("password", "")
    is_valid = False
    
    if stored.startswith("$2b$"):
        if bcrypt.checkpw(data.password.encode('utf-8'), stored.encode('utf-8')):
            is_valid = True
    else:
        # Legacy fallback
        if stored == data.password:
            is_valid = True
            # Upgrade legacy plaintext password to bcrypt
            hashed = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"password": hashed}}
            )

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id, "email": user["email"]})
    return {
        "token": token,
        "user": {"id": user_id, "name": user["name"], "email": user["email"]},
    }
