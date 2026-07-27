from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from db import get_db
from auth_utils import get_current_user
from models.student import StudentProfile, InternshipProfile, ProjectProfile
from models.db_models import Student, Internship, Project, SemesterRecord, SubjectMark, User, Skill

router = APIRouter()


# ── Serializers ────────────────────────────────────────────────────────────────

def _serialize_internship(i: Internship) -> dict:
    return {
        "id": i.id,
        "company_name": i.company_name,
        "domain": i.domain,
        "role": i.role,
        "start_date": i.start_date.isoformat() if i.start_date else None,
        "end_date": i.end_date.isoformat() if i.end_date else None,
        "is_current": i.is_current,
        "certificate_url": i.certificate_url,
        "description": i.description,
    }


def _serialize_project(p: Project) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "github_url": p.github_url,
        "live_demo_url": p.live_demo_url,
        "tech_stack": p.tech_stack or [],
        "thumbnail_url": p.thumbnail_url,
        "certificate_url": p.certificate_url,
    }


def _serialize(student: Student) -> dict:
    doc = {c.name: getattr(student, c.name) for c in student.__table__.columns}

    doc["projects_count"] = len(student.projects)
    doc["internship_count"] = len(student.internships)
    doc["cgpa"] = student.cgpa if hasattr(student, 'cgpa') and student.cgpa else 0.0

    doc["internships"] = [_serialize_internship(i) for i in student.internships]
    doc["projects"] = [_serialize_project(p) for p in student.projects]
    doc["avatar_url"] = student.user.avatar_url if student.user else None
    
    # ensure certifications exists in response if needed by flutter, though flutter removes it, it's safer
    doc["certifications"] = getattr(student, "certifications", [])
    
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
def save_profile(
    profile: StudentProfile,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter_by(user_id=user_id).first()
    base_data = profile.dict(exclude={"internships", "projects", "semester_records"})

    if student:
        for key, value in base_data.items():
            setattr(student, key, value)
        student.predictions = None
        # We NO LONGER delete internships, projects, or semester_records here.
        # They are managed via their own dedicated endpoints (POST /projects, etc.)
    else:
        student = Student(**base_data, user_id=user_id)
        db.add(student)
        db.commit()
        db.refresh(student)

        # Only on initial creation do we populate any nested data sent in the profile
        for internship_data in profile.internships:
            db.add(Internship(**internship_data.dict(), student_id=student.id))

        for project_data in profile.projects:
            db.add(Project(**project_data.dict(), student_id=student.id))

        for sem_data in profile.semester_records:
            sem_dict = sem_data.dict(exclude={"subjects"})
            sem_record = SemesterRecord(**sem_dict, student_id=student.id)
            db.add(sem_record)
            db.commit()
            for sub_data in sem_data.subjects:
                db.add(SubjectMark(**sub_data.dict(), semester_record_id=sem_record.id))

    db.commit()
    db.refresh(student)
    return {"student_id": student.id, "message": "Profile saved successfully"}


@router.get("/profile")
def get_profile(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _serialize(student)


@router.patch("/profile/avatar")
def update_avatar(
    data: AvatarUpdate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.avatar_url = data.avatar_url
    db.commit()
    return {"avatar_url": user.avatar_url, "message": "Avatar updated"}


# ── Skills endpoints ─────────────────────────────────────────────────────────────

@router.get("/skills")
def get_skills(db: Session = Depends(get_db)):
    skills = db.query(Skill).all()
    return [{"id": s.id, "name": s.name} for s in skills]

# ── Internship CRUD ────────────────────────────────────────────────────────────

@router.get("/internships")
def list_internships(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    return [_serialize_internship(i) for i in student.internships]


@router.post("/internships")
def add_internship(
    data: InternshipProfile,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Complete onboarding first")
    internship = Internship(**data.dict(), student_id=student.id)
    db.add(internship)
    student.predictions = None
    db.commit()
    db.refresh(internship)
    return _serialize_internship(internship)


@router.patch("/internships/{internship_id}/certificate")
def update_certificate(
    internship_id: str,
    data: CertificateUpdate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    internship = db.query(Internship).filter_by(id=internship_id, student_id=student.id).first()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    internship.certificate_url = data.certificate_url
    student.predictions = None
    db.commit()
    return {"certificate_url": internship.certificate_url, "message": "Certificate updated"}


@router.delete("/internships/{internship_id}")
def delete_internship(
    internship_id: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    internship = db.query(Internship).filter_by(id=internship_id, student_id=student.id).first()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    db.delete(internship)
    student.predictions = None
    db.commit()
    return {"message": "Internship deleted"}


# ── Project CRUD ───────────────────────────────────────────────────────────────

@router.get("/projects")
def list_projects(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    return [_serialize_project(p) for p in student.projects]


@router.post("/projects")
def add_project(
    data: ProjectProfile,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Complete onboarding first")
    project = Project(**data.dict(), student_id=student.id)
    db.add(project)
    student.predictions = None
    db.commit()
    db.refresh(project)
    return _serialize_project(project)


@router.put("/projects/{project_id}")
def update_project(
    project_id: str,
    data: ProjectProfile,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    project = db.query(Project).filter_by(id=project_id, student_id=student.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.title = data.title
    project.description = data.description
    project.github_url = data.github_url
    project.live_demo_url = data.live_demo_url
    project.tech_stack = data.tech_stack
    if data.thumbnail_url:
        project.thumbnail_url = data.thumbnail_url
    if data.certificate_url:
        project.certificate_url = data.certificate_url
        
    student.predictions = None
    db.commit()
    db.refresh(project)
    return _serialize_project(project)


@router.patch("/projects/{project_id}/thumbnail")
def update_thumbnail(
    project_id: str,
    data: ThumbnailUpdate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    project = db.query(Project).filter_by(id=project_id, student_id=student.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.thumbnail_url = data.thumbnail_url
    student.predictions = None
    db.commit()
    return {"thumbnail_url": project.thumbnail_url, "message": "Thumbnail updated"}


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    project = db.query(Project).filter_by(id=project_id, student_id=student.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    student.predictions = None
    db.commit()
    return {"message": "Project deleted"}
