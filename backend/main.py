from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from db import Base, engine, get_db
import models.db_models
from routes import auth, students, predict, developer, uploads

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="MirrorMind API", version="1.0.0")

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

@app.get("/")
def root():
    return {"status": "MirrorMind API running", "version": "1.0.0"}

@app.get("/api/health/db")
def health_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "Database connection successful"}
    except Exception as e:
        return {"status": "Database connection failed", "error": str(e)}
