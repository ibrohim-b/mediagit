import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import ProjectHeader from "../components/ProjectHeader";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import FilePreview from "../components/FilePreview";
import HoverPreview from "../components/HoverPreview";
import {
  GitFork,
  GitBranch,
  Code2,
  GitCommitHorizontal,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  GitPullRequest,
  FileImage,
  GitMerge,
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
  if (months < 12)
    return `${months} month${months !== 1 ? "s" : ""} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

// ─── Tab definition ───────────────────────────────────────────────────────────


// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#238636]/20 text-[#3fb950] border border-[#238636]/40 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] inline-block" />
        Open
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-900/30 text-purple-400 border border-purple-500/40 whitespace-nowrap">
        <GitMerge size={11} />
        Merged
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-900/30 text-red-400 border border-red-500/40 whitespace-nowrap">
        <XCircle size={11} />
        Rejected
      </span>
    );
  }
  return null;
}

// ─── Change type badge ────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  if (type === "added") {
    return (
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-[#238636]/20 text-[#3fb950] border border-[#238636]/40 text-[10px] font-bold" title="Added">
        +
      </span>
    );
  }
  if (type === "deleted") {
    return (
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-red-900/30 text-red-400 border border-red-500/40 text-[10px] font-bold" title="Deleted">
        -
      </span>
    );
  }
  // modified
  return (
    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-yellow-900/30 text-yellow-400 border border-yellow-500/40 text-[10px] font-bold" title="Modified">
      M
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PRPage() {
  const { id, prid } = useParams();
  const { user } = useAuth();

  const [project, setProject]     = useState(null);
  const [pr, setPR]               = useState(null);
  const [loading, setLoading]     = useState(true);
  const [hoveredFile, setHoveredFile] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [reviewNote, setReviewNote]     = useState("");
  const [reviewing, setReviewing]       = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, prData] = await Promise.all([
        api.getProject(id),
        api.getPR(id, prid),
      ]);
      setProject(proj);
      setPR(prData);
    } finally {
      setLoading(false);
    }
  }, [id, prid]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Compute file list ────────────────────────────────────────────────────────

  const allFiles = useMemo(() => {
    if (!pr) return [];
    const branchMap = new Map(pr.branch_snapshots.map((s) => [s.filename, s]));
    const mainMap   = new Map(pr.main_snapshots.map((s) => [s.filename, s]));
    const allNames  = new Set([...branchMap.keys(), ...mainMap.keys()]);
    return [...allNames].map((name) => ({
      name,
      branchSnap: branchMap.get(name) ?? null,
      mainSnap:   mainMap.get(name)   ?? null,
      type: !mainMap.has(name)
        ? "added"
        : !branchMap.has(name)
        ? "deleted"
        : "modified",
    }));
  }, [pr]);

  // Auto-select first file once files are available
  useEffect(() => {
    if (allFiles.length > 0 && selectedFile === null) {
      setSelectedFile(allFiles[0].name);
    }
  }, [allFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Review handler ──────────────────────────────────────────────────────────

  const handleReview = async (action) => {
    setReviewing(true);
    try {
      await api.reviewPR(id, prid, { action, note: reviewNote });
      await load();
      setReviewNote("");
    } catch (err) {
      alert("Review failed: " + (err?.detail ?? "Unknown error"));
    } finally {
      setReviewing(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0d1117" }}
      >
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8b949e] text-sm">Loading pull request...</p>
        </div>
      </div>
    );
  }

  if (!project || !pr) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0d1117" }}
      >
        <p className="text-[#8b949e]">Pull request not found.</p>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const selectedFileData = allFiles.find((f) => f.name === selectedFile) ?? null;
  const canReview        = project.is_owner && pr.status === "open";
  const isReviewed       = pr.status !== "open" && pr.reviewed_by_username;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="-mx-4 -mt-6"
      style={{ color: "#e6edf3", minHeight: "100vh", backgroundColor: "#0d1117" }}
    >
      <ProjectHeader project={project} activeTab="pull-requests" />

      {/* ══ Page Body ════════════════════════════════════════════════════════════ */}
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">

        {/* ── PR Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          {/* Title + badge */}
          <div className="flex items-start gap-3 flex-wrap mb-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-[#e6edf3] leading-snug">
              {pr.title}
            </h1>
            <div className="mt-0.5">
              <StatusBadge status={pr.status} />
            </div>
          </div>

          {/* Meta line */}
          <p className="text-sm text-[#8b949e] leading-relaxed">
            <span className="text-[#e6edf3] font-medium">
              @{pr.created_by_username}
            </span>{" "}
            wants to merge branch{" "}
            <span className="font-mono text-xs bg-[#1c2128] border border-[#30363d] rounded px-1.5 py-0.5 text-[#58a6ff]">
              {pr.branch?.name}
            </span>{" "}
            into{" "}
            <span className="font-mono text-xs bg-[#1c2128] border border-[#30363d] rounded px-1.5 py-0.5 text-[#e6edf3]">
              main
            </span>
            {" · "}
            <span>{timeAgo(pr.created_at)}</span>
          </p>

          {/* Description */}
          {pr.description && (
            <div className="mt-3 px-4 py-3 bg-[#161b22] border border-[#30363d] rounded-md text-[#8b949e] text-sm leading-relaxed">
              {pr.description}
            </div>
          )}
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="border-t border-[#30363d] mb-6" />

        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        <div className="flex gap-4 items-start">

          {/* ── Left column: Files changed ─────────────────────────────────── */}
          <div className="w-64 flex-shrink-0">
            <h2 className="text-sm font-semibold text-[#e6edf3] mb-3">
              Files changed{" "}
              <span className="text-[#8b949e] font-normal">
                ({allFiles.length})
              </span>
            </h2>

            <div className="flex flex-col gap-0.5">
              {allFiles.length === 0 && (
                <p className="text-[#8b949e] text-xs px-3 py-4 text-center">
                  No files to show
                </p>
              )}
              {allFiles.map((file) => {
                const isSelected = selectedFile === file.name;
                const thumbSnap  = file.branchSnap ?? file.mainSnap;
                const thumbUrl   = thumbSnap
                  ? api.storageUrl(thumbSnap.storage_path)
                  : null;

                return (
                  <div
                    key={file.name}
                    onClick={() => setSelectedFile(file.name)}
                    className={`cursor-pointer hover:bg-[#1c2128] px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${
                      isSelected
                        ? "bg-[#1c2128] border border-[#30363d]"
                        : "border border-transparent"
                    }`}
                  >
                    {/* Thumbnail */}
                    {thumbUrl ? (
                      <FilePreview
                        src={thumbUrl}
                        filename={file.name}
                        className="rounded object-cover flex-shrink-0"
                        style={{ width: 20, height: 20 }}
                        onMouseEnter={(e) => setHoveredFile({ src: thumbUrl, filename: file.name, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHoveredFile(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setHoveredFile(null)}
                      />
                    ) : (
                      <div
                        className="rounded bg-[#21262d] flex items-center justify-center flex-shrink-0"
                        style={{ width: 20, height: 20 }}
                      >
                        <FileImage size={11} className="text-[#8b949e]" />
                      </div>
                    )}

                    {/* Filename */}
                    <span
                      className={`text-xs truncate flex-1 min-w-0 ${
                        isSelected ? "text-[#58a6ff]" : "text-[#e6edf3]"
                      }`}
                      title={file.name}
                    >
                      {file.name}
                    </span>

                    {/* Type badge */}
                    <TypeBadge type={file.type} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right column: Diff preview ─────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {!selectedFile ? (
              <div className="flex items-center justify-center h-64 bg-[#161b22] border border-[#30363d] rounded-md">
                <p className="text-[#8b949e] text-sm">
                  Select a file to preview changes
                </p>
              </div>
            ) : (
              <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
                {/* File header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#30363d] bg-[#1c2128]">
                  <FileImage size={14} className="text-[#8b949e] flex-shrink-0" />
                  <span className="text-sm font-mono text-[#e6edf3] truncate flex-1">
                    {selectedFile}
                  </span>
                  {selectedFileData && (
                    <TypeBadge type={selectedFileData.type} />
                  )}
                </div>

                {/* Side-by-side */}
                <div className="flex">
                  {/* BEFORE (main) */}
                  <div className="flex-1 border-r border-[#30363d] flex flex-col">
                    <div className="px-3 py-1.5 bg-red-900/10 border-b border-[#30363d] flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-red-400">
                        Before
                      </span>
                      <span className="text-[#8b949e] text-xs">(main)</span>
                    </div>
                    <div
                      className="bg-[#0d1117] flex items-center justify-center flex-1"
                      style={{ minHeight: 200 }}
                    >
                      {selectedFileData?.mainSnap ? (
                        <FilePreview
                          src={api.storageUrl(
                            selectedFileData.mainSnap.storage_path,
                          )}
                          filename={selectedFile}
                          className="w-full object-contain"
                          style={{ maxHeight: 400 }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                          <div className="w-10 h-10 rounded-full bg-[#238636]/10 border border-[#238636]/30 flex items-center justify-center">
                            <GitPullRequest
                              size={18}
                              className="text-[#3fb950]"
                            />
                          </div>
                          <span className="text-xs font-semibold text-[#3fb950]">
                            New file
                          </span>
                          <span className="text-xs text-[#8b949e]">
                            Doesn't exist in main
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AFTER (branch) */}
                  <div className="flex-1 flex flex-col">
                    <div className="px-3 py-1.5 bg-[#238636]/10 border-b border-[#30363d] flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#3fb950]">
                        After
                      </span>
                      <span className="text-[#8b949e] text-xs">
                        ({pr.branch?.name ?? "branch"})
                      </span>
                    </div>
                    <div
                      className="bg-[#0d1117] flex items-center justify-center flex-1"
                      style={{ minHeight: 200 }}
                    >
                      {selectedFileData?.branchSnap ? (
                        <FilePreview
                          src={api.storageUrl(
                            selectedFileData.branchSnap.storage_path,
                          )}
                          filename={selectedFile}
                          className="w-full object-contain"
                          style={{ maxHeight: 400 }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                          <div className="w-10 h-10 rounded-full bg-red-900/20 border border-red-500/30 flex items-center justify-center">
                            <XCircle size={18} className="text-red-400" />
                          </div>
                          <span className="text-xs font-semibold text-red-400">
                            Deleted
                          </span>
                          <span className="text-xs text-[#8b949e]">
                            Removed in this branch
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Review section (project owner + PR still open) ─────────── */}
            {canReview && (
              <div className="border-t border-[#30363d] mt-6 pt-6">
                <h3 className="text-base font-semibold text-[#e6edf3] mb-4 flex items-center gap-2">
                  <GitPullRequest size={16} className="text-[#58a6ff]" />
                  Review changes
                </h3>

                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Leave a review note (optional)..."
                  disabled={reviewing}
                  className="bg-[#0d1117] border border-[#30363d] rounded-md p-3 text-sm w-full mb-4 resize-none h-20 focus:border-[#58a6ff] outline-none text-[#e6edf3] placeholder-[#8b949e] transition-colors disabled:opacity-60"
                />

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => handleReview("approve")}
                    disabled={reviewing}
                    className="flex items-center gap-2 bg-[#238636] hover:bg-[#2ea043] text-white px-5 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reviewing ? (
                      <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle size={15} />
                    )}
                    Approve & Merge
                  </button>

                  <button
                    onClick={() => handleReview("reject")}
                    disabled={reviewing}
                    className="flex items-center gap-2 bg-[#da3633] hover:bg-[#b91c1c] text-white px-5 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reviewing ? (
                      <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <XCircle size={15} />
                    )}
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* ── Review result card (PR already reviewed) ────────────────── */}
            {isReviewed && (
              <div className="mt-6">
                {pr.status === "approved" ? (
                  <div className="flex items-start gap-3 p-4 bg-purple-900/20 border border-purple-500/30 rounded-md">
                    <CheckCircle
                      size={18}
                      className="text-purple-400 flex-shrink-0 mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-purple-400">
                        Merged by{" "}
                        <span className="font-semibold">
                          @{pr.reviewed_by_username}
                        </span>
                      </p>
                      <p className="text-xs text-[#8b949e] mt-0.5">
                        {timeAgo(pr.reviewed_at)}
                      </p>
                      {pr.review_note && (
                        <p className="text-sm text-[#8b949e] mt-2 leading-relaxed">
                          {pr.review_note}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-500/30 rounded-md">
                    <XCircle
                      size={18}
                      className="text-red-400 flex-shrink-0 mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-red-400">
                        Rejected by{" "}
                        <span className="font-semibold">
                          @{pr.reviewed_by_username}
                        </span>
                      </p>
                      <p className="text-xs text-[#8b949e] mt-0.5">
                        {timeAgo(pr.reviewed_at)}
                      </p>
                      {pr.review_note && (
                        <p className="text-sm text-[#8b949e] mt-2 leading-relaxed">
                          {pr.review_note}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
