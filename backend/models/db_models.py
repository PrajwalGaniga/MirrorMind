from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any
from datetime import datetime
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class ExtensionAPIKey(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    user_id: str
    key_prefix: str
    key_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used_at: Optional[datetime] = None
    revoked: bool = False

class User(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    name: str
    email: str
    password: str
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # The extension api key and prediction cache can be referenced or queried separately.
    # In our Mongo plan, extension_api_key is embedded in User.
    extension_api_key: Optional[ExtensionAPIKey] = None

class Internship(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    company_name: str
    domain: str
    role: str
    start_date: datetime
    end_date: Optional[datetime] = None
    is_current: int = 0
    certificate_url: Optional[str] = None
    description: Optional[str] = None

class Project(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    title: str
    description: str
    github_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    thumbnail_url: Optional[str] = None
    certificate_url: Optional[str] = None

class SubjectMark(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    subject_name: str
    marks_obtained: float
    max_marks: float
    grade: Optional[str] = None

class SemesterRecord(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    semester: int
    sgpa: float
    credits_earned: int
    subjects: List[SubjectMark] = Field(default_factory=list)

class PredictionCache(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    predictions: Any
    skill_radar: Optional[Any] = None
    top_insight: Optional[str] = None
    cgpa: Optional[float] = None
    computed_at: datetime = Field(default_factory=datetime.utcnow)

class Student(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    user_id: str
    name: str
    branch: str
    semester: int
    college_tier: str
    cgpa: float = 0.0
    backlog_count: int
    skills: List[str] = Field(default_factory=list)
    certifications: List[Any] = Field(default_factory=list)
    career_interest: str
    communication_rating: int
    work_style_pref: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    predictions: Optional[Any] = None
    
    # Embedded data
    internships: List[Internship] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    semester_records: List[SemesterRecord] = Field(default_factory=list)

class Skill(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    name: str

class ExtensionActivityLog(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    user_id: str
    event_type: str
    file_path: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ErrorLog(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    user_id: str
    file_path: str
    error_message: str
    line: int
    source: Optional[str] = None
    error_code: Optional[str] = None
    fingerprint: str
    hint: Optional[str] = None
    corrected_block: Optional[str] = None
    explanation: Optional[str] = None
    gemini_fetched_at: Optional[datetime] = None
    code_context: Optional[str] = None
    resolved_via: Optional[str] = None
    resolved_at: Optional[datetime] = None
    hidden_by_user: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
