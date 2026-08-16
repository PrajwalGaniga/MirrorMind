# MirrorMind Intelligence Layer - Module 5
# Implementation Report

## 1. Architecture
Module 5 introduces a Grounded RAG integration utilizing OpenRouter for the LLM processing. The pipeline enforces strict data extraction paths natively from MongoDB and FAISS, combining authenticated student profiles with module 4 retrieval outputs before interfacing securely with the language model. LangChain or other heavy abstraction agents were excluded from this architecture by design.

## 2. OpenRouter Configuration
The OpenRouter API is securely accessed strictly via the backend utilizing native HTTP clients (`httpx`). Environment keys `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are managed exclusively by the Node ecosystem to prevent frontend key leakage.

## 3. Model Configuration
The chosen model can be manipulated cleanly via the `.env` configuration allowing free-tier models (e.g., `meta-llama/llama-3.3-70b-instruct:free`) to be swapped natively without code updates.

## 4. Profile Context
The `rag_service.py` securely extracts the user's MongoDB profile via `user_id` mapping. Profiles dynamically bundle skills, projects, and CGPA metrics into a structured sub-context minimizing unnecessary MongoDB fields or JWT headers.

## 5. Retrieval Context
Module 4's `retrieval_service` integrates dynamically exposing semantic chunks matching the user's intent. The system ranks, limits, and injects string extracts cleanly alongside metadata attributes for provenance tracking.

## 6. Context Construction
System configurations strictly bracket the input formats:
- System Instructions
- Student Profile
- Retrieved Document Evidence 
- User Question
This ensures inputs are cleanly delimited, minimizing LLM confusion between commands and untrusted external PDF contents.

## 7. Grounding Strategy
The system instructs the model explicitly:
- Do not invent facts.
- Answer honestly if data is insufficient.
- Emphasize and prioritize text strictly from the context blocks provided.

## 8. Prompt Injection Defense
Documents are explicitly highlighted as untrusted external data within the system directives. Prompts demanding instruction overrides are neutralized logically without exposing API payloads or crashing the query interface.

## 9. Hallucination Controls
Queries requesting non-existent skills (e.g. Kubernetes) actively evaluate the missing parameters from the `Profile` + `Evidence` sections, deflecting securely with honest ignorance.

## 10. Source Attribution
Sources traverse natively from MongoDB FAISS arrays to the final response payloads exposing exact chunks, filenames, page markers, and Document IDs alongside the generated insights.

## 11. Error Handling
All HTTP bounds are guarded returning `502 Bad Gateway` mappings if OpenRouter fails, ensuring system failures stay isolated safely without spilling internal server diagnostics.

## 12. Privacy
All contexts isolate dynamically upon standard JWT payload mapping to `user_id`. Queries only bundle strings belonging to the caller ensuring zero multi-user bleed internally.

## 13. Context Budget Management
A configurable max-budget structure protects the model from oversized payloads originating from high `top_k` inputs over large documents. 
- Context budgets fall back to `RAG_MAX_CONTEXT_CHARS` bounded logically to limit oversized prompt drops. 
- If bounds are hit, relevance limits trigger parsing strict higher-scored similarity sets while protecting baseline `Profile` elements automatically. 
- Returned output elements strictly mask trailing chunks enforcing exact mappings between chunks submitted natively.

## 14. Testing Strategy
Mocked deterministic environments test logic limits (isolation, prompt injection, extraction accuracy) without actively hitting OpenRouter limits. A live key check enables authentic end-to-end secret validation preventing active string leakage to the response.
