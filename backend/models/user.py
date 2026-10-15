from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRegister(BaseModel):
    name: Optional[str] = None
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str
