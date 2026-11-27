from datetime import datetime
from sqlalchemy import String, Integer, Float, Text, DateTime, ForeignKey, JSON, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


def now():
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(20))  # recruiter | candidate
    settings: Mapped[dict] = mapped_column(JSON, default=dict)  # {blind_mode, weights}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Resume(Base):
    __tablename__ = "resumes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # recruiter_upload | candidate_profile
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(500))
    raw_text: Mapped[str] = mapped_column(Text)
    profile: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    matches = relationship("Match", cascade="all, delete-orphan", back_populates="resume")


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    required_skills: Mapped[list] = mapped_column(JSON, default=list)
    preferred_skills: Mapped[list] = mapped_column(JSON, default=list)
    min_experience: Mapped[float] = mapped_column(Float, default=0)
    education_level: Mapped[int] = mapped_column(Integer, default=0)
    location: Mapped[str] = mapped_column(String(120), default="")
    employment_type: Mapped[str] = mapped_column(String(40), default="Full-time")
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    matches = relationship("Match", cascade="all, delete-orphan", back_populates="job")


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("job_id", "resume_id", name="uq_job_resume"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"), index=True)
    total: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String(30))
    result: Mapped[dict] = mapped_column(JSON)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    job = relationship("Job", back_populates="matches")
    resume = relationship("Resume", back_populates="matches")


class Activity(Base):
    __tablename__ = "activity"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    text: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
