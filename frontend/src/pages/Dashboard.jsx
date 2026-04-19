import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Lock,
  Globe,
  Trash2,
  BookMarked,
  GitCommitHorizontal,
  X,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

// ─── New Project Modal ───────────────────────────────────────────────────────

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Repository name is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onCreate({ name: name.trim(), description: desc, visibility });
    } catch (err) {
      setError(err?.detail || "Something went wrong.");
      setLoading(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(1,4,9,0.75)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#21262d]">
          <h2 className="text-base font-semibold text-white">
            Create a new repository
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors rounded-md p-1 hover:bg-[#21262d]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal body */}
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Repository name <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="my-awesome-project"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className={`w-full bg-[#0d1117] border rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 transition-colors ${
                error
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : "border-[#30363d] focus:border-[#58a6ff] focus:ring-[#58a6ff]"
              }`}
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle size={11} /> {error}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Description{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="A short description of this repository"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
            />
          </div>

          {/* Visibility */}
          <div>
            <p className="text-sm font-medium text-gray-300 mb-2">Visibility</p>
            <div className="space-y-2">
              {[
                {
                  value: "public",
                  icon: Globe,
                  label: "Public",
                  desc: "Anyone can see this repository.",
                },
                {
                  value: "private",
                  icon: Lock,
                  label: "Private",
                  desc: "Only you and collaborators can see it.",
                },
              ].map(({ value, icon: Icon, label, desc: hint }) => (
                <label
                  key={value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    visibility === value
                      ? "border-[#58a6ff] bg-[#58a6ff]/5"
                      : "border-[#30363d] hover:border-[#484f58]"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                    className="mt-0.5 accent-[#58a6ff]"
                  />
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Icon
                      size={15}
                      className={`mt-0.5 shrink-0 ${
                        visibility === value
                          ? "text-[#58a6ff]"
                          : "text-gray-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {label}
                      </p>
                      <p className="text-xs text-gray-500">{hint}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-[#21262d] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-gray-300 bg-transparent border border-[#30363d] hover:border-[#484f58] hover:text-white rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-1.5 text-sm font-medium text-white bg-[#238636] hover:bg-[#2ea043] border border-[#2ea043]/60 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Create repository"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Repository row ──────────────────────────────────────────────────────────

function RepoRow({ project, onNavigate, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(e, project.id);
    setConfirmDelete(false);
  };

  return (
    <li className="group flex items-start justify-between gap-4 py-5 px-4 border-b border-[#21262d] last:border-b-0">
      {/* Left: info */}
      <div className="flex-1 min-w-0">
        {/* Name + badge row */}
        <div className="flex items-center flex-wrap gap-2 mb-1 ">
          <button
            onClick={() => onNavigate(`/project/${project.id}`)}
            className="text-[#58a6ff] font-semibold text-base hover:underline focus:outline-none leading-snug"
          >
            {project.name}
          </button>

          {/* Visibility badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${
              project.visibility === "public"
                ? "border-[#388bfd]/40 text-[#58a6ff] bg-[#388bfd]/10"
                : "border-[#484f58] text-gray-400 bg-[#21262d]"
            }`}
          >
            {project.visibility === "public" ? (
              <Globe size={10} />
            ) : (
              <Lock size={10} />
            )}
            {project.visibility === "public" ? "Public" : "Private"}
          </span>

          {/* Price badge */}
          {project.price > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded-full">
              <DollarSign size={10} />
              {project.price.toFixed(2)}
            </span>
          )}

          {/* Collaborator badge */}
          {!project.is_owner && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border border-[#484f58] text-gray-500 bg-[#21262d]">
              Collaborator
            </span>
          )}
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-gray-400 mb-2 leading-relaxed line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-4 text-xs text-gray-500">
          {/* Language dot + type */}
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: "#3fb950" }}
            />
            <span>MediaGit</span>
          </span>

          {/* Commit count */}
          <span className="flex items-center gap-1">
            <GitCommitHorizontal size={12} className="shrink-0" />
            {project.commit_count}{" "}
            {project.commit_count === 1 ? "commit" : "commits"}
          </span>

          {/* Paid access label */}
          {project.is_gated && (
            <span className="inline-flex items-center gap-1 text-yellow-400 font-semibold">
              🔒 Paid access
            </span>
          )}

          {/* Updated at */}
          {project.updated_at && (
            <span>Updated {timeAgo(project.updated_at)}</span>
          )}
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {project.is_owner && (
          <button
            onClick={handleDelete}
            onBlur={() => setTimeout(() => setConfirmDelete(false), 200)}
            title={
              confirmDelete ? "Click again to confirm" : "Delete repository"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 ${
              confirmDelete
                ? "border-red-500 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                : "border-[#30363d] text-gray-500 hover:text-red-400 hover:border-red-500/60 hover:bg-red-500/5"
            }`}
          >
            <Trash2 size={12} />
            {confirmDelete ? "Confirm" : "Delete"}
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [visFilter, setVisFilter] = useState("all"); // "all" | "public" | "private"
  const nav = useNavigate();

  const load = () => api.getProjects().then(setProjects);
  useEffect(() => {
    load();
  }, []);

  const create = async ({ name, description, visibility }) => {
    const p = await api.createProject({ name, description, visibility });
    setShowModal(false);
    nav(`/project/${p.id}`);
  };

  const remove = async (e, pid) => {
    e.stopPropagation();
    await api.deleteProject(pid);
    load();
  };

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchName = p.name.toLowerCase().includes(search.toLowerCase());
      const matchVis = visFilter === "all" || p.visibility === visFilter;
      return matchName && matchVis;
    });
  }, [projects, search, visFilter]);

  const VIS_FILTERS = [
    { key: "all", label: "All" },
    { key: "public", label: "Public" },
    { key: "private", label: "Private" },
  ];

  return (
    <>
      {/* ── New project modal ── */}
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={create}
        />
      )}

      <div className="max-w-4xl mx-auto">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-semibold text-white">Repositories</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#238636] hover:bg-[#2ea043] border border-[#2ea043]/60 rounded-md transition-colors"
          >
            <span className="text-base leading-none font-light">+</span> New
          </button>
        </div>

        {/* ── Filter bar ── */}
        <div className="flex items-center flex-wrap gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a repository…"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md pl-9 pr-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
            />
          </div>

          {/* Visibility filter pills */}
          <div className="flex items-center rounded-md border border-[#30363d] overflow-hidden shrink-0">
            {VIS_FILTERS.map(({ key, label }, idx) => (
              <button
                key={key}
                onClick={() => setVisFilter(key)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  idx !== 0 ? "border-l border-[#30363d]" : ""
                } ${
                  visFilter === key
                    ? "bg-[#21262d] text-white"
                    : "text-gray-400 hover:text-white hover:bg-[#21262d]/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Repository list ── */}
        {filtered.length > 0 ? (
          <div className="border border-[#21262d] rounded-lg overflow-hidden bg-[#0d1117]">
            <ul className="divide-y-0">
              {filtered.map((p) => (
                <RepoRow
                  key={p.id}
                  project={p}
                  onNavigate={nav}
                  onDelete={remove}
                />
              ))}
            </ul>
          </div>
        ) : projects.length === 0 ? (
          /* ── Empty state: no projects at all ── */
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#30363d] rounded-xl">
            <div className="w-16 h-16 mb-4 bg-[#161b22] border border-[#30363d] rounded-2xl flex items-center justify-center">
              <BookMarked className="w-7 h-7 text-gray-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              No repositories yet
            </h3>
            <p className="text-sm text-gray-500 mb-5 max-w-xs">
              Create your first repository to start tracking media versions
              across commits.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-[#238636] hover:bg-[#2ea043] border border-[#2ea043]/60 rounded-md transition-colors"
            >
              Create a repository
            </button>
          </div>
        ) : (
          /* ── Empty state: search returned nothing ── */
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#30363d] rounded-xl">
            <div className="w-14 h-14 mb-4 bg-[#161b22] border border-[#30363d] rounded-2xl flex items-center justify-center">
              <BookMarked className="w-6 h-6 text-gray-500" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">
              No repositories match
            </h3>
            <p className="text-sm text-gray-500">
              Try a different name or remove your filters.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setVisFilter("all");
              }}
              className="mt-4 text-sm text-[#58a6ff] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </>
  );
}
