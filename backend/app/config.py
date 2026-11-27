import os, secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'talentiq.db'}")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "5")) * 1024 * 1024
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "12"))


def _secret() -> str:
    if os.getenv("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    f = DATA_DIR / ".secret_key"
    if not f.exists():
        f.write_text(secrets.token_hex(32))
        try:
            f.chmod(0o600)
        except OSError:
            pass
    return f.read_text().strip()


SECRET_KEY = _secret()
DEMO_PASSWORD = "Demo@1234"
DEMO_RECRUITER = "recruiter@demo.talentiq.ai"
DEMO_CANDIDATE = "candidate@demo.talentiq.ai"
