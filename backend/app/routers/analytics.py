from collections import Counter
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import recruiter_only
from ..models import User, Job, Match, Resume, Activity
from ..engine import embedder
from .. import services as S

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
def analytics(user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    blind = S.blind_for(user)
    S.run_matching(db, user, only_missing=True)
    db.commit()
    resumes = S.recruiter_resumes(db, user)
    jobs = list(db.scalars(select(Job).where(Job.recruiter_id == user.id)))
    rid = {r.id: r for r in resumes}
    jid = {j.id: j for j in jobs}
    matches = [m for m in db.scalars(select(Match).where(Match.job_id.in_(list(jid) or [0])))
               if m.resume_id in rid]

    best: dict[int, Match] = {}
    for m in matches:
        if m.resume_id not in best or m.total > best[m.resume_id].total:
            best[m.resume_id] = m
    top = sorted(best.values(), key=lambda m: -m.total)[:5]
    buckets = [0] * 10
    for m in matches:
        buckets[min(9, int(m.total // 10))] += 1
    cats = Counter(m.category for m in matches)
    demand = Counter(s for j in jobs for s in (j.required_skills or []) + (j.preferred_skills or []))
    have = Counter(s for r in resumes for s in r.profile.get("technical_skills", []))
    edu = Counter(r.profile.get("highest_education", "Not specified") for r in resumes)
    acts = db.scalars(select(Activity).where(Activity.user_id == user.id).order_by(Activity.id.desc()).limit(8))
    per_job = []
    for j in jobs:
        ms = sorted([m for m in matches if m.job_id == j.id], key=lambda m: -m.total)
        per_job.append({"job_id": j.id, "title": j.title, "candidates": len(ms),
                        "avg": round(sum(m.total for m in ms) / len(ms), 1) if ms else 0,
                        "top": [{"name": S.display_name(rid[m.resume_id], blind), "score": m.total} for m in ms[:5]]})
    scores = [m.total for m in matches]
    return {
        "totals": {"resumes": len(resumes), "jobs": len(jobs), "screened": len(best),
                   "avg_score": round(sum(scores) / len(scores), 1) if scores else 0},
        "top_candidates": [{"resume_id": m.resume_id, "name": S.display_name(rid[m.resume_id], blind),
                            "score": m.total, "category": m.category, "job": jid[m.job_id].title} for m in top],
        "recent_activity": [{"text": a.text, "at": a.created_at.isoformat()} for a in acts],
        "category_distribution": [{"name": c, "value": cats.get(c, 0)} for c in
                                  ["Excellent Match", "Strong Match", "Moderate Match", "Low Match"]],
        "score_distribution": [{"range": f"{i*10}-{i*10+10}", "count": buckets[i]} for i in range(10)],
        "skill_demand": [{"skill": s, "count": c} for s, c in demand.most_common(12)],
        "candidate_skills": [{"skill": s, "count": c} for s, c in have.most_common(12)],
        "qualifications": [{"name": k, "value": v} for k, v in edu.items()],
        "pipeline": [
            {"stage": "Uploaded", "count": len(resumes)},
            {"stage": "Screened", "count": len(best)},
            {"stage": "Shortlist (best >= 65%)", "count": sum(1 for m in best.values() if m.total >= 65)},
            {"stage": "Excellent (best >= 80%)", "count": sum(1 for m in best.values() if m.total >= 80)}],
        "per_job": per_job,
        "engine": embedder.info(),
    }
