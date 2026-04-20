import os
import re
import json
import pickle
import numpy as np
from pathlib import Path

MODEL_DIR = Path(__file__).parent.parent / "models"

# ── Mock fallback ──────────────────────────────────────────────────────────────
USE_MOCK = not (MODEL_DIR / "label_encoder.pkl").exists()

MOCK_PREDICTIONS = [
    {"rank": 1, "role": "AIML_ENGINEER",  "label": "AI / ML Engineer",    "confidence": 0.71},
    {"rank": 2, "role": "DATA_ANALYST",   "label": "Data Analyst",         "confidence": 0.14},
    {"rank": 3, "role": "SWE_BACKEND",    "label": "Backend Developer",    "confidence": 0.06},
    {"rank": 4, "role": "RESEARCH",       "label": "Research Engineer",    "confidence": 0.04},
    {"rank": 5, "role": "DEVOPS_CLOUD",   "label": "DevOps Engineer",      "confidence": 0.03},
]

# ── Lazy-loaded model state ────────────────────────────────────────────────────
_st_model = None
_best_model = None
_le = None
_best_name = None
_arch = None


def _load_assets():
    global _st_model, _best_model, _le, _best_name, _arch
    if _st_model is not None:
        return

    from sentence_transformers import SentenceTransformer

    embed_name = (MODEL_DIR / "embedding_model.txt").read_text().strip()
    _best_name = (MODEL_DIR / "best_model_name.txt").read_text().strip()
    _st_model = SentenceTransformer(embed_name)

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

            def forward(self, x):
                return self.net(x)

        m = CareerMLP(_arch["input_dim"], _arch["num_classes"])
        m.load_state_dict(torch.load(MODEL_DIR / "nn_best.pt", map_location="cpu"))
        m.eval()
        _best_model = m
    else:
        fname = {
            "LogReg":   "logistic_regression.pkl",
            "XGBoost":  "xgboost_model.pkl",
            "LightGBM": "lightgbm_model.pkl",
        }[_best_name]
        with open(MODEL_DIR / fname, "rb") as f:
            _best_model = pickle.load(f)


# ── Text builder ───────────────────────────────────────────────────────────────
def build_profile_text(skills: list, cgpa: float = None,
                        projects: int = None, internships: int = None) -> str:
    skills_clean = [str(s).strip().lower() for s in skills if s]
    if skills_clean:
        text = f"Engineering student with skills in {', '.join(skills_clean)}."
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
        text += f" Completed {' and '.join(extras)}."
    return text.strip()


# ── Main inference function ────────────────────────────────────────────────────
def predict_career(skills: list, cgpa: float = None,
                   projects: int = None, internships: int = None,
                   top_k: int = 5) -> dict:
    _load_assets()
    text = build_profile_text(skills, cgpa, projects, internships)
    embedding = _st_model.encode([text], normalize_embeddings=True)

    if _best_name == "NeuralNet":
        import torch
        import torch.nn.functional as F
        with torch.no_grad():
            logits = _best_model(torch.tensor(embedding, dtype=torch.float32))
            proba = F.softmax(logits, dim=1).numpy()[0]
    else:
        proba = _best_model.predict_proba(embedding)[0]

    top_indices = np.argsort(proba)[::-1][:top_k]
    predictions = [
        {
            "rank": i + 1,
            "role": _le.classes_[idx],
            "confidence": float(round(proba[idx], 4)),
        }
        for i, idx in enumerate(top_indices)
    ]

    return {
        "profile_text": text,
        "top_prediction": predictions[0]["role"],
        "confidence": predictions[0]["confidence"],
        "predictions": predictions,
    }
