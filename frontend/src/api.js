const API = "http://localhost:8000/api";
const STORAGE_BASE = "http://localhost:8000/storage";

const getToken = () => {
  try { return JSON.parse(localStorage.getItem("mg_user"))?.token; } catch { return null; }
};

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const json = (r) => r.json();

export const api = {
  // Auth
  register: (username, password) =>
    fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then(json),

  login: (username, password) =>
    fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then(json),

  // Projects
  getProjects: () =>
    fetch(`${API}/projects`, { headers: authHeaders() }).then(json),

  createProject: (data) =>
    fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    }).then(json),

  getProject: (id) =>
    fetch(`${API}/projects/${id}`, { headers: authHeaders() }).then(json),

  deleteProject: (id) =>
    fetch(`${API}/projects/${id}`, { method: "DELETE", headers: authHeaders() }).then(json),

  updateVisibility: (id, visibility) =>
    fetch(`${API}/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ visibility }),
    }).then(json),

  // Collaborators
  addCollaborator: (pid, username) =>
    fetch(`${API}/projects/${pid}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ username }),
    }).then(json),

  removeCollaborator: (pid, uid) =>
    fetch(`${API}/projects/${pid}/collaborators/${uid}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(json),

  // Upload
  uploadFile: (file, projectId) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${API}/upload?project_id=${projectId}`, { method: "POST", headers: authHeaders(), body: fd }).then(json);
  },

  // Commits
  createCommit: (pid, data) =>
    fetch(`${API}/projects/${pid}/commits`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    }).then(json),

  // Rollback
  rollback: (pid, commitId) =>
    fetch(`${API}/projects/${pid}/rollback/${commitId}`, {
      method: "POST",
      headers: authHeaders(),
    }).then(json),

  // Diff
  diff: (path_a, path_b) =>
    fetch(`${API}/diff`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ path_a, path_b }),
    }).then(json),

  // Helpers
  storageUrl: (path) => `${STORAGE_BASE}/${path}`,
};
