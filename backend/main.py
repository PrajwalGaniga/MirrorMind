from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from db import get_db, setup_indexes
import models.db_models
from routes import auth, students, predict, developer, uploads, settings, extension, documents



app = FastAPI(title="MirrorMind API", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    await setup_indexes()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
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
