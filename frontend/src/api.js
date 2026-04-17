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

  // AI Analysis via OpenRouter
  analyzeWithAI: async (urlA, urlB) => {
    const toBase64 = async (url) => {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    };
    const [b64A, b64B] = await Promise.all([toBase64(urlA), toBase64(urlB)]);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-nano-12b-v2-vl:free",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "These are two versions of an image (Before and After). Describe concisely what has visually changed between them. Be specific about colors, shapes, text, layout, or content differences.  Keep it short." },
            { type: "image_url", image_url: { url: b64A } },
            { type: "image_url", image_url: { url: b64B } },
          ],
        }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  },

  // Helpers
  storageUrl: (path) => `${STORAGE_BASE}/${path}`,
};
