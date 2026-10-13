# MirrorMind — Comprehensive System Architecture & Ecosystem Overview

## 1. Executive Summary & Project Purpose

**MirrorMind** is an advanced, multi-modal, cross-platform artificial intelligence ecosystem designed specifically for engineering and computer science students. It bridges the gap between academic education, software development practice, and industry career readiness.

MirrorMind integrates five core technological pillars into a single unified platform:
1. **Machine Learning Career Trajectory Engine**: Predicts top career paths (from 11 engineering domains) based on academic records, technical skills, project portfolios, and internship experience.
2. **Grounded Academic RAG & Document Intelligence**: Ingests, semantically chunks, and indexes student documents (resumes, transcripts, project reports, certificates) into an isolated vector database (FAISS) for factual, citation-backed AI query answering.
3. **Agentic Voice & Multi-Turn Action Engine**: Enables hands-free, wake-word-activated ("Hey MirrorMind") voice interactions that can execute navigation, document inspection, and structured profile mutations (adding projects, internships, editing profile details).
4. **Real-Time IDE Telemetry & AI Bug Diagnostics (Skillgap Monitor)**: A VS Code extension that monitors syntax and runtime diagnostics on file save, fingerprints errors, and retrieves automated hints, explanations, and code fixes powered by Google Gemini 2.5 Flash.
5. **Cross-Platform Parity**: Synchronized experiences across a React 18 / Vite web application and a Flutter cross-platform mobile application, supported by an asynchronous FastAPI and MongoDB Atlas cloud backend.

---

## 2. High-Level System Architecture Diagram

```mermaid
graph TB
    subgraph Clients["Client Applications"]
        WEB["React 18 + Vite Web App<br/>(Port 5173 / Vercel)"]
        MOBILE["Flutter Mobile App<br/>(Android / iOS / Web)"]
        EXT["VS Code Extension<br/>(Skillgap Monitor)"]
    end

    subgraph Gateway["API & Communication Gateway"]
        FASTAPI["FastAPI Asynchronous Gateway<br/>(Port 8000 / ngrok)"]
        AUTH_MW["JWT & Extension Key<br/>Authentication Middleware"]
        WS_GATEWAY["WebSocket Endpoint<br/>(/api/voice/ws/tts)"]
    end

    subgraph CoreServices["Backend Micro-Services & Processing Engines"]
        PREDICT_SVC["Career ML Predictor<br/>(SentenceTransformer + CareerMLP)"]
        RAG_SVC["Grounded RAG Engine<br/>(Context Budgeting & Formatting)"]
        RETRIEVAL_SVC["Vector Retrieval Service<br/>(FAISS Cosine Similarity)"]
        DOC_SVC["Document Processing Engine<br/>(PyMuPDF / pdfplumber / docx)"]
        ACTION_SVC["Action Normalization Engine<br/>(LLM Structured JSON Extractor)"]
        VOICE_SVC["Voice Processing Engine<br/>(Whisper Tiny STT & Piper ONNX TTS)"]
        TELEMETRY_SVC["IDE Telemetry & Deduplication<br/>(SHA-256 Fingerprinting)"]
    end

    subgraph DataStorage["Data Persistence Layer"]
        MONGO[("MongoDB Atlas Cloud Database<br/>(Users, Students, Chunks, Logs)")]
        FAISS_DIR[("Per-User FAISS Vector Stores<br/>(/backend/vector_indexes/{user_id})")]
        CLOUDINARY["Cloudinary Media Storage<br/>(Certificates & Thumbnails)"]
        LOCAL_UPLOADS["Local Document Cache<br/>(/backend/uploads)"]
    end

    subgraph ExternalAI["External AI & Cloud Inference Providers"]
        GEMINI_RAG["Google Gemini 3.1 Flash Lite<br/>(Grounded RAG & DB Analysis)"]
        GEMINI_EXT["Google Gemini 2.5 Flash<br/>(IDE Code Diagnostics & Fixes)"]
    end


    %% Client to Gateway
    WEB -->|REST HTTPS + JWT| FASTAPI
    WEB -->|WebSocket PCM Stream| WS_GATEWAY
    MOBILE -->|REST HTTPS + JWT| FASTAPI
    EXT -->|REST HTTPS + X-Extension-Key| FASTAPI

    %% Gateway to Middleware
    FASTAPI --- AUTH_MW
    FASTAPI --- WS_GATEWAY

    %% Gateway to Services
    FASTAPI --> PREDICT_SVC
    FASTAPI --> RAG_SVC
    FASTAPI --> DOC_SVC
    FASTAPI --> ACTION_SVC
    FASTAPI --> VOICE_SVC
    FASTAPI --> TELEMETRY_SVC

    %% Services Interconnections
    RAG_SVC --> RETRIEVAL_SVC
    DOC_SVC --> RETRIEVAL_SVC
    RETRIEVAL_SVC --> FAISS_DIR
    DOC_SVC --> LOCAL_UPLOADS
    DOC_SVC --> MONGO

    %% Services to Data Storage
    PREDICT_SVC --> MONGO
    ACTION_SVC --> MONGO
    TELEMETRY_SVC --> MONGO
    FASTAPI --> MONGO
    WEB -->|Direct Upload| CLOUDINARY
    MOBILE -->|Direct Upload| CLOUDINARY

    %% Services to AI Providers
    TELEMETRY_SVC -->|Prompt with Snippet| GEMINI_EXT
    RAG_SVC -->|Context Prompt| GEMINI_RAG
    ACTION_SVC -->|Normalization Prompt| GEMINI_RAG
```

---

## 3. Ecosystem Component Matrix

| Component | Technology Stack | Primary Directory | Port / Runtime | Key Responsibilities |
|---|---|---|---|---|
| **Backend API** | Python 3.10+, FastAPI, Uvicorn, Motor, Pydantic v2 | `backend/` | `http://localhost:8000` | REST API, WebSockets, JWT auth, database CRUD, RAG orchestration, ML execution. |
| **Database** | MongoDB Atlas (Cloud) / Local MongoDB | `backend/db.py` | Port `27017` / Atlas SRV | Persistent storage of user profiles, projects, internships, document chunks, telemetry error logs. |
| **Vector Engine** | FAISS (`IndexFlatIP` + `IndexIDMap`), NumPy | `backend/services/vector_store.py` | File-based per user | High-performance vector indexing, isolated storage, inner product (cosine similarity) search. |
| **Career ML** | PyTorch, HuggingFace SentenceTransformers, Scikit-learn, XGBoost, LightGBM | `backend/inference/predictor.py`, `backend/ml_models/` | In-process execution | Profile text generation, 384-dimensional dense semantic embedding, 11-class softmax career prediction. |
| **Speech Engine** | HuggingFace Transformers (`openai/whisper-tiny`), Piper TTS (ONNX), Web Speech API | `backend/services/voice_service.py` | In-process / WebSocket | Audio transcription (STT), low-latency speech synthesis (TTS), audio streaming over WebSocket. |
| **Web Frontend** | React 18, Vite, React Router DOM, Axios, Lucide Icons | `frontend/` | `http://localhost:5173` | Responsive web portal, 5-step onboarding, interactive dashboards, RAG chat, action panel, developer visualizer. |
| **Mobile App** | Flutter 3.x, Dart, Provider State Management, Dio/Http | `mobile-app/` | iOS / Android / Web | Mobile dashboard, real-time voice assistant, document upload, project tracking, career predictions. |
| **VS Code Tool** | TypeScript, VS Code Extension API, esbuild, Node.js Crypto | `vs_extension/` | VS Code Host | File-save telemetry, error AST parsing, 7-line context extraction, SHA-256 deduplication, AI healing feed. |
| **External LLMs**| Google Gemini 3.1 Flash Lite (`GEMINI_API_KEY_RAG_DB`), Google Gemini 2.5 Flash | Google GenAI SDK | Cloud API | RAG answer generation, student DB insight extraction, structured action normalization, and real-time code error diagnostics. |


---

## 4. End-to-End System Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Student
    participant IDE as VS Code Extension
    participant FE as React Web / Mobile
    participant BE as FastAPI Backend
    participant ML as ML & Vector Store
    participant DB as MongoDB Atlas
    participant LLM as External AI (Gemini / OpenRouter / Ollama)

    %% 1. Registration & Prediction
    rect rgb(240, 245, 255)
    Note over User, ML: 1. Registration & Career Prediction Phase
    User->>FE: Fills 5-step Onboarding (CGPA, Branch, Skills, Projects)
    FE->>BE: POST /api/students/profile (JWT)
    BE->>DB: Upsert student record
    User->>FE: Clicks "Predict Career"
    FE->>BE: GET /api/predict
    BE->>ML: Pass skills & stats -> Embed (all-MiniLM-L6-v2) -> CareerMLP
    ML-->>BE: Top 5 Roles, Confidence scores, Skill Radar
    BE->>DB: Cache predictions in db.prediction_cache
    BE-->>FE: Return predictions JSON
    FE-->>User: Render primary card, radar chart, probability bars
    end

    %% 2. Document Ingestion & RAG
    rect rgb(245, 255, 240)
    Note over User, LLM: 2. Document Processing & Grounded RAG Phase
    User->>FE: Uploads PDF (Resume, Transcript, Project Report)
    FE->>BE: POST /api/documents (Multipart PDF)
    BE->>DB: Insert document metadata
    FE->>BE: POST /api/documents/{id}/process
    BE->>BE: Extract text (PyMuPDF) -> Semantic Chunking
    BE->>DB: Store chunks in db.document_chunks
    FE->>BE: POST /api/documents/{id}/embed
    BE->>ML: Embed chunks (all-MiniLM-L6-v2) -> Index in user FAISS
    User->>FE: Asks question via voice / text ("What backend skills do I lack?")
    FE->>BE: POST /api/intelligence/ask (question, provider, top_k)
    BE->>ML: Vector search query in user's FAISS index (Cosine similarity)
    ML-->>BE: Top-k matching document chunks
    BE->>DB: Fetch user profile (CGPA, skills, projects, academics)
    BE->>BE: Build bounded prompt (Max 20,000 characters budget)
    BE->>LLM: Send structured prompt (Ollama / OpenRouter)
    LLM-->>BE: Grounded response with citations
    BE-->>FE: Return answer + source citations + timing metadata
    FE-->>User: Display markdown response & speak via Piper / Browser TTS
    end

    %% 3. IDE Telemetry & Auto-Healing
    rect rgb(255, 245, 245)
    Note over User, LLM: 3. Real-Time IDE Coding Telemetry & AI Healing Phase
    User->>IDE: Writes code in VS Code & saves file with error
    IDE->>IDE: onDidSaveTextDocument -> Parse diagnostics
    IDE->>IDE: Extract 7-line snippet -> Compute SHA-256 fingerprint
    IDE->>BE: POST /api/extension/error (X-Extension-Key)
    BE->>DB: Check if fingerprint already logged
    alt New Error
        BE->>LLM: Query Gemini 2.5 Flash with code snippet
        LLM-->>BE: JSON {hint, explanation, corrected_block}
        BE->>DB: Save error log with AI insights
    end
    BE-->>IDE: Acknowledge logged error
    User->>FE: Views /extension dashboard
    FE->>BE: GET /api/extension/errors
    BE-->>FE: Return active error list with AI hints
    User->>FE: Clicks "Show fix 🪄"
    FE->>BE: GET /api/extension/errors/{id}/reveal
    BE-->>FE: Return corrected code block & explanation
    User->>FE: Clicks "Mark as Solved"
    FE->>BE: PATCH /api/extension/errors/{id}/resolve
    BE->>DB: Update resolved status and timestamp
    end
```

---

## 5. Database Architecture & Data Dictionary

MirrorMind utilizes MongoDB as its primary datastore, backed by asynchronous connections via the `motor` driver. The data is partitioned across specialized collections:

### 5.1 Collection: `users`
Stores authentication accounts and embedded API keys for VS Code:
```json
{
  "_id": "uuid-string",
  "name": "Prajwal Ganiga",
  "email": "prajwal@mirrormind.com",
  "password": "hashed_or_plain_password",
  "avatar_url": "https://res.cloudinary.com/.../avatar.png",
  "created_at": "2026-09-29T14:30:00Z",
  "extension_api_key": {
    "id": "uuid-string",
    "user_id": "uuid-string",
    "key_prefix": "ext_a1b2",
    "key_hash": "sha256_hash_of_full_token",
    "created_at": "2026-09-29T14:35:00Z",
    "last_used_at": "2026-09-29T18:20:00Z",
    "revoked": false
  }
}
```

### 5.2 Collection: `students`
The primary profile collection representing student academic and technical history:
```json
{
  "_id": "uuid-string",
  "user_id": "uuid-string",
  "name": "Prajwal Ganiga",
  "branch": "Computer Science and Engineering",
  "semester": 7,
  "college_tier": "Tier-1",
  "cgpa": 8.85,
  "backlog_count": 0,
  "skills": ["python", "fastapi", "react", "pytorch", "docker", "faiss", "mongodb"],
  "career_interest": "AIML_ENGINEER",
  "communication_rating": 8,
  "work_style_pref": "collaborative",
  "updated_at": "2026-09-29T18:00:00Z",
  "predictions": [
    { "rank": 1, "role": "AIML_ENGINEER", "label": "AI / ML Engineer", "confidence": 0.842 },
    { "rank": 2, "role": "SWE_BACKEND", "label": "Backend Developer", "confidence": 0.091 }
  ],
  "projects": [
    {
      "id": "uuid-string",
      "title": "MirrorMind AI Platform",
      "description": "Multi-modal career trajectory prediction and academic RAG intelligence system.",
      "tech_stack": ["Python", "FastAPI", "React", "PyTorch", "FAISS"],
      "github_url": "https://github.com/...",
      "live_demo_url": "https://mirrormindai.vercel.app",
      "thumbnail_url": "https://res.cloudinary.com/...",
      "certificate_url": null
    }
  ],
  "internships": [
    {
      "id": "uuid-string",
      "company_name": "Google",
      "domain": "Artificial Intelligence",
      "role": "Machine Learning Intern",
      "start_date": "2026-05-01T00:00:00Z",
      "end_date": "2026-08-01T00:00:00Z",
      "is_current": 0,
      "certificate_url": "https://res.cloudinary.com/...",
      "description": "Worked on LLM alignment and agentic workflows."
    }
  ],
  "semester_records": [
    {
      "id": "uuid-string",
      "semester": 6,
      "sgpa": 9.1,
      "credits_earned": 24,
      "subjects": [
        { "id": "uuid-string", "subject_name": "Machine Learning", "marks_obtained": 95, "max_marks": 100, "grade": "S" }
      ]
    }
  ]
}
```

### 5.3 Collection: `user_documents` & `document_chunks`
Stores uploaded PDF metadata and resulting textual chunks:
* **`user_documents`**: `user_id`, `filename`, `category` (resume, transcript, certificate, project_report), `file_type`, `file_size`, `processing_status` (uploaded, processing, processed, failed), `embedding_status` (embedding, embedded, failed), `page_count`, `chunk_count`.
* **`document_chunks`**: `user_id`, `document_id`, `chunk_index`, `page_start`, `page_end`, `text`, `created_at`. Indexed on compound key `[("user_id", 1), ("document_id", 1)]`.

### 5.4 Collection: `vector_indexes`
Tracks the status and metadata of user vector stores:
```json
{
  "_id": "ObjectId",
  "user_id": "uuid-string",
  "index_version": 1,
  "embedding_model": "all-MiniLM-L6-v2",
  "embedding_dimension": 384,
  "distance_metric": "inner_product",
  "normalized": true,
  "vector_count": 48,
  "index_path": "c:/.../backend/vector_indexes/user_123/index.faiss",
  "updated_at": "2026-09-29T18:15:00Z"
}
```

### 5.5 Collection: `error_logs` & `extension_activity_log`
Stores real-time telemetry from developer workstations:
* **`error_logs`**: `user_id`, `file_path`, `line`, `error_message`, `source`, `error_code`, `fingerprint` (SHA-256 hash), `code_context` (7-line snippet), `hint`, `explanation`, `corrected_block`, `gemini_fetched_at`, `resolved_via` (`hint` | `full_fix`), `resolved_at`, `hidden_by_user`.
* **`extension_activity_log`**: `user_id`, `event_type` (`file_saved`), `file_path`, `created_at`.

---

## 6. Security, Key Management & Authentication Architecture

1. **User Authentication (JWT)**:
   * Uses standard JSON Web Tokens signed with a secure server secret (`JWT_SECRET_KEY`) using the `HS256` algorithm.
   * Expiration configured via `ACCESS_TOKEN_EXPIRE_MINUTES`.
   * Standard endpoints accept `Authorization: Bearer <token>`.
2. **VS Code Extension Security (Hashed Key Handshake)**:
   * When an extension API key is generated via `/api/settings/api-key`, the backend generates a 32-byte cryptographically secure random token with prefix `ext_...`.
   * The plaintext key is shown to the user **once only**.
   * Only the SHA-256 hash (`key_hash`) and prefix (`key_prefix`) are stored in MongoDB.
   * VS Code stores this secret in its platform-native secure credential store (`context.secrets` / Windows Credential Manager / macOS Keychain).
   * Requests sent from VS Code use the `X-Extension-Key` header.
3. **User-Isolated Storage & Vector Spaces**:
   * Every query to MongoDB enforces explicit `{"user_id": user_id}` filtering.
   * FAISS vector stores are physically isolated into dedicated user directories: `backend/vector_indexes/{user_id}/index.faiss` and `metadata.json`. There is zero cross-contamination between students.
4. **Untrusted Data Isolation in RAG**:
   * All uploaded student documents are treated as untrusted text. The system prompt explicitly enforces guardrails prohibiting prompt injections or instruction overrides embedded inside user PDFs.
