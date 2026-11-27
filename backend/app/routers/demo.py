"""Demo mode: seeds demo accounts, jobs and resumes (all fictional) through the real pipeline."""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import DEMO_PASSWORD, DEMO_RECRUITER, DEMO_CANDIDATE, DATA_DIR
from ..db import get_db
from ..models import User, Job, Resume
from ..security import hash_password, make_token
from ..sample_data import SAMPLE_RESUMES, SAMPLE_JOBS
from ..engine import parser
from .. import services as S
from .auth import user_out

router = APIRouter(prefix="/api/demo", tags=["demo"])
SAMPLES = DATA_DIR / "sample_resumes"


class DemoIn(BaseModel):
    role: str


def _resume_bytes(key: str):
    f = SAMPLES / f"{key}.docx"
    if f.exists():
        return f"{key}.docx", f.read_bytes(), False
    return f"{key}.txt", SAMPLE_RESUMES[key].encode(), True


def _ingest(db, owner, key, kind):
    name, data, _ = _resume_bytes(key)
    return S.ingest_resume(db, owner, name, data, kind, internal=True)


def seed(db: Session):
    rec = db.scalar(select(User).where(User.email == DEMO_RECRUITER))
    if rec is None:
        rec = User(name="Demo Recruiter", email=DEMO_RECRUITER, password_hash=hash_password(DEMO_PASSWORD),
                   role="recruiter", settings={})
        db.add(rec)
        db.flush()
        for jd in SAMPLE_JOBS:
            req = parser.extract_job_requirements(jd["title"], jd["description"])
            db.add(Job(recruiter_id=rec.id, title=jd["title"], description=jd["description"],
                       required_skills=req["required_skills"], preferred_skills=req["preferred_skills"],
                       min_experience=req["min_experience"], education_level=req["education_level"],
                       location=jd["location"], employment_type=jd["employment_type"]))
        db.flush()
        for key in SAMPLE_RESUMES:
            _ingest(db, rec, key, "recruiter_upload")
        S.run_matching(db, rec)
        S.log(db, rec.id, f"Demo data loaded: {len(SAMPLE_JOBS)} jobs, {len(SAMPLE_RESUMES)} resumes screened")
    cand = db.scalar(select(User).where(User.email == DEMO_CANDIDATE))
    if cand is None:
        cand = User(name="Omar Hassan", email=DEMO_CANDIDATE, password_hash=hash_password(DEMO_PASSWORD),
                    role="candidate", settings={})
        db.add(cand)
        db.flush()
        _ingest(db, cand, "omar_hassan", "candidate_profile")
    db.commit()
    return rec, cand


@router.post("/login")
def demo_login(body: DemoIn, db: Session = Depends(get_db)):
    if body.role not in ("recruiter", "candidate"):
        raise HTTPException(422, "Role must be 'recruiter' or 'candidate'.")
    rec, cand = seed(db)
    u = rec if body.role == "recruiter" else cand
    return {"token": make_token(u.id, u.role), "user": user_out(u)}
