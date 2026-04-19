import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import FilePreview from "../components/FilePreview";
import HoverPreview from "../components/HoverPreview";
import ProjectHeader from "../components/ProjectHeader";
import {
  GitBranch,
  GitPullRequest,
  GitCommitHorizontal,
  GitMerge,
  Upload,
  X,
  Check,
  Trash2,
  AlertCircle,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

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

function AvatarCircle({ name, size = "w-8 h-8" }) {
  const initial = (name || "?")[0].toUpperCase();
  const colors = [
    "bg-purple-600",
    "bg-blue-600",
    "bg-green-700",
    "bg-yellow-600",
    "bg-pink-600",
    "bg-indigo-600",
    "bg-teal-600",
  ];
  const color = colors[initial.charCodeAt(0) % colors.length];
  return (
    <div
      className={`${size} ${color} rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0`}
    >
      {initial}
    </div>
  );
}

// ─── status badge helpers ─────────────────────────────────────────────────────

function BranchStatusBadge({ status }) {
  const styles = {
    active:   "bg-[#238636]/20 text-[#3fb950] border-[#238636]/40",
    merged:   "bg-purple-900/30 text-purple-400 border-purple-500/40",
    closed:   "bg-[#30363d] text-[#8b949e] border-[#30363d]",
    rejected: "bg-red-900/30 text-red-400 border-red-500/40",
  };
  const labels = { active: "Active", merged: "Merged", closed: "Closed", rejected: "Rejected" };
  const cls = styles[status] ?? "bg-[#30363d] text-[#8b949e] border-[#30363d]";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

function PRStatusBadge({ status }) {
  const styles = {
    open:     "bg-[#238636]/20 text-[#3fb950] border-[#238636]/40",
    merged:   "bg-purple-900/30 text-purple-400 border-purple-500/40",
    closed:   "bg-[#30363d] text-[#8b949e] border-[#30363d]",
    rejected: "bg-red-900/30 text-red-400 border-red-500/40",
  };
  const labels = { open: "Open", merged: "Merged", closed: "Closed", rejected: "Rejected" };
  const cls = styles[status] ?? "bg-[#30363d] text-[#8b949e] border-[#30363d]";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function BranchPage() {
  const { id, bid } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  // ── core state ──────────────────────────────────────────────────────────────
  const [project, setProject]         = useState(null);
  const [branch,  setBranch]          = useState(null);

  // upload / commit
  const [staged,    setStaged]        = useState([]);
  const [message,   setMessage]       = useState("");
  const [dragging,  setDragging]      = useState(false);
  const [uploading, setUploading]     = useState(false);

  // PR
  const [existingPR,  setExistingPR]  = useState(null);
  const [showPRForm,  setShowPRForm]  = useState(false);
  const [prTitle,     setPrTitle]     = useState("");
  const [prDesc,      setPrDesc]      = useState("");
  const [prLoading,   setPrLoading]   = useState(false);

  // UI
  const [hoveredFile,     setHoveredFile]     = useState(null);
  const [deletingBranch,  setDeletingBranch]  = useState(false);

  const fileInputRef = useRef(null);

  // ── data loading ────────────────────────────────────────────────────────────

  const loadPRs = useCallback(() => {
    if (!branch) return;
    api
      .getPRs(id)
      .then((prs) => {
        const branchPRs = prs.filter((p) => p.branch_name === branch.name);
        const openPR = branchPRs.find((p) => p.status === "open");
        setExistingPR(openPR || branchPRs[0] || null);
      })
      .catch(() => setExistingPR(null));
  }, [id, branch]);

  const loadBranch = useCallback(() => {
    api.getBranch(id, bid).then(setBranch).catch(() => setBranch(null));
  }, [id, bid]);

  const load = useCallback(() => {
    api.getProject(id).then(setProject).catch(() => setProject(null));
    loadBranch();
  }, [id, loadBranch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPRs(); }, [loadPRs]);

  // ── file handling ───────────────────────────────────────────────────────────

  const handleFiles = async (files) => {
    setUploading(true);
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      const res = await api.uploadFile(f, id);
      setStaged((prev) => [...prev, res]);
    }
    setUploading(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles([...e.dataTransfer.files]);
  };

  const onFileSelect = (e) => {
    handleFiles([...e.target.files]);
    e.target.value = "";
  };

  const removeStaged = (index) =>
    setStaged((prev) => prev.filter((_, i) => i !== index));

  // ── commit to branch ────────────────────────────────────────────────────────

  const commitToBranch = async () => {
    if (!message.trim() || staged.length === 0) return;
    await api.commitToBranch(id, bid, {
      message: message.trim(),
      snapshots: staged.map((s) => ({
        filename:     s.filename,
        file_hash:    s.file_hash,
        storage_path: s.storage_path,
        file_size:    s.file_size,
      })),
    });
    setStaged([]);
    setMessage("");
    loadBranch();
  };

  // ── delete branch ───────────────────────────────────────────────────────────

  const deleteBranch = async () => {
    if (!confirm(`Delete branch "${branch.name}"? This cannot be undone.`)) return;
    setDeletingBranch(true);
    try {
      await api.deleteBranch(id, bid);
      nav(`/project/${id}`);
    } catch {
      setDeletingBranch(false);
    }
  };

  // ── create PR ───────────────────────────────────────────────────────────────

  const createPR = async (e) => {
    e.preventDefault();
    if (!prTitle.trim()) return;
    setPrLoading(true);
    try {
      await api.createPR(id, bid, {
        title:       prTitle.trim(),
        description: prDesc.trim(),
      });
      setPrTitle("");
      setPrDesc("");
      setShowPRForm(false);
      loadPRs();
    } finally {
      setPrLoading(false);
    }
  };

  // ── loading guard ────────────────────────────────────────────────────────────

  if (!project || !branch) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── derived flags ────────────────────────────────────────────────────────────

  const isBranchOwner = user?.id === branch.owner_id;
  const isActive      = branch.status === "active";

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ color: "#e6edf3" }}>
      <ProjectHeader project={project} activeTab="branches" />
      <div className="mt-6" />

      {/* ════════════════════════════════════════════════════════════════════
          BRANCH HEADER CARD
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4 mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {/* Name + status badge */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <GitBranch size={18} className="text-[#3fb950] flex-shrink-0" />
            <span className="text-[#e6edf3] font-bold text-lg leading-tight">
              {branch.name}
            </span>
            <BranchStatusBadge status={branch.status} />
          </div>
          {/* Meta: owner + created */}
          <p className="text-[#8b949e] text-sm">
            <span className="text-[#58a6ff] font-medium">
              @{branch.owner_username}
            </span>
            {" · "}
            Created {timeAgo(branch.created_at)}
          </p>
        </div>

        {/* Delete button — only for project owner on active branches */}
        {project.is_owner && isActive && (
          <button
            onClick={deleteBranch}
            disabled={deletingBranch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-red-500/40 text-red-400 bg-red-900/20 hover:bg-red-900/40 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            {deletingBranch ? "Deleting…" : "Delete branch"}
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          UPLOAD + COMMIT  (branch owner + active only)
      ═════════════════════════════════════════════════════════════════════ */}
      {isBranchOwner && isActive && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4 mb-4">
          <h2 className="text-sm font-semibold text-[#e6edf3] mb-3 flex items-center gap-2">
            <Upload size={14} className="text-[#8b949e]" />
            Upload &amp; Commit
          </h2>

          {/* ── Drop zone ── */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            className={`border-2 border-dashed rounded-md p-6 text-center transition-all mb-3 ${
              dragging
                ? "border-[#58a6ff] bg-[#58a6ff]/5"
                : "border-[#30363d] hover:border-[#8b949e] bg-[#0d1117]"
            }`}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-3 text-[#58a6ff]">
                <div className="w-4 h-4 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
                Uploading…
              </div>
            ) : (
              <>
                <Upload size={24} className="text-[#8b949e] mx-auto mb-2" />
                <p className="text-[#8b949e] text-sm mb-1">
                  Drag &amp; drop images here, or{" "}
                  <label className="text-[#58a6ff] hover:underline cursor-pointer">
                    browse
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={onFileSelect}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-[#6e7681] text-xs">
                  PNG, JPG, SVG, WebP supported
                </p>
              </>
            )}
          </div>

          {/* ── Staged file thumbnails ── */}
          {staged.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-[#3fb950] font-medium mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#3fb950] rounded-full animate-pulse inline-block" />
                {staged.length} file{staged.length !== 1 ? "s" : ""} staged
              </p>
              <div className="flex gap-3 flex-wrap">
                {staged.map((s, i) => (
                  <div key={i} className="relative group">
                    {/* 80×80 thumbnail with hover overlay */}
                    <div
                      className="relative w-20 h-20 rounded overflow-hidden border border-[#238636] cursor-pointer"
                      onMouseEnter={(e) => setHoveredFile({ src: api.storageUrl(s.storage_path), filename: s.filename, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setHoveredFile(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setHoveredFile(null)}
                      onClick={() => window.open(api.storageUrl(s.storage_path), "_blank")}
                    >
                      <FilePreview
                        src={api.storageUrl(s.storage_path)}
                        filename={s.filename}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => removeStaged(i)}
                      title="Remove"
                      className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      <X size={10} />
                    </button>
                    <p className="text-xs text-[#8b949e] mt-1 truncate w-20">
                      {s.filename}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Commit message + button ── */}
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='Commit message (e.g. "Updated banner design")'
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm focus:border-[#58a6ff] outline-none transition-colors placeholder:text-[#6e7681]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && message.trim() && staged.length > 0)
                  commitToBranch();
              }}
            />
            <button
              onClick={commitToBranch}
              disabled={!message.trim() || staged.length === 0}
              className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 text-white whitespace-nowrap"
            >
              <Check size={14} />
              Commit to branch
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          BRANCH COMMITS
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-[#e6edf3] flex items-center gap-2">
            <GitCommitHorizontal size={16} className="text-[#8b949e]" />
            Branch commits
          </h2>
          <span className="bg-[#21262d] text-[#8b949e] text-xs px-2 py-0.5 rounded-full font-medium">
            {branch.commits.length}
          </span>
        </div>

        {/* Empty state */}
        {branch.commits.length === 0 ? (
          <div className="bg-[#161b22] border border-[#30363d] rounded-md p-10 text-center">
            <GitCommitHorizontal size={32} className="text-[#30363d] mx-auto mb-3" />
            <p className="text-[#8b949e] text-sm font-medium mb-1">No commits yet</p>
            <p className="text-[#6e7681] text-xs">
              {isBranchOwner && isActive
                ? "Upload images above and make your first commit to this branch."
                : "This branch has no commits."}
            </p>
          </div>
        ) : (
          /* Commit cards */
          <div>
            {branch.commits.map((commit, idx) => {
              const isLatest  = idx === 0;
              const shortHash = commit.id ? String(commit.id).slice(0, 7) : "—";

              return (
                <div
                  key={commit.id}
                  className="bg-[#161b22] border border-[#30363d] rounded-md p-3 mb-2"
                >
                  {/* Row 1 — avatar · message · "latest" badge · timeAgo */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <AvatarCircle name={commit.committer_username || "?"} size="w-7 h-7" />
                    <span className="text-[#e6edf3] font-semibold text-sm truncate flex-1 min-w-0">
                      {commit.message}
                    </span>
                    {isLatest && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/30 font-medium flex-shrink-0">
                        latest
                      </span>
                    )}
                    <span className="text-[#8b949e] text-xs flex-shrink-0">
                      {timeAgo(commit.created_at)}
                    </span>
                  </div>

                  {/* Row 2 — @username · short-hash */}
                  <div className="flex items-center gap-2 mb-2 pl-9">
                    <span className="text-[#8b949e] text-xs">
                      @{commit.committer_username}
                    </span>
                    <span className="text-[#6e7681] text-xs select-none">·</span>
                    <span className="font-mono text-[#8b949e] text-xs bg-[#21262d] px-1.5 py-0.5 rounded">
                      {shortHash}
                    </span>
                  </div>

                  {/* Row 3 — snapshot thumbnails (up to 4, 32×32) */}
                  {commit.snapshots && commit.snapshots.length > 0 && (
                    <div className="flex gap-2 flex-wrap pl-9">
                      {commit.snapshots.slice(0, 4).map((snap, si) => {
                        const thumbKey = `commit-${commit.id}-${si}`;
                        return (
                          <div
                            className="relative"
                            onMouseEnter={(e) => setHoveredFile({ snap, x: e.clientX, y: e.clientY })}
                            onMouseMove={(e) => setHoveredFile(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setHoveredFile(null)}
                          >
                            <FilePreview
                              src={api.storageUrl(snap.storage_path)}
                              filename={snap.filename}
                              className="w-8 h-8 object-cover rounded border border-[#30363d] cursor-pointer hover:border-[#58a6ff] transition-colors"
                              onClick={() =>
                                window.open(api.storageUrl(snap.storage_path), "_blank")
                              }
                            />
                          </div>
                        );
                      })}
                      {/* Overflow badge */}
                      {commit.snapshots.length > 4 && (
                        <div className="w-8 h-8 rounded border border-[#30363d] bg-[#21262d] flex items-center justify-center text-[#8b949e] text-xs font-medium flex-shrink-0">
                          +{commit.snapshots.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          PULL REQUEST
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="border border-[#30363d] rounded-md p-4">
        <h2 className="text-base font-semibold text-[#e6edf3] mb-4 flex items-center gap-2">
          <GitPullRequest size={16} className="text-[#8b949e]" />
          Pull Request
        </h2>

        {/* ── Case 1: existing PR ── */}
        {/* ── Case 1: Active or Open PR ── */}
        {(existingPR && existingPR.status === "open") ? (
          <div>
            <div className="bg-[#0d1117] border border-[#30363d] rounded-md p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <GitPullRequest size={15} className="text-[#3fb950] flex-shrink-0" />
                <span className="text-[#e6edf3] font-medium text-sm truncate">
                  {existingPR.title}
                </span>
                <PRStatusBadge status={existingPR.status} />
              </div>
              <Link
                to={`/project/${id}/pr/${existingPR.id}`}
                className="text-[#58a6ff] hover:underline text-xs flex items-center gap-1 font-medium bg-[#1f6feb26] px-3 py-1.5 rounded-md border border-[#388bfd66] transition-colors whitespace-nowrap"
              >
                View details
              </Link>
            </div>
            
            {/* Show review note / reason if exists */}
            {existingPR.review_note && (
              <div className={`mt-3 p-3 rounded-md border text-sm ${
                existingPR.status === "rejected" 
                  ? "bg-red-500/5 border-red-500/20 text-red-300" 
                  : "bg-purple-500/5 border-purple-500/20 text-purple-300"
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertCircle size={14} className="opacity-70" />
                  <span className="font-bold opacity-80 uppercase tracking-wider text-[10px]">
                    {existingPR.status === "rejected" ? "Rejection Reason" : "Review Note"}
                  </span>
                </div>
                <p className="pl-5 leading-relaxed">{existingPR.review_note}</p>
              </div>
            )}

            {existingPR.status !== "open" && isActive && isBranchOwner && (
              <div className="mt-4 pt-4 border-t border-[#30363d]">
                <p className="text-xs text-[#8b949e] mb-3">
                  This pull request was {existingPR.status}. You can address the feedback and open a new one.
                </p>
                <button
                  onClick={() => setShowPRForm(true)}
                  className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Open new Pull Request
                </button>
              </div>
            )}
          </div>

        ) : (existingPR && (existingPR.status === "approved" || existingPR.status === "merged")) ? (
          /* ── Case 2: Already merged PR ── */
          <div className="flex items-center gap-2 bg-purple-900/10 border border-purple-500/30 rounded-md p-3">
            <GitMerge size={15} className="text-purple-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-purple-400 text-sm font-medium">This branch was merged into main.</p>
              <Link to={`/project/${id}/pr/${existingPR.id}`} className="text-xs text-purple-400/70 hover:underline">View PR #{existingPR.id}</Link>
            </div>
          </div>

        ) : branch.status === "merged" ? (
          /* ── Case 3: Branch marked merged (fallback) ── */
          <div className="flex items-center gap-2 bg-purple-900/10 border border-purple-500/30 rounded-md p-3">
            <GitMerge size={15} className="text-purple-400 flex-shrink-0" />
            <p className="text-purple-400 text-sm font-medium">
              This branch was merged into main.
            </p>
          </div>

        ) : branch.commits.length === 0 ? (
          /* ── Case 4: no commits yet ── */
          <div className="flex items-center gap-2 text-[#8b949e] bg-[#0d1117] border border-[#21262d] rounded-md p-3">
            <GitCommitHorizontal size={15} className="flex-shrink-0" />
            <p className="text-sm">
              Push commits first before opening a pull request.
            </p>
          </div>

        ) : isActive && isBranchOwner ? (
          /* ── Case 5: Allowed to create PR (no open PR exists) ── */
          <>
            {existingPR && existingPR.status === "rejected" && (
              <div className="mb-4 flex items-start gap-2 bg-red-900/10 border border-red-500/30 rounded-md p-3">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-red-400 text-sm font-semibold mb-0.5">Previous PR was rejected</p>
                  {existingPR.review_note && <p className="text-red-400/80 text-xs mb-2 italic">"{existingPR.review_note}"</p>}
                  <Link to={`/project/${id}/pr/${existingPR.id}`} className="text-xs text-red-400/70 hover:underline">View rejected PR #{existingPR.id}</Link>
                </div>
              </div>
            )}

            {showPRForm ? (
              <form onSubmit={createPR} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#8b949e] mb-1">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    placeholder="Describe your changes…"
                    required
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm focus:border-[#58a6ff] outline-none transition-colors placeholder:text-[#6e7681]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8b949e] mb-1">
                    Description{" "}
                    <span className="text-[#6e7681] font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={prDesc}
                    onChange={(e) => setPrDesc(e.target.value)}
                    placeholder="Provide more context about your changes…"
                    rows={3}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm focus:border-[#58a6ff] outline-none transition-colors placeholder:text-[#6e7681] resize-y min-h-[72px]"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="submit"
                    disabled={!prTitle.trim() || prLoading}
                    className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm font-medium text-white transition-colors flex items-center gap-2"
                  >
                    {prLoading && (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Create Pull Request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPRForm(false);
                      setPrTitle("");
                      setPrDesc("");
                    }}
                    className="px-4 py-2 rounded-md text-sm font-medium text-[#8b949e] border border-[#30363d] hover:text-[#e6edf3] hover:border-[#8b949e] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowPRForm(true)}
                className="flex items-center gap-2 bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <GitPullRequest size={14} />
                {existingPR && existingPR.status === "rejected" ? "Open New Pull Request" : "Open Pull Request"}
              </button>
            )}
          </>
        ) : null}
      </div>

      <HoverPreview
        snap={hoveredFile?.snap}
        filename={hoveredFile?.filename}
        src={hoveredFile?.src}
        x={hoveredFile?.x}
        y={hoveredFile?.y}
      />
    </div>
  );
}
