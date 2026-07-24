# MirrorMind — Career Trajectory Prediction System Overview

## 1. What We Actually Have (System Architecture)
**MirrorMind** is an AI-powered platform that predicts career trajectories for engineering students. By analyzing a student's skills and academic background, it recommends the top-5 most suitable career roles. 

The system relies on a modern stack:
*   **Frontend**: A React/Vite web application that handles user authentication, a 5-step onboarding wizard for profile creation, and a Dashboard for displaying predictions. 
*   **Backend**: A **FastAPI** (Python) server that manages RESTful API routes (`/api/auth`, `/api/students/profile`, `/api/predict`).
*   **Database**: **MongoDB** running locally to store user credentials and profile data.
*   **Machine Learning (ML)**: A Python-based inference pipeline using Semantic Embeddings and Classifiers.
*   **Mock Mode**: The system features a fallback mock mode. If the trained ML model files are missing from the `backend/models/` directory, it automatically returns hardcoded predictions to prevent crashes.

---

## 2. How Things Are Working (The Data Flow)
1.  **Onboarding**: A student registers on the frontend and completes a profile detailing their skills, CGPA, projects, and internships.
2.  **Data Processing**: The backend receives this data. To prevent "data leakage" (where models simply memorize keywords like "seeking AI role"), the system converts the student's skills into a neutral sentence: *"Engineering student with skills in X, Y, Z."*
3.  **Semantic Embedding**: This neutral sentence is passed through a **Sentence Transformer** model, which converts the text into a 384-dimensional vector (an embedding). This ensures the model understands the *meaning* of the skills (e.g., knowing that "neural networks" is semantically similar to "machine learning" even without exact word overlap).
4.  **Classification**: The 384-dimensional vector, along with numerical data (CGPA, etc.), is fed into the primary classifier.
5.  **Output Generation**: The classifier computes the probability for 10 different career classes and returns the top 5 to the user's dashboard.

---

## 3. What Models We Have
The project uses a two-stage machine learning architecture. 

**Stage 1: Embedding Model**
*   **`all-MiniLM-L6-v2`** (Sentence Transformer): Pre-trained on over 1 billion sentences, this model generates the semantic embeddings of the student's profile.

**Stage 2: Classifiers**
The system has several trained classifiers (stored as `.pkl` or `.pt` files). The best model is dynamically selected via `best_model_name.txt`:
*   **XGBoost (`xgboost_model.pkl`)**: The current best-performing model (approx. 66.8% accuracy, 92.2% top-3 accuracy).
*   **Logistic Regression (`logistic_regression.pkl`)**
*   **LightGBM (`lightgbm_model.pkl`)**
*   **Neural Network (`nn_best.pt` & `nn_arch.json`)**
*   **`label_encoder.pkl`**: Used to decode the integer outputs of the classifier back into human-readable role names (e.g., 0 -> `AIML_ENGINEER`).

---

## 4. What Type of Data is Fed into the Models
The input to the prediction script (`predict_career`) requires the following data points from the student's profile:

*   **`skills`**: A list of technical skills (e.g., `["python", "tensorflow", "sql", "numpy"]`).
*   **`cgpa`**: A float representing the student's academic grade (e.g., `8.2`).
*   **`projects`**: An integer counting the number of completed projects (e.g., `4`).
*   **`internships`**: An integer counting the number of completed internships (e.g., `1`).

---

## 5. What Type of Output is Generated
When a prediction is requested, the inference script evaluates the student's profile against 10 possible career paths and generates:

*   **`top_prediction`**: A string representing the absolute best-fit role (e.g., `"AIML_ENGINEER"` or `"SOFTWARE_DEVELOPER"`).
*   **`predictions`**: A list of the top 5 recommended roles, each paired with its **confidence score** (the probability percentage calculated by the model). This allows the student to see alternative career paths they might also be suited for.
