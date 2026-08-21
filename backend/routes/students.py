from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from db import get_db
from auth_utils import get_current_user
from models.student import StudentProfile, InternshipProfile, ProjectProfile, ProfileUpdateRequest
from models.db_models import Student, Internship, Project, SemesterRecord, SubjectMark

router = APIRouter()

# ── Serializers ────────────────────────────────────────────────────────────────

def _serialize_internship(i: dict) -> dict:
    start = i.get("start_date")
    end = i.get("end_date")
    return {
        "id": i.get("id"),
        "company_name": i.get("company_name"),
        "domain": i.get("domain"),
        "role": i.get("role"),
        "start_date": start.isoformat() if isinstance(start, datetime) else start,
        "end_date": end.isoformat() if isinstance(end, datetime) else end,
        "is_current": i.get("is_current", 0),
        "certificate_url": i.get("certificate_url"),
        "description": i.get("description"),
    }

def _serialize_project(p: dict) -> dict:
    return {
        "id": p.get("id"),
        "title": p.get("title"),
        "description": p.get("description"),
        "github_url": p.get("github_url"),
        "live_demo_url": p.get("live_demo_url"),
        "tech_stack": p.get("tech_stack") or [],
        "thumbnail_url": p.get("thumbnail_url"),
        "certificate_url": p.get("certificate_url"),
    }

async def _serialize(student_dict: dict, db) -> dict:
    # exclude embedded arrays for the top-level keys
    doc = {k: v for k, v in student_dict.items() if k not in ["internships", "projects", "semester_records", "_id"]}
    
    internships = student_dict.get("internships", [])
    projects = student_dict.get("projects", [])
    
    doc["projects_count"] = len(projects)
    doc["internship_count"] = len(internships)
    doc["cgpa"] = student_dict.get("cgpa", 0.0)

    doc["internships"] = [_serialize_internship(i) for i in internships]
    doc["projects"] = [_serialize_project(p) for p in projects]
    
    user = await db.users.find_one({"id": student_dict.get("user_id")})
    doc["avatar_url"] = user.get("avatar_url") if user else None
    
    doc["certifications"] = student_dict.get("certifications", [])
    return doc


# ── Pydantic schemas for partial updates ──────────────────────────────────────

class AvatarUpdate(BaseModel):
    avatar_url: str

class CertificateUpdate(BaseModel):
    certificate_url: str

class ThumbnailUpdate(BaseModel):
    thumbnail_url: str


# ── Profile endpoints ──────────────────────────────────────────────────────────

@router.post("/profile")
async def save_profile(
    profile: StudentProfile,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    student_dict = await db.students.find_one({"user_id": user_id})
    base_data = profile.dict(exclude={"internships", "projects", "semester_records"})

    if student_dict:
        update_doc = {**base_data, "predictions": None, "updated_at": datetime.utcnow()}
        result = await db.students.update_one(
            {"user_id": user_id},
            {"$set": update_doc}
        )
        student_id = student_dict.get("id")

        print(
            f"[MIRRORMIND][PROFILE]\n"
            f"user_id={user_id}\n"
            f"operation=UPDATE\n"
            f"fields_updated={list(base_data.keys())}\n"
            f"matched_count={result.matched_count}\n"
            f"modified_count={result.modified_count}\n"
        )

        if result.matched_count == 0:
            # Document not found by user_id — should not happen, but handle defensively
            raise HTTPException(
                status_code=404,
                detail="Profile not found. Please complete onboarding first."
            )
    else:
        new_student = Student(**base_data, user_id=user_id)

        for internship_data in profile.internships:
            new_student.internships.append(Internship(**internship_data.dict()))

        for project_data in profile.projects:
            new_student.projects.append(Project(**project_data.dict()))

        for sem_data in profile.semester_records:
            sem_dict = sem_data.dict(exclude={"subjects"})
            sem_record = SemesterRecord(**sem_dict)
            for sub_data in sem_data.subjects:
                sem_record.subjects.append(SubjectMark(**sub_data.dict()))
            new_student.semester_records.append(sem_record)

        student_doc = new_student.model_dump()
        student_doc["_id"] = student_doc["id"]
        await db.students.insert_one(student_doc)
        student_id = new_student.id

        print(
            f"[MIRRORMIND][PROFILE]\n"
            f"user_id={user_id}\n"
            f"operation=INSERT\n"
            f"student_id={student_id}\n"
        )

    # Always re-fetch and return the actual persisted document
    persisted = await db.students.find_one({"user_id": user_id})
    if not persisted:
        raise HTTPException(status_code=500, detail="Profile persistence verification failed.")

    print(
        f"[MIRRORMIND][PROFILE]\n"
        f"PERSISTENCE VERIFIED\n"
        f"profile_reload_success=true\n"
        f"profile_fields={list(persisted.keys())}\n"
    )

    return {
        "student_id": student_id,
        "message": "Profile saved successfully",
        "profile": await _serialize(persisted, db),
    }


@router.get("/profile")
async def get_profile(user_id: str = Depends(get_current_user), db = Depends(get_db)):
    student = await db.students.find_one({"user_id": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    print(
        f"[MIRRORMIND][PROFILE]\n"
        f"GET_PROFILE\n"
        f"user_id={user_id}\n"
        f"profile_found=true\n"
        f"profile_fields={list(student.keys())}\n"
    )
    return await _serialize(student, db)


@router.patch("/profile/update")
async def update_profile_fields(
    data: ProfileUpdateRequest,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    """
    Safe partial update for profile scalar fields.
    Only fields explicitly provided are written to MongoDB.
    internships / projects / semester_records are NEVER touched by this endpoint.
    """
    # Build $set dict from only the non-None fields
    fields_to_update = {
        k: v for k, v in data.dict().items() if v is not None
    }

    if not fields_to_update:
        # Nothing to update — still return the current persisted profile
        student = await db.students.find_one({"user_id": user_id})
        if not student:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {"message": "No changes submitted", "profile": await _serialize(student, db)}

    fields_to_update["updated_at"] = datetime.utcnow()
    fields_to_update["predictions"] = None  # invalidate cached predictions on any profile change

    print(
        f"[MIRRORMIND][PROFILE]\n"
        f"PATCH_UPDATE REQUEST\n"
        f"user_id={user_id}\n"
        f"fields_updated={list(fields_to_update.keys())}\n"
    )

    result = await db.students.update_one(
        {"user_id": user_id},
        {"$set": fields_to_update}
    )

    print(
        f"[MIRRORMIND][PROFILE]\n"
        f"MONGO UPDATE\n"
        f"matched_count={result.matched_count}\n"
        f"modified_count={result.modified_count}\n"
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Profile not found. Please complete onboarding first."
        )

    # Re-fetch and return the actual persisted document
    persisted = await db.students.find_one({"user_id": user_id})
    if not persisted:
        raise HTTPException(status_code=500, detail="Profile persistence verification failed.")

    print(
        f"[MIRRORMIND][PROFILE]\n"
        f"PERSISTENCE VERIFIED\n"
        f"profile_reload_success=true\n"
    )

    return {
        "message": "Profile updated successfully",
        "modified_count": result.modified_count,
        "profile": await _serialize(persisted, db),
    }


@router.patch("/profile/avatar")
async def update_avatar(
    data: AvatarUpdate,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"id": user_id}, {"$set": {"avatar_url": data.avatar_url}})
    return {"avatar_url": data.avatar_url, "message": "Avatar updated"}


# ── Skills endpoints ─────────────────────────────────────────────────────────────

@router.get("/skills")
async def get_skills(db = Depends(get_db)):
    cursor = db.skills.find({})
    skills = await cursor.to_list(length=None)
    return [{"id": s.get("id"), "name": s.get("name")} for s in skills]

# ── Internship CRUD ────────────────────────────────────────────────────────────

@router.get("/internships")
async def list_internships(user_id: str = Depends(get_current_user), db = Depends(get_db)):
    student = await db.students.find_one({"user_id": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    return [_serialize_internship(i) for i in student.get("internships", [])]


@router.post("/internships")
async def add_internship(
    data: InternshipProfile,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    student = await db.students.find_one({"user_id": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Complete onboarding first")
    
    internship = Internship(**data.dict())
    await db.students.update_one(
        {"user_id": user_id},
        {
            "$push": {"internships": internship.model_dump()},
            "$set": {"predictions": None}
        }
    )
    return _serialize_internship(internship.model_dump())


@router.patch("/internships/{internship_id}/certificate")
async def update_certificate(
    internship_id: str,
    data: CertificateUpdate,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    result = await db.students.update_one(
        {"user_id": user_id, "internships.id": internship_id},
        {
            "$set": {
                "internships.$.certificate_url": data.certificate_url,
                "predictions": None
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Internship or Profile not found")
        
    return {"certificate_url": data.certificate_url, "message": "Certificate updated"}


@router.delete("/internships/{internship_id}")
async def delete_internship(
    internship_id: str,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    result = await db.students.update_one(
        {"user_id": user_id},
        {
            "$pull": {"internships": {"id": internship_id}},
            "$set": {"predictions": None}
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Internship or Profile not found")
    
    return {"message": "Internship deleted"}


# ── Project CRUD ───────────────────────────────────────────────────────────────

@router.get("/projects")
async def list_projects(user_id: str = Depends(get_current_user), db = Depends(get_db)):
    student = await db.students.find_one({"user_id": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    return [_serialize_project(p) for p in student.get("projects", [])]


@router.post("/projects")
async def add_project(
    data: ProjectProfile,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    student = await db.students.find_one({"user_id": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Complete onboarding first")
    
    project = Project(**data.dict())
    await db.students.update_one(
        {"user_id": user_id},
        {
            "$push": {"projects": project.model_dump()},
            "$set": {"predictions": None}
        }
    )
    return _serialize_project(project.model_dump())


@router.put("/projects/{project_id}")
async def update_project(
    project_id: str,
    data: ProjectProfile,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    update_data = {
        "projects.$.title": data.title,
        "projects.$.description": data.description,
        "projects.$.github_url": data.github_url,
        "projects.$.live_demo_url": data.live_demo_url,
        "projects.$.tech_stack": data.tech_stack,
        "predictions": None
    }
    if data.thumbnail_url:
        update_data["projects.$.thumbnail_url"] = data.thumbnail_url
    if data.certificate_url:
        update_data["projects.$.certificate_url"] = data.certificate_url
        
    result = await db.students.update_one(
        {"user_id": user_id, "projects.id": project_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Project or Profile not found")
        
    updated_student = await db.students.find_one({"user_id": user_id})
    updated_project = next(p for p in updated_student.get("projects", []) if p["id"] == project_id)
    return _serialize_project(updated_project)


@router.patch("/projects/{project_id}/thumbnail")
async def update_thumbnail(
    project_id: str,
    data: ThumbnailUpdate,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    result = await db.students.update_one(
        {"user_id": user_id, "projects.id": project_id},
        {
            "$set": {
                "projects.$.thumbnail_url": data.thumbnail_url,
                "predictions": None
            }
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Project or Profile not found")
        
    return {"thumbnail_url": data.thumbnail_url, "message": "Thumbnail updated"}


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db = Depends(get_db),
):
    result = await db.students.update_one(
        {"user_id": user_id},
        {
            "$pull": {"projects": {"id": project_id}},
            "$set": {"predictions": None}
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Project or Profile not found")
        
    return {"message": "Project deleted"}
