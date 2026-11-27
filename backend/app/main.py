import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import CORS_ORIGINS
from .db import Base, engine
from . import models  # noqa: F401  (register tables)
from .engine import embedder, parser
from .routers import auth, jobs, resumes, analytics, candidate, demo

log = logging.getLogger("talentiq")
Base.metadata.create_all(engine)

app = FastAPI(title="TalentIQ API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
for r in (auth, jobs, resumes, analytics, candidate, demo):
    app.include_router(r.router)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})


@app.get("/api/health")
def health():
    """Reports which AI components are really active, so the UI never overstates capability."""
    return {"status": "ok", "semantic_engine": embedder.info(), "parser": parser.parser_info()}
