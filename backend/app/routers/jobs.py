import csv, io
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user, recruiter_only
from ..models import User, Job, Match, Resume
from ..engine import parser, matcher, skills as sk, embedder
from .. import services as S

router = APIRouter(prefix="/api", tags=["jobs"])


class JobIn(BaseModel):
    title: str
    description: str
    required_skills: list[str] | None = None   # None => extract from description with NLP
    preferred_skills: list[str] | None = None
    min_experience: float | None = None
    education_level: int | None = None
    location: str = ""
    employment_type: str = "Full-time"


class ExtractIn(BaseModel):
    title: str = ""
    description: str


class CompareIn(BaseModel):
    resume_ids: list[int]


def _fill(body: JobIn, job: Job):
    ext = parser.extract_job_requirements(body.title, body.description)
    job.title = body.title.strip()
    job.description = body.description.strip()
    job.required_skills = [sk.normalise(s) for s in body.required_skills] if body.required_skills is not None else ext["required_skills"]
    job.preferred_skills = [sk.normalise(s) for s in body.preferred_skills] if body.preferred_skills is not None else ext["preferred_skills"]
    job.min_experience = body.min_experience if body.min_experience is not None else ext["min_experience"]
    job.education_level = body.education_level if body.education_level is not None else ext["education_level"]
    job.location, job.employment_type = body.location.strip(), body.employment_type


def _validate(body: JobIn):
    if not body.title.strip():
        raise HTTPException(422, "Job title is required.")
    if len(body.description.strip()) < 30:
        raise HTTPException(422, "Please provide a job description (at least 30 characters).")
    if body.education_level is not None and not 0 <= body.education_level <= 5:
        raise HTTPException(422, "Education level must be between 0 and 5.")


@router.post("/jobs/extract")
def extract(body: ExtractIn, user: User = Depends(recruiter_only)):
    """Live NLP preview of requirements found in a description."""
    r = parser.extract_job_requirements(body.title, body.description)
    return {**r, "education": parser.LEVEL_NAME[r["education_level"]]}


@router.get("/jobs")
def list_jobs(user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    jobs = db.scalars(select(Job).where(Job.recruiter_id == user.id).order_by(Job.id.desc()))
    out = []
    for j in jobs:
        ms = list(db.scalars(select(Match).where(Match.job_id == j.id)))
        out.append({**S.job_public(j), "candidates_screened": len(ms),
                    "top_score": max([m.total for m in ms], default=None)})
    return out


@router.post("/jobs")
def create_job(body: JobIn, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    _validate(body)
    j = Job(recruiter_id=user.id, title="", description="")
    _fill(body, j)
    db.add(j)
    db.flush()
    S.run_matching(db, user, jobs=[j])
    S.log(db, user.id, f"Posted job '{j.title}' and screened {len(S.recruiter_resumes(db, user))} resume(s)")
    db.commit()
    return S.job_public(j)


@router.put("/jobs/{job_id}")
def update_job(job_id: int, body: JobIn, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    _validate(body)
    j = S.own_job(db, user, job_id)
    _fill(body, j)
    S.run_matching(db, user, jobs=[j])
    S.log(db, user.id, f"Updated job '{j.title}' and re-ranked candidates")
    db.commit()
    return S.job_public(j)


@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    j = S.own_job(db, user, job_id)
    db.delete(j)
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ ranking
def _ranking_rows(db, user, job, filters=None):
    blind = S.blind_for(user)
    S.run_matching(db, user, jobs=[job], only_missing=True)
    rows = []
    ms = db.execute(select(Match, Resume).join(Resume, Resume.id == Match.resume_id)
                    .where(Match.job_id == job.id, Resume.owner_id == user.id)).all()
    for m, r in ms:
        res = m.result
        p = r.profile
        rows.append({
            "resume_id": r.id, "name": S.display_name(r, blind), "filename": r.filename if not blind else f"resume_{r.id}",
            "total": m.total, "category": m.category, "matched_skills": res["matched_skills"],
            "missing_skills": res["missing_skills"], "experience_years": p.get("experience_years", 0),
            "education": p.get("highest_education", "Not specified"),
            "education_level": p.get("highest_education_level", 0), "skills": p.get("technical_skills", []),
            "breakdown": res["breakdown"]})
    f = filters or {}
    if f.get("min_score") is not None:
        rows = [x for x in rows if x["total"] >= f["min_score"]]
    if f.get("min_exp") is not None:
        rows = [x for x in rows if x["experience_years"] >= f["min_exp"]]
    if f.get("min_edu"):
        rows = [x for x in rows if x["education_level"] >= f["min_edu"]]
    if f.get("skills"):
        want = [sk.normalise(s) for s in f["skills"]]
        rows = [x for x in rows if all(w in x["skills"] for w in want)]
    if f.get("category"):
        rows = [x for x in rows if x["category"] == f["category"]]
    rows.sort(key=lambda x: -x["total"])
    for i, x in enumerate(rows, 1):
        x["rank"] = i
    return rows


@router.get("/jobs/{job_id}/ranking")
def ranking(job_id: int, min_score: float | None = None, min_exp: float | None = None, min_edu: int | None = None,
            skills: str | None = None, category: str | None = None,
            user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    job = S.own_job(db, user, job_id)
    rows = _ranking_rows(db, user, job, {"min_score": min_score, "min_exp": min_exp, "min_edu": min_edu,
                                         "skills": [s for s in (skills or "").split(",") if s.strip()],
                                         "category": category})
    db.commit()
    return {"job": S.job_public(job), "weights": S.weights_for(user), "blind_mode": S.blind_for(user),
            "engine": embedder.info(), "total_candidates": len(S.recruiter_resumes(db, user)), "candidates": rows}


def _match_for(db, user, job, resume_id):
    r = S.own_resume(db, user, resume_id)
    m = db.scalar(select(Match).where(Match.job_id == job.id, Match.resume_id == r.id))
    if not m:
        m = S._upsert_match(db, job, r, user)
    return r, m


@router.get("/jobs/{job_id}/report/{resume_id}")
def report(job_id: int, resume_id: int, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    job = S.own_job(db, user, job_id)
    r, m = _match_for(db, user, job, resume_id)
    blind = S.blind_for(user)
    res = S.blind_match(m.result, r, blind)
    gap = matcher.skill_gap(r.profile, S.job_dict(job), m.result)
    db.commit()
    return {"candidate": S.public_profile(r, blind), "job": S.job_public(job), "match": res, "skill_gap": gap,
            "weights": S.weights_for(user), "engine": embedder.info(),
            "fairness_note": "Name, age, gender, religion, caste, photo and location are never used in scoring."}


@router.get("/jobs/{job_id}/interview/{resume_id}")
def interview(job_id: int, resume_id: int, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    job = S.own_job(db, user, job_id)
    r, m = _match_for(db, user, job, resume_id)
    qs = matcher.interview_questions(r.profile, S.job_dict(job), m.result)
    db.commit()
    return S._redact_deep(qs, r.profile.get("name")) if S.blind_for(user) else qs


@router.post("/jobs/{job_id}/compare")
def compare(job_id: int, body: CompareIn, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    if not 2 <= len(body.resume_ids) <= 3:
        raise HTTPException(422, "Select two or three candidates to compare.")
    job = S.own_job(db, user, job_id)
    blind = S.blind_for(user)
    out = []
    for rid in dict.fromkeys(body.resume_ids):
        r, m = _match_for(db, user, job, rid)
        prof = S.public_profile(r, blind)
        out.append({"profile": prof, "total": m.total, "category": m.category,
                    "breakdown": m.result["breakdown"], "matched_skills": m.result["matched_skills"],
                    "missing_skills": m.result["missing_skills"],
                    "skill_gap": matcher.skill_gap(r.profile, S.job_dict(job), m.result)})
    db.commit()
    return {"job": S.job_public(job), "candidates": out}


# ------------------------------------------------------------------ export
@router.get("/jobs/{job_id}/export")
def export(job_id: int, format: str = Query("csv", pattern="^(csv|pdf)$"), user: User = Depends(recruiter_only),
           db: Session = Depends(get_db)):
    job = S.own_job(db, user, job_id)
    rows = _ranking_rows(db, user, job)
    db.commit()
    slug = "".join(c if c.isalnum() else "_" for c in job.title)[:40]
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["Rank", "Candidate", "Score %", "Category", "Matched skills", "Missing skills", "Experience (yrs)",
                    "Education", "Skills score", "Experience score", "Education score", "Semantic score"])
        for x in rows:
            b = x["breakdown"]
            w.writerow([x["rank"], x["name"], x["total"], x["category"], "; ".join(x["matched_skills"]),
                        "; ".join(x["missing_skills"]), x["experience_years"], x["education"], b["skills"]["score"],
                        b["experience"]["score"], b["education"]["score"], b["semantic"]["score"]])
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="talentiq_{slug}.csv"'})
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=28, rightMargin=28, topMargin=28, bottomMargin=28)
    st = getSampleStyleSheet()
    small = st["BodyText"].clone("small", fontSize=8, leading=10)
    el = [Paragraph(f"TalentIQ Screening Report: {job.title}", st["Title"]),
          Paragraph(f"Weights: " + ", ".join(f"{k} {v*100:.0f}%" for k, v in S.weights_for(user).items()) +
                    f" &nbsp;|&nbsp; Engine: {embedder.info()['engine']}" +
                    (" &nbsp;|&nbsp; Blind screening ON" if S.blind_for(user) else ""), st["Normal"]), Spacer(1, 10)]
    data = [["#", "Candidate", "Score", "Category", "Matched skills", "Missing skills", "Exp", "Education"]]
    for x in rows:
        data.append([x["rank"], Paragraph(x["name"], small), f"{x['total']}%", x["category"],
                     Paragraph(", ".join(x["matched_skills"]) or "-", small),
                     Paragraph(", ".join(x["missing_skills"]) or "-", small), x["experience_years"], x["education"]])
    t = Table(data, repeatRows=1, colWidths=[24, 110, 44, 80, 220, 200, 34, 70])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b4cca")),
                           ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTSIZE", (0, 0), (-1, -1), 8),
                           ("GRID", (0, 0), (-1, -1), 0.25, colors.grey), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f4ff")])]))
    el.append(t)
    doc.build(el)
    return Response(buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="talentiq_{slug}.pdf"'})
