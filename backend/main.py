from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List
import sqlite3
import uuid
import hashlib
import os
from PIL import Image

# ── App ──────────────────────────────────────────────
app = FastAPI(title="MediaGit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Storage ──────────────────────────────────────────
STORAGE = "storage"
SNAPS = f"{STORAGE}/snapshots"
os.makedirs(SNAPS, exist_ok=True)

app.mount("/storage", StaticFiles(directory=STORAGE), name="storage")

# ── Database ─────────────────────────────────────────
DB_PATH = "mediagit.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS commits (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id),
            message TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS snapshots (
            id TEXT PRIMARY KEY,
            commit_id TEXT NOT NULL REFERENCES commits(id),
            filename TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            file_size INTEGER DEFAULT 0
        );
    """)
    db.commit()
    db.close()


init_db()


# ── Pydantic Models ─────────────────────────────────
class ProjectIn(BaseModel):
    name: str
    description: str = ""


class SnapshotIn(BaseModel):
    filename: str
    file_hash: str
    storage_path: str
    file_size: int = 0


class CommitIn(BaseModel):
    message: str
    snapshots: List[SnapshotIn]



# ── Project Routes ───────────────────────────────────
@app.get("/api/projects")
def list_projects():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM projects ORDER BY created_at DESC"
    ).fetchall()
    result = []
    for r in rows:
        cc = db.execute(
            "SELECT COUNT(*) c FROM commits WHERE project_id=?", (r["id"],)
        ).fetchone()["c"]
        result.append({**dict(r), "commit_count": cc})
    db.close()
    return result


@app.post("/api/projects")
def create_project(data: ProjectIn):
    db = get_db()
    pid = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO projects(id, name, description) VALUES(?,?,?)",
        (pid, data.name, data.description),
    )
    db.commit()
    db.close()
    return {"id": pid, "name": data.name, "description": data.description}


@app.get("/api/projects/{pid}")
def get_project(pid: str):
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")

    commits = db.execute(
        "SELECT * FROM commits WHERE project_id=? ORDER BY created_at DESC",
        (pid,),
    ).fetchall()

    result_commits = []
    for c in commits:
        snaps = db.execute(
            "SELECT * FROM snapshots WHERE commit_id=?", (c["id"],)
        ).fetchall()
        result_commits.append({**dict(c), "snapshots": [dict(s) for s in snaps]})

    db.close()
    return {**dict(p), "commits": result_commits}


@app.delete("/api/projects/{pid}")
def delete_project(pid: str):
    db = get_db()
    db.execute(
        "DELETE FROM snapshots WHERE commit_id IN "
        "(SELECT id FROM commits WHERE project_id=?)",
        (pid,),
    )
    db.execute("DELETE FROM commits WHERE project_id=?", (pid,))
    db.execute("DELETE FROM projects WHERE id=?", (pid,))
    db.commit()
    db.close()
    return {"ok": True}


# ── Upload Route ─────────────────────────────────────
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()[:16]
    ext = os.path.splitext(file.filename)[1].lower()
    storage_filename = f"{file_hash}{ext}"
    storage_path = os.path.join(SNAPS, storage_filename)

    with open(storage_path, "wb") as f:
        f.write(content)

    return {
        "filename": file.filename,
        "file_hash": file_hash,
        "storage_path": f"snapshots/{storage_filename}",
        "file_size": len(content),
    }


# ── Commit Route ─────────────────────────────────────
@app.post("/api/projects/{pid}/commits")
def create_commit(pid: str, data: CommitIn):
    db = get_db()
    p = db.execute("SELECT id FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")

    cid = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO commits(id, project_id, message) VALUES(?,?,?)",
        (cid, pid, data.message),
    )
    for s in data.snapshots:
        sid = str(uuid.uuid4())[:8]
        db.execute(
            "INSERT INTO snapshots(id, commit_id, filename, file_hash, storage_path, file_size) "
            "VALUES(?,?,?,?,?,?)",
            (sid, cid, s.filename, s.file_hash, s.storage_path, s.file_size),
        )
    db.commit()
    db.close()
    return {"id": cid, "message": data.message}


# ── Rollback Route ───────────────────────────────────
@app.post("/api/projects/{pid}/rollback/{commit_id}")
def rollback(pid: str, commit_id: str):
    """Delete all commits newer than the given commit."""
    db = get_db()
    target = db.execute(
        "SELECT created_at FROM commits WHERE id=? AND project_id=?",
        (commit_id, pid),
    ).fetchone()
    if not target:
        db.close()
        raise HTTPException(404, "Commit not found")

    newer = db.execute(
        "SELECT id FROM commits WHERE project_id=? AND created_at > ?",
        (pid, target["created_at"]),
    ).fetchall()

    for c in newer:
        db.execute("DELETE FROM snapshots WHERE commit_id=?", (c["id"],))
        db.execute("DELETE FROM commits WHERE id=?", (c["id"],))

    db.commit()
    db.close()
    return {"ok": True, "removed": len(newer)}


# ── Run ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
