from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from db import get_db, setup_indexes
import models.db_models
from routes import auth, students, predict, developer, uploads, settings, extension, documents, retrieval, intelligence, voice, actions

app = FastAPI(title="MirrorMind API", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    await setup_indexes()

# Allowed Origins for CORS
ALLOWED_ORIGINS = [
    "http://localhost:5173",                            # React Vite Frontend (Local)
    "http://localhost:3000",                            # React CRA / Next.js (Local)
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://dawdlingly-pseudoinsane-pa.ngrok-free.dev", # ngrok Public Tunnel
    "https://mirrormindai.vercel.app",                  # Vercel Production Frontend
    "*",                                                # Wildcard fallback
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(students.router, prefix="/api/students", tags=["Students"])
app.include_router(predict.router, prefix="/api", tags=["Predict"])
app.include_router(developer.router, prefix="/api/developer", tags=["Developer"])
app.include_router(uploads.router, prefix="/api/upload", tags=["Uploads"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(extension.router, prefix="/api/extension", tags=["Extension"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(retrieval.router, prefix="/api/retrieval", tags=["Retrieval"])
app.include_router(intelligence.router, prefix="/api/intelligence", tags=["Intelligence"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(actions.router, prefix="/api/actions", tags=["Actions"])

@app.get("/")
def root():
    return {"status": "MirrorMind API running", "version": "1.0.0"}

@app.get("/api/health/db")
async def health_db(db = Depends(get_db)):
    try:
        await db.command("ping")
        return {"status": "Database connection successful"}
    except Exception as e:
        return {"status": "Database connection failed", "error": str(e)}
