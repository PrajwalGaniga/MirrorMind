from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db import Base, engine, SessionLocal
from models.db_models import Skill, Student
import alembic

print("Connecting to DB...")
Base.metadata.create_all(bind=engine)
db = SessionLocal()

INITIAL_SKILLS = [
    "Python", "Java", "C++", "C#", "JavaScript", "TypeScript", "Dart", "Go", "Rust", "Swift", "Kotlin",
    "React", "Angular", "Vue", "Next.js", "Node.js", "Express", "Django", "FastAPI", "Flask", "Spring Boot",
    "Flutter", "React Native", "Android Development", "iOS Development",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Firebase", "Supabase",
    "AWS", "GCP", "Azure", "Docker", "Kubernetes", "CI/CD", "Linux", "Git",
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "NLP", "Computer Vision",
    "Data Science", "Pandas", "NumPy", "Data Analysis",
    "UI/UX Design", "Figma", "Adobe XD",
    "Cybersecurity", "Ethical Hacking", "Cloud Computing", "Blockchain", "Web3", "Smart Contracts"
]

print("Populating skills...")
existing_skills = {s.name for s in db.query(Skill).all()}

for name in INITIAL_SKILLS:
    if name not in existing_skills:
        db.add(Skill(name=name))

db.commit()

# Ensure existing students have cgpa column updated if they are missing
print("Updating existing students for cgpa defaults if necessary...")
try:
    students = db.query(Student).all()
    for s in students:
        if s.cgpa is None:
            s.cgpa = 0.0
    db.commit()
except Exception as e:
    print(f"Migration error for cgpa: {e}")

print("Done!")
db.close()
