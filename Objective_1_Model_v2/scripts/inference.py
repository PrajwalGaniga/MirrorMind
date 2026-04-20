"""
MirrorMind — Inference Script
Career Trajectory Prediction

Usage:
    from inference import predict_career
    result = predict_career(
        skills=['python', 'tensorflow', 'sql'],
        cgpa=8.2,
        projects=4,
        internships=1
    )
"""

import os, re, json, pickle
import numpy as np
from pathlib import Path

MODEL_DIR = Path(__file__).parent.parent / "models"

# ── Load assets once at module level ──────────────────────────
_st_model    = None
_best_model  = None
_le          = None
_best_name   = None
_arch        = None

def _load_assets():
    global _st_model, _best_model, _le, _best_name, _arch
    if _st_model is not None:
        return  # Already loaded

    from sentence_transformers import SentenceTransformer

    embed_name  = (MODEL_DIR / "embedding_model.txt").read_text().strip()
    _best_name  = (MODEL_DIR / "best_model_name.txt").read_text().strip()
    _st_model   = SentenceTransformer(embed_name)

    with open(MODEL_DIR / "label_encoder.pkl", "rb") as f:
        _le = pickle.load(f)

    if _best_name == "NeuralNet":
        import torch
        import torch.nn as nn

        with open(MODEL_DIR / "nn_arch.json") as f:
            _arch = json.load(f)

        class CareerMLP(nn.Module):
            def __init__(self, input_dim, num_classes, dropout=0.35):
                super().__init__()
                self.net = nn.Sequential(
                    nn.Linear(input_dim, 512), nn.BatchNorm1d(512), nn.GELU(), nn.Dropout(dropout),
                    nn.Linear(512, 256),       nn.BatchNorm1d(256), nn.GELU(), nn.Dropout(dropout),
                    nn.Linear(256, 128),       nn.BatchNorm1d(128), nn.GELU(), nn.Dropout(dropout * 0.7),
                    nn.Linear(128, num_classes)
                )
            def forward(self, x): return self.net(x)

        m = CareerMLP(_arch["input_dim"], _arch["num_classes"])
        m.load_state_dict(torch.load(MODEL_DIR / "nn_best.pt", map_location="cpu"))
        m.eval()
        _best_model = m
    else:
        fname = {"LogReg": "logistic_regression.pkl",
                 "XGBoost": "xgboost_model.pkl",
                 "LightGBM": "lightgbm_model.pkl"}[_best_name]
        with open(MODEL_DIR / fname, "rb") as f:
            _best_model = pickle.load(f)


def build_profile_text(skills: list, cgpa: float = None,
                        projects: int = None, internships: int = None) -> str:
    """
    Convert structured student profile → neutral text string.
    MUST match the exact format used during training.
    """
    skills_clean = [str(s).strip().lower() for s in skills if s]

    if skills_clean:
        skill_str = ", ".join(skills_clean)
        text = f"Engineering student with skills in {skill_str}."
    else:
        text = "Engineering student with technical skills."

    if cgpa is not None:
        text += f" CGPA {float(cgpa):.1f}."

    extras = []
    if projects is not None:
        extras.append(f"{int(projects)} projects")
    if internships is not None:
        extras.append(f"{int(internships)} internship(s)")
    if extras:
        text += f" Completed {" and ".join(extras)}."

    return text.strip()


def predict_career(skills: list, cgpa: float = None,
                   projects: int = None, internships: int = None,
                   top_k: int = 5) -> dict:
    """
    Predict career trajectory from student profile.

    Args:
        skills      : List of skill strings, e.g. ["python", "tensorflow", "sql"]
        cgpa        : CGPA on 10-point scale, e.g. 8.2
        projects    : Number of self-projects
        internships : Number of internships
        top_k       : Number of predictions to return (default 5)

    Returns:
        dict with keys:
            profile_text     : The text sent to the model
            top_prediction   : Highest confidence career label
            confidence       : Confidence score for top prediction
            predictions      : List of top_k {rank, role, confidence} dicts
    """
    _load_assets()

    text      = build_profile_text(skills, cgpa, projects, internships)
    embedding = _st_model.encode([text], normalize_embeddings=True)

    if _best_name == "NeuralNet":
        import torch
        import torch.nn.functional as F
        with torch.no_grad():
            logits = _best_model(torch.tensor(embedding, dtype=torch.float32))
            proba  = F.softmax(logits, dim=1).numpy()[0]
    else:
        proba = _best_model.predict_proba(embedding)[0]

    top_indices = np.argsort(proba)[::-1][:top_k]
    predictions = [
        {
            "rank"      : i + 1,
            "role"      : _le.classes_[idx],
            "confidence": float(round(proba[idx], 4)),
        }
        for i, idx in enumerate(top_indices)
    ]

    return {
        "profile_text"  : text,
        "top_prediction": predictions[0]["role"],
        "confidence"    : predictions[0]["confidence"],
        "predictions"   : predictions,
    }


if __name__ == "__main__":
    test_cases = [
        dict(skills=["python","tensorflow","pytorch","sql","numpy"], cgpa=8.5, projects=5, internships=1),
        dict(skills=["react","javascript","html","css","tailwind"], cgpa=7.2, projects=3, internships=0),
        dict(skills=["docker","kubernetes","aws","terraform","linux"], cgpa=7.8, projects=4, internships=1),
        dict(skills=["sql","tableau","excel","power bi","statistics"], cgpa=7.0, projects=2, internships=1),
    ]
    for tc in test_cases:
        result = predict_career(**tc)
        print(f"\nInput skills: {tc["skills"]}")
        print(f"Top prediction: {result["top_prediction"]} ({result["confidence"]*100:.1f}%)")
        for p in result["predictions"]:
            print(f"  #{p["rank"]} {p["role"]:<22} {p["confidence"]*100:.1f}%")