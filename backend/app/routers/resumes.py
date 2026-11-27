from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import recruiter_only
from ..models import User, Resume
from .. import services as S
import os

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


@router.get("")
def list_resumes(user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    blind = S.blind_for(user)
    return {"blind_mode": blind, "resumes": [S.public_profile(r, blind) for r in S.recruiter_resumes(db, user)][::-1]}


@router.post("/upload")
async def upload(files: list[UploadFile] = File(...), user: User = Depends(recruiter_only),
                 db: Session = Depends(get_db)):
    results, created = [], []
    for f in files:
        data = await f.read()
        try:
            r = S.ingest_resume(db, user, f.filename or "resume", data, "recruiter_upload")
            created.append(r)
            results.append({"filename": f.filename, "status": "processed", "resume_id": r.id,
                            "name": S.display_name(r, S.blind_for(user)),
                            "skills_found": len(r.profile["technical_skills"])})
        except ValueError as e:
            results.append({"filename": f.filename, "status": "failed", "error": str(e)})
    if created:
        S.run_matching(db, user, resumes=created)  # screen new resumes against every job
        S.log(db, user.id, f"Uploaded and screened {len(created)} resume(s)")
    db.commit()
    return {"processed": len(created), "failed": len(results) - len(created), "results": results}


@router.get("/{resume_id}")
def get_resume(resume_id: int, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    return S.public_profile(S.own_resume(db, user, resume_id), S.blind_for(user))


@router.get("/{resume_id}/file")
def get_file(resume_id: int, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    r = S.own_resume(db, user, resume_id)  # 404 unless it belongs to this recruiter
    if S.blind_for(user):
        from fastapi import HTTPException
        raise HTTPException(403, "Original files are hidden in blind screening mode (they contain identifying details).")
    if not os.path.exists(r.stored_path):
        from fastapi import HTTPException
        raise HTTPException(404, "Stored file is missing.")
    return FileResponse(r.stored_path, filename=r.filename)


@router.delete("/{resume_id}")
def delete_resume(resume_id: int, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    r = S.own_resume(db, user, resume_id)
    try:
        os.remove(r.stored_path)
    except OSError:
        pass
    db.delete(r)
    S.log(db, user.id, "Deleted a resume")
    db.commit()
    return {"ok": True}
