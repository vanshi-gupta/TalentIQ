from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt
from .db import get_db
from .models import User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not cred:
        raise HTTPException(401, "Not authenticated. Please sign in.")
    try:
        data = decode_token(cred.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired. Please sign in again.")
    except Exception:
        raise HTTPException(401, "Invalid token.")
    user = db.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(401, "User no longer exists.")
    return user


def recruiter_only(user: User = Depends(current_user)) -> User:
    if user.role != "recruiter":
        raise HTTPException(403, "This action is only available to recruiters.")
    return user


def candidate_only(user: User = Depends(current_user)) -> User:
    if user.role != "candidate":
        raise HTTPException(403, "This action is only available to candidates.")
    return user
