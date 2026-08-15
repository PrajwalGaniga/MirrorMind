import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends
from db import get_db
from auth_utils import get_current_user
from inference.predictor import predict_career, USE_MOCK, MOCK_PREDICTIONS

logger = logging.getLogger(__name__)

router = APIRouter()

ADVANCED_SKILLS = [
    "tensorflow", "pytorch", "keras", "scikit-learn", "xgboost", "lightgbm",
    "kubernetes", "docker", "aws", "azure", "gcp", "react", "angular", "vue",
    "django", "fastapi", "flask", "postgresql", "mongodb", "redis", "spark", "kafka",
]

ROLE_LABELS = {
    "AIML_ENGINEER":   "AI / ML Engineer",
    "DATA_ANALYST":    "Data Analyst",
    "SWE_BACKEND":     "Backend Developer",
    "SWE_FRONTEND":    "Frontend Developer",
    "FULLSTACK":       "Full Stack Developer",
    "FULLSTACK_DEV":   "Full Stack Developer",
    "DEVOPS_CLOUD":    "DevOps / Cloud Engineer",
    "DATA_ENGINEER":   "Data Engineer",
    "CYBERSECURITY":   "Cybersecurity Analyst",
    "EMBEDDED":        "Embedded Systems Engineer",
    "EMBEDDED_IOT":    "Embedded / IoT Engineer",
    "RESEARCH":        "Research Engineer",
    "PRODUCT_MANAGER": "Product Manager",
}

# ── Helpers ────────────────────────────────────────────────────────────────────

def _compute_radar(skills: list, cgpa: float, projects: int, internships: int) -> dict:
    skills_lower = [s.lower() for s in skills]
    return {
        "technical_depth": min(100, len([s for s in skills_lower if s in ADVANCED_SKILLS]) * 20),
        "breadth":         min(100, len(skills) * 8),
        "project_exp":     min(100, projects * 20),
        "industry_exp":    min(100, internships * 40),
        "academic":        min(100, int((cgpa / 10.0) * 100)),
        "soft_skills":     60,
    }


def _build_insight(predictions: list, skills: list) -> str:
    if not predictions:
        return "Complete your profile to get career predictions."
    top_role = predictions[0]["role"]
    top_conf = predictions[0]["confidence"]
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


def _run_ml(skills, cgpa, projects, internships) -> list:
    """Blocking ML call — always run via asyncio.to_thread so it never stalls the event loop."""
    result = predict_career(skills, cgpa, projects, internships, top_k=5)
    return [
        {
            "rank": i + 1,
            "role": p["role"],
            "label": ROLE_LABELS.get(p["role"], p["role"]),
            "confidence": p["confidence"],
        }
        for i, p in enumerate(result["predictions"])
    ]


async def _persist_cache(db, user_id: str, predictions: list,
                   skill_radar: dict, top_insight: str, cgpa: float):
    from datetime import datetime
    update_doc = {
        "predictions": predictions,
        "skill_radar": skill_radar,
        "top_insight": top_insight,
        "cgpa": cgpa,
        "computed_at": datetime.utcnow()
    }
    await db.prediction_cache.update_one(
        {"user_id": user_id},
        {"$set": update_doc},
        upsert=True
    )


def _build_response(student_dict: dict, predictions: list, skill_radar: dict,
                    top_insight: str, cgpa: float, from_cache: bool) -> dict:
    return {
        "student_id": student_dict.get("id"),
        "name":       student_dict.get("name", ""),
        "branch":     student_dict.get("branch", ""),
        "cgpa":       cgpa,
        "predictions": predictions,
        "skill_radar": skill_radar,
        "top_insight": top_insight,
        "from_cache":  from_cache,
        "ml_failed":   False,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/predict")
async def predict(user_id: str = Depends(get_current_user), db = Depends(get_db), force: bool = False):
    student = await db.students.find_one({"user_id": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found. Please complete onboarding first.")

    skills = student.get("skills") or []
    projects = len(student.get("projects", []))
    internships = len(student.get("internships", []))
    
    semester_records = student.get("semester_records", [])

    if semester_records:
        total_credits = sum(r.get("credits_earned", 0) for r in semester_records)
        cgpa = float(sum(r.get("sgpa", 0.0) * r.get("credits_earned", 0) for r in semester_records) / total_credits) if total_credits > 0 else 0.0
    else:
        cgpa = float(student.get("cgpa", 0.0))

    skill_radar = _compute_radar(skills, cgpa, projects, internships)

    # ── 1. Serve from student.predictions ONLY if not forced ──────────────────
    if not force and student.get("predictions"):
        top_insight = _build_insight(student["predictions"], skills)
        return _build_response(student, student["predictions"], skill_radar, top_insight, cgpa, from_cache=True)

    # ── 2. Run ML model in a thread — non-blocking ────────────────────────────
    ml_failed = False
    predictions = None
    try:
        if USE_MOCK:
            raw = MOCK_PREDICTIONS
            predictions = [
                {"rank": i + 1, "role": p["role"], "label": ROLE_LABELS.get(p["role"], p["role"]), "confidence": p["confidence"]}
                for i, p in enumerate(raw)
            ]
        else:
            logger.info(f"[predict] Running ML for user {user_id[:8]}…")
            predictions = await asyncio.to_thread(_run_ml, skills, cgpa, projects, internships)
            logger.info(f"[predict] ML success for user {user_id[:8]}")

        # Save to both student.predictions (fast lookup) and prediction_cache (permanent fallback)
        await db.students.update_one({"user_id": user_id}, {"$set": {"predictions": predictions}})
        top_insight = _build_insight(predictions, skills)
        await _persist_cache(db, user_id, predictions, skill_radar, top_insight, cgpa)

    except Exception as e:
        logger.error(f"[predict] ML FAILED for user {user_id[:8]}: {e}")
        ml_failed = True

    # ── 3. ML failed — serve from prediction_cache (last known good) ──────────
    if ml_failed or predictions is None:
        cache = await db.prediction_cache.find_one({"user_id": user_id})
        if cache:
            logger.info(f"[predict] Serving stale cache for user {user_id[:8]}")
            resp = _build_response(student, cache.get("predictions", []), cache.get("skill_radar") or skill_radar,
                                   cache.get("top_insight") or "Using last saved predictions.", cache.get("cgpa") or cgpa,
                                   from_cache=True)
            resp["ml_failed"] = True
            return resp

        # No cache at all — return a graceful placeholder
        placeholder = [{
            "rank": 1, "role": "PENDING",
            "label": "Predictions computing — check back soon",
            "confidence": 0.0
        }]
        top_insight = "Our ML model is still warming up. Refresh in a moment."
        resp = _build_response(student, placeholder, skill_radar, top_insight, cgpa, from_cache=False)
        resp["ml_failed"] = True
        return resp

    top_insight = _build_insight(predictions, skills)
    return _build_response(student, predictions, skill_radar, top_insight, cgpa, from_cache=False)



@router.post("/predict/refresh")
async def refresh_predict(user_id: str = Depends(get_current_user), db = Depends(get_db)):
    """Force-clear ALL cached predictions so next GET /predict?force=true re-runs ML fresh."""
    student = await db.students.find_one({"user_id": user_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    # Clear both the fast-lookup cache on student doc AND the prediction_cache collection
    await db.students.update_one(
        {"user_id": user_id},
        {"$unset": {"predictions": ""}}
    )
    await db.prediction_cache.delete_one({"user_id": user_id})

    return {"message": "All prediction caches cleared. Ready for fresh ML run."}

