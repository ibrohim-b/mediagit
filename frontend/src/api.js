const API = "http://localhost:8000/api";
const STORAGE_BASE = "http://localhost:8000/storage";

export const api = {
  // Projects
  getProjects: () => fetch(`${API}/projects`).then((r) => r.json()),

  createProject: (data) =>
    fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  getProject: (id) => fetch(`${API}/projects/${id}`).then((r) => r.json()),

  deleteProject: (id) =>
    fetch(`${API}/projects/${id}`, { method: "DELETE" }).then((r) => r.json()),

  // Upload
  uploadFile: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${API}/upload`, { method: "POST", body: fd }).then((r) =>
      r.json()
    );
  },

  // Commits
  createCommit: (pid, data) =>
    fetch(`${API}/projects/${pid}/commits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // Rollback
  rollback: (pid, commitId) =>
    fetch(`${API}/projects/${pid}/rollback/${commitId}`, {
      method: "POST",
    }).then((r) => r.json()),

  // Diff
  generateDiff: (pathA, pathB) =>
    fetch(`${API}/diff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path_a: pathA, path_b: pathB }),
    }).then((r) => r.json()),

  // Helpers
  storageUrl: (path) => `${STORAGE_BASE}/${path}`,
};
