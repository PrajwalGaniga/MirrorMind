from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, students, predict, developer

app = FastAPI(title="MirrorMind API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(students.router, prefix="/api/students", tags=["Students"])
app.include_router(predict.router, prefix="/api", tags=["Predict"])
app.include_router(developer.router, prefix="/api/developer", tags=["Developer"])


@app.get("/")
def root():
    return {"status": "MirrorMind API running", "version": "1.0.0"}
