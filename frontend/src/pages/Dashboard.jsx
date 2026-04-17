import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [showForm, setShowForm] = useState(false);
  const nav = useNavigate();

  const load = () => api.getProjects().then(setProjects);
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    const p = await api.createProject({ name, description: desc, visibility });
    nav(`/project/${p.id}`);
  };

  const remove = async (e, pid) => {
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    await api.deleteProject(pid);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">Track visual changes across versions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#238636] hover:bg-[#2ea043] px-5 py-2.5 rounded-lg font-medium transition"
        >
          + New Project
        </button>
      </div>

      {showForm && (
        <div className="bg-[#161b22] border border-gray-700 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            autoFocus
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 mb-3 focus:border-[#58a6ff] outline-none transition"
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 mb-3 focus:border-[#58a6ff] outline-none transition"
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <div className="flex gap-2 mb-4">
            {["private", "public"].map((v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={`px-4 py-1.5 rounded-lg text-sm border transition capitalize ${
                  visibility === v
                    ? "border-[#58a6ff] text-[#58a6ff] bg-[#58a6ff]/10"
                    : "border-gray-700 text-gray-500 hover:border-gray-500"
                }`}
              >
                {v === "private" ? "🔒" : "🌐"} {v}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={create}
              className="bg-[#238636] hover:bg-[#2ea043] px-5 py-2 rounded-lg font-medium transition"
            >
              Create Project
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <div
            key={p.id}
            onClick={() => nav(`/project/${p.id}`)}
            className="bg-[#161b22] border border-gray-700 rounded-lg p-5 cursor-pointer hover:border-[#58a6ff] transition group"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold mb-1 group-hover:text-[#58a6ff] transition">
                {p.name}
              </h3>
              {p.is_owner && (
                <button
                  onClick={(e) => remove(e, p.id)}
                  className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-lg"
                  title="Delete project"
                >
                  ×
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm mb-3">{p.description || "No description"}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-[#238636] rounded-full inline-block" />
                {p.commit_count} commit{p.commit_count !== 1 ? "s" : ""}
              </span>
              <span>{p.visibility === "public" ? "🌐" : "🔒"} {p.visibility}</span>
              {!p.is_owner && <span className="text-gray-600">collaborator</span>}
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && !showForm && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎨</div>
          <p className="text-gray-500 text-lg">No projects yet</p>
          <p className="text-gray-600 text-sm">Create your first project to start tracking media versions</p>
        </div>
      )}
    </div>
  );
}
