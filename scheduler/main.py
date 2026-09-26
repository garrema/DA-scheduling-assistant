"""Private HTTP boundary: only Express should call this service."""
import os
import secrets
from fastapi import FastAPI, Header, HTTPException, Depends
from models import Problem
from engine import solve, validate

app = FastAPI(title="Deskwise scheduling engine", docs_url=None, redoc_url=None)

def authorized(x_scheduler_key: str = Header(default="")):
    expected = os.environ.get("SCHEDULER_KEY", "")
    if not expected or not secrets.compare_digest(expected, x_scheduler_key):
        raise HTTPException(status_code=401, detail="Invalid service key")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/solve", dependencies=[Depends(authorized)])
def generate(problem: Problem):
    return solve(problem)

@app.post("/validate", dependencies=[Depends(authorized)])
def check(problem: Problem):
    return {"errors": validate(problem)}
