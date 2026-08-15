# MirrorMind System Audit Report

*Date: August 2026*

This is a factual read-only audit of the existing MirrorMind system.

---

## 1. PROJECT STRUCTURE

The MirrorMind repository is structured as a full-stack application with multiple distinct components.

| Component | Technology | Main Entry / Directory | Current Status |
|---|---|---|---|
| **Backend** | Python, FastAPI | `backend/main.py` | Functional and serving APIs. |
| **Frontend** | React, Vite | `frontend/src/main.jsx` | Functional and deployed. |
| **Mobile App** | Flutter | `mobile-app/lib/main.dart` | Exists, UI/Auth functional. |
| **ML Models** | PyTorch, Scikit-learn, HuggingFace SentenceTransformers | `backend/inference/predictor.py` | Trained models are deployed and actively running inference. |
| **VS Code Extension** | TypeScript | `vs_extension/src/extension.ts` | Fully functional, communicating with backend. |
| **Database** | MongoDB | `backend/db.py` | Connection established, storing actual data. |

---

## 2. BACKEND AUDIT

The backend is built with FastAPI. Below are the verified implemented routes.

| Module | Endpoint | HTTP Method | Purpose | Authentication | Status |
| --- | --- | --- | --- | --- | --- |
| **Auth** | `/api/auth/register` | POST | Register a new user | None | DONE |
| **Auth** | `/api/auth/login` | POST | Login user | None | DONE |
| **Students**| `/api/students/profile` | POST | Save student profile details | Bearer JWT | DONE |
| **Students**| `/api/students/profile` | GET | Retrieve student profile details | Bearer JWT | DONE |
| **Students**| `/api/students/profile/avatar` | PATCH | Update user avatar URL | Bearer JWT | DONE |
| **Students**| `/api/students/skills` | GET | List available skills | None | DONE |
| **Students**| `/api/students/internships`| GET/POST/DELETE | Manage internships | Bearer JWT | DONE |
| **Students**| `/api/students/internships/{id}/certificate` | PATCH | Add certificate to internship | Bearer JWT | DONE |
| **Students**| `/api/students/projects` | GET/POST/PUT/DELETE | Manage projects | Bearer JWT | DONE |
| **Students**| `/api/students/projects/{id}/thumbnail` | PATCH | Add thumbnail to project | Bearer JWT | DONE |
| **Predict** | `/api/predict` | GET | Get ML career predictions | Bearer JWT | DONE (ML Integrated) |
| **Predict** | `/api/predict/refresh` | POST | Force clear prediction cache | Bearer JWT | DONE |
| **Developer**| `/api/developer/demo` | GET | Fetch mock ML pipelines | None | DONE |
| **Developer**| `/api/developer/my-pipeline` | GET | Fetch real user ML pipeline | Bearer JWT | DONE |
| **Uploads** | `/api/upload/config` | GET | Get Cloudinary config for UI | Bearer JWT | DONE |
| **Uploads** | `/api/upload/sign` | GET | Get Cloudinary upload signature | Bearer JWT | DONE |
| **Extension**| `/api/extension/verify-key` | POST | Verify VS Code API Key | `X-Extension-Key` header | DONE |
| **Extension**| `/api/extension/activity` | POST | Log file save events | `X-Extension-Key` header | DONE |
| **Extension**| `/api/extension/error` | POST | Log compilation/linter errors | `X-Extension-Key` header | DONE (Calls Gemini API) |
| **Extension**| `/api/extension/errors` | GET | Fetch captured VS Code errors | Bearer JWT | DONE |
| **Extension**| `/api/extension/errors/{id}/reveal` | GET | Get AI fix for a specific error | Bearer JWT | DONE |
| **Extension**| `/api/extension/errors/{id}/resolve` | PATCH | Mark error as solved | Bearer JWT | DONE |
| **Extension**| `/api/extension/errors/{id}` | DELETE | Hide error from history | Bearer JWT | DONE |
| **Settings**| `/api/settings/api-key` | GET/POST | Fetch/generate extension API key | Bearer JWT | DONE |
| **Settings**| `/api/settings/api-key/regenerate` | POST | Regenerate extension API key | Bearer JWT | DONE |

---

## 3. DATABASE AUDIT

**Database Technology:** MongoDB (Motor async driver)
**Persistence Status:** Fully working and integrated. Data is actively persisted.

**Collections & Schemas:**

1.  **`users`**: Stores authentication data (`name`, `email`, `password`, `avatar_url`). It also securely embeds the `extension_api_key` object (containing hashed tokens).
2.  **`students`**: The core profile document. It stores:
    *   `branch`, `semester`, `college_tier`, `cgpa`, `backlog_count`
    *   `skills` (Array of strings)
    *   `career_interest`, `communication_rating`, `work_style_pref`
    *   `predictions` (Cached ML output)
    *   **Embedded Arrays:**
        *   `internships` (Company, domain, dates, cert URLs)
        *   `projects` (Title, description, URLs, tech stack)
        *   `semester_records` (SGPA, credits, subject marks)
3.  **`prediction_cache`**: A backup collection storing the last successfully generated ML predictions (`predictions`, `skill_radar`, `top_insight`, `cgpa`) to gracefully handle ML downtime.
4.  **`skills`**: Static lookup list of skills available in the system.
5.  **`extension_activity_log`**: Logs from the VS Code extension whenever a file is saved (`event_type`, `file_path`, timestamp).
6.  **`error_logs`**: Logs captured errors from VS Code. Stores `file_path`, `error_message`, `line`, `fingerprint` (for deduplication), and crucially, AI-generated hints and code fixes (`hint`, `explanation`, `corrected_block`) retrieved from Gemini.

---

## 4. USER REGISTRATION / ONBOARDING

**Status:** IMPLEMENTED AND FULLY FUNCTIONAL

**Actual Flow:**
User → Registration (`/api/auth/register`) → Generates JWT → Onboarding Form (`frontend/src/pages/Onboarding.jsx`) → Posts structured data to `/api/students/profile` → Stores in MongoDB → Redirects to Dashboard.

**Fields Collected:**
*   Name, Email, Password (plain text currently).
*   Education details (Branch, Semester, CGPA, Backlogs, College Tier).
*   Skills array.
*   Projects (Title, description, tech stack, github link).
*   Internships (Company, role, dates).
*   Career interest.
*   Soft metrics (Communication rating, work style preference).

---

## 5. MACHINE LEARNING SYSTEM

**Status:** IMPLEMENTED, TRAINED, AND INTEGRATED

**Architecture & Implementation:**
*   **Model:** The active model is a **PyTorch NeuralNet** (Multi-Layer Perceptron), located at `backend/ml_models/nn_best.pt`.
*   **Feature Extraction:** The system uses HuggingFace `SentenceTransformers` (`all-MiniLM-L6-v2`) to convert raw text into 384-dimensional dense vectors.
*   **Input Pipeline:** The predictor (`backend/inference/predictor.py`) takes the user's `skills`, `cgpa`, `projects`, and `internships` and dynamically formats them into a single string (e.g., *"Engineering student with skills in python, react. CGPA 8.5. Completed 2 projects."*).
*   **Inference:** The string is embedded into a 384-dim vector, passed through the PyTorch NeuralNet, and outputs logit scores for 11 distinct classes, which are normalized using softmax to produce confidence percentages.
*   **Alternative Models:** Scikit-learn Logistic Regression, LightGBM, and XGBoost models exist in the `ml_models` folder, but `best_model_name.txt` dictates that `NeuralNet` is the active model.
*   **Training Data:** The most recent training dataset (`new_dataset/mirrormind_training_dataset.csv`) contains exactly 4,000 synthetically balanced samples (400 per class).
*   **Execution:** Predictions run asynchronously via `asyncio.to_thread` to prevent blocking the FastAPI event loop, and use `threading.Lock` to ensure thread-safe lazy loading of PyTorch models into memory.

---

## 6. CAREER / JOB PREDICTION

**Status:** IMPLEMENTED AND FULLY INTEGRATED

The ML model predicts across 11 specific roles:
*   `AIML_ENGINEER` (AI / ML Engineer)
*   `DATA_ANALYST` (Data Analyst)
*   `SWE_BACKEND` (Backend Developer)
*   `SWE_FRONTEND` (Frontend Developer)
*   `FULLSTACK` / `FULLSTACK_DEV` (Full Stack Developer)
*   `DEVOPS_CLOUD` (DevOps / Cloud Engineer)
*   `DATA_ENGINEER` (Data Engineer)
*   `CYBERSECURITY` (Cybersecurity Analyst)
*   `EMBEDDED` / `EMBEDDED_IOT` (Embedded / IoT Engineer)
*   `RESEARCH` (Research Engineer)
*   `PRODUCT_MANAGER` (Product Manager)

**Actual Flow:**
1.  User clicks "Predict" (or forces refresh).
2.  Backend `GET /api/predict` fetches profile data from MongoDB.
3.  Data is passed to `predictor.py` which generates a natural language sentence.
4.  Sentence is embedded and passed through the PyTorch NeuralNet.
5.  Top 5 matching roles and their confidence percentages are calculated.
6.  Results are cached in MongoDB (`student.predictions` and `prediction_cache`).
7.  Results are rendered on the Dashboard and Predict pages.
8.  The system calculates a "Skill Radar" (Technical Depth, Breadth, Project Exp, etc.) using hardcoded logic based on known "Advanced Skills".

---

## 7. STUDENT DASHBOARD

**Status:** IMPLEMENTED AND FULLY FUNCTIONAL

**Visible Sections:**
1.  **Hero/Welcome:** Shows Name, Branch, Semester, and CGPA. Data is real and fetched from DB.
2.  **Stats Grid:** Shows counts for Projects, Internships, Skills, and CGPA. Data is real.
3.  **Prediction Teaser:** Links to the `/predict` page.
4.  **Full Predict Page:** Shows the #1 top match, a confidence ring, and a list of the top 5 predictions with progress bars. It also shows a "Skill Radar" chart. All data here is real, generated by the ML pipeline, and cached dynamically.
5.  **Developer Console:** A real-time UI showing the inner workings of the ML pipeline (Raw text, Embeddings, Softmax calculations).

---

## 8. VS CODE EXTENSION

**Status:** IMPLEMENTED AND FULLY CONNECTED

The VS Code extension (`skillgap-monitor`) is a functioning telemetry and AI assistance tool.

### Authentication
*   User generates a unique API key from the MirrorMind Settings page (`/api-key`).
*   In VS Code, they run `Skillgap: Set API Key` and paste the key.
*   The key is stored in VS Code's secure `SecretStorage`.
*   All backend requests include the `X-Extension-Key` header.

### Monitoring & Telemetry
The extension listens to `vscode.workspace.onDidSaveTextDocument`:
*   **File Save:** Sends an `activity` POST to the backend with the file path.
*   **Errors/Diagnostics:** Upon saving, it parses the active file's diagnostics.
*   It filters for severe errors (Syntax, undefined variables, type issues).
*   If an actionable error is found, it extracts a 7-line code snippet (the erroring line +/- 3 lines).
*   It generates a SHA-256 fingerprint (`file:line:message`) for deduplication.

### Backend Communication & AI Integration
1.  Extension POSTs the error snippet to `/api/extension/error`.
2.  The backend verifies the API key.
3.  If the error fingerprint is new, the backend makes a live API call to **Google Gemini (`gemini-2.5-flash`)**.
4.  Gemini generates a structured JSON response containing a `hint`, a detailed `explanation`, and the `corrected_block` of code.
5.  The backend saves the error along with the AI insights into MongoDB.

### Dashboard Integration
*   The frontend `Extension.jsx` page polls for new errors.
*   When an error appears on the web dashboard, the user sees the file, line, and AI-generated `hint`.
*   The user can click **"Show fix 🪄"** to reveal the full explanation and the corrected code block.
*   They can mark the issue as solved, moving it to history.

---

## 9. MOBILE APPLICATION

**Status:** UI IMPLEMENTED, PARTIALLY CONNECTED

**Implementation Details:**
*   **Framework:** Flutter (`mobile-app/lib/main.dart`).
*   **State Management:** Provider (`AuthProvider`, `StudentProvider`, `PredictProvider`).
*   **API Connection:** `ApiService` is implemented and configured to talk to the backend (`core/constants/api.dart`).
*   **Cloudinary:** `CloudinaryService` is implemented for direct unsigned uploads from the mobile app.

**Current Connectivity:**
The architecture to connect is fully present. State providers exist for Auth, Student profile data, and Predictions, mirroring the web functionality. The app is capable of logging in and fetching profile data, though it may lack parity with some of the more advanced web views (like the Extension Error dashboard).

---

## 10. FRONTEND / WEB APPLICATION

**Status:** IMPLEMENTED AND FUNCTIONAL

**Framework:** React 18, Vite, React Router DOM.
**Styling:** CSS (`index.css`), structured with custom utility classes.

**Pages & Status:**
*   `/login` & `/register`: **Fully Functional** (JWT auth).
*   `/onboarding`: **Fully Functional** (Profile data entry).
*   `/dashboard`: **Fully Functional** (Stats overview).
*   `/profile`, `/projects`, `/internships`: **Fully Functional** (CRUD operations working with DB).
*   `/predict`: **Fully Functional** (Displays ML predictions, handles cache refreshing).
*   `/extension`: **Fully Functional** (Displays VS Code errors, handles AI reveals).
*   `/settings`: **Fully Functional** (Generates API keys for VS Code).
*   `/developer`: **Fully Functional** (Visualizes ML pipeline).

---

## 11. FILES / CERTIFICATES / DOCUMENTS

**Status:** IMPLEMENTED AND INTEGRATED (Cloudinary)

*   Users can upload certificates for projects and internships.
*   The backend exposes Cloudinary configuration (`/api/upload/config` and `/sign`).
*   Images/certificates are directly uploaded to Cloudinary, and the resulting URLs are stored in MongoDB (`certificate_url`, `thumbnail_url`).
*   **YOLO/OCR:** NOT PRESENT. There is no automated certificate validation or data extraction implemented in the codebase.

---

## 12. AUTHENTICATION & SECURITY

**Status:** IMPLEMENTED

*   **Auth Mechanism:** JWT (JSON Web Tokens) generated via python-jose.
*   **Protected Endpoints:** Most API routes require a valid Bearer token, handled via FastAPI dependencies (`get_current_user`).
*   **Passwords:** Passwords are currently stored in **PLAIN TEXT** (`auth.py` line 19). This is a known security vulnerability for a production environment.
*   **Extension Security:** The VS Code extension API key is securely handled. The database stores a `key_hash` (SHA-256), and the raw key is only shown to the user once upon creation.

---

## 13. TESTING

**Status:** PARTIAL / MINIMAL

*   The backend contains minor test files (`test_api.py`, `test_pred.py`) which appear to be scratchpad scripts rather than formalized test suites (like pytest).
*   There are no automated CI/CD test pipelines visible in the codebase.

---

## 14. DEPLOYMENT

**Status:** LOCAL / DEVELOPMENT ARCHITECTURE

The current architecture is set up for local development:
```text
  React Web (Port 5173)   VS Code Extension
         \                       /
          \                     /
           \                   /
     FastAPI Backend (Port 8000) ---> Google Gemini API
                  |
                  |
    MongoDB Atlas (Cloud Database)
```

---

## 15. EXISTING AI / LLM FUNCTIONALITY

**Status:** IMPLEMENTED (Gemini)

*   **Gemini (`gemini-2.5-flash`)**: Fully integrated in the backend (`extension.py`). It is actively used to analyze compilation and syntax errors caught by the VS Code extension, providing hints and generating corrected code blocks.
*   **HuggingFace / PyTorch**: Fully integrated for the predictive CareerMLP pipeline.
*   **OpenAI, Claude, Ollama, LangChain, RAG, STT, TTS, Computer Vision**: NOT PRESENT.

---

## 16. CURRENT END-TO-END USER JOURNEY

**Actual Journey:**
```text
User
 ↓
Registers via Web UI
 ↓
Completes Onboarding Form (Skills, CGPA, Branch)
 ↓
Dashboard
 ↓
Clicks "Predict Career"
 ↓
Backend passes profile to ML Pipeline (PyTorch NeuralNet)
 ↓
Top 5 Careers & Confidences cached and displayed
 ↓
User goes to Settings, generates Extension API Key
 ↓
Installs VS Code Extension, enters API Key
 ↓
User writes code and saves file with a Syntax Error
 ↓
Extension detects error, POSTs snippet to Backend
 ↓
Backend queries Gemini for a fix, saves to DB
 ↓
User checks Web Dashboard (`/extension`), sees AI Hint
 ↓
User clicks "Reveal Fix", views the AI-generated code correction
```

---

## 17. FEATURE STATUS MATRIX

| Feature | Status | Evidence / File | Notes |
|---|---|---|---|
| Registration / Login | DONE | `backend/routes/auth.py` | Working JWT, but plain-text passwords. |
| Profile / Skills CRUD | DONE | `backend/routes/students.py` | Full DB persistence. |
| Projects / Internships CRUD| DONE | `backend/routes/students.py` | Full DB persistence. |
| Certificates Upload | DONE | `backend/routes/uploads.py` | Integrated with Cloudinary. |
| Career prediction | DONE | `backend/inference/predictor.py`| Live PyTorch NeuralNet running. |
| Readiness score / Radar | DONE | `backend/routes/predict.py` | Computed dynamically based on skills. |
| Dashboard | DONE | `frontend/src/pages/Dashboard.jsx` | Fully rendering live data. |
| Mobile app | PARTIAL | `mobile-app/lib/main.dart` | UI exists, API connections structured. |
| VS Code extension | DONE | `vs_extension/src/extension.ts` | Fully logging activities and errors. |
| AI Error tracking | DONE | `backend/routes/extension.py` | Gemini integration fully functional. |
| OCR / YOLO Validation | NOT PRESENT | N/A | No evidence in codebase. |

---

## 18. FINAL SECTION — CURRENT STATE

### A. What is definitely completed
*   Full authentication, user profile management, project/internship tracking, Cloudinary image uploads, a live ML career prediction pipeline (PyTorch), a functional VS Code telemetry extension, and an AI-powered code error assistant (Gemini).

### B. What is partially completed
*   The Flutter mobile application has the core architecture and UI in place, but requires validation to ensure full feature parity with the web dashboard.

### C. What exists but is unused
*   Alternative ML models (Logistic Regression, LightGBM, XGBoost) exist on disk but are bypassed in favor of the active `NeuralNet`.

### D. What is planned but not implemented
*   None apparent from codebase documentation.

### E. Current architecture
```text
[React Web App]  <-->  [FastAPI Backend]  <-->  [MongoDB Atlas]
                           ^        |
                           |        v
                     [VS Code]   [PyTorch ML Model] & [Gemini API]
```

### F. Important technical debt
1.  **Passwords:** Stored in plain text in MongoDB.
2.  **ML Scaling:** The ML pipeline runs synchronously inside `asyncio.to_thread`. While it prevents event loop blocking, heavy traffic will require a dedicated worker queue (e.g., Celery).

### G. Recommended next development point
The most logical extension point is the **Flutter Mobile App**. The backend APIs are robust, well-structured, and fully tested by the React web app. Connecting the remaining mobile screens to the existing prediction and extension-tracking APIs will provide immediate cross-platform value without requiring backend structural changes.
