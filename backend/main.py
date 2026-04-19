import hashlib
import os
import re
import secrets
import sqlite3
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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
            id          TEXT PRIMARY KEY,
            username    TEXT NOT NULL UNIQUE,
            email       TEXT NOT NULL UNIQUE,
            full_name   TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            token       TEXT UNIQUE,
            created_at  TEXT DEFAULT (datetime('now'))
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
            src_branch_id TEXT REFERENCES branches(id),
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
        CREATE TABLE IF NOT EXISTS branches (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id),
            name TEXT NOT NULL,
            owner_id TEXT NOT NULL REFERENCES users(id),
            base_commit_id TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS branch_commits (
            id TEXT PRIMARY KEY,
            branch_id TEXT NOT NULL REFERENCES branches(id),
            message TEXT NOT NULL,
            committer_id TEXT REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS branch_snapshots (
            id TEXT PRIMARY KEY,
            branch_commit_id TEXT NOT NULL REFERENCES branch_commits(id),
            filename TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            file_size INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS pull_requests (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id),
            branch_id TEXT NOT NULL REFERENCES branches(id),
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            created_by TEXT NOT NULL REFERENCES users(id),
            status TEXT DEFAULT 'open',
            reviewed_by TEXT REFERENCES users(id),
            review_note TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            reviewed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT DEFAULT '',
            link TEXT DEFAULT '',
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS project_payments (
            id          TEXT PRIMARY KEY,
            project_id  TEXT NOT NULL REFERENCES projects(id),
            user_id     TEXT NOT NULL REFERENCES users(id),
            amount      REAL NOT NULL DEFAULT 0.0,
            paid_at     TEXT DEFAULT (datetime('now')),
            UNIQUE(project_id, user_id)
        );
    """)
    # Migrate: add price column if it doesn't exist yet
    try:
        db.execute("ALTER TABLE projects ADD COLUMN price REAL DEFAULT 0.0")
    except Exception:
        pass  # column already exists
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
class RegisterIn(BaseModel):
    username: str
    email: str
    full_name: str
    password: str


class LoginIn(BaseModel):
    login: str  # accepts username OR email
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


class BranchIn(BaseModel):
    name: str
    base_commit_id: Optional[str] = None


class BranchCommitIn(BaseModel):
    message: str
    snapshots: List[SnapshotIn]


class PullRequestIn(BaseModel):
    title: str
    description: str = ""


class PRReviewIn(BaseModel):
    action: str  # "approve" or "reject"
    note: str = ""


# ── Auth Routes ──────────────────────────────────────
@app.post("/api/auth/register")
def register(data: RegisterIn):
    # Basic validation
    username = data.username.strip()
    email = data.email.strip().lower()
    full_name = data.full_name.strip()
    password = data.password

    if not username or not email or not full_name or not password:
        raise HTTPException(400, "All fields are required")
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if (
        not re.match(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?$", username)
        and len(username) > 1
    ):
        raise HTTPException(
            400, "Username may only contain alphanumeric characters or single hyphens"
        )
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        raise HTTPException(400, "Invalid email address")

    db = get_db()
    if db.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone():
        db.close()
        raise HTTPException(400, "Username already taken")
    if db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone():
        db.close()
        raise HTTPException(400, "Email already registered")

    uid = str(uuid.uuid4())[:8]
    token = secrets.token_hex(32)
    db.execute(
        "INSERT INTO users(id, username, email, full_name, password_hash, token) VALUES(?,?,?,?,?,?)",
        (uid, username, email, full_name, hash_password(password), token),
    )
    db.commit()
    db.close()
    return {
        "id": uid,
        "username": username,
        "email": email,
        "full_name": full_name,
        "token": token,
    }


@app.post("/api/auth/login")
def login(data: LoginIn):
    identifier = data.login.strip()
    db = get_db()
    # Try username first, then email
    user = db.execute("SELECT * FROM users WHERE username=?", (identifier,)).fetchone()
    if not user:
        user = db.execute(
            "SELECT * FROM users WHERE email=?", (identifier.lower(),)
        ).fetchone()
    if not user or user["password_hash"] != hash_password(data.password):
        db.close()
        raise HTTPException(401, "Invalid credentials")
    token = secrets.token_hex(32)
    db.execute("UPDATE users SET token=? WHERE id=?", (token, user["id"]))
    db.commit()
    db.close()
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "full_name": user["full_name"],
        "token": token,
    }


@app.get("/api/auth/me")
def me(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "full_name": user["full_name"],
    }


# ── Project Routes ───────────────────────────────────
@app.get("/api/projects")
def list_projects(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    rows = db.execute(
        """SELECT p.* FROM projects p
           WHERE p.owner_id=?
              OR p.visibility='public'
              OR (p.price IS NOT NULL AND p.price > 0)
              OR EXISTS (
                  SELECT 1 FROM project_collaborators pc
                  WHERE pc.project_id=p.id AND pc.user_id=?
              )
           ORDER BY p.created_at DESC""",
        (user["id"], user["id"]),
    ).fetchall()
    result = []
    for r in rows:
        cc = db.execute(
            "SELECT COUNT(*) c FROM commits WHERE project_id=?", (r["id"],)
        ).fetchone()["c"]
        price = float(r["price"] or 0)
        is_owner = r["owner_id"] == user["id"]
        is_collab = (
            db.execute(
                "SELECT 1 FROM project_collaborators WHERE project_id=? AND user_id=?",
                (r["id"], user["id"]),
            ).fetchone()
            is not None
        )
        has_paid = (
            db.execute(
                "SELECT 1 FROM project_payments WHERE project_id=? AND user_id=?",
                (r["id"], user["id"]),
            ).fetchone()
            is not None
        )
        is_gated = price > 0 and not is_owner and not is_collab and not has_paid
        result.append(
            {
                **dict(r),
                "commit_count": cc,
                "is_owner": is_owner,
                "price": price,
                "is_gated": is_gated,
                "has_paid": has_paid,
            }
        )
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
    return {
        "id": pid,
        "name": data.name,
        "description": data.description,
        "visibility": data.visibility,
    }


@app.get("/api/projects/{pid}")
def get_project(pid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")

    price = float(p["price"] or 0)
    is_owner = p["owner_id"] == user["id"]
    is_collab = (
        db.execute(
            "SELECT 1 FROM project_collaborators WHERE project_id=? AND user_id=?",
            (pid, user["id"]),
        ).fetchone()
        is not None
    )
    has_paid = (
        db.execute(
            "SELECT 1 FROM project_payments WHERE project_id=? AND user_id=?",
            (pid, user["id"]),
        ).fetchone()
        is not None
    )

    # ── Paywall gate ─────────────────────────────────────────────────────
    if price > 0 and not is_owner and not is_collab and not has_paid:
        owner = db.execute(
            "SELECT id, username FROM users WHERE id=?", (p["owner_id"],)
        ).fetchone()
        db.close()
        return {
            "id": p["id"],
            "name": p["name"],
            "description": p["description"],
            "visibility": p["visibility"],
            "price": price,
            "gated": True,
            "owner": dict(owner) if owner else None,
            "created_at": p["created_at"],
            "is_owner": False,
        }

    # ── Normal access gate ───────────────────────────────────────────────
    if not is_owner and not is_collab and not has_paid:
        if not can_access(db, p, user["id"]):
            db.close()
            raise HTTPException(403, "Access denied")

    commits = db.execute(
        """SELECT c.*, u.username as committer_username
           FROM commits c LEFT JOIN users u ON u.id = c.committer_id
           WHERE c.project_id=? ORDER BY c.created_at DESC, c.rowid DESC""",
        (pid,),
    ).fetchall()
    result_commits = []
    for c in commits:
        snaps = db.execute(
            "SELECT * FROM snapshots WHERE commit_id=?", (c["id"],)
        ).fetchall()
        result_commits.append({**dict(c), "snapshots": [dict(s) for s in snaps]})

    collabs = db.execute(
        """SELECT u.id, u.username FROM users u
           JOIN project_collaborators pc ON pc.user_id=u.id
           WHERE pc.project_id=?""",
        (pid,),
    ).fetchall()

    owner = db.execute(
        "SELECT id, username FROM users WHERE id=?", (p["owner_id"],)
    ).fetchone()
    db.close()
    return {
        **dict(p),
        "commits": result_commits,
        "collaborators": [dict(c) for c in collabs],
        "owner": dict(owner) if owner else None,
        "is_owner": is_owner,
        "price": price,
        "gated": False,
    }


@app.patch("/api/projects/{pid}")
def update_project(pid: str, data: dict, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    require_owner(p, user["id"])

    if "visibility" in data:
        visibility = data["visibility"]
        if visibility not in ("public", "private"):
            db.close()
            raise HTTPException(400, "visibility must be 'public' or 'private'")
        db.execute("UPDATE projects SET visibility=? WHERE id=?", (visibility, pid))

    if "price" in data:
        try:
            price_val = float(data["price"])
        except (TypeError, ValueError):
            db.close()
            raise HTTPException(400, "price must be a number")
        if price_val < 0:
            db.close()
            raise HTTPException(400, "price must be non-negative")
        db.execute("UPDATE projects SET price=? WHERE id=?", (price_val, pid))

    db.commit()
    db.close()
    return {"ok": True}


@app.post("/api/projects/{pid}/pay")
def pay_for_project(pid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    price = float(p["price"] or 0)
    if price <= 0:
        db.close()
        raise HTTPException(400, "This project has no paywall")
    if p["owner_id"] == user["id"]:
        db.close()
        raise HTTPException(400, "You are the owner of this project")
    # Check if already paid
    existing = db.execute(
        "SELECT 1 FROM project_payments WHERE project_id=? AND user_id=?",
        (pid, user["id"]),
    ).fetchone()
    if existing:
        db.close()
        return {"ok": True, "already_paid": True, "amount": price}
    pay_id = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO project_payments(id, project_id, user_id, amount) VALUES(?,?,?,?)",
        (pay_id, pid, user["id"], price),
    )
    db.commit()
    db.close()
    return {"ok": True, "already_paid": False, "amount": price}


@app.delete("/api/projects/{pid}")
def delete_project(pid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    require_owner(p, user["id"])
    # Delete branch data first
    db.execute(
        "DELETE FROM branch_snapshots WHERE branch_commit_id IN (SELECT id FROM branch_commits WHERE branch_id IN (SELECT id FROM branches WHERE project_id=?))",
        (pid,),
    )
    db.execute(
        "DELETE FROM branch_commits WHERE branch_id IN (SELECT id FROM branches WHERE project_id=?)",
        (pid,),
    )
    db.execute("DELETE FROM pull_requests WHERE project_id=?", (pid,))
    db.execute("DELETE FROM branches WHERE project_id=?", (pid,))
    # Delete main commit data
    db.execute(
        "DELETE FROM snapshots WHERE commit_id IN (SELECT id FROM commits WHERE project_id=?)",
        (pid,),
    )
    db.execute("DELETE FROM commits WHERE project_id=?", (pid,))
    db.execute("DELETE FROM project_collaborators WHERE project_id=?", (pid,))
    db.execute("DELETE FROM projects WHERE id=?", (pid,))
    db.commit()
    db.close()
    return {"ok": True}


# ── Collaborator Routes ──────────────────────────────
@app.post("/api/projects/{pid}/collaborators")
def add_collaborator(
    pid: str, data: CollaboratorIn, authorization: Optional[str] = Header(None)
):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    require_owner(p, user["id"])
    target = db.execute(
        "SELECT * FROM users WHERE username=?", (data.username,)
    ).fetchone()
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
def remove_collaborator(
    pid: str, uid: str, authorization: Optional[str] = Header(None)
):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    require_owner(p, user["id"])
    db.execute(
        "DELETE FROM project_collaborators WHERE project_id=? AND user_id=?", (pid, uid)
    )
    db.commit()
    db.close()
    return {"ok": True}


# ── Upload Route ─────────────────────────────────────
@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    project_id: Optional[str] = None,
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
def create_commit(
    pid: str, data: CommitIn, authorization: Optional[str] = Header(None)
):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_write(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "You are not a collaborator on this project")
    # The frontend sends the full snapshot list for the new commit (it handles
    # carrying forward unchanged files and excluding staged removals itself).
    # We simply save exactly what was sent.
    merged_snapshots = {s.filename: s for s in data.snapshots}

    cid = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO commits(id, project_id, message, committer_id) VALUES(?,?,?,?)",
        (cid, pid, data.message, user["id"]),
    )
    for s in merged_snapshots.values():
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
        "SELECT created_at, rowid FROM commits WHERE id=? AND project_id=?",
        (commit_id, pid),
    ).fetchone()
    if not target:
        db.close()
        raise HTTPException(404, "Commit not found")
    newer = db.execute(
        """SELECT id FROM commits
           WHERE project_id=? AND (
             created_at > ?
             OR (created_at = ? AND rowid > ?)
           )""",
        (pid, target["created_at"], target["created_at"], target["rowid"]),
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
    import base64
    import io

    import numpy as np
    from PIL import Image as PILImage

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
    diff_norm = (
        (diff / diff.max() * 255).astype(np.uint8)
        if diff.max() > 0
        else diff.astype(np.uint8)
    )

    heatmap = np.zeros((*diff_norm.shape, 3), dtype=np.uint8)
    heatmap[:, :, 0] = diff_norm
    result = PILImage.fromarray(heatmap)

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    return {"diff_image": f"data:image/png;base64,{encoded}"}


# ── Graph / Timeline Routes ──────────────────────────


@app.get("/api/projects/{pid}/timeline")
def get_project_timeline(pid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_access(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "Access denied")

    # 1. Fetch all main commits
    main_commits = db.execute(
        """SELECT c.*, u.username as committer_username, 'main' as branch_name, 'main' as branch_id
           FROM commits c LEFT JOIN users u ON u.id = c.committer_id
           WHERE c.project_id=? ORDER BY c.created_at DESC, c.rowid DESC""",
        (pid,),
    ).fetchall()

    main_commits_list = []
    for c in main_commits:
        cdict = dict(c)
        snaps = db.execute(
            "SELECT * FROM snapshots WHERE commit_id=?", (cdict["id"],)
        ).fetchall()
        cdict["snapshots"] = [dict(s) for s in snaps]
        main_commits_list.append(cdict)

    # 2. Fetch all branch commits
    branch_commits = db.execute(
        """SELECT bc.*, u.username as committer_username, b.name as branch_name, b.id as branch_id
           FROM branch_commits bc
           JOIN branches b ON b.id = bc.branch_id
           LEFT JOIN users u ON u.id = bc.committer_id
           WHERE b.project_id=? ORDER BY bc.created_at DESC, bc.rowid DESC""",
        (pid,),
    ).fetchall()

    branch_commits_list = []
    for c in branch_commits:
        cdict = dict(c)
        snaps = db.execute(
            "SELECT * FROM branch_snapshots WHERE branch_commit_id=?", (cdict["id"],)
        ).fetchall()
        cdict["snapshots"] = [dict(s) for s in snaps]
        branch_commits_list.append(cdict)

    # 3. Get all branches for base commit relationships
    branches = db.execute(
        "SELECT id, name, base_commit_id, status FROM branches WHERE project_id=?",
        (pid,),
    ).fetchall()

    db.close()

    # Combine and tag
    all_nodes = []
    for c in main_commits_list:
        node = dict(c)
        node["is_main"] = True
        node["type"] = "merge" if node.get("src_branch_id") else "commit"
        all_nodes.append(node)

    for c in branch_commits_list:
        node = dict(c)
        node["is_main"] = False
        node["type"] = "commit"
        all_nodes.append(node)

    # Sort by creation time
    all_nodes.sort(key=lambda x: x["created_at"], reverse=True)

    return {"nodes": all_nodes, "branches": [dict(b) for b in branches]}


# ── Branch Routes ────────────────────────────────────


@app.get("/api/projects/{pid}/branches")
def list_branches(pid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_access(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "Access denied")

    branches = db.execute(
        """SELECT b.*, u.username as owner_username
           FROM branches b LEFT JOIN users u ON u.id = b.owner_id
           WHERE b.project_id=? ORDER BY b.created_at DESC""",
        (pid,),
    ).fetchall()

    result = []
    for b in branches:
        open_pr = db.execute(
            "SELECT id FROM pull_requests WHERE branch_id=? AND status='open'",
            (b["id"],),
        ).fetchone()
        latest_commit = db.execute(
            "SELECT message FROM branch_commits WHERE branch_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1",
            (b["id"],),
        ).fetchone()
        result.append(
            {
                "id": b["id"],
                "name": b["name"],
                "status": b["status"],
                "owner_username": b["owner_username"],
                "base_commit_id": b["base_commit_id"],
                "created_at": b["created_at"],
                "open_pr": open_pr is not None,
                "latest_commit": latest_commit["message"] if latest_commit else None,
            }
        )
    db.close()
    return result


@app.post("/api/projects/{pid}/branches")
def create_branch(
    pid: str, data: BranchIn, authorization: Optional[str] = Header(None)
):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_write(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "Write access required")
    bid = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO branches(id, project_id, name, owner_id, base_commit_id) VALUES(?,?,?,?,?)",
        (bid, pid, data.name, user["id"], data.base_commit_id),
    )
    db.commit()
    branch = db.execute("SELECT * FROM branches WHERE id=?", (bid,)).fetchone()
    db.close()
    return dict(branch)


@app.get("/api/projects/{pid}/branches/{bid}")
def get_branch(pid: str, bid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_access(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "Access denied")
    branch = db.execute(
        """SELECT b.*, u.username as owner_username
           FROM branches b LEFT JOIN users u ON u.id = b.owner_id
           WHERE b.id=? AND b.project_id=?""",
        (bid, pid),
    ).fetchone()
    if not branch:
        db.close()
        raise HTTPException(404, "Branch not found")
    commits = db.execute(
        """SELECT bc.*, u.username as committer_username
           FROM branch_commits bc LEFT JOIN users u ON u.id = bc.committer_id
           WHERE bc.branch_id=? ORDER BY bc.created_at DESC, bc.rowid DESC""",
        (bid,),
    ).fetchall()
    result_commits = []
    for c in commits:
        snaps = db.execute(
            "SELECT * FROM branch_snapshots WHERE branch_commit_id=?", (c["id"],)
        ).fetchall()
        result_commits.append({**dict(c), "snapshots": [dict(s) for s in snaps]})
    db.close()
    return {**dict(branch), "commits": result_commits}


@app.delete("/api/projects/{pid}/branches/{bid}")
def delete_branch(pid: str, bid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    branch = db.execute(
        "SELECT * FROM branches WHERE id=? AND project_id=?", (bid, pid)
    ).fetchone()
    if not branch:
        db.close()
        raise HTTPException(404, "Branch not found")
    if branch["owner_id"] != user["id"] and p["owner_id"] != user["id"]:
        db.close()
        raise HTTPException(
            403, "Only the branch owner or project owner can delete this branch"
        )
    db.execute("UPDATE branches SET status='closed' WHERE id=?", (bid,))
    db.commit()
    db.close()
    return {"ok": True}


@app.post("/api/projects/{pid}/branches/{bid}/commits")
def create_branch_commit(
    pid: str,
    bid: str,
    data: BranchCommitIn,
    authorization: Optional[str] = Header(None),
):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    branch = db.execute(
        "SELECT * FROM branches WHERE id=? AND project_id=?", (bid, pid)
    ).fetchone()
    if not branch:
        db.close()
        raise HTTPException(404, "Branch not found")
    if branch["owner_id"] != user["id"]:
        db.close()
        raise HTTPException(403, "Only the branch owner can commit to this branch")
    # Get previous branch state or main base state
    latest_bc = db.execute(
        "SELECT id FROM branch_commits WHERE branch_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1",
        (bid,),
    ).fetchone()

    merged_snapshots = {}
    if latest_bc:
        # Branch has history - inherit from last branch commit
        branch_snaps = db.execute(
            "SELECT * FROM branch_snapshots WHERE branch_commit_id=?",
            (latest_bc["id"],),
        ).fetchall()
        for s in branch_snaps:
            merged_snapshots[s["filename"]] = dict(s)
    elif branch["base_commit_id"]:
        # First commit on branch - inherit from main's base commit
        base_snaps = db.execute(
            "SELECT * FROM snapshots WHERE commit_id=?", (branch["base_commit_id"],)
        ).fetchall()
        for s in base_snaps:
            merged_snapshots[s["filename"]] = dict(s)

    # Add/Update with new branch snapshots
    for s in data.snapshots:
        merged_snapshots[s.filename] = {
            "filename": s.filename,
            "file_hash": s.file_hash,
            "storage_path": s.storage_path,
            "file_size": s.file_size,
        }

    bcid = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO branch_commits(id, branch_id, message, committer_id) VALUES(?,?,?,?)",
        (bcid, bid, data.message, user["id"]),
    )
    for s in merged_snapshots.values():
        sid = str(uuid.uuid4())[:8]
        db.execute(
            "INSERT INTO branch_snapshots(id, branch_commit_id, filename, file_hash, storage_path, file_size) VALUES(?,?,?,?,?,?)",
            (
                sid,
                bcid,
                s["filename"],
                s["file_hash"],
                s["storage_path"],
                s["file_size"],
            ),
        )
    db.commit()
    db.close()
    return {"id": bcid, "message": data.message}


# ── Pull Request Routes ──────────────────────────────


@app.post("/api/projects/{pid}/branches/{bid}/pull-request")
def create_pull_request(
    pid: str, bid: str, data: PullRequestIn, authorization: Optional[str] = Header(None)
):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    branch = db.execute(
        "SELECT * FROM branches WHERE id=? AND project_id=?", (bid, pid)
    ).fetchone()
    if not branch:
        db.close()
        raise HTTPException(404, "Branch not found")
    if branch["owner_id"] != user["id"]:
        db.close()
        raise HTTPException(403, "Only the branch owner can open a pull request")
    has_commits = db.execute(
        "SELECT id FROM branch_commits WHERE branch_id=? LIMIT 1", (bid,)
    ).fetchone()
    if not has_commits:
        db.close()
        raise HTTPException(400, "Branch has no commits")
    existing_pr = db.execute(
        "SELECT id FROM pull_requests WHERE branch_id=? AND status='open'", (bid,)
    ).fetchone()
    if existing_pr:
        db.close()
        raise HTTPException(400, "An open pull request already exists for this branch")
    prid = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO pull_requests(id, project_id, branch_id, title, description, created_by) VALUES(?,?,?,?,?,?)",
        (prid, pid, bid, data.title, data.description, user["id"]),
    )
    if p["owner_id"] != user["id"]:
        nid = str(uuid.uuid4())[:8]
        db.execute(
            "INSERT INTO notifications(id, user_id, type, title, body, link) VALUES(?,?,?,?,?,?)",
            (
                nid,
                p["owner_id"],
                "pr_opened",
                f"New pull request: {data.title}",
                f"{user['username']} opened PR from branch '{branch['name']}'",
                f"/project/{pid}/pr/{prid}",
            ),
        )
    db.commit()
    pr = db.execute("SELECT * FROM pull_requests WHERE id=?", (prid,)).fetchone()
    db.close()
    return dict(pr)


@app.get("/api/projects/{pid}/pull-requests")
def list_pull_requests(pid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_access(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "Access denied")
    prs = db.execute(
        """SELECT pr.*, b.name as branch_name, u.username as creator_username
           FROM pull_requests pr
           LEFT JOIN branches b ON b.id = pr.branch_id
           LEFT JOIN users u ON u.id = pr.created_by
           WHERE pr.project_id=?
           ORDER BY pr.created_at DESC""",
        (pid,),
    ).fetchall()
    result = []
    for pr in prs:
        result.append(
            {
                "id": pr["id"],
                "title": pr["title"],
                "branch_name": pr["branch_name"],
                "creator_username": pr["creator_username"],
                "status": pr["status"],
                "created_at": pr["created_at"],
            }
        )
    db.close()
    return result


@app.get("/api/projects/{pid}/pull-requests/{prid}")
def get_pull_request(pid: str, prid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    if not can_access(db, p, user["id"]):
        db.close()
        raise HTTPException(403, "Access denied")
    pr = db.execute(
        "SELECT * FROM pull_requests WHERE id=? AND project_id=?", (prid, pid)
    ).fetchone()
    if not pr:
        db.close()
        raise HTTPException(404, "Pull request not found")
    branch = db.execute(
        "SELECT * FROM branches WHERE id=?", (pr["branch_id"],)
    ).fetchone()
    latest_bc = db.execute(
        "SELECT id FROM branch_commits WHERE branch_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1",
        (pr["branch_id"],),
    ).fetchone()
    branch_snapshots = []
    if latest_bc:
        branch_snapshots = [
            dict(s)
            for s in db.execute(
                "SELECT * FROM branch_snapshots WHERE branch_commit_id=?",
                (latest_bc["id"],),
            ).fetchall()
        ]
    latest_mc = db.execute(
        "SELECT id FROM commits WHERE project_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1",
        (pid,),
    ).fetchone()
    main_snapshots = []
    if latest_mc:
        main_snapshots = [
            dict(s)
            for s in db.execute(
                "SELECT * FROM snapshots WHERE commit_id=?",
                (latest_mc["id"],),
            ).fetchall()
        ]
    db.close()
    return {
        **dict(pr),
        "branch": dict(branch) if branch else None,
        "branch_snapshots": branch_snapshots,
        "main_snapshots": main_snapshots,
    }


@app.post("/api/projects/{pid}/pull-requests/{prid}/review")
def review_pull_request(
    pid: str, prid: str, data: PRReviewIn, authorization: Optional[str] = Header(None)
):
    user = get_current_user(authorization)
    db = get_db()
    p = db.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(404, "Project not found")
    require_owner(p, user["id"])
    pr = db.execute(
        "SELECT * FROM pull_requests WHERE id=? AND project_id=?", (prid, pid)
    ).fetchone()
    if not pr:
        db.close()
        raise HTTPException(404, "Pull request not found")
    if pr["status"] != "open":
        db.close()
        raise HTTPException(400, "Pull request is not open")
    if data.action not in ("approve", "reject"):
        db.close()
        raise HTTPException(400, "action must be 'approve' or 'reject'")
    branch = db.execute(
        "SELECT * FROM branches WHERE id=?", (pr["branch_id"],)
    ).fetchone()
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    if data.action == "approve":
        # 1. Get branch's latest snapshots
        latest_bc = db.execute(
            "SELECT id FROM branch_commits WHERE branch_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1",
            (pr["branch_id"],),
        ).fetchone()
        branch_snaps = []
        if latest_bc:
            branch_snaps = db.execute(
                "SELECT * FROM branch_snapshots WHERE branch_commit_id=?",
                (latest_bc["id"],),
            ).fetchall()

        # 2. Get main's current snapshots (to avoid losing unchanged files)
        latest_mc = db.execute(
            "SELECT id FROM commits WHERE project_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1",
            (pid,),
        ).fetchone()

        # Use a dict {filename: snapshot_data} for easy merging
        merged_snapshots = {}
        if latest_mc:
            main_snaps = db.execute(
                "SELECT * FROM snapshots WHERE commit_id=?",
                (latest_mc["id"],),
            ).fetchall()
            for s in main_snaps:
                merged_snapshots[s["filename"]] = dict(s)

        # Overlay branch snapshots (add new files or update existing ones)
        for s in branch_snaps:
            merged_snapshots[s["filename"]] = {
                "filename": s["filename"],
                "file_hash": s["file_hash"],
                "storage_path": s["storage_path"],
                "file_size": s["file_size"],
            }

        # 3. Create the merge commit
        cid = str(uuid.uuid4())[:8]
        merge_message = f"Merge branch '{branch['name']}'"
        db.execute(
            "INSERT INTO commits(id, project_id, message, committer_id, src_branch_id) VALUES(?,?,?,?,?)",
            (cid, pid, merge_message, user["id"], pr["branch_id"]),
        )

        # 4. Save merged snapshots
        for s in merged_snapshots.values():
            sid = str(uuid.uuid4())[:8]
            db.execute(
                "INSERT INTO snapshots(id, commit_id, filename, file_hash, storage_path, file_size) VALUES(?,?,?,?,?,?)",
                (
                    sid,
                    cid,
                    s["filename"],
                    s["file_hash"],
                    s["storage_path"],
                    s["file_size"],
                ),
            )
        db.execute(
            "UPDATE pull_requests SET status='approved', reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?",
            (user["id"], now, data.note, prid),
        )
        db.execute("UPDATE branches SET status='merged' WHERE id=?", (pr["branch_id"],))
        if branch["owner_id"] != user["id"]:
            nid = str(uuid.uuid4())[:8]
            db.execute(
                "INSERT INTO notifications(id, user_id, type, title, body, link) VALUES(?,?,?,?,?,?)",
                (
                    nid,
                    branch["owner_id"],
                    "pr_approved",
                    f"PR approved: {pr['title']}",
                    "Your pull request was approved and merged",
                    f"/project/{pid}",
                ),
            )
    else:  # reject
        db.execute(
            "UPDATE pull_requests SET status='rejected', reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?",
            (user["id"], now, data.note, prid),
        )
        if branch["owner_id"] != user["id"]:
            nid = str(uuid.uuid4())[:8]
            body = data.note if data.note else "Your pull request was rejected"
            db.execute(
                "INSERT INTO notifications(id, user_id, type, title, body, link) VALUES(?,?,?,?,?,?)",
                (
                    nid,
                    branch["owner_id"],
                    "pr_rejected",
                    f"PR rejected: {pr['title']}",
                    body,
                    f"/project/{pid}/branch/{pr['branch_id']}",
                ),
            )

    db.commit()
    db.close()
    return {"ok": True, "action": data.action}


# ── Notification Routes ──────────────────────────────


@app.get("/api/notifications")
def get_notifications(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    notifications = db.execute(
        """SELECT id, type, title, body, link, is_read, created_at
           FROM notifications
           WHERE user_id=?
           ORDER BY created_at DESC""",
        (user["id"],),
    ).fetchall()
    db.close()
    return [dict(n) for n in notifications]


@app.post("/api/notifications/read-all")
def mark_all_notifications_read(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    result = db.execute(
        "UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0",
        (user["id"],),
    )
    count = result.rowcount
    db.commit()
    db.close()
    return {"ok": True, "count": count}


@app.post("/api/notifications/{nid}/read")
def mark_notification_read(nid: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    db = get_db()
    n = db.execute(
        "SELECT id FROM notifications WHERE id=? AND user_id=?", (nid, user["id"])
    ).fetchone()
    if not n:
        db.close()
        raise HTTPException(404, "Notification not found")
    db.execute("UPDATE notifications SET is_read=1 WHERE id=?", (nid,))
    db.commit()
    db.close()
    return {"ok": True}


# ── Run ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
