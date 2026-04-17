from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import sqlite3, uuid, hashlib, os, secrets

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
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            token TEXT UNIQUE
        );
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            visibility TEXT DEFAULT 'private',
            owner_id TEXT NOT NULL REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS project_collaborators (
            project_id TEXT NOT NULL REFERENCES projects(id),
            user_id TEXT NOT NULL REFERENCES users(id),
            PRIMARY KEY (project_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS commits (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id),
            message TEXT NOT NULL,
            committer_id TEXT REFERENCES users(id),
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


# ── Auth Helpers ─────────────────────────────────────
def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization[7:]
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE token=?", (token,)).fetchone()
    db.close()
    if not user:
        raise HTTPException(401, "Invalid token")
    return dict(user)


def can_access(db, project, user_id: str) -> bool:
    """Read access: public projects are visible to all authenticated users."""
    if project["visibility"] == "public":
        return True
    if project["owner_id"] == user_id:
        return True
    collab = db.execute(
        "SELECT 1 FROM project_collaborators WHERE project_id=? AND user_id=?",
        (project["id"], user_id),
    ).fetchone()
    return collab is not None


def can_write(db, project, user_id: str) -> bool:
    """Write access: only owner and collaborators, regardless of visibility."""
    if project["owner_id"] == user_id:
        return True
    collab = db.execute(
        "SELECT 1 FROM project_collaborators WHERE project_id=? AND user_id=?",
        (project["id"], user_id),
    ).fetchone()
    return collab is not None


def require_owner(project, user_id: str):
    if project["owner_id"] != user_id:
        raise HTTPException(403, "Only the owner can do this")


# ── Pydantic Models ─────────────────────────────────
class AuthIn(BaseModel):
    username: str
    password: str


class ProjectIn(BaseModel):
    name: str
    description: str = ""
    visibility: str = "private"


class SnapshotIn(BaseModel):
    filename: str
    file_hash: str
    storage_path: str
    file_size: int = 0


class CommitIn(BaseModel):
    message: str
    snapshots: List[SnapshotIn]


class CollaboratorIn(BaseModel):
    username: str


# ── Auth Routes ──────────────────────────────────────
@app.post("/api/auth/register")
def register(data: AuthIn):
    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE username=?", (data.username,)).fetchone()
    if existing:
        db.close()
        raise HTTPException(400, "Username already taken")
    uid = str(uuid.uuid4())[:8]
    token = secrets.token_hex(32)
    db.execute(
        "INSERT INTO users(id, username, password_hash, token) VALUES(?,?,?,?)",
        (uid, data.username, hash_password(data.password), token),
    )
    db.commit()
    db.close()
    return {"id": uid, "username": data.username, "token": token}


@app.post("/api/auth/login")
def login(data: AuthIn):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username=?", (data.username,)).fetchone()
    if not user or user["password_hash"] != hash_password(data.password):
        db.close()
        raise HTTPException(401, "Invalid credentials")
    token = secrets.token_hex(32)
    db.execute("UPDATE users SET token=? WHERE id=?", (token, user["id"]))
    db.commit()
    db.close()
    return {"id": user["id"], "username": user["username"], "token": token}


@app.get("/api/auth/me")
def me(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    return {"id": user["id"], "username": user["username"]}


# ── Project Routes ───────────────────────────────────
@app.get("/api/projects")
def list_projects(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    rows = db.execute(
        """SELECT p.* FROM projects p
           WHERE p.owner_id=?
              OR p.visibility='public'
              OR EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id=p.id AND pc.user_id=?)
           ORDER BY p.created_at DESC""",
        (user["id"], user["id"]),
    ).fetchall()
    result = []
    for r in rows:
        cc = db.execute("SELECT COUNT(*) c FROM commits WHERE project_id=?", (r["id"],)).fetchone()["c"]
        result.append({**dict(r), "commit_count": cc, "is_owner": r["owner_id"] == user["id"]})
    db.close()
    return result


@app.post("/api/projects")
def create_project(data: ProjectIn, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    pid = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO projects(id, name, description, visibility, owner_id) VALUES(?,?,?,?,?)",
        (pid, data.name, data.description, data.visibility, user["id"]),
    )
    db.commit()
    db.close()
    return {"id": pid, "name": data.name, "description": data.description, "visibility": data.visibility}


@app.get("/api/projects/{pid}")
def get_project(pid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_access(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "Access denied")

    commits = db.execute(
        """SELECT c.*, u.username as committer_username
           FROM commits c LEFT JOIN users u ON u.id = c.committer_id
           WHERE c.project_id=? ORDER BY c.created_at DESC""", (pid,)
    ).fetchall()
    result_commits = []
    for c in commits:
        snaps = db.execute("SELECT * FROM snapshots WHERE commit_id=?", (c["id"],)).fetchall()
        result_commits.append({**dict(c), "snapshots": [dict(s) for s in snaps]})

    collabs = db.execute(
        """SELECT u.id, u.username FROM users u
           JOIN project_collaborators pc ON pc.user_id=u.id
           WHERE pc.project_id=?""",
        (pid,),
    ).fetchall()

    owner = db.execute("SELECT id, username FROM users WHERE id=?", (p["owner_id"],)).fetchone()
    db.close()
    return {
        **dict(p),
        "commits": result_commits,
        "collaborators": [dict(c) for c in collabs],
        "owner": dict(owner) if owner else None,
        "is_owner": p["owner_id"] == user["id"],
    }


@app.patch("/api/projects/{pid}")
def update_project_visibility(pid: str, data: dict, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    require_owner(p, user["id"])
    visibility = data.get("visibility", p["visibility"])
    if visibility not in ("public", "private"):
        raise HTTPException(400, "visibility must be 'public' or 'private'")
    db.execute("UPDATE projects SET visibility=? WHERE id=?", (visibility, pid))
    db.commit()
    db.close()
    return {"ok": True, "visibility": visibility}


@app.delete("/api/projects/{pid}")
def delete_project(pid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    require_owner(p, user["id"])
    db.execute("DELETE FROM snapshots WHERE commit_id IN (SELECT id FROM commits WHERE project_id=?)", (pid,))
    db.execute("DELETE FROM commits WHERE project_id=?", (pid,))
    db.execute("DELETE FROM project_collaborators WHERE project_id=?", (pid,))
    db.execute("DELETE FROM projects WHERE id=?", (pid,))
    db.commit()
    db.close()
    return {"ok": True}


# ── Collaborator Routes ──────────────────────────────
@app.post("/api/projects/{pid}/collaborators")
def add_collaborator(pid: str, data: CollaboratorIn, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    require_owner(p, user["id"])
    target = db.execute("SELECT * FROM users WHERE username=?", (data.username,)).fetchone()
    if not target:
        db.close()
        raise HTTPException(404, "User not found")
    if target["id"] == p["owner_id"]:
        db.close()
        raise HTTPException(400, "Owner is already a member")
    db.execute(
        "INSERT OR IGNORE INTO project_collaborators(project_id, user_id) VALUES(?,?)",
        (pid, target["id"]),
    )
    db.commit()
    db.close()
    return {"id": target["id"], "username": target["username"]}


@app.delete("/api/projects/{pid}/collaborators/{uid}")
def remove_collaborator(pid: str, uid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    require_owner(p, user["id"])
    db.execute("DELETE FROM project_collaborators WHERE project_id=? AND user_id=?", (pid, uid))
    db.commit()
    db.close()
    return {"ok": True}


# ── Upload Route ─────────────────────────────────────
@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    project_id: str = None,
    authorization: Optional[str] = Header(None),
):
    user = get_current_user(authorization)
    if not project_id:
        raise HTTPException(400, "project_id is required")
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    db.close()
    if not p:
        raise HTTPException(404, "Project not found")
    db2 = get_db()
    write_ok = can_write(db2, p, user["id"])
    db2.close()
    if not write_ok:
        raise HTTPException(403, "You are not a collaborator on this project")
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
def create_commit(pid: str, data: CommitIn, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_write(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "You are not a collaborator on this project")
    cid = str(uuid.uuid4())[:8]
    db.execute("INSERT INTO commits(id, project_id, message, committer_id) VALUES(?,?,?,?)", (cid, pid, data.message, user["id"]))
    for s in data.snapshots:
        sid = str(uuid.uuid4())[:8]
        db.execute(
            "INSERT INTO snapshots(id, commit_id, filename, file_hash, storage_path, file_size) VALUES(?,?,?,?,?,?)",
            (sid, cid, s.filename, s.file_hash, s.storage_path, s.file_size),
        )
    db.commit()
    db.close()
    return {"id": cid, "message": data.message}


# ── Rollback Route ───────────────────────────────────
@app.post("/api/projects/{pid}/rollback/{commit_id}")
def rollback(pid: str, commit_id: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_access(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "Access denied")
    target = db.execute(
        "SELECT created_at FROM commits WHERE id=? AND project_id=?", (commit_id, pid)
    ).fetchone()
    if not target:
        db.close()
        raise HTTPException(404, "Commit not found")
    newer = db.execute(
        "SELECT id FROM commits WHERE project_id=? AND created_at > ?", (pid, target["created_at"])
    ).fetchall()
    for c in newer:
        db.execute("DELETE FROM snapshots WHERE commit_id=?", (c["id"],))
        db.execute("DELETE FROM commits WHERE id=?", (c["id"],))
    db.commit()
    db.close()
    return {"ok": True, "removed": len(newer)}


# ── Diff Route ───────────────────────────────────────
@app.post("/api/diff")
def diff_images(data: dict, authorization: Optional[str] = Header(None)):
    get_current_user(authorization)
    import numpy as np
    from PIL import Image as PILImage
    import io, base64

    path_a = os.path.join(STORAGE, data["path_a"])
    path_b = os.path.join(STORAGE, data["path_b"])
    if not os.path.exists(path_a) or not os.path.exists(path_b):
        raise HTTPException(404, "Image not found")

    img_a = PILImage.open(path_a).convert("RGB")
    img_b = PILImage.open(path_b).convert("RGB")
    size = (max(img_a.width, img_b.width), max(img_a.height, img_b.height))
    img_a = img_a.resize(size)
    img_b = img_b.resize(size)

    arr_a = np.array(img_a, dtype=np.float32)
    arr_b = np.array(img_b, dtype=np.float32)
    diff = np.abs(arr_a - arr_b).mean(axis=2)
    diff_norm = (diff / diff.max() * 255).astype(np.uint8) if diff.max() > 0 else diff.astype(np.uint8)

    heatmap = np.zeros((*diff_norm.shape, 3), dtype=np.uint8)
    heatmap[:, :, 0] = diff_norm
    result = PILImage.fromarray(heatmap)

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    return {"diff_image": f"data:image/png;base64,{encoded}"}


# ── Run ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
