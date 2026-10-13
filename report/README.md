# MirrorMind — Comprehensive Technical Architecture & System Documentation

Welcome to the central technical documentation suite for **MirrorMind**, an AI-powered career trajectory prediction, academic document intelligence (RAG), and developer telemetry ecosystem.

This repository directory contains exhaustive, deep-dive architectural documents detailing every layer, subsystem, data structure, workflow, and model in the project.

---

## Documentation Navigation Index

| Document | Scope & Contents | Primary Technologies |
|---|---|---|
| 📑 **[overall_architecture.md](file:///c:/Users/ASUS/Desktop/Projects/MirrorMind/report/overall_architecture.md)** | **Overall System Architecture & Ecosystem Topology**<br/>• Executive Summary & Vision<br/>• System Component Matrix & Ports<br/>• Full System Mermaid Architecture Diagram<br/>• Complete End-to-End Sequence Diagram<br/>• Database Schemas (MongoDB collections: users, students, chunks, logs)<br/>• Security, Key Management & Vector Isolation | FastAPI, React, Flutter, VS Code, MongoDB Atlas, FAISS, PyTorch, Gemini |
| ⚙️ **[backend_detail.md](file:///c:/Users/ASUS/Desktop/Projects/MirrorMind/report/backend_detail.md)** | **Backend Services, ML & RAG Engine Specification**<br/>• FastAPI Application Lifecycle & Middleware<br/>• Complete 12-Router API Catalog (45+ endpoints)<br/>• Career Trajectory ML Pipeline (`predictor.py`, `CareerMLP`, Softmax)<br/>• Document Processing & FAISS Vector Store (`vector_store.py`)<br/>• Grounded RAG & Context Budgeting (`rag_service.py`)<br/>• Dual LLM Architecture (Local Ollama vs Cloud OpenRouter)<br/>• Real-Time Voice Services (Whisper STT & Piper Neural TTS)<br/>• Telemetry & Gemini 2.5 Flash Healing Services | Python, FastAPI, Motor, PyTorch, SentenceTransformers, FAISS, Piper ONNX, Whisper |
| 💻 **[frontend_detail.md](file:///c:/Users/ASUS/Desktop/Projects/MirrorMind/report/frontend_detail.md)** | **Web Application Architecture & Component Deep Dive**<br/>• React 18 + Vite Architecture & Directory Layout<br/>• Global Contexts (`AuthContext`, `DevConsoleContext`)<br/>• Neo-Brutalist & Glassmorphic Design System (`index.css`)<br/>• Complete Page Walkthrough (Onboarding, Dashboard, Predict, Profile, etc.)<br/>• Core Interactive Subsystems (`Intelligence.jsx`, `ActionPanel.jsx`)<br/>• Hands-Free Voice Machine & Wake-Word Detection | React 18, Vite, React Router DOM, Axios, Web Audio API, Web Speech API, Lucide |
| 📱 **[mobile_app_detail.md](file:///c:/Users/ASUS/Desktop/Projects/MirrorMind/report/mobile_app_detail.md)** | **Cross-Platform Flutter Mobile Application Specification**<br/>• Flutter Architecture & Project Layout (`mobile-app/lib`)<br/>• Provider State Architecture (6 Core Providers)<br/>• Persistent Navigation Shell (`MainScaffold`)<br/>• Screen-by-Screen Breakdown (Home, Predict, Docs, AI Voice, Profile)<br/>• Mobile Document Picker & Cloudinary Direct Upload<br/>• Mobile Hands-Free Voice Engine & Quick Prompts<br/>• Neo-Brutalist Mobile Theme & Component Library | Flutter 3.x, Dart, Provider, FilePicker, Cloudinary, SpeechToText, FlutterTTS |
| 🔌 **[vscode_extension_detail.md](file:///c:/Users/ASUS/Desktop/Projects/MirrorMind/report/vscode_extension_detail.md)** | **VS Code Telemetry Extension (Skillgap Monitor) Specification**<br/>• Extension Architecture & Life Cycle (`src/extension.ts`)<br/>• VS Code SecretStorage Key Handshake<br/>• File Save Event Listener (`onDidSaveTextDocument`)<br/>• AST Diagnostic Filtering & 7-Line Context Extractor<br/>• SHA-256 Deduplication Fingerprinting Engine<br/>• Automated AI Healing Cycle with Google Gemini 2.5 Flash<br/>• Two-Tier Web Dashboard Resolution (Hint vs Reveal Fix)<br/>• Packaging, Commands, and Configuration Options | TypeScript, VS Code Extension API, esbuild, Node.js Crypto, Gemini 2.5 Flash |
| 🔄 **[features_and_workflow_guide.md](file:///c:/Users/ASUS/Desktop/Projects/MirrorMind/report/features_and_workflow_guide.md)** | **Features Catalog, Operational Workflows & System Logics**<br/>• 15-Feature Master Catalog (Inputs, Logic, Outputs, Benefits)<br/>• **Workflow 1**: Onboarding & ML Career Prediction<br/>• **Workflow 2**: Document Ingestion, Chunking & Vector Indexing<br/>• **Workflow 3**: Grounded Academic RAG Query Execution<br/>• **Workflow 4**: Agentic Multi-Turn Profile Actions<br/>• **Workflow 5**: Real-Time IDE Telemetry & Gemini AI Repair<br/>• **Workflow 6**: Multi-Modal Voice Interaction & Hands-Free Loop<br/>• **Workflow 7**: Developer ML Pipeline Transparency & Inspection<br/>• **Workflow 8**: Cross-Platform Web & Mobile Synchronization | Mermaid Workflow Diagrams, Logic Flows, State Transitions |

---

## System Architectural Topology Summary

```mermaid
graph TB
    subgraph Clients["Cross-Platform Client Tier"]
        WEB["React 18 Web App"]
        MOBILE["Flutter Mobile App"]
        IDE["VS Code Extension"]
    end

    subgraph GatewayTier["FastAPI Backend Tier (Port 8000)"]
        FASTAPI["FastAPI Asynchronous Gateway"]
        PREDICT_SVC["Career ML Predictor (PyTorch)"]
        RAG_SVC["Grounded RAG Engine"]
        ACTION_SVC["Agentic Action Engine"]
        VOICE_SVC["Whisper STT & Piper TTS"]
        EXT_SVC["Telemetry & Error Healing"]
    end

    subgraph DataTier["Storage & Persistence Tier"]
        MONGO[("MongoDB Atlas Cloud Database")]
        FAISS[("Per-User FAISS Vector Stores")]
        CLOUDINARY["Cloudinary Media Storage"]
    end

    subgraph AITier["External Artificial Intelligence Tier"]
        GEMINI_RAG["Google Gemini 3.1 Flash Lite<br/>(GEMINI_API_KEY_RAG_DB)"]
        GEMINI_EXT["Google Gemini 2.5 Flash<br/>(VS Code Error Diagnostics)"]
    end

    Clients --> FASTAPI
    FASTAPI --> PREDICT_SVC
    FASTAPI --> RAG_SVC
    FASTAPI --> ACTION_SVC
    FASTAPI --> VOICE_SVC
    FASTAPI --> EXT_SVC

    FASTAPI --> MONGO
    RAG_SVC --> FAISS
    FASTAPI --> CLOUDINARY

    EXT_SVC --> GEMINI_EXT
    RAG_SVC --> GEMINI_RAG
    ACTION_SVC --> GEMINI_RAG
```

