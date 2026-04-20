# MirrorMind — Career Trajectory Prediction Model (Objective 1)

## Problem Statement
Given a student's skill profile, predict the top-5 most suitable career roles.

## Why TF-IDF Failed (Leakage)
The original dataset was built from job postings where skills are perfectly correlated
with role labels. TF-IDF exploited this memorization and achieved ~100% accuracy on
validation/test — a trivially solved lookup, not a real prediction.

**Root cause:** profile_text contained phrases like "Targeting a role in AI and Machine
Learning" which directly encode the label. TF-IDF matched these phrases to predict classes.

## Fix: Sentence Transformer + Leakage Removal
1. All label-encoding phrases stripped from profile_text
2. Text rebuilt into neutral format: "Engineering student with skills in X, Y, Z."
3. Sentence Transformer (all-MiniLM-L6-v2) generates 384-dim semantic embeddings
4. Classifiers trained on embeddings — must learn skill→role from meaning, not keywords

## Why Sentence Transformer
- Understands that "trained neural networks" ≈ "built ML models" (zero word overlap)
- Pre-trained on 1B+ sentences — general semantic understanding built-in
- 22M parameters — runs on free Colab T4 GPU in minutes
- Generalises to new skill descriptions not seen in training

## Model Performance (Test Set)
| Model    | Accuracy | F1-Macro | ROC-AUC | Top-3 |
|----------|----------|----------|---------|-------|
| Best: XGBoost  | 0.6684  | 0.6637  | 0.9261 | 0.9223 |

## Dataset
- 10 career classes, 1,284 total samples after cleaning
- Split: 70/15/15 (stratified)
- Sources: LinkedIn job postings + campus placement dataset

## How to Run Inference
```python
from scripts.inference import predict_career

result = predict_career(
    skills=["python", "tensorflow", "sql", "numpy"],
    cgpa=8.2,
    projects=4,
    internships=1
)
print(result["top_prediction"])   # e.g. AIML_ENGINEER
print(result["predictions"])      # top-5 with confidence scores
```

## Files
```
models/
  label_encoder.pkl        ← decodes int → role name
  embedding_model.txt      ← sentence transformer name
  best_model_name.txt      ← which model won
  logistic_regression.pkl
  xgboost_model.pkl
  lightgbm_model.pkl
  nn_best.pt               ← best neural network checkpoint
  nn_arch.json             ← architecture config for loading
scripts/
  inference.py             ← use this in FastAPI
plots/
  confusion_*.png, roc_*.png, pr_*.png, model_comparison.png
reports/
  classification_report_test_XGBoost.txt
  model_comparison_val.csv
```

---
Generated: 2026-04-20 13:50