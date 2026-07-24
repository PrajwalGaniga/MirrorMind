from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from db import get_db
from auth_utils import get_current_user
from models.db_models import Student
from inference.predictor import predict_career, USE_MOCK, MOCK_PREDICTIONS

router = APIRouter()

ADVANCED_SKILLS = [
    "tensorflow", "pytorch", "kubernetes", "docker", "aws", "azure", "gcp",
    "react", "django", "fastapi", "postgresql", "mongodb", "spark", "kafka",
    "xgboost", "lightgbm"
]

ROLE_LABELS = {
    "AIML_ENGINEER": "AI / ML Engineer",
    "DATA_ANALYST": "Data Analyst",
    "SWE_BACKEND": "Backend Developer",
    "SWE_FRONTEND": "Frontend Developer",
    "FULLSTACK": "Full Stack Developer",
    "DEVOPS_CLOUD": "DevOps / Cloud Engineer",
    "DATA_ENGINEER": "Data Engineer",
    "CYBERSECURITY": "Cybersecurity Analyst",
    "EMBEDDED": "Embedded Systems Engineer",
    "RESEARCH": "Research Engineer",
    "PRODUCT_MANAGER": "Product Manager",
}


def _compute_radar(skills: list, cgpa: float, projects: int, internships: int) -> dict:
    skills_lower = [s.lower() for s in skills]
    return {
        "technical_depth": min(100, len([s for s in skills_lower if s in ADVANCED_SKILLS]) * 20),
        "breadth": min(100, len(skills) * 8),
        "project_exp": min(100, projects * 20),
        "industry_exp": min(100, internships * 40),
        "academic": min(100, int((cgpa / 10.0) * 100)),
        "soft_skills": 60,
    }


def _build_insight(predictions: list, skills: list) -> str:
    top_role = predictions[0]["role"] if predictions else None
    top_conf = predictions[0]["confidence"] if predictions else 0
    skills_lower = [s.lower() for s in skills]

    if top_role == "AIML_ENGINEER":
        missing = [s for s in ["pytorch", "docker"] if s not in skills_lower]
        if missing and top_conf < 0.85:
            return f"Add {' and '.join(missing)} to reach 85%+ confidence for ML roles"
    if top_role == "DEVOPS_CLOUD":
        missing = [s for s in ["kubernetes", "terraform"] if s not in skills_lower]
        if missing:
            return f"Add {' and '.join(missing)} to strengthen your DevOps profile"
    if top_conf >= 0.75:
        return f"Strong match for {ROLE_LABELS.get(top_role, top_role)} — keep building domain projects!"
    return "Diversify your skills across projects and internships to boost prediction confidence"


@router.get("/predict")
def predict(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.query(Student).filter_by(user_id=user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found. Please complete onboarding first.")

    skills = student.skills or []
    
    projects = len(student.projects)
    internships = len(student.internships)
    
    if student.semester_records:
        total_credits = sum(r.credits_earned for r in student.semester_records)
        cgpa = float(sum(r.sgpa * r.credits_earned for r in student.semester_records) / total_credits) if total_credits > 0 else 0.0
    else:
        cgpa = 0.0

    skill_radar = _compute_radar(skills, cgpa, projects, internships)

    if USE_MOCK:
        predictions = MOCK_PREDICTIONS
    else:
        result = predict_career(skills, cgpa, projects, internships, top_k=5)
        raw_preds = result["predictions"]
        predictions = [
            {
                "rank": p["rank"],
                "role": p["role"],
                "label": ROLE_LABELS.get(p["role"], p["role"]),
                "confidence": p["confidence"],
            }
            for p in raw_preds
        ]

    top_insight = _build_insight(predictions, skills)

    student.predictions = predictions
    db.commit()

    return {
        "student_id": student.id,
        "name": student.name or "",
        "branch": student.branch or "",
        "cgpa": cgpa,
        "predictions": predictions,
        "skill_radar": skill_radar,
        "top_insight": top_insight,
    }
