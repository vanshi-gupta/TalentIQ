from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user, recruiter_only
from ..models import User
from ..security import hash_password, verify_password, make_token, valid_email
from ..engine import matcher
from .. import services

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str
    role: str


class LoginIn(BaseModel):
    email: str
    password: str


class SettingsIn(BaseModel):
    blind_mode: bool | None = None
    weights: dict[str, float] | None = None


def user_out(u: User) -> dict:
    s = u.settings or {}
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role,
            "settings": {"blind_mode": bool(s.get("blind_mode")), "weights": matcher.normalise_weights(s.get("weights"))}}


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if body.role not in ("recruiter", "candidate"):
        raise HTTPException(422, "Role must be 'recruiter' or 'candidate'.")
    email = body.email.strip().lower()
    if not valid_email(email):
        raise HTTPException(422, "Please enter a valid email address.")
    if len(body.password) < 8:
        raise HTTPException(422, "Password must be at least 8 characters.")
    if not body.name.strip():
        raise HTTPException(422, "Name is required.")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists.")
    u = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password), role=body.role,
             settings={})
    db.add(u)
    db.commit()
    return {"token": make_token(u.id, u.role), "user": user_out(u)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Incorrect email or password.")
    return {"token": make_token(u.id, u.role), "user": user_out(u)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@router.put("/settings")
def update_settings(body: SettingsIn, user: User = Depends(recruiter_only), db: Session = Depends(get_db)):
    s = dict(user.settings or {})
    weights_changed = False
    if body.blind_mode is not None:
        s["blind_mode"] = body.blind_mode
    if body.weights is not None:
        if any(v < 0 for v in body.weights.values()):
            raise HTTPException(422, "Weights cannot be negative.")
        if sum(body.weights.values()) <= 0:
            raise HTTPException(422, "At least one weight must be greater than zero.")
        s["weights"] = matcher.normalise_weights(body.weights)
        weights_changed = True
    user.settings = s
    db.flush()
    if weights_changed:
        services.run_matching(db, user)  # re-score everything with the new weights
        services.log(db, user.id, "Updated scoring weights and re-ranked all candidates")
    db.commit()
    return user_out(user)
