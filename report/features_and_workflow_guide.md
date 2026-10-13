# MirrorMind — Features Catalog, Operational Workflows & System Logics

## 1. Comprehensive Features Catalog

MirrorMind provides an integrated suite of artificial intelligence features designed to assist engineering students at every stage of their academic and professional development.

| # | Feature Name | Description | Key Inputs | Core Engine / Service | Output / Deliverable |
|---|---|---|---|---|---|
| **F-01** | **Career Trajectory Prediction** | Evaluates student profile to predict top-5 best-fit industry career roles with confidence probabilities. | Skills, CGPA, Projects count, Internships count | PyTorch `CareerMLP`, SentenceTransformer `all-MiniLM-L6-v2`, `predictor.py` | Top-5 ranked career roles, confidence scores, primary role card. |
| **F-02** | **Skill Competency Radar** | Visualizes student proficiency across 6 dimensions to evaluate engineering readiness. | Profile skills, academic CGPA, completed projects, internships | Algorithmic normalization in `routes/predict.py` | 6-axis SVG / Canvas polygon (Depth, Breadth, Projects, Industry, Academic, Soft Skills). |
| **F-03** | **Actionable Career Insights** | Dynamically generates strategic recommendations based on prediction gaps. | Prediction ranks, confidence percentages, skill array | Heuristic rules engine in `routes/predict.py` | Contextual advice banner (e.g., *"Add PyTorch and Docker to hit 85%+ confidence"*). |
| **F-04** | **Academic Document Processing** | Ingests PDF resumes, transcripts, project reports, and certificates. | Uploaded PDF files (max 10MB) | PyMuPDF (`fitz`), `pdfplumber`, `document_processor.py` | Clean text chunks with page bounds, stored in `db.document_chunks`. |
| **F-05** | **Per-User Isolated Vector Search** | Indexes document chunks for sub-millisecond semantic retrieval without cross-user leakage. | Normalized chunk text embeddings | FAISS (`IndexFlatIP` + `IndexIDMap`) in `services/vector_store.py` | Isolated on-disk vector index (`index.faiss`) per user. |
| **F-06** | **Grounded Academic RAG** | Answers complex student questions using their own profile and uploaded documents with strict anti-hallucination. | User query string, top-k chunks, student profile | `rag_service.py`, `llm_service.py` (Ollama / OpenRouter) | Factual markdown answer accompanied by verified source citations. |
| **F-07** | **Context Budget Management** | Enforces strict 20,000 character context windows to prevent token overflows and hallucinations. | Retrieved document chunks, system prompt, profile | Priority sliding window in `services/rag_service.py` | Optimal prompt budget allocation with truncation flags. |
| **F-08** | **Hands-Free Wake-Word Voice Assistant** | Continuous voice listening activated by saying *"Hey MirrorMind"*, with audio chimes and voice playback. | Microphone audio stream, wake phrases | `WakeRecognitionManager`, Web Audio API, `audio-meter.js` | Hands-free hands-off voice interaction loop. |
| **F-09** | **Real-Time Speech Synthesis (TTS)** | High-quality neural voice playback for AI answers. | Generated answer text | Piper Neural TTS (ONNX) via WebSockets (`/ws/tts`) & Web Speech API fallback | Streamed 16-bit PCM audio or browser voice output. |
| **F-10** | **Speech-to-Text Transcription (STT)**| Local offline voice transcription. | Raw WAV audio recordings | HuggingFace `openai/whisper-tiny` pipeline in `voice_service.py` | Accurate natural language text transcript. |
| **F-11** | **Agentic Profile Mutations** | Voice and text conversational wizards to add projects, internships, or edit profile fields. | Conversational statements (e.g., *"Add project"*, *"Change CGPA"*) | `useActionEngine.js`, `intentDetector.js`, `actions.py` | LLM-normalized Pydantic JSON committed to MongoDB. |
| **F-12** | **IDE Coding Telemetry & AI Healing** | Captures syntax and runtime errors on file save in VS Code, retrieves Gemini AI hints and code fixes. | File save events, compiler diagnostics, 7-line snippet | VS Code Extension (`extension.ts`), Google Gemini 2.5 Flash | Real-time AI hint cards and revealable code corrections on web dashboard. |
| **F-13** | **SHA-256 Error Deduplication** | Prevents repeated API calls and saves AI tokens during iterative debugging. | File path, line number, error message | SHA-256 hashing in `extension.ts` & backend check | Cached duplicate recognition and instant hint response. |
| **F-14** | **Developer ML Pipeline Visualizer** | Exposes inner mathematical workings of the machine learning pipeline for educational transparency. | Student profile data | `Developer.jsx`, `routes/developer.py` | Step-by-step vector inspector, raw sentence view, and 11-class Softmax breakdown. |
| **F-15** | **Cloudinary Media Infrastructure** | Secure cloud storage for project thumbnails and internship completion certificates. | Image files (JPEG, PNG) | Signed/Unsigned Cloudinary API integration in `routes/uploads.py` | Persistent CDN URLs stored in student documents. |

---

## 2. Operational Workflows & System Logics

---

### Workflow 1: Student Onboarding & Career Trajectory Prediction

This workflow transforms raw student academic credentials into dense semantic vector representations, executes neural network inference, and renders the top career predictions.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant UI as Onboarding / Predict UI
    participant BE as FastAPI Predict Router
    participant Predictor as predictor.py
    participant ST as SentenceTransformer
    participant MLP as PyTorch CareerMLP
    participant DB as MongoDB Atlas

    Student->>UI: Completes 5-step form (CGPA: 8.8, Skills: [Python, React, PyTorch])
    UI->>BE: POST /api/students/profile
    BE->>DB: Upsert record in db.students
    Student->>UI: Clicks "Predict Career"
    UI->>BE: GET /api/predict?force=false
    BE->>DB: Check db.prediction_cache for user
    alt Cache Valid & Not Forced
        DB-->>BE: Return cached predictions & radar
    else Cache Empty or Forced
        BE->>Predictor: predict_career(skills, cgpa, projects, internships)
        Predictor->>Predictor: Normalize to text: "Engineering student with skills in python, react, pytorch. CGPA 8.8..."
        Predictor->>ST: encode(text, normalize_embeddings=True)
        ST-->>Predictor: 384-dimensional dense vector (L2 norm)
        Predictor->>MLP: forward(tensor(vector))
        MLP-->>Predictor: Raw Logits (11 classes)
        Predictor->>Predictor: Softmax(Logits) -> Top 5 indices
        Predictor->>Predictor: Decode classes with label_encoder.pkl
        Predictor-->>BE: Top 5 roles & confidences
        BE->>BE: Compute Skill Radar & Top Insight
        BE->>DB: Write to db.prediction_cache & db.students.predictions
    end
    BE-->>UI: Return JSON response
    UI-->>Student: Display Primary Role Card, Radar Polygon & Insight Banner
```

---

### Workflow 2: Document Ingestion, Semantic Chunking & FAISS Vector Indexing

This workflow enables students to upload academic documents (resumes, transcripts, project reports), extracts textual content, partitions it into semantic chunks, and creates a private FAISS vector index.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant UI as Documents Hub (Web/Mobile)
    participant DocRouter as /api/documents
    participant Extractor as document_processor.py
    participant DB as MongoDB Atlas
    participant EmbedSvc as embedding_service.py
    participant VStore as vector_store.py (FAISS)

    Student->>UI: Selects "Resume_2026.pdf", category: "resume"
    UI->>DocRouter: POST /api/documents (Multipart File)
    DocRouter->>DocRouter: Validate PDF MIME type & file size (<10MB)
    DocRouter->>DB: Insert document metadata (status: "uploaded")
    DocRouter->>DocRouter: Save local copy in /backend/uploads/{id}.pdf
    DocRouter-->>UI: Return 201 Created (document_id)

    UI->>DocRouter: POST /api/documents/{id}/process
    DocRouter->>DB: Set status: "processing"
    DocRouter->>Extractor: process_pdf_document(local_path)
    Extractor->>Extractor: PyMuPDF extracts text per page
    Extractor->>Extractor: Split text into semantic chunks with page boundaries
    Extractor-->>DocRouter: Chunks list + page_count
    DocRouter->>DB: Delete any prior chunks for this doc (idempotency)
    DocRouter->>DB: Insert chunks into db.document_chunks
    DocRouter->>DB: Update document status: "processed"
    DocRouter-->>UI: Return processing complete

    UI->>DocRouter: POST /api/documents/{id}/embed
    DocRouter->>DB: Set embedding_status: "embedding"
    DocRouter->>DB: Query chunks from db.document_chunks
    DB-->>DocRouter: Return chunk texts
    DocRouter->>EmbedSvc: embed(chunk_texts)
    EmbedSvc-->>DocRouter: Normalized 384-d vectors
    DocRouter->>VStore: VectorStore(user_id).add_vectors(vectors, metadatas)
    VStore->>VStore: Write index.faiss & metadata.json in user directory
    DocRouter->>DB: Update db.vector_indexes (vector_count, updated_at)
    DocRouter->>DB: Set embedding_status: "embedded"
    DocRouter-->>UI: Return embedding complete
    UI-->>Student: Document badge switches to "Indexed & Ready"
```

---

### Workflow 3: Grounded Academic RAG Query Execution

This workflow executes an anti-hallucination, citation-backed query answering cycle combining the student's live profile with retrieved document evidence.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant UI as Intelligence UI
    participant RAG as /api/intelligence/ask
    participant EmbedSvc as embedding_service.py
    participant VStore as FAISS Vector Store
    participant DB as MongoDB Atlas
    participant LLM as External LLM (OpenRouter / Ollama)

    Student->>UI: Submits question: "What skills should I learn for backend roles?"
    UI->>RAG: POST /api/intelligence/ask {question, provider: "openrouter", top_k: 5}
    RAG->>DB: Fetch student profile from db.students (Skills, Projects, CGPA)
    RAG->>EmbedSvc: embed([question])
    EmbedSvc-->>RAG: Normalized query vector
    RAG->>VStore: Search user's FAISS index (top_k=5)
    VStore-->>RAG: Vector IDs & Cosine Similarity scores
    RAG->>DB: Fetch matching text from db.document_chunks
    RAG->>RAG: Context Budgeting (fits profile + chunks under 20,000 chars)
    RAG->>RAG: Assemble System Prompt + Profile Context + Document Evidence
    RAG->>LLM: Dispatch prompt with temperature: 0.3
    LLM-->>RAG: Return generated answer text
    RAG->>RAG: Extract cited filenames, page ranges, and similarity scores
    RAG-->>UI: Return {question, answer, sources, timing_ms}
    UI-->>Student: Render formatted markdown + interactive source citation pills
```

---

### Workflow 4: Agentic Multi-Turn Profile Actions

This workflow enables users to execute profile modifications (e.g., adding a project or internship) conversationally via voice or text with strict structured JSON normalization.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Engine as useActionEngine.js
    participant UI as ActionPanel.jsx
    participant Normalizer as /api/actions/normalize
    participant LLM as OpenRouter / Ollama
    participant StudentsRouter as /api/students/projects
    participant DB as MongoDB Atlas

    Student->>Engine: Voice/Text: "Add a new project"
    Engine->>Engine: Intent detected: ADD_PROJECT
    Engine->>UI: Open ActionPanel, set step: 0 ("What is the project title?")
    Student->>Engine: "Smart Attendance System"
    Engine->>UI: Set step: 1 ("Describe what this project does")
    Student->>Engine: "It uses facial recognition and computer vision to log attendance"
    Engine->>UI: Set step: 2 ("What tech stack did you use?")
    Student->>Engine: "Python, OpenCV, and FastAPI"
    Engine->>UI: Set step: 3 ("Provide a GitHub repository link or say skip")
    Student->>Engine: "https://github.com/myname/attendance"
    
    Note over Engine, Normalizer: All wizard fields collected
    Engine->>Normalizer: POST /api/actions/normalize {workflow_id: "ADD_PROJECT", collected_data}
    Normalizer->>LLM: Prompt LLM with strict Pydantic JSON schema rules
    LLM-->>Normalizer: Clean JSON {title, description, tech_stack: ["Python", "OpenCV", "FastAPI"], github_url}
    Normalizer-->>Engine: Return normalized project payload
    Engine->>UI: Render Action Preview Card ("Save changes to your portfolio?")
    Student->>Engine: "Confirm" (or clicks Save Button)
    Engine->>StudentsRouter: POST /api/students/projects (Normalized Payload)
    StudentsRouter->>DB: Push to student.projects array
    StudentsRouter-->>Engine: Return 201 Created
    Engine->>UI: Display success notification, close ActionPanel
    Engine-->>Student: Speaks audio confirmation: "Project added successfully!"
```

---

### Workflow 5: Real-Time IDE Coding Telemetry & Automated AI Repair

This workflow links developer coding actions in VS Code to the web dashboard, diagnosing syntax/runtime errors and generating fixes via Google Gemini 2.5 Flash.

```mermaid
sequenceDiagram
    autonumber
    actor Developer
    participant VSCode as VS Code Editor
    participant Ext as Skillgap Extension
    participant ExtRouter as /api/extension
    participant Gemini as Google Gemini 2.5 Flash
    participant DB as MongoDB Atlas
    participant WebUI as Web Dashboard (/extension)

    Developer->>VSCode: Writes code, introduces a syntax error, presses Ctrl+S
    VSCode->>Ext: onDidSaveTextDocument triggered
    Ext->>ExtRouter: POST /api/extension/activity (event: "file_saved")
    Ext->>Ext: Read active diagnostics from language server
    Ext->>Ext: Filter for errors & actionable warnings
    Ext->>Ext: Extract 7-line snippet (line ± 3 lines)
    Ext->>Ext: Generate SHA-256 fingerprint: hash(filePath + ":" + line + ":" + message)
    Ext->>ExtRouter: POST /api/extension/error (payload + X-Extension-Key)
    ExtRouter->>DB: Check if fingerprint exists for user
    alt Fingerprint Already Logged
        DB-->>ExtRouter: Duplicate found
        ExtRouter-->>Ext: Return cached {duplicate: true, hint}
    else New Error
        ExtRouter->>Gemini: Query Gemini 2.5 Flash with prompt & code snippet
        Gemini-->>ExtRouter: JSON {hint, explanation, corrected_block}
        ExtRouter->>DB: Save entry in db.error_logs
        ExtRouter-->>Ext: Return 201 Created {duplicate: false, hint}
    end

    Developer->>WebUI: Opens /extension dashboard
    WebUI->>ExtRouter: GET /api/extension/errors?status=active
    ExtRouter-->>WebUI: Return active errors with Gemini hints
    WebUI-->>Developer: Displays error card with file, line, and Hint
    Developer->>WebUI: Clicks "Show fix 🪄"
    WebUI->>ExtRouter: GET /api/extension/errors/{id}/reveal
    ExtRouter-->>WebUI: Return {explanation, corrected_block}
    WebUI-->>Developer: Opens modal showing code correction diff & root cause
    Developer->>WebUI: Clicks "Mark as Solved"
    WebUI->>ExtRouter: PATCH /api/extension/errors/{id}/resolve {resolved_via: "full_fix"}
    ExtRouter->>DB: Update resolved_at timestamp
    WebUI-->>Developer: Moves error to Solved History
```

---

### Workflow 6: Multi-Modal Voice Interaction & Hands-Free Audio Loop

This workflow details the continuous speech recognition, wake-word activation, query routing, and real-time audio playback cycle.

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Browser as Web Browser / Mobile Audio
    participant WakeMgr as WakeRecognitionManager
    participant Meter as audio-meter.js
    participant STT as Whisper STT / WebSpeech
    participant Core as Intelligence.jsx / Flutter
    participant Piper as Piper Neural TTS (WebSocket)

    Student->>Browser: Clicks "Hands-Free Mode" toggle ON
    Core->>WakeMgr: start("wake")
    Core->>Meter: Connect AudioContext AnalyserNode
    Core-->>Student: Status badge: "WAKE_LISTENING (Say 'Hey MirrorMind')"

    Student->>Browser: Speaks: "Hey MirrorMind"
    Browser->>WakeMgr: SpeechRecognition result
    WakeMgr->>WakeMgr: matchesWakePhrase("Hey MirrorMind") == true
    WakeMgr->>Core: onResult -> Trigger Wake Word Event
    Core->>Browser: Play activation chime audio
    Core->>WakeMgr: stop()
    Core->>STT: Start recording user question (VoiceState: "RECORDING")
    Core->>Meter: Render animated pulsating audio wave

    Student->>Browser: Speaks: "Summarize my uploaded resume"
    STT->>Core: Transcription received: "Summarize my uploaded resume"
    Core->>Core: VoiceState: "THINKING"
    Note over Core: RAG Workflow (Workflow 3) runs
    Core->>Piper: Connect WS /api/voice/ws/tts -> Send answer text
    Core->>Core: VoiceState: "SPEAKING"
    loop Audio Streaming
        Piper-->>Browser: Stream 16-bit raw PCM audio chunks
        Browser->>Browser: AudioContext plays chunks with zero buffering delay
    end
    Piper-->>Browser: Token "__END__" received
    Core->>WakeMgr: start("wake")
    Core-->>Student: VoiceState returns to "WAKE_LISTENING"
```

---

### Workflow 7: Developer ML Pipeline Transparency & Inspection

This workflow allows students and instructors to inspect the exact mathematical stages of career prediction inside `/developer`.

```mermaid
graph TD
    STUDENT["Student opens /developer page"] --> PIPELINE_CALL["GET /api/developer/my-pipeline"]
    PIPELINE_CALL --> BE_DEV["developer.py inspect_pipeline()"]
    
    subgraph PipelineInspection["ML Pipeline Stages Exposed"]
        STAGE1["Stage 1: Profile Text Builder<br/>Displays exact normalized input sentence"]
        STAGE2["Stage 2: 384-Dimensional Embeddings<br/>Displays dense floating-point vector with statistics"]
        STAGE3["Stage 3: Softmax Probabilities<br/>Displays percentage distribution across all 11 classes"]
        STAGE4["Stage 4: Model Comparison<br/>Compares active NeuralNet against XGBoost, LightGBM, LogReg"]
    end
    
    BE_DEV --> PipelineInspection
    PipelineInspection --> RENDER["Developer.jsx renders interactive visualizers:<br/>Vector Heatmap, Probability Bars, Model Switcher"]
    RENDER --> STUDENT
```

---

### Workflow 8: Cross-Platform Web & Mobile Synchronization

This workflow illustrates how state changes performed on one client reflect instantaneously across all other devices.

```mermaid
graph LR
    subgraph UserClients["User Client Devices"]
        WEB["React Web App<br/>(Desktop Browser)"]
        MOBILE["Flutter Mobile App<br/>(Smartphone)"]
        VSCODE["VS Code Extension<br/>(Workstation)"]
    end

    subgraph CentralServer["FastAPI Backend & Cloud Database"]
        API["FastAPI Asynchronous Gateway"]
        MONGO[("MongoDB Atlas Cloud Database")]
        FAISS_STORE[("User FAISS Vector Store")]
    end

    %% Interactions
    VSCODE -->|Logs Error| API
    WEB -->|Uploads PDF Resume| API
    MOBILE -->|Adds Project via Voice| API

    API --> MONGO
    API --> FAISS_STORE

    MONGO -.->|Real-time Poll / Fetch| WEB
    MONGO -.->|Real-time Poll / Fetch| MOBILE
```
* **Unified Profile State**: A project added via voice on the mobile app is immediately visible on the web dashboard projects list.
* **Unified Document & Vector Hub**: A PDF transcript uploaded on the desktop web app is immediately searchable via voice RAG on the mobile phone.
* **Unified Coding Error Feed**: An error caught in VS Code appears in real-time on both the web telemetry page and the mobile notification dashboard.
