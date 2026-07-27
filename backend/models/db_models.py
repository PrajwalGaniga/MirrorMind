from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from db import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student_profile = relationship("Student", back_populates="user", uselist=False)
    extension_api_key = relationship("ExtensionAPIKey", back_populates="user", uselist=False)
    prediction_cache = relationship("PredictionCache", back_populates="user", uselist=False)

class ExtensionAPIKey(Base):
    __tablename__ = "extension_api_keys"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    key_prefix = Column(String, nullable=False)
    key_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    revoked = Column(Boolean, default=False)

    user = relationship("User", back_populates="extension_api_key")


class Skill(Base):
    __tablename__ = "skills"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, unique=True, index=True, nullable=False)


class Internship(Base):
    __tablename__ = "internships"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), index=True, nullable=False)
    company_name = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    role = Column(String, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    is_current = Column(Integer, default=0)
    certificate_url = Column(String, nullable=True)
    description = Column(String, nullable=True)

    student = relationship("Student", back_populates="internships")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    github_url = Column(String, nullable=True)
    live_demo_url = Column(String, nullable=True)
    tech_stack = Column(JSON, default=[])
    thumbnail_url = Column(String, nullable=True)
    certificate_url = Column(String, nullable=True)

    student = relationship("Student", back_populates="projects")


class SemesterRecord(Base):
    __tablename__ = "semester_records"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), index=True, nullable=False)
    semester = Column(Integer, nullable=False)
    sgpa = Column(Float, nullable=False)
    credits_earned = Column(Integer, nullable=False)

    student = relationship("Student", back_populates="semester_records")
    subjects = relationship("SubjectMark", back_populates="semester_record")


class SubjectMark(Base):
    __tablename__ = "subject_marks"

    id = Column(String, primary_key=True, default=generate_uuid)
    semester_record_id = Column(String, ForeignKey("semester_records.id"), index=True, nullable=False)
    subject_name = Column(String, nullable=False)
    marks_obtained = Column(Float, nullable=False)
    max_marks = Column(Float, nullable=False)
    grade = Column(String, nullable=True)

    semester_record = relationship("SemesterRecord", back_populates="subjects")


class Student(Base):
    __tablename__ = "students"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, index=True)
    name = Column(String, nullable=False)
    branch = Column(String, nullable=False)
    semester = Column(Integer, nullable=False)
    college_tier = Column(String, nullable=False)
    cgpa = Column(Float, nullable=False, default=0.0)
    backlog_count = Column(Integer, nullable=False)
    skills = Column(JSON, default=[])
    certifications = Column(JSON, default=[])
    career_interest = Column(String, nullable=False)
    communication_rating = Column(Integer, nullable=False)
    work_style_pref = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    predictions = Column(JSON, nullable=True)

    user = relationship("User", back_populates="student_profile")
    internships = relationship("Internship", back_populates="student")
    projects = relationship("Project", back_populates="student")
    semester_records = relationship("SemesterRecord", back_populates="student")


class PredictionCache(Base):
    """Stores the last successfully computed ML predictions per user.
    
    Acts as a permanent fallback — if ML fails, we return stale-but-valid data
    rather than showing an error. Updated every time ML succeeds.
    """
    __tablename__ = "prediction_cache"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    predictions = Column(JSON, nullable=False)
    skill_radar = Column(JSON, nullable=True)
    top_insight = Column(String, nullable=True)
    cgpa = Column(Float, nullable=True)
    computed_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="prediction_cache")

