import hashlib, hmac, os, re
from datetime import datetime, timedelta, timezone
import jwt
from .config import SECRET_KEY, TOKEN_HOURS

_ITER = 240_000


def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, _ITER)
    return f"pbkdf2${_ITER}${salt.hex()}${dk.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, it, salt, dk = stored.split("$")
        new = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(new.hex(), dk)
    except Exception:
        return False


def make_token(user_id: int, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": exp}, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def valid_email(e: str) -> bool:
    return bool(EMAIL_RE.match(e))
