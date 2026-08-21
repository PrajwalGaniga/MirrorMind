from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from typing import Any

class InternshipProfile(BaseModel):
    company_name: str
    domain: str
    role: str
    start_date: datetime
    end_date: Optional[datetime] = None
    is_current: int = 0
    certificate_url: Optional[str] = None
    description: Optional[str] = None

class ProjectProfile(BaseModel):
    title: str
    description: str
    github_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    tech_stack: List[str] = []
    thumbnail_url: Optional[str] = None
    certificate_url: Optional[str] = None

class SubjectMarkProfile(BaseModel):
    subject_name: str
    marks_obtained: float
    max_marks: float
    grade: Optional[str] = None

class SemesterRecordProfile(BaseModel):
    semester: int
    sgpa: float
    credits_earned: int
    subjects: List[SubjectMarkProfile] = []

class StudentProfile(BaseModel):
    name: str
    branch: str
    semester: int
    college_tier: str
    cgpa: float = 0.0
    backlog_count: int
    skills: List[str] = []
    certifications: List[str] = []
    career_interest: str
    communication_rating: int
    work_style_pref: str
    
    internships: List[InternshipProfile] = []
    projects: List[ProjectProfile] = []
    semester_records: List[SemesterRecordProfile] = []


class ProfileUpdateRequest(BaseModel):
    """All-optional model for partial profile updates.
    Only the fields that are explicitly provided will be written to MongoDB.
    internships / projects / semester_records are intentionally excluded
    so a scalar-only update never erases array data.
    """
    name: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[int] = None
    college_tier: Optional[str] = None
    cgpa: Optional[float] = None
    backlog_count: Optional[int] = None
    skills: Optional[List[str]] = None
    certifications: Optional[List[Any]] = None
    career_interest: Optional[str] = None
    communication_rating: Optional[int] = None
    work_style_pref: Optional[str] = None
