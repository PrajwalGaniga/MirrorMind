from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId
from db import students_collection
from auth_utils import get_current_user
from models.student import StudentProfile

router = APIRouter()


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    if "user_id" in doc:
        doc["user_id"] = str(doc["user_id"])
    return doc


@router.post("/profile")
def save_profile(profile: StudentProfile, user_id: str = Depends(get_current_user)):
    now = datetime.utcnow()
    doc = profile.dict()
    doc["user_id"] = ObjectId(user_id)
    doc["updated_at"] = now
    doc["predictions"] = None

    students_collection.update_one(
        {"user_id": ObjectId(user_id)},
        {"$set": doc},
        upsert=True,
    )
    student = students_collection.find_one({"user_id": ObjectId(user_id)})
    return {"student_id": str(student["_id"]), "message": "Profile saved successfully"}


@router.get("/profile")
def get_profile(user_id: str = Depends(get_current_user)):
    student = students_collection.find_one({"user_id": ObjectId(user_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _serialize(student)
