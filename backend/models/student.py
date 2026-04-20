from pydantic import BaseModel
from typing import List, Optional


class StudentProfile(BaseModel):
    name: str
    branch: str
    cgpa: float
    semester: int
    college_tier: str
    backlog_count: int
    skills: List[str]
    certifications: List[str]
    projects_count: int
    internship_count: int
    internship_domain: Optional[str] = None
    career_interest: str
    communication_rating: int
    work_style_pref: str
