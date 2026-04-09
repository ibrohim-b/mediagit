# MediaGit

A Git-like version control system for images. Create projects, commit image snapshots, compare versions with a visual diff heatmap, and roll back to any previous commit.

## Features

- Create and manage image projects
- Commit image snapshots with messages
- Visual pixel-level diff between any two image versions (heatmap overlay)
- Rollback to any previous commit

## Tech Stack

- **Backend:** FastAPI, SQLite, Pillow, NumPy
- **Frontend:** React 18, Vite, Tailwind CSS, React Router

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

API runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI runs at `http://localhost:5173`.

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/:id` | Get project with commits |
| DELETE | `/api/projects/:id` | Delete a project |
| POST | `/api/upload` | Upload an image |
| POST | `/api/projects/:id/commits` | Create a commit |
| POST | `/api/projects/:id/rollback/:commitId` | Rollback to a commit |
| POST | `/api/diff` | Generate a diff heatmap between two images |
