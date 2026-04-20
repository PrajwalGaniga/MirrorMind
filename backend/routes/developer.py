import math
import numpy as np
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId
from db import students_collection
from auth_utils import decode_token
from inference.predictor import predict_career, build_profile_text, USE_MOCK

router = APIRouter()

bearer_scheme = HTTPBearer(auto_error=False)

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

ALL_ROLES = list(ROLE_LABELS.keys())

DEMO_STUDENTS = [
    {
        "name": "Arjun Sharma", "branch": "CSE", "cgpa": 8.5, "semester": 7,
        "skills": ["python", "tensorflow", "pytorch", "sql", "numpy", "scikit-learn"],
        "projects": 5, "internships": 1, "career_interest": "AI_ML"
    },
    {
        "name": "Priya Nair", "branch": "CSE", "cgpa": 7.8, "semester": 6,
        "skills": ["react", "javascript", "html", "css", "tailwind", "node.js", "typescript"],
        "projects": 4, "internships": 1, "career_interest": "SWE_FRONTEND"
    },
    {
        "name": "Rohit Verma", "branch": "IT", "cgpa": 7.2, "semester": 7,
        "skills": ["docker", "kubernetes", "aws", "terraform", "linux", "ci/cd", "bash"],
        "projects": 3, "internships": 2, "career_interest": "DEVOPS_CLOUD"
    },
    {
        "name": "Sneha Kulkarni", "branch": "CSE", "cgpa": 8.1, "semester": 7,
        "skills": ["sql", "tableau", "power bi", "statistics", "excel", "python", "data analysis"],
        "projects": 3, "internships": 1, "career_interest": "DATA_ANALYST"
    },
    {
        "name": "Kiran Reddy", "branch": "ECE", "cgpa": 7.5, "semester": 7,
        "skills": ["embedded c", "rtos", "arduino", "raspberry pi", "c++", "firmware", "microcontroller"],
        "projects": 4, "internships": 1, "career_interest": "EMBEDDED"
    },
]

# Realistic mock raw scores for each demo student (when model files are absent)
MOCK_RAW_SCORES = [
    {"AIML_ENGINEER": 2.41, "DATA_ANALYST": 0.83, "SWE_BACKEND": 0.21, "SWE_FRONTEND": -0.14,
     "FULLSTACK": 0.05, "DEVOPS_CLOUD": -0.32, "DATA_ENGINEER": 0.61, "CYBERSECURITY": -0.88,
     "EMBEDDED": -1.20, "RESEARCH": 0.44, "PRODUCT_MANAGER": -0.55},
    {"SWE_FRONTEND": 2.18, "FULLSTACK": 1.42, "SWE_BACKEND": 0.55, "PRODUCT_MANAGER": 0.12,
     "DATA_ANALYST": -0.21, "AIML_ENGINEER": -0.45, "DEVOPS_CLOUD": -0.60, "DATA_ENGINEER": -0.38,
     "CYBERSECURITY": -0.92, "EMBEDDED": -1.35, "RESEARCH": -0.28},
    {"DEVOPS_CLOUD": 2.55, "SWE_BACKEND": 0.92, "DATA_ENGINEER": 0.48, "FULLSTACK": 0.15,
     "CYBERSECURITY": 0.08, "AIML_ENGINEER": -0.35, "SWE_FRONTEND": -0.72, "DATA_ANALYST": -0.58,
     "EMBEDDED": -0.44, "RESEARCH": -0.65, "PRODUCT_MANAGER": -0.82},
    {"DATA_ANALYST": 2.38, "DATA_ENGINEER": 1.15, "AIML_ENGINEER": 0.42, "PRODUCT_MANAGER": 0.18,
     "SWE_BACKEND": -0.15, "FULLSTACK": -0.32, "SWE_FRONTEND": -0.55, "DEVOPS_CLOUD": -0.72,
     "RESEARCH": 0.05, "CYBERSECURITY": -0.95, "EMBEDDED": -1.10},
    {"EMBEDDED": 2.62, "RESEARCH": 0.88, "SWE_BACKEND": 0.25, "DEVOPS_CLOUD": 0.10,
     "AIML_ENGINEER": -0.18, "DATA_ENGINEER": -0.35, "FULLSTACK": -0.52, "SWE_FRONTEND": -0.78,
     "CYBERSECURITY": -0.42, "DATA_ANALYST": -0.65, "PRODUCT_MANAGER": -0.95},
]

MOCK_EMBEDDINGS = [
    [0.023, -0.041, 0.118, 0.072, -0.033, 0.091, -0.015, 0.064],
    [0.045, 0.018, -0.032, 0.089, 0.056, -0.071, 0.033, -0.012],
    [-0.028, 0.067, 0.042, -0.055, 0.098, 0.011, -0.044, 0.076],
    [0.051, -0.019, 0.075, 0.038, -0.062, 0.027, 0.083, -0.031],
    [-0.037, 0.053, -0.021, 0.068, 0.014, -0.046, 0.059, 0.029],
]


def _softmax(scores_dict: dict) -> dict:
    vals = np.array(list(scores_dict.values()))
    exp_vals = np.exp(vals - np.max(vals))
    probs = exp_vals / exp_vals.sum()
    return {k: float(round(p, 4)) for k, p in zip(scores_dict.keys(), probs)}


def _build_pipeline(student: dict, idx: int) -> dict:
    skills = student["skills"]
    cgpa = student["cgpa"]
    projects = student["projects"]
    internships = student["internships"]

    profile_text = build_profile_text(skills, cgpa, projects, internships)
    template = "Engineering student with skills in {skills}. CGPA {cgpa}. Completed {projects} projects and {internships} internship(s)."

    if USE_MOCK:
        embedding_preview = MOCK_EMBEDDINGS[idx]
        raw_scores = MOCK_RAW_SCORES[idx]
        probabilities = _softmax(raw_scores)
        model_used = "all-MiniLM-L6-v2"
        classifier_type = "LogReg"
    else:
        from inference.predictor import _load_assets, _st_model, _best_model, _le, _best_name
        _load_assets()
        embedding = _st_model.encode([profile_text], normalize_embeddings=True)
        embedding_preview = [float(round(v, 4)) for v in embedding[0][:8]]
        model_used = "all-MiniLM-L6-v2"
        classifier_type = _best_name

        if _best_name == "NeuralNet":
            import torch, torch.nn.functional as F
            with torch.no_grad():
                logits = _best_model(torch.tensor(embedding, dtype=torch.float32))
                raw_np = logits.numpy()[0]
                prob_np = F.softmax(logits, dim=1).numpy()[0]
        else:
            raw_np = None
            prob_np = _best_model.predict_proba(embedding)[0]

        raw_scores = {}
        probabilities = {}
        for i, role in enumerate(_le.classes_):
            probabilities[role] = float(round(prob_np[i], 4))
            if raw_np is not None:
                raw_scores[role] = float(round(raw_np[i], 4))
            else:
                raw_scores[role] = float(round(math.log(max(prob_np[i], 1e-8)), 4))

    sorted_probs = dict(sorted(probabilities.items(), key=lambda x: x[1], reverse=True))
    top5 = [
        {"rank": i+1, "role": r, "label": ROLE_LABELS.get(r, r), "confidence": sorted_probs[r]}
        for i, r in enumerate(list(sorted_probs.keys())[:5])
    ]

    return {
        "student": {
            "name": student["name"], "branch": student["branch"],
            "cgpa": cgpa, "skills": skills,
            "projects": projects, "internships": internships
        },
        "pipeline": {
            "step1_raw_input": {
                "label": "Raw Profile Input",
                "description": "Structured JSON received from the student profile form",
                "data": {"skills": skills, "cgpa": cgpa, "projects": projects, "internships": internships}
            },
            "step2_profile_text": {
                "label": "Profile Text Construction",
                "description": "Structured fields converted into a single neutral sentence. This is the ONLY text the model sees.",
                "template": template,
                "output": profile_text
            },
            "step3_embedding": {
                "label": "Sentence Embedding (all-MiniLM-L6-v2)",
                "description": "The profile text is passed through the SentenceTransformer model. Output is a 384-dimensional vector.",
                "model_used": model_used,
                "embedding_dim": 384,
                "embedding_preview": embedding_preview,
                "note": "Similar skill combinations produce similar vectors — this is why 'built ML models' matches 'tensorflow + pytorch' even without exact keywords"
            },
            "step4_classifier": {
                "label": "Classification Head",
                "description": "The 384-dim embedding is fed into the trained classifier. Raw logit scores are produced for each of the 11 career classes.",
                "classifier_type": classifier_type,
                "raw_scores": raw_scores
            },
            "step5_softmax": {
                "label": "Softmax → Probabilities",
                "description": "Raw scores converted to probabilities using softmax. All values sum to 1.0 (100%).",
                "probabilities": sorted_probs,
                "sum_check": round(sum(sorted_probs.values()), 2)
            },
            "step6_output": {
                "label": "Final Prediction Output",
                "description": "Top-5 roles sorted by confidence. Returned to the React frontend.",
                "top_5": top5
            }
        }
    }


@router.get("/demo")
def developer_demo():
    results = []
    for i, student in enumerate(DEMO_STUDENTS):
        results.append(_build_pipeline(student, i))
    return {"students": results}


@router.get("/my-pipeline")
def my_pipeline(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Login to run on your real profile")
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    student = students_collection.find_one({"user_id": ObjectId(user_id)})
    if not student:
        raise HTTPException(status_code=404, detail="No profile found. Complete onboarding first.")

    demo_format = {
        "name": student.get("name", ""),
        "branch": student.get("branch", ""),
        "cgpa": float(student.get("cgpa", 0)),
        "semester": student.get("semester", 0),
        "skills": student.get("skills", []),
        "projects": int(student.get("projects_count", 0)),
        "internships": int(student.get("internship_count", 0)),
        "career_interest": student.get("career_interest", "")
    }
    result = _build_pipeline(demo_format, 0)
    return result
