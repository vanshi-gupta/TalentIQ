"""Business logic shared by routers: resume ingestion, matching runs, blind-screening redaction."""
from __future__ import annotations
import re
import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from .config import UPLOAD_DIR, MAX_UPLOAD_BYTES
from .engine import parser, matcher, skills as sk
from .models import User, Resume, Job, Match, Activity


# ------------------------------------------------------------------ activity
def log(db: Session, user_id: int, text: str):
    db.add(Activity(user_id=user_id, text=text[:300]))


# ------------------------------------------------------------------ settings
def weights_for(user: User) -> dict:
    return matcher.normalise_weights((user.settings or {}).get("weights"))


def blind_for(user: User) -> bool:
    return bool((user.settings or {}).get("blind_mode"))


# ------------------------------------------------------------------ resume ingestion
def validate_upload(filename: str, data: bytes):
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ("pdf", "docx"):
        raise ValueError("Unsupported file type. Please upload a PDF or DOCX file.")
    if not data:
        raise ValueError("The file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError(f"File is too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).")
    if ext == "pdf" and not data.startswith(b"%PDF"):
        raise ValueError("File content is not a valid PDF.")
    if ext == "docx" and not data.startswith(b"PK"):
        raise ValueError("File content is not a valid DOCX.")


def ingest_resume(db: Session, owner: User, filename: str, data: bytes, kind: str, internal: bool = False) -> Resume:
    """Validate, extract text, run NLP profile extraction, store file + DB row. Raises ValueError with a
    user-facing message on failure."""
    safe_name = re.sub(r"[^\w.\- ]", "_", Path(filename).name)[:120] or "resume"
    if not internal:
        validate_upload(safe_name, data)
    try:
        text = parser.extract_text(safe_name, data)
    except parser.ResumeParseError as e:
        raise ValueError(str(e))
    profile = parser.parse_resume(text)
    owner_dir = UPLOAD_DIR / str(owner.id)
    owner_dir.mkdir(parents=True, exist_ok=True)
    ext = safe_name.rsplit(".", 1)[-1] if "." in safe_name else "bin"
    stored = owner_dir / f"{uuid.uuid4().hex}.{ext}"
    stored.write_bytes(data)
    try:
        stored.chmod(0o600)
    except OSError:
        pass
    res = Resume(owner_id=owner.id, kind=kind, filename=safe_name, stored_path=str(stored), raw_text=text,
                 profile=profile)
    db.add(res)
    db.flush()
    return res


# ------------------------------------------------------------------ job helpers
def job_dict(j: Job) -> dict:
    return {"title": j.title, "description": j.description, "required_skills": j.required_skills or [],
            "preferred_skills": j.preferred_skills or [], "min_experience": j.min_experience or 0,
            "education_level": j.education_level or 0}


def job_public(j: Job) -> dict:
    return {"id": j.id, **job_dict(j), "education": parser.LEVEL_NAME.get(j.education_level or 0),
            "location": j.location, "employment_type": j.employment_type, "is_open": j.is_open,
            "created_at": j.created_at.isoformat()}


# ------------------------------------------------------------------ matching runs
def _upsert_match(db: Session, job: Job, resume: Resume, user: User) -> Match:
    result = matcher.score_candidate(resume.profile, resume.raw_text, job_dict(job), weights_for(user))
    m = db.scalar(select(Match).where(Match.job_id == job.id, Match.resume_id == resume.id))
    if m is None:
        m = Match(job_id=job.id, resume_id=resume.id, total=result["total"], category=result["category"], result=result)
        db.add(m)
    else:
        m.total, m.category, m.result = result["total"], result["category"], result
    return m


def recruiter_resumes(db: Session, user: User) -> list[Resume]:
    return list(db.scalars(select(Resume).where(Resume.owner_id == user.id, Resume.kind == "recruiter_upload")
                           .order_by(Resume.id)))


def run_matching(db: Session, user: User, jobs: list[Job] | None = None, resumes: list[Resume] | None = None,
                 only_missing: bool = False):
    jobs = jobs if jobs is not None else list(db.scalars(select(Job).where(Job.recruiter_id == user.id)))
    resumes = resumes if resumes is not None else recruiter_resumes(db, user)
    for j in jobs:
        existing = set(db.scalars(select(Match.resume_id).where(Match.job_id == j.id))) if only_missing else set()
        for r in resumes:
            if r.id in existing:
                continue
            _upsert_match(db, j, r, user)
    db.flush()


def own_job(db: Session, user: User, job_id: int) -> Job:
    j = db.get(Job, job_id)
    if not j or j.recruiter_id != user.id:
        raise HTTPException(404, "Job not found.")
    return j


def own_resume(db: Session, user: User, resume_id: int) -> Resume:
    r = db.get(Resume, resume_id)
    if not r or r.owner_id != user.id:
        raise HTTPException(404, "Resume not found.")
    return r


# ------------------------------------------------------------------ blind screening
TITLE_RE = re.compile(r"\b(Mr|Mrs|Ms|Miss|Mx)\.?\s")
_PRON = {"he": "they", "she": "they", "him": "them", "her": "their", "his": "their", "hers": "theirs",
         "himself": "themselves", "herself": "themselves"}
PRONOUN_RE = re.compile(r"\b(he|she|him|her|his|hers|himself|herself)\b", re.I)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"\+?\d[\d\s().-]{8,17}\d")
URL_RE = re.compile(r"(?:https?://)?(?:www\.)?(?:linkedin\.com|github\.com)/\S+", re.I)


def redact(text: str | None, name: str | None) -> str | None:
    if not text:
        return text
    t = EMAIL_RE.sub("[redacted]", text)
    t = URL_RE.sub("[redacted]", t)
    t = PHONE_RE.sub("[redacted]", t)
    if name:
        for part in [p for p in re.split(r"\s+", name) if len(p) > 1]:
            t = re.sub(rf"\b{re.escape(part)}\b", "[redacted]", t, flags=re.I)
    t = TITLE_RE.sub("", t)
    return PRONOUN_RE.sub(lambda m: _PRON[m.group(0).lower()], t)


def _redact_deep(obj, name):
    if isinstance(obj, str):
        return redact(obj, name)
    if isinstance(obj, list):
        return [_redact_deep(x, name) for x in obj]
    if isinstance(obj, dict):
        return {k: _redact_deep(v, name) for k, v in obj.items()}
    return obj


def display_name(resume: Resume, blind: bool) -> str:
    if blind:
        return f"Candidate #{resume.id}"
    return resume.profile.get("name") or Path(resume.filename).stem.replace("_", " ").title()


def public_profile(resume: Resume, blind: bool) -> dict:
    """Profile as shown to recruiters. In blind mode, direct identifiers are removed server-side."""
    p = dict(resume.profile)
    real_name = p.get("name")
    out = {"resume_id": resume.id, "filename": resume.filename, "uploaded_at": resume.created_at.isoformat(),
           "name": display_name(resume, blind), "blind": blind, **{k: v for k, v in p.items() if k != "name"}}
    if blind:
        for k in ("email", "phone", "location"):
            out[k] = None
        out["links"] = []
        out["filename"] = f"resume_{resume.id}"
        for k in ("summary", "experience", "projects", "achievements", "education", "certifications"):
            out[k] = _redact_deep(out.get(k), real_name)
    return out


def blind_match(result: dict, resume: Resume, blind: bool) -> dict:
    if not blind:
        return result
    return _redact_deep(result, resume.profile.get("name"))
