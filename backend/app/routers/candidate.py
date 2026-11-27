import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import candidate_only
from ..models import User, Resume, Job
from ..engine import parser, matcher, skills as sk, embedder
from .. import services as S

router = APIRouter(prefix="/api/candidate", tags=["candidate"])


class ProfileIn(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    summary: str | None = None
    technical_skills: list[str] | None = None
    soft_skills: list[str] | None = None
    experience_years: float | None = None
    highest_education_level: int | None = None
    certifications: list[str] | None = None
    projects: list[dict] | None = None


def _my_resume(db: Session, user: User) -> Resume | None:
    return db.scalar(select(Resume).where(Resume.owner_id == user.id, Resume.kind == "candidate_profile")
                     .order_by(Resume.id.desc()))


def _need_resume(db, user) -> Resume:
    r = _my_resume(db, user)
    if not r:
        raise HTTPException(404, "Upload your resume first.")
    return r


def _out(r: Resume | None):
    if not r:
        return {"profile": None}
    return {"resume_id": r.id, "filename": r.filename, "uploaded_at": r.created_at.isoformat(), "profile": r.profile,
            "improvements": matcher.improve_resume(r.profile, r.raw_text),
            "parser": parser.parser_info()}


@router.get("/profile")
def profile(user: User = Depends(candidate_only), db: Session = Depends(get_db)):
    return _out(_my_resume(db, user))


@router.post("/resume")
async def upload(file: UploadFile = File(...), user: User = Depends(candidate_only), db: Session = Depends(get_db)):
    data = await file.read()
    try:
        r = S.ingest_resume(db, user, file.filename or "resume", data, "candidate_profile")
    except ValueError as e:
        raise HTTPException(422, str(e))
    for old in db.scalars(select(Resume).where(Resume.owner_id == user.id, Resume.kind == "candidate_profile",
                                               Resume.id != r.id)):
        try:
            os.remove(old.stored_path)
        except OSError:
            pass
        db.delete(old)
    db.commit()
    return _out(r)


@router.put("/profile")
def edit_profile(body: ProfileIn, user: User = Depends(candidate_only), db: Session = Depends(get_db)):
    r = _need_resume(db, user)
    p = dict(r.profile)
    data = body.model_dump(exclude_none=True)
    if "highest_education_level" in data:
        lvl = data["highest_education_level"]
        if not 0 <= lvl <= 5:
            raise HTTPException(422, "Education level must be between 0 and 5.")
        p["highest_education_level"] = lvl
        p["highest_education"] = parser.LEVEL_NAME[lvl]
    if "experience_years" in data:
        if not 0 <= data["experience_years"] <= 60:
            raise HTTPException(422, "Experience must be between 0 and 60 years.")
        p["experience_years"] = data["experience_years"]
    for k in ("name", "email", "phone", "location", "summary", "certifications", "projects"):
        if k in data:
            p[k] = data[k]
    for k in ("technical_skills", "soft_skills"):
        if k in data:
            p[k] = list(dict.fromkeys(sk.normalise(s) for s in data[k] if s.strip()))
    r.profile = p  # reassign so SQLAlchemy detects the JSON change
    db.commit()
    return _out(r)


def _score_all(db, user, r):
    from ..engine.matcher import score_candidate
    jobs = list(db.scalars(select(Job).where(Job.is_open == True).order_by(Job.id)))  # noqa: E712
    out = []
    for j in jobs:
        m = score_candidate(r.profile, r.raw_text, S.job_dict(j))
        out.append({"job": S.job_public(j), "total": m["total"], "category": m["category"],
                    "matched_skills": m["matched_skills"], "missing_skills": m["missing_skills"],
                    "breakdown": m["breakdown"], "explanation": m["explanation"]})
    out.sort(key=lambda x: -x["total"])
    return out


@router.get("/recommendations")
def recommendations(user: User = Depends(candidate_only), db: Session = Depends(get_db)):
    r = _need_resume(db, user)
    return {"engine": embedder.info(), "recommendations": _score_all(db, user, r)}


@router.get("/jobs/{job_id}/gap")
def gap(job_id: int, user: User = Depends(candidate_only), db: Session = Depends(get_db)):
    r = _need_resume(db, user)
    j = db.get(Job, job_id)
    if not j or not j.is_open:
        raise HTTPException(404, "Job not found.")
    m = matcher.score_candidate(r.profile, r.raw_text, S.job_dict(j))
    return {"job": S.job_public(j), "match": m, "skill_gap": matcher.skill_gap(r.profile, S.job_dict(j), m),
            "improvements": matcher.improve_resume(r.profile, r.raw_text, S.job_dict(j), m),
            "engine": embedder.info()}
