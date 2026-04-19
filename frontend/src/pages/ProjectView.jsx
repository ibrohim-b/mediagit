import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import ProjectHeader from "../components/ProjectHeader";
import FilePreview from "../components/FilePreview";
import HoverPreview from "../components/HoverPreview";
import {
  Globe,
  Lock,
  GitCommitHorizontal,
  Upload,
  X,
  Check,
  Users,
  ChevronDown,
  Copy,
  RotateCcw,
  ImageIcon,
  Search,
  Plus,
  Clock,
  GitBranch,
  List,
  LayoutGrid,
  AlignJustify,
  GitPullRequest,
  GitMerge,
  ArrowRight,
  History,
  XCircle,
  CheckCircle,
  CreditCard,
  DollarSign,
} from "lucide-react";

const TRACK_COLORS = [
  "#58a6ff", // Main (Blue/Azure)
  "#3fb950", // Track 1 (Green/Emerald)
  "#8957e5", // Track 2 (Purple/Amethyst)
  "#f78166", // Track 3 (Orange/Coral)
  "#e3b341", // Track 4 (Yellow/Gold)
  "#f14c4c", // Track 5 (Red/Ruby)
];

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

function formatDateHeader(dateStr) {
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function groupCommitsByDate(commits) {
  const groups = [];
  const map = new Map();
  commits.forEach((c) => {
    const d = new Date(
      c.created_at.endsWith("Z") ? c.created_at : c.created_at + "Z",
    );
    const key = d.toDateString();
    if (!map.has(key)) {
      map.set(key, { label: formatDateHeader(c.created_at), commits: [] });
      groups.push(map.get(key));
    }
    map.get(key).commits.push(c);
  });
  return groups;
}

function AvatarCircle({ name, size = 8 }) {
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
      className={`w-${size} h-${size} ${color} rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0`}
    >
      {initial}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ProjectView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  // core state
  const [project, setProject] = useState(null);
  const [staged, setStaged] = useState([]);
  const [stagedRemovals, setStagedRemovals] = useState(new Set());
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  // collaborator state
  const [collabInput, setCollabInput] = useState("");
  const [collabError, setCollabError] = useState("");

  const location = useLocation();
  const hashTab = location.hash.replace("#", "") || "media";
  const validTabs = [
    "media",
    "commits",
    "branches",
    "pull-requests",
    "collaborators",
  ];
  const activeTab = validTabs.includes(hashTab) ? hashTab : "media";
  const setActiveTab = (tab) => {
    window.location.hash = tab;
  };

  // UI state
  const [showUpload, setShowUpload] = useState(false);
  const [copiedHash, setCopiedHash] = useState(null);
  const [hoveredFile, setHoveredFile] = useState(null);
  const [fileView, setFileView] = useState("list"); // "list" | "grid" | "compact"
  const [commitViewMode, setCommitViewMode] = useState("timeline"); // "timeline" | "list"
  const [commitTooltip, setCommitTooltip] = useState(null); // { commit, isLatest, x, y }
  const [pullRequests, setPullRequests] = useState([]);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [prFilter, setPrFilter] = useState("all"); // "all" | "open" | "approved" | "rejected"
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const branchDropdownRef = useRef(null);

  // timeline state
  const [timelineData, setTimelineData] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // branches state
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showBranchForm, setShowBranchForm] = useState(false);

  // paywall state
  const [priceInput, setPriceInput] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    api.getProject(id).then(setProject);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Load branches for both the branches tab AND the branch dropdown in the media tab
  useEffect(() => {
    if (project?.gated) return;
    if (activeTab === "branches" || activeTab === "media") {
      setLoadingBranches(true);
      api
        .getBranches(id)
        .then((b) => {
          setBranches(b);
          setLoadingBranches(false);
        })
        .catch(() => {
          setBranches([]);
          setLoadingBranches(false);
        });
    }
  }, [activeTab, id, project?.gated]);

  // Close branch dropdown when clicking outside
  useEffect(() => {
    if (!showBranchDropdown) return;
    const handleClick = (e) => {
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(e.target)
      ) {
        setShowBranchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showBranchDropdown]);

  useEffect(() => {
    if (project?.gated) return;
    if (activeTab === "pull-requests") {
      setLoadingPRs(true);
      api
        .getPRs(id)
        .then((prs) => {
          setPullRequests(prs);
          setLoadingPRs(false);
        })
        .catch(() => {
          setPullRequests([]);
          setLoadingPRs(false);
        });
    }
  }, [activeTab, id, project?.gated]);

  const loadTimeline = useCallback(() => {
    setLoadingTimeline(true);
    api
      .getTimeline(id)
      .then((data) => {
        setTimelineData(data);
        setLoadingTimeline(false);
      })
      .catch((e) => {
        console.error("Failed to load timeline", e);
        setLoadingTimeline(false);
      });
  }, [id]);

  useEffect(() => {
    if (project?.gated) return;
    if (activeTab === "commits") {
      loadTimeline();
    }
  }, [activeTab, loadTimeline, project?.gated]);

  const canWrite = project
    ? project.is_owner ||
      (project.collaborators ?? []).some((c) => c.id === user?.id)
    : false;

  // ── file handling ──────────────────────────────────────────────────────────

  const handleFiles = async (files) => {
    setUploading(true);
    for (const f of files) {
      if (
        !f.type.startsWith("image/") &&
        !f.name.toLowerCase().endsWith(".psd")
      )
        continue;
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

  // ── commit ─────────────────────────────────────────────────────────────────

  const commit = async () => {
    if (!message.trim() || (staged.length === 0 && stagedRemovals.size === 0))
      return;

    const headSnapshots = project.commits[0]?.snapshots || [];
    const newFilenames = new Set(staged.map((s) => s.filename));
    const carried = headSnapshots.filter(
      (s) => !stagedRemovals.has(s.filename) && !newFilenames.has(s.filename),
    );

    await api.createCommit(id, {
      message,
      snapshots: [
        ...carried.map((s) => ({
          filename: s.filename,
          file_hash: s.file_hash,
          storage_path: s.storage_path,
          file_size: s.file_size,
        })),
        ...staged.map((s) => ({
          filename: s.filename,
          file_hash: s.file_hash,
          storage_path: s.storage_path,
          file_size: s.file_size,
        })),
      ],
    });
    setStaged([]);
    setStagedRemovals(new Set());
    setMessage("");
    setShowUpload(false);
    load();
  };

  const removeStaged = (index) => {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  };

  // ── rollback ───────────────────────────────────────────────────────────────

  const rollback = async (commitId) => {
    if (!confirm("Rollback to this commit? All newer commits will be removed."))
      return;
    await api.rollback(id, commitId);
    load();
  };

  // ── collaborators ──────────────────────────────────────────────────────────

  const addCollaborator = async () => {
    setCollabError("");
    const username = collabInput.trim().replace(/^@/, "");
    const res = await api.addCollaborator(id, username);
    if (res.detail) {
      setCollabError(res.detail);
      return;
    }
    setCollabInput("");
    load();
  };

  const removeCollaborator = async (uid) => {
    await api.removeCollaborator(id, uid);
    load();
  };

  // ── visibility ─────────────────────────────────────────────────────────────

  const toggleVisibility = async () => {
    const next = project.visibility === "public" ? "private" : "public";
    await api.updateVisibility(id, next);
    load();
  };

  // ── paywall handlers ───────────────────────────────────────────────────────

  const handleSetPrice = async (overrideVal) => {
    const val =
      overrideVal !== undefined ? overrideVal : parseFloat(priceInput);
    if (isNaN(val) || val < 0) return;
    setPriceSaving(true);
    await api.setProjectPrice(id, val);
    setPriceInput("");
    setPriceSaving(false);
    load();
  };

  const handlePay = async () => {
    setPayLoading(true);
    try {
      await api.payForProject(id);
      setPaySuccess(true);
      setTimeout(() => {
        setPaySuccess(false);
        load();
      }, 1800);
    } catch {
      setPayLoading(false);
    }
  };

  // ── copy hash ──────────────────────────────────────────────────────────────

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const createBranch = async () => {
    const name = newBranchName.trim();
    if (!name) return;
    await api.createBranch(id, {
      name,
      base_commit_id: project.commits[0]?.id ?? null,
    });
    setNewBranchName("");
    setShowBranchForm(false);
    api.getBranches(id).then(setBranches);
  };

  const handleCommitNavigate = (clickedId) => {
    if (!project?.commits?.length) return;
    const params = new URLSearchParams();
    const latestId = project.commits[0].id;
    if (String(clickedId) === String(latestId)) {
      if (project.commits[1]) params.set("a", String(project.commits[1].id));
    } else {
      params.set("a", String(clickedId));
    }
    params.set("b", String(latestId));
    nav(`/project/${id}/diff?${params.toString()}`);
  };

  // ── derived file list ──────────────────────────────────────────────────────

  const getLatestFiles = () => {
    if (!project || !project.commits || project.commits.length === 0) return [];

    // Build a map: filename -> { snap, lastCommit, versions }
    const fileInfo = new Map();

    // Iterate commits newest→oldest to find each file's last commit
    [...project.commits].forEach((c) => {
      c.snapshots.forEach((s) => {
        if (!fileInfo.has(s.filename)) {
          fileInfo.set(s.filename, {
            snap: s,
            lastCommit: c,
            versions: 0,
          });
        }
        fileInfo.get(s.filename).versions += 1;
      });
    });

    // Only keep files in the HEAD commit
    const headFiles = new Set(
      (project.commits[0]?.snapshots ?? []).map((s) => s.filename),
    );

    return [...fileInfo.entries()]
      .filter(([name]) => headFiles.has(name))
      .map(([name, info]) => ({ name, ...info }));
  };

  // ─── loading ───────────────────────────────────────────────────────────────

  if (!project)
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8b949e] text-sm">Loading project…</p>
        </div>
      </div>
    );

  // ── Paywall gate ──────────────────────────────────────────────────────────
  if (project.gated) {
    return (
      <div
        className="max-w-7xl mx-auto px-4 py-6 min-h-screen"
        style={{ color: "#e6edf3" }}
      >
        {/* Minimal header strip */}
        <div className="flex items-center gap-3 mb-10">
          <button
            onClick={() => nav("/dashboard")}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors text-sm flex items-center gap-1.5"
          >
            ← Dashboard
          </button>
        </div>

        <div className="max-w-xl mx-auto text-center">
          {/* Lock icon with glow */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-yellow-500/20 blur-2xl" />
            <div className="relative w-24 h-24 rounded-full bg-[#161b22] border border-yellow-500/30 flex items-center justify-center">
              <Lock size={40} className="text-yellow-400" />
            </div>
          </div>

          {/* Project info */}
          <h1 className="text-3xl font-bold text-[#e6edf3] mb-2">
            {project.name}
          </h1>
          <p className="text-[#8b949e] text-sm mb-1">
            by{" "}
            <span className="text-[#58a6ff] font-medium">
              @{project.owner?.username}
            </span>
          </p>
          {project.description && (
            <p className="text-[#8b949e] text-sm mt-3 leading-relaxed max-w-md mx-auto">
              {project.description}
            </p>
          )}

          {/* Paywall card */}
          <div className="mt-10 bg-[#161b22] border border-[#30363d] rounded-2xl p-8 shadow-2xl">
            {/* Tier label */}
            <div className="inline-flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-6">
              <DollarSign size={11} />
              Premium Access
            </div>

            {/* What you get */}
            <ul className="text-left text-sm text-[#8b949e] space-y-2 mb-8">
              {[
                "Full access to all media files",
                "View complete commit history",
                "Access to all branches",
                "Lifetime access after payment",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#238636]/30 border border-[#238636]/50 flex items-center justify-center flex-shrink-0">
                    <Check size={9} className="text-[#3fb950]" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            {/* Price display */}
            <div className="border-t border-[#30363d] pt-6 mb-6">
              <p className="text-[#8b949e] text-xs uppercase tracking-wider mb-1">
                One-time access fee
              </p>
              <p className="text-5xl font-black text-[#e6edf3] tracking-tight">
                ${project.price.toFixed(2)}
              </p>
            </div>

            {/* Pay button */}
            {paySuccess ? (
              <div className="flex items-center justify-center gap-2 py-3 text-[#3fb950] font-semibold text-sm">
                <div className="w-5 h-5 rounded-full bg-[#238636]/30 flex items-center justify-center">
                  <Check size={12} />
                </div>
                Access granted! Loading project…
              </div>
            ) : (
              <button
                onClick={handlePay}
                disabled={payLoading}
                className="w-full bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
              >
                {payLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Processing payment…
                  </>
                ) : (
                  <>
                    <CreditCard size={15} />
                    Unlock access for ${project.price.toFixed(2)}
                  </>
                )}
              </button>
            )}

            {/* Mock notice */}
            <p className="text-[#484f58] text-xs mt-4 flex items-center justify-center gap-1.5">
              <Lock size={10} />
              This is a demo — no real payment is processed
            </p>
          </div>
        </div>
      </div>
    );
  }

  const latestFiles = getLatestFiles();
  const latestCommit = (project.commits ?? [])[0] ?? null;
  const hasStagedChanges = staged.length > 0 || stagedRemovals.size > 0;

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="max-w-7xl mx-auto px-4 py-6 min-h-0"
      style={{ color: "#e6edf3" }}
    >
      <ProjectHeader project={project} activeTab={activeTab} />
      <div className="mt-6" />

      {/* ═══════════════════════════════════════════════════════════════════
          CODE TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "media" && (
        <div className="flex gap-6 items-start">
          {/* ── Left column (main) ────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Branch / info bar */}
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                {/* ── Branch switcher dropdown ─────────────────────────── */}
                <div className="relative" ref={branchDropdownRef}>
                  <button
                    onClick={() => setShowBranchDropdown((v) => !v)}
                    className="flex items-center gap-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md px-3 py-1.5 text-sm transition-colors"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="text-[#8b949e]"
                    >
                      <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
                    </svg>
                    <span className="font-medium">main</span>
                    <ChevronDown
                      size={12}
                      className={`text-[#8b949e] transition-transform duration-150 ${showBranchDropdown ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Dropdown panel */}
                  {showBranchDropdown && (
                    <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-50 overflow-hidden">
                      {/* Header */}
                      <div className="px-3 py-2 border-b border-[#30363d]">
                        <p className="text-xs text-[#8b949e] font-semibold uppercase tracking-wider">
                          Switch branch
                        </p>
                      </div>

                      {/* main (always first, always active view) */}
                      <button
                        onClick={() => setShowBranchDropdown(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#1c2128] transition-colors text-left"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="text-[#3fb950] flex-shrink-0"
                        >
                          <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
                        </svg>
                        <span className="font-medium text-[#e6edf3]">main</span>
                        <span className="ml-auto text-[10px] font-semibold text-[#3fb950] bg-[#238636]/20 border border-[#238636]/40 px-1.5 py-px rounded-full">
                          default
                        </span>
                      </button>

                      {/* Branch list */}
                      {loadingBranches ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-4 h-4 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : branches.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-[#8b949e] text-center">
                          No other branches
                        </p>
                      ) : (
                        <div className="border-t border-[#30363d] py-1">
                          {branches.map((branch) => (
                            <button
                              key={branch.id}
                              onClick={() => {
                                setShowBranchDropdown(false);
                                nav(`/project/${id}/branch/${branch.id}`);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#1c2128] transition-colors text-left group"
                            >
                              <GitBranch
                                size={13}
                                className="text-[#8b949e] flex-shrink-0 group-hover:text-[#58a6ff]"
                              />
                              <span className="text-[#e6edf3] truncate flex-1">
                                {branch.name}
                              </span>
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-px rounded-full border flex-shrink-0 ${
                                  branch.status === "active"
                                    ? "text-[#3fb950] bg-[#238636]/20 border-[#238636]/40"
                                    : branch.status === "merged"
                                      ? "text-purple-400 bg-purple-900/30 border-purple-500/40"
                                      : "text-red-400 bg-red-900/20 border-red-500/30"
                                }`}
                              >
                                {branch.status ?? "active"}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {project.commits.length > 0 && (
                  <button
                    onClick={() => setActiveTab("commits")}
                    className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#58a6ff] text-sm transition-colors"
                  >
                    <GitCommitHorizontal size={14} />
                    <span className="font-medium">
                      {project.commits.length}
                    </span>
                    <span>commit{project.commits.length !== 1 ? "s" : ""}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFileView("list")}
                    title="List view"
                    className={`p-1.5 rounded border transition-colors ${
                      fileView === "list"
                        ? "border-[#58a6ff] text-[#58a6ff] bg-[#58a6ff]/10"
                        : "border-transparent text-[#8b949e] hover:text-[#e6edf3]"
                    }`}
                  >
                    <List size={14} />
                  </button>
                  <button
                    onClick={() => setFileView("grid")}
                    title="Grid view"
                    className={`p-1.5 rounded border transition-colors ${
                      fileView === "grid"
                        ? "border-[#58a6ff] text-[#58a6ff] bg-[#58a6ff]/10"
                        : "border-transparent text-[#8b949e] hover:text-[#e6edf3]"
                    }`}
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <button
                    onClick={() => setFileView("compact")}
                    title="Compact view"
                    className={`p-1.5 rounded border transition-colors ${
                      fileView === "compact"
                        ? "border-[#58a6ff] text-[#58a6ff] bg-[#58a6ff]/10"
                        : "border-transparent text-[#8b949e] hover:text-[#e6edf3]"
                    }`}
                  >
                    <AlignJustify size={14} />
                  </button>
                </div>
                {canWrite && (
                  <button
                    onClick={() => setShowUpload((v) => !v)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      showUpload
                        ? "bg-[#238636] hover:bg-[#2ea043] border-[#2ea043] text-white"
                        : "bg-[#21262d] hover:bg-[#30363d] border-[#30363d] text-[#e6edf3]"
                    }`}
                  >
                    <Plus size={14} />
                    Add files
                  </button>
                )}
              </div>
            </div>

            {/* ── Upload zone (collapsible) ─────────────────────────── */}
            {showUpload && canWrite && (
              <div className="mb-4">
                <div
                  onDrop={onDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  className={`border-2 border-dashed rounded-md p-8 text-center transition-all ${
                    dragging
                      ? "border-[#58a6ff] bg-[#58a6ff10]"
                      : "border-[#30363d] hover:border-[#8b949e] bg-[#161b22]"
                  }`}
                >
                  {uploading ? (
                    <div className="flex items-center justify-center gap-3 text-[#58a6ff]">
                      <div className="w-4 h-4 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </div>
                  ) : (
                    <>
                      <Upload
                        size={28}
                        className="text-[#8b949e] mx-auto mb-3"
                      />
                      <p className="text-[#8b949e] text-sm mb-1">
                        Drag &amp; drop images here, or{" "}
                        <label className="text-[#58a6ff] hover:underline cursor-pointer">
                          browse
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.psd"
                            onChange={onFileSelect}
                            className="hidden"
                          />
                        </label>
                      </p>
                      <p className="text-[#6e7681] text-xs">
                        PNG, JPG, SVG, WebP, PSD supported
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── File browser table ─────────────────────────────────── */}
            {project.commits.length === 0 ? (
              <div className="bg-[#161b22] border border-[#30363d] rounded-md p-12 text-center">
                <ImageIcon size={40} className="text-[#8b949e] mx-auto mb-4" />
                <h3 className="text-[#e6edf3] font-semibold mb-2">
                  Get started with MediaGit
                </h3>
                <p className="text-[#8b949e] text-sm mb-4">
                  Upload images and make your first commit to track changes.
                </p>
                {canWrite && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Add files
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden mb-4">
                {/* Table header: latest commit summary */}
                {latestCommit && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#161b22] border-b border-[#21262d]">
                    <AvatarCircle
                      name={latestCommit.committer_username || "?"}
                      size={6}
                    />
                    <span className="text-[#e6edf3] text-sm font-medium truncate">
                      {latestCommit.committer_username && (
                        <span className="font-semibold text-[#e6edf3] mr-1">
                          {latestCommit.committer_username}
                        </span>
                      )}
                      <span className="text-[#8b949e] font-normal">
                        {latestCommit.message}
                      </span>
                    </span>
                    <span className="ml-auto text-[#8b949e] text-xs flex-shrink-0">
                      {timeAgo(latestCommit.created_at)}
                    </span>
                    <button
                      onClick={() => setActiveTab("commits")}
                      className="text-[#8b949e] hover:text-[#58a6ff] text-xs border border-[#30363d] px-2 py-1 rounded-md flex-shrink-0 transition-colors flex items-center gap-1"
                    >
                      <GitCommitHorizontal size={12} />
                      {project.commits.length} commits
                    </button>
                  </div>
                )}

                {/* File rows */}
                {latestFiles.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[#8b949e] text-sm">
                    No files in this commit.
                  </div>
                ) : fileView === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
                    {latestFiles.map(({ name, snap, lastCommit }) => (
                      <div
                        key={name}
                        onClick={() =>
                          nav(
                            `/project/${id}/diff?file=${encodeURIComponent(name)}&b=${latestCommit?.id ?? ""}`,
                          )
                        }
                        className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden cursor-pointer hover:border-[#58a6ff] transition-colors group"
                      >
                        <div className="h-48 overflow-hidden">
                          <FilePreview
                            src={api.storageUrl(snap.storage_path)}
                            filename={name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onMouseEnter={(e) =>
                              setHoveredFile({
                                snap,
                                name,
                                x: e.clientX,
                                y: e.clientY,
                              })
                            }
                            onMouseMove={(e) =>
                              setHoveredFile((prev) =>
                                prev
                                  ? { ...prev, x: e.clientX, y: e.clientY }
                                  : null,
                              )
                            }
                            onMouseLeave={() => setHoveredFile(null)}
                          />
                        </div>
                        <div className="p-3">
                          <p className="text-[#e6edf3] text-sm font-medium truncate">
                            {name}
                          </p>
                          <p className="text-[#8b949e] text-xs mt-0.5">
                            {timeAgo(lastCommit?.created_at)}
                          </p>
                          {canWrite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStagedRemovals((prev) => {
                                  const n = new Set(prev);
                                  n.has(name) ? n.delete(name) : n.add(name);
                                  return n;
                                });
                              }}
                              className={`mt-1 text-xs px-1.5 py-0.5 rounded border transition-colors ${
                                stagedRemovals.has(name)
                                  ? "bg-red-500/20 text-red-400 border-red-500/40"
                                  : "text-[#6e7681] border-transparent hover:text-red-400 hover:border-red-500/30"
                              }`}
                            >
                              {stagedRemovals.has(name) ? "− staged" : "−"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : fileView === "compact" ? (
                  <div>
                    {latestFiles.map(({ name, snap, lastCommit }, i) => (
                      <div
                        key={name}
                        onClick={() =>
                          nav(
                            `/project/${id}/diff?file=${encodeURIComponent(name)}&b=${latestCommit?.id ?? ""}`,
                          )
                        }
                        className={`flex items-center gap-3 px-4 py-2.5 hover:bg-[#1c2128] cursor-pointer transition-colors ${
                          i < latestFiles.length - 1
                            ? "border-b border-[#21262d]"
                            : ""
                        }`}
                      >
                        <FilePreview
                          className="w-14 h-14 object-cover rounded flex-shrink-0"
                          src={api.storageUrl(snap.storage_path)}
                          filename={name}
                          onMouseEnter={(e) =>
                            setHoveredFile({
                              snap,
                              name,
                              x: e.clientX,
                              y: e.clientY,
                            })
                          }
                          onMouseMove={(e) =>
                            setHoveredFile((prev) =>
                              prev
                                ? { ...prev, x: e.clientX, y: e.clientY }
                                : null,
                            )
                          }
                          onMouseLeave={() => setHoveredFile(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              api.storageUrl(snap.storage_path),
                              "_blank",
                            );
                          }}
                        />
                        <span className="text-[#58a6ff] text-sm truncate flex-1">
                          {name}
                        </span>
                        <span className="text-[#8b949e] text-xs flex-shrink-0">
                          {timeAgo(lastCommit?.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* list view (default) */
                  latestFiles.map(({ name, snap, lastCommit, versions }, i) => (
                    <div
                      key={name}
                      onClick={() =>
                        nav(
                          `/project/${id}/diff?file=${encodeURIComponent(name)}&b=${latestCommit?.id ?? ""}`,
                        )
                      }
                      className={`flex items-center gap-4 px-4 py-4 hover:bg-[#1c2128] transition-colors cursor-pointer ${
                        i < latestFiles.length - 1
                          ? "border-b border-[#21262d]"
                          : ""
                      }`}
                    >
                      {/* Thumbnail */}
                      <FilePreview
                        src={api.storageUrl(snap.storage_path)}
                        filename={name}
                        className="w-20 h-20 object-cover rounded-md border border-[#30363d] flex-shrink-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(
                            api.storageUrl(snap.storage_path),
                            "_blank",
                          );
                        }}
                        onMouseEnter={(e) =>
                          setHoveredFile({
                            snap,
                            name,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                        onMouseMove={(e) =>
                          setHoveredFile((prev) =>
                            prev
                              ? { ...prev, x: e.clientX, y: e.clientY }
                              : null,
                          )
                        }
                        onMouseLeave={() => setHoveredFile(null)}
                      />

                      {/* Filename */}
                      <span
                        className="text-[#58a6ff] text-sm hover:underline truncate min-w-0 flex-shrink-0 w-56 cursor-pointer"
                        onMouseEnter={(e) =>
                          setHoveredFile({
                            snap,
                            name,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                        onMouseMove={(e) =>
                          setHoveredFile((prev) =>
                            prev
                              ? { ...prev, x: e.clientX, y: e.clientY }
                              : null,
                          )
                        }
                        onMouseLeave={() => setHoveredFile(null)}
                      >
                        {name}
                      </span>

                      {/* Last commit message for this file */}
                      <span className="text-[#8b949e] text-sm truncate flex-1 min-w-0">
                        {lastCommit?.message ?? ""}
                      </span>

                      {/* versions badge */}
                      <span className="text-[#6e7681] text-xs flex-shrink-0">
                        {versions} version{versions !== 1 ? "s" : ""}
                      </span>

                      {/* Time */}
                      <span className="text-[#8b949e] text-xs flex-shrink-0 w-24 text-right">
                        {timeAgo(lastCommit?.created_at)}
                      </span>

                      {/* Remove button */}
                      {canWrite && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStagedRemovals((prev) => {
                              const n = new Set(prev);
                              n.has(name) ? n.delete(name) : n.add(name);
                              return n;
                            });
                          }}
                          className={`flex-shrink-0 text-xs px-2 py-0.5 rounded border transition-colors ${
                            stagedRemovals.has(name)
                              ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
                              : "text-[#6e7681] border-transparent hover:text-red-400 hover:border-red-500/30"
                          }`}
                          title={
                            stagedRemovals.has(name)
                              ? "Unstage removal"
                              : "Stage for removal"
                          }
                        >
                          {stagedRemovals.has(name) ? "− staged" : "−"}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Staged changes panel ──────────────────────────────── */}
            {hasStagedChanges && (
              <div className="bg-[#161b22] border border-[#238636] rounded-md p-4 mb-4">
                <h3 className="text-sm font-semibold text-[#3fb950] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#3fb950] rounded-full animate-pulse" />
                  Staged changes — {staged.length + stagedRemovals.size} file
                  {staged.length + stagedRemovals.size !== 1 ? "s" : ""}
                </h3>

                {/* Thumbnails */}
                <div className="flex gap-3 flex-wrap mb-4">
                  {/* Removals */}
                  {[...stagedRemovals].map((filename) => {
                    const snap = project.commits
                      .flatMap((c) => c.snapshots)
                      .find((s) => s.filename === filename);
                    return snap ? (
                      <div key={filename} className="relative group">
                        {filename.endsWith(".psd") ? (
                          <div
                            className="w-20 h-20 bg-[#1f2428] rounded border border-red-800 opacity-50 flex flex-col items-center justify-center text-[#58a6ff]"
                            onMouseEnter={(e) =>
                              setHoveredFile({
                                snap,
                                x: e.clientX,
                                y: e.clientY,
                              })
                            }
                            onMouseMove={(e) =>
                              setHoveredFile((prev) =>
                                prev
                                  ? { ...prev, x: e.clientX, y: e.clientY }
                                  : null,
                              )
                            }
                            onMouseLeave={() => setHoveredFile(null)}
                          >
                            <span className="text-xl mb-1">🎨</span>
                            <span className="text-[10px] font-bold">PSD</span>
                          </div>
                        ) : (
                          <img
                            src={api.storageUrl(snap.storage_path)}
                            alt={filename}
                            className="w-20 h-20 object-cover rounded border border-red-800 opacity-50"
                            onMouseEnter={(e) =>
                              setHoveredFile({
                                snap,
                                x: e.clientX,
                                y: e.clientY,
                              })
                            }
                            onMouseMove={(e) =>
                              setHoveredFile((prev) =>
                                prev
                                  ? { ...prev, x: e.clientX, y: e.clientY }
                                  : null,
                              )
                            }
                            onMouseLeave={() => setHoveredFile(null)}
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-red-400 text-2xl font-bold">
                            −
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setStagedRemovals((prev) => {
                              const n = new Set(prev);
                              n.delete(filename);
                              return n;
                            })
                          }
                          className="absolute -top-1.5 -right-1.5 bg-[#30363d] hover:bg-[#3d444e] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <X size={10} />
                        </button>
                        <p className="text-xs text-red-400 mt-1 truncate w-20">
                          {filename}
                        </p>
                      </div>
                    ) : null;
                  })}

                  {/* Additions */}
                  {staged.map((s, i) => (
                    <div key={i} className="relative group">
                      {s.filename.endsWith(".psd") ? (
                        <div
                          className="w-20 h-20 bg-[#1f2428] rounded border border-[#238636] flex flex-col items-center justify-center text-[#58a6ff]"
                          onMouseEnter={(e) =>
                            setHoveredFile({
                              snap: s,
                              x: e.clientX,
                              y: e.clientY,
                            })
                          }
                          onMouseMove={(e) =>
                            setHoveredFile((prev) =>
                              prev
                                ? { ...prev, x: e.clientX, y: e.clientY }
                                : null,
                            )
                          }
                          onMouseLeave={() => setHoveredFile(null)}
                        >
                          <span className="text-xl mb-1">🎨</span>
                          <span className="text-[10px] font-bold">PSD</span>
                        </div>
                      ) : (
                        <img
                          src={api.storageUrl(s.storage_path)}
                          alt={s.filename}
                          className="w-20 h-20 object-cover rounded border border-[#238636]"
                          onMouseEnter={(e) =>
                            setHoveredFile({
                              snap: s,
                              x: e.clientX,
                              y: e.clientY,
                            })
                          }
                          onMouseMove={(e) =>
                            setHoveredFile((prev) =>
                              prev
                                ? { ...prev, x: e.clientX, y: e.clientY }
                                : null,
                            )
                          }
                          onMouseLeave={() => setHoveredFile(null)}
                        />
                      )}
                      <button
                        onClick={() => removeStaged(i)}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        <X size={10} />
                      </button>
                      <p className="text-xs text-[#8b949e] mt-1 truncate w-20">
                        {s.filename}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Commit input */}
                <div className="flex gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder='Commit message (e.g. "Updated hero banner")'
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm focus:border-[#58a6ff] outline-none transition-colors placeholder:text-[#6e7681]"
                    onKeyDown={(e) => e.key === "Enter" && commit()}
                  />
                  <button
                    onClick={commit}
                    disabled={!message.trim()}
                    className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 text-white"
                  >
                    <Check size={14} />
                    Commit changes
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────── */}
          <div className="w-64 flex-shrink-0 space-y-4">
            {/* About */}
            <div className="border border-[#30363d] rounded-md p-4">
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">
                About
              </h3>
              {project.description ? (
                <p className="text-[#8b949e] text-sm mb-3">
                  {project.description}
                </p>
              ) : (
                <p className="text-[#6e7681] text-sm italic mb-3">
                  No description provided.
                </p>
              )}
              <div className="flex items-center gap-2 text-[#8b949e] text-xs mb-2">
                {project.visibility === "public" ? (
                  <Globe size={13} />
                ) : (
                  <Lock size={13} />
                )}
                <span className="capitalize">{project.visibility}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="border border-[#30363d] rounded-md p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <GitCommitHorizontal size={16} className="text-[#8b949e]" />
                <button
                  onClick={() => setActiveTab("commits")}
                  className="text-[#58a6ff] hover:underline"
                >
                  {project.commits.length} commit
                  {project.commits.length !== 1 ? "s" : ""}
                </button>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Users size={16} className="text-[#8b949e]" />
                <button
                  onClick={() => setActiveTab("collaborators")}
                  className="text-[#58a6ff] hover:underline"
                >
                  {project.collaborators.length + 1} contributor
                  {project.collaborators.length + 1 !== 1 ? "s" : ""}
                </button>
              </div>
            </div>

            {/* Owner info */}
            <div className="border border-[#30363d] rounded-md p-4">
              <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3">
                Owner
              </h3>
              <div className="flex items-center gap-2">
                <AvatarCircle name={project.owner?.username} size={7} />
                <span className="text-sm text-[#e6edf3] font-medium">
                  @{project.owner?.username}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {project.commits.length >= 2 && (
                <button
                  onClick={() => nav(`/project/${id}/diff`)}
                  className="w-full flex items-center justify-center gap-2 bg-[#6e40c9] hover:bg-[#8957e5] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  <Search size={14} />
                  Compare Versions
                </button>
              )}
              {project.is_owner && (
                <button
                  onClick={toggleVisibility}
                  className="w-full flex items-center justify-center gap-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#e6edf3] px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {project.visibility === "public" ? (
                    <>
                      <Lock size={13} /> Make private
                    </>
                  ) : (
                    <>
                      <Globe size={13} /> Make public
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          COMMITS TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "commits" && (
        <div className="max-w-4xl">
          {project.commits.length === 0 ? (
            <div className="text-center py-20">
              <GitCommitHorizontal
                size={40}
                className="text-[#8b949e] mx-auto mb-4"
              />
              <p className="text-[#8b949e]">No commits yet.</p>
            </div>
          ) : (
            <>
              {/* ── View toggle ──────────────────────────────────────────── */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#21262d] rounded-md border border-[#30363d]">
                    <History size={15} className="text-[#58a6ff]" />
                  </div>
                  <span className="text-sm font-semibold text-[#e6edf3]">
                    {project.commits.length} commit
                    {project.commits.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setCommitViewMode("timeline")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                      commitViewMode === "timeline"
                        ? "bg-[#21262d] border-[#58a6ff] text-[#58a6ff]"
                        : "bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]/50"
                    }`}
                  >
                    <GitBranch size={12} /> Timeline
                  </button>
                  <button
                    onClick={() => setCommitViewMode("list")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                      commitViewMode === "list"
                        ? "bg-[#21262d] border-[#58a6ff] text-[#58a6ff]"
                        : "bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]/50"
                    }`}
                  >
                    <List size={12} /> List
                  </button>
                </div>
              </div>

              {/* ── Hint ─────────────────────────────────────────────────── */}
              {project.commits.length >= 2 && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-md bg-[#161b22] border border-[#21262d] text-[#8b949e] text-xs">
                  <ArrowRight
                    size={11}
                    className="text-[#58a6ff] flex-shrink-0"
                  />
                  Click any commit to open the Diff Viewer comparing it against
                  the latest version.
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════
                  TIMELINE VIEW — Multi-Track Metro / Railway Graph
              ══════════════════════════════════════════════════════════ */}
              {commitViewMode === "timeline" && timelineData && (
                <div className="relative mt-8 min-h-[400px]">
                  {/* Logic for calculating track layouts */}
                  {(() => {
                    const nodes = [...timelineData.nodes];
                    const branches = timelineData.branches || [];

                    // Track 0 is main.
                    const branchTracks = { main: 0 };
                    let nextTrack = 1;

                    // Calculate track for each node
                    nodes.forEach((node) => {
                      if (node.is_main) {
                        node.track = 0;
                      } else {
                        if (branchTracks[node.branch_id] === undefined) {
                          branchTracks[node.branch_id] = nextTrack++;
                        }
                        node.track = branchTracks[node.branch_id];
                      }
                    });

                    const nodeHeight = 120; // vertical spacing
                    const trackWidth = 50; // horizontal spacing
                    const totalHeight = nodes.length * nodeHeight;

                    // Find parent Y positions for drawing lines
                    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

                    return (
                      <div
                        className="relative"
                        style={{ height: totalHeight + 100 }}
                      >
                        {/* SVG Layer for tracks and connections */}
                        <svg
                          className="absolute pointer-events-none"
                          style={{
                            left: "0",
                            top: "0",
                            width: "250px",
                            height: "100%",
                            zIndex: 10,
                          }}
                        >
                          {/* 1. Main Rail Track (Vertical) */}
                          <line
                            x1={trackWidth}
                            y1={0}
                            x2={trackWidth}
                            y2={totalHeight}
                            stroke={TRACK_COLORS[0]}
                            strokeWidth="3"
                            strokeOpacity="0.3"
                            strokeDasharray="4 4"
                          />

                          {/* 2. Side Rail Tracks */}
                          {Object.keys(branchTracks).map((bid) => {
                            if (bid === "main") return null;
                            const tIdx = branchTracks[bid];
                            return (
                              <line
                                key={bid}
                                x1={trackWidth + tIdx * trackWidth}
                                y1={0}
                                x2={trackWidth + tIdx * trackWidth}
                                y2={totalHeight}
                                stroke={
                                  TRACK_COLORS[tIdx % TRACK_COLORS.length]
                                }
                                strokeWidth="2"
                                strokeOpacity="0.2"
                                strokeDasharray="3 3"
                              />
                            );
                          })}

                          {/* 3. Connection Paths (Forks and Merges) */}
                          {nodes.map((node, i) => {
                            const y = i * nodeHeight + 40;
                            const x = trackWidth + node.track * trackWidth;

                            const paths = [];

                            // Vertical connection to previous node on same track
                            const prevOnTrack = nodes
                              .slice(i + 1)
                              .find((n) => n.track === node.track);
                            if (prevOnTrack) {
                              const prevIdx = nodes.findIndex(
                                (n) => n.id === prevOnTrack.id,
                              );
                              const prevY = prevIdx * nodeHeight + 40;
                              paths.push(
                                <line
                                  key={`v-${node.id}`}
                                  x1={x}
                                  y1={y}
                                  x2={x}
                                  y2={prevY}
                                  stroke={
                                    TRACK_COLORS[
                                      node.track % TRACK_COLORS.length
                                    ]
                                  }
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                />,
                              );
                            }

                            // Growth line (Fork): If first commit on a branch, connect to base_commit_id
                            const branchInfo = branches.find(
                              (b) => b.id === node.branch_id,
                            );
                            const isFirstOnBranch =
                              !prevOnTrack && !node.is_main;
                            if (isFirstOnBranch && branchInfo?.base_commit_id) {
                              const baseNodeIdx = nodes.findIndex(
                                (n) => n.id === branchInfo.base_commit_id,
                              );
                              if (baseNodeIdx !== -1) {
                                const baseNode = nodes[baseNodeIdx];
                                const baseTrackIdx = baseNode.track ?? 0;
                                const baseY = baseNodeIdx * nodeHeight + 40;
                                const baseX =
                                  trackWidth + baseTrackIdx * trackWidth;

                                // Curved path from main/parent track to this track
                                paths.push(
                                  <path
                                    key={`fork-${node.id}`}
                                    d={`M ${baseX} ${baseY} C ${baseX} ${y}, ${baseX} ${y}, ${x} ${y}`}
                                    fill="none"
                                    stroke={
                                      TRACK_COLORS[
                                        node.track % TRACK_COLORS.length
                                      ]
                                    }
                                    strokeWidth="3"
                                    strokeDasharray="5 3"
                                    className="animate-pulse"
                                  />,
                                );
                              }
                            }

                            // Merge line: If this is a merge commit (src_branch_id), connect from that branch's track
                            if (node.src_branch_id) {
                              const srcTrackIdx =
                                branchTracks[node.src_branch_id];
                              if (srcTrackIdx !== undefined) {
                                const srcX =
                                  trackWidth + srcTrackIdx * trackWidth;
                                // Find the last commit on that branch (chronologically before this merge)
                                const lastOnBranch = nodes
                                  .slice(i + 1)
                                  .find(
                                    (n) => n.branch_id === node.src_branch_id,
                                  );
                                if (lastOnBranch) {
                                  const lastIdx = nodes.findIndex(
                                    (n) => n.id === lastOnBranch.id,
                                  );
                                  const lastY = lastIdx * nodeHeight + 40;

                                  paths.push(
                                    <path
                                      key={`merge-${node.id}`}
                                      d={`M ${srcX} ${lastY} C ${srcX} ${y}, ${srcX} ${y}, ${x} ${y}`}
                                      fill="none"
                                      stroke={
                                        TRACK_COLORS[
                                          srcTrackIdx % TRACK_COLORS.length
                                        ]
                                      }
                                      strokeWidth="4"
                                      strokeOpacity="0.6"
                                    />,
                                  );
                                }
                              }
                            }

                            return paths;
                          })}
                        </svg>

                        {/* Node Layer (Interactive) */}
                        <div className="relative" style={{ zIndex: 20 }}>
                          {nodes.map((node, i) => {
                            const isLatest = i === 0;
                            const snapshots = node.snapshots || [];
                            const trackColor =
                              TRACK_COLORS[node.track % TRACK_COLORS.length];
                            const xOffset = 50 + node.track * 50;

                            return (
                              <div
                                key={node.id}
                                className="absolute w-full flex items-start"
                                style={{ top: i * nodeHeight + 30 }}
                              >
                                {/* The glowing node circle */}
                                <div
                                  className="absolute cursor-pointer transition-all duration-300 group"
                                  style={{ left: `${xOffset - 8}px`, top: "0" }}
                                  onMouseEnter={(e) => {
                                    const rect =
                                      e.currentTarget.getBoundingClientRect();
                                    setCommitTooltip({
                                      commit: node,
                                      isLatest,
                                      x: rect.right + 10,
                                      y: rect.top + rect.height / 2,
                                    });
                                  }}
                                  onMouseLeave={() => setCommitTooltip(null)}
                                  onClick={() => handleCommitNavigate(node.id)}
                                >
                                  {/* Node glow effect */}
                                  <div
                                    className="w-4 h-4 rounded-full border-2 bg-[#0d1117] relative z-10 transition-transform group-hover:scale-125"
                                    style={{
                                      borderColor: trackColor,
                                      boxShadow: isLatest
                                        ? `0 0 15px ${trackColor}80`
                                        : "none",
                                    }}
                                  />
                                  {node.type === "merge" && (
                                    <GitMerge
                                      size={10}
                                      className="absolute inset-0 m-auto text-white z-20 pointer-events-none"
                                    />
                                  )}
                                </div>

                                {/* Node content card */}
                                <div
                                  className="ml-auto w-[calc(100%-350px)] mr-8 bg-[#161b22] border border-[#30363d] hover:border-[#58a6ff]/50 rounded-xl p-4 transition-all cursor-pointer group"
                                  onClick={() => handleCommitNavigate(node.id)}
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span
                                          className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-opacity-30"
                                          style={{
                                            color: trackColor,
                                            borderColor: trackColor,
                                            background: `${trackColor}10`,
                                          }}
                                        >
                                          {node.is_main
                                            ? "main"
                                            : node.branch_name}
                                        </span>
                                        <span className="text-[#8b949e] text-xs font-mono">
                                          {String(node.id).slice(0, 7)}
                                        </span>
                                        {isLatest && (
                                          <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/30 px-1.5 py-0.5 rounded-full font-bold">
                                            LATEST
                                          </span>
                                        )}
                                      </div>
                                      <h4 className="text-[#e6edf3] font-semibold text-sm line-clamp-1 group-hover:text-[#58a6ff] transition-colors">
                                        {node.message || (
                                          <span className="italic opacity-50">
                                            No message
                                          </span>
                                        )}
                                      </h4>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-[#8b949e] text-xs font-medium">
                                        @{node.committer_username}
                                      </p>
                                      <p className="text-[#484f58] text-[10px]">
                                        {timeAgo(node.created_at)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Minimal file strip */}
                                  {snapshots.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 no-scrollbar">
                                      {snapshots.slice(0, 8).map((s) => (
                                        <div
                                          key={s.id}
                                          className="w-7 h-7 rounded bg-[#0d1117] border border-[#30363d] overflow-hidden flex-shrink-0"
                                        >
                                          <img
                                            src={api.storageUrl(s.storage_path)}
                                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                          />
                                        </div>
                                      ))}
                                      {snapshots.length > 8 && (
                                        <span className="text-[#484f58] text-[10px] font-bold">
                                          +{snapshots.length - 8}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tooltip portal */}
              {commitTooltip &&
                createPortal(
                  <div
                    style={{
                      position: "fixed",
                      left: Math.min(
                        commitTooltip.x + 16,
                        window.innerWidth - 304,
                      ),
                      top: Math.max(
                        8,
                        Math.min(
                          commitTooltip.y - 60,
                          window.innerHeight - 260,
                        ),
                      ),
                      zIndex: 9999,
                      pointerEvents: "none",
                    }}
                    className="bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl p-3 w-72"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <AvatarCircle
                        name={commitTooltip.commit.committer_username}
                        size={7}
                      />
                      <span className="text-[#e6edf3] text-sm font-medium truncate">
                        {commitTooltip.commit.committer_username}
                      </span>
                      {commitTooltip.isLatest && (
                        <span className="ml-auto flex-shrink-0 text-xs text-[#3fb950] bg-[#0d2016] border border-[#1a4226] rounded-full px-2 py-0.5 font-medium">
                          latest
                        </span>
                      )}
                    </div>
                    <p className="text-[#e6edf3] text-sm font-semibold leading-snug mb-1">
                      {commitTooltip.commit.message || (
                        <span className="italic text-[#8b949e]">
                          (no message)
                        </span>
                      )}
                    </p>
                    <p className="text-[#8b949e] text-xs">
                      {new Date(
                        (commitTooltip.commit.created_at || "").endsWith("Z")
                          ? commitTooltip.commit.created_at
                          : commitTooltip.commit.created_at + "Z",
                      ).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <div className="border-t border-[#30363d] my-2" />
                    {(commitTooltip.commit.snapshots ?? []).length > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {(commitTooltip.commit.snapshots ?? [])
                            .slice(0, 3)
                            .map((snap) => (
                              <div
                                key={snap.id}
                                className="w-8 h-8 rounded border border-[#30363d] overflow-hidden bg-[#0d1117]"
                              >
                                <img
                                  src={api.storageUrl(snap.storage_path)}
                                  alt={snap.filename}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          {(commitTooltip.commit.snapshots ?? []).length >
                            3 && (
                            <div className="w-8 h-8 rounded border border-[#30363d] bg-[#21262d] flex items-center justify-center">
                              <span className="text-[#8b949e] text-xs">
                                +
                                {(commitTooltip.commit.snapshots ?? []).length -
                                  3}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-[#8b949e] text-xs">
                          {(commitTooltip.commit.snapshots ?? []).length} file
                          {(commitTooltip.commit.snapshots ?? []).length !== 1
                            ? "s"
                            : ""}{" "}
                          changed
                        </p>
                      </>
                    ) : (
                      <p className="text-[#484f58] text-xs italic">
                        No files in this commit
                      </p>
                    )}
                    <div className="border-t border-[#30363d] my-2" />
                    <div className="flex items-center gap-1.5 text-[#58a6ff] text-xs font-medium">
                      <ArrowRight size={11} /> Click to view diff
                    </div>
                  </div>,
                  document.body,
                )}

              {/* ══════════════════════════════════════════════════════════
                  LIST VIEW
              ══════════════════════════════════════════════════════════ */}
              {commitViewMode === "list" && (
                <div className="space-y-1.5">
                  {project.commits.map((c) => {
                    const isLatest = c.id === project.commits[0]?.id;
                    const hash = String(c.id).padStart(7, "0").slice(0, 7);
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleCommitNavigate(c.id)}
                        className="group flex items-start gap-3 px-4 py-3 bg-[#161b22] border border-[#30363d] rounded-md hover:border-[#58a6ff] hover:bg-[#1c2128] transition-all cursor-pointer"
                      >
                        <AvatarCircle
                          name={c.committer_username || "?"}
                          size={8}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[#e6edf3] font-semibold text-sm truncate">
                            {c.message}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[#58a6ff] text-xs">
                              @{c.committer_username}
                            </span>
                            <span className="text-[#484f58] text-xs">·</span>
                            <span className="text-[#8b949e] text-xs">
                              {timeAgo(c.created_at)}
                            </span>
                            {isLatest && (
                              <span className="text-xs text-[#3fb950] bg-[#238636]/20 border border-[#238636]/40 px-1.5 py-px rounded-full">
                                latest
                              </span>
                            )}
                          </div>
                          {c.snapshots?.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5">
                              {c.snapshots.slice(0, 4).map((s) => (
                                <img
                                  key={s.id}
                                  src={api.storageUrl(s.storage_path)}
                                  alt={s.filename}
                                  className="w-7 h-7 object-cover rounded border border-[#30363d] hover:border-[#58a6ff] transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(
                                      api.storageUrl(s.storage_path),
                                      "_blank",
                                    );
                                  }}
                                  title={s.filename}
                                />
                              ))}
                              {c.snapshots.length > 4 && (
                                <span className="text-[#8b949e] text-xs">
                                  +{c.snapshots.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                          <span className="font-mono text-xs text-[#8b949e] bg-[#21262d] border border-[#30363d] px-2 py-1 rounded">
                            {hash}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyHash(String(c.id));
                            }}
                            className="p-1.5 text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] rounded transition-colors"
                            title="Copy hash"
                          >
                            {copiedHash === String(c.id) ? (
                              <Check size={12} className="text-[#3fb950]" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                          {!isLatest && canWrite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                rollback(c.id);
                              }}
                              className="p-1.5 text-[#8b949e] hover:text-yellow-400 hover:bg-[#30363d] rounded transition-colors"
                              title="Rollback"
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          COLLABORATORS TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "collaborators" && (
        <div className="max-w-2xl">
          <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#21262d]">
              <h2 className="text-sm font-semibold text-[#e6edf3]">
                Manage access
              </h2>
              <p className="text-xs text-[#8b949e] mt-0.5">
                {project.collaborators.length + 1} member
                {project.collaborators.length + 1 !== 1 ? "s" : ""} with access
                to this project
              </p>
            </div>

            {/* Owner row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#21262d]">
              <AvatarCircle name={project.owner?.username} size={8} />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#e6edf3]">
                  {project.owner?.username}
                </p>
                <p className="text-xs text-[#8b949e]">
                  @{project.owner?.username}
                </p>
              </div>
              <span className="text-xs bg-[#1f6feb26] text-[#79c0ff] border border-[#388bfd66] px-2.5 py-1 rounded-full">
                Owner
              </span>
            </div>

            {/* Collaborator rows */}
            {project.collaborators.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-[#21262d] last:border-b-0"
              >
                <AvatarCircle name={c.username} size={8} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#e6edf3]">
                    {c.username}
                  </p>
                  <p className="text-xs text-[#8b949e]">@{c.username}</p>
                </div>
                <span className="text-xs bg-[#21262d] text-[#8b949e] border border-[#30363d] px-2.5 py-1 rounded-full">
                  Collaborator
                </span>
                {project.is_owner && (
                  <button
                    onClick={() => removeCollaborator(c.id)}
                    className="ml-2 p-1.5 text-[#8b949e] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Remove collaborator"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}

            {/* Add collaborator form (owner only) */}
            {project.is_owner && (
              <div className="px-4 py-4 bg-[#0d1117] border-t border-[#21262d]">
                <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">
                  Add collaborator
                </h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]">
                      @
                    </span>
                    <input
                      value={collabInput}
                      onChange={(e) => setCollabInput(e.target.value)}
                      placeholder="username"
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-md pl-7 pr-3 py-2 text-sm focus:border-[#58a6ff] outline-none transition-colors placeholder:text-[#6e7681]"
                      onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
                    />
                  </div>
                  <button
                    onClick={addCollaborator}
                    disabled={!collabInput.trim()}
                    className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Add
                  </button>
                </div>
                {collabError && (
                  <p className="text-red-400 text-xs mt-2">{collabError}</p>
                )}
              </div>
            )}
          </div>

          {/* ── Access Pricing (owner only) ──────────────────── */}
          {project.is_owner && (
            <div className="mt-6 bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
              <div className="px-4 py-3 border-b border-[#30363d] flex items-center gap-2">
                <DollarSign size={14} className="text-yellow-400" />
                <h3 className="text-sm font-semibold text-[#e6edf3]">
                  Access Pricing
                </h3>
                {project.price > 0 && (
                  <span className="ml-auto text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded-full">
                    Active · ${project.price.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="px-4 py-4">
                <p className="text-xs text-[#8b949e] mb-4 leading-relaxed">
                  {project.price > 0
                    ? `This repository is paywalled at $${project.price.toFixed(2)}. Non-members must pay to view its contents. Collaborators and the owner always have free access.`
                    : "Set a price to require payment before non-collaborators can view this repository. The repo remains discoverable but contents stay locked until they pay."}
                </p>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e] text-sm font-medium">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      placeholder={
                        project.price > 0 ? project.price.toFixed(2) : "0.00"
                      }
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-md pl-7 pr-3 py-2 text-sm focus:border-[#58a6ff] outline-none transition-colors placeholder:text-[#6e7681]"
                    />
                  </div>
                  <button
                    onClick={() => handleSetPrice()}
                    disabled={priceSaving || priceInput.trim() === ""}
                    className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    {priceSaving
                      ? "Saving…"
                      : project.price > 0
                        ? "Update price"
                        : "Set price"}
                  </button>
                  {project.price > 0 && (
                    <button
                      onClick={() => handleSetPrice(0)}
                      disabled={priceSaving}
                      className="px-3 py-2 text-red-400 hover:bg-red-500/10 border border-red-500/30 hover:border-red-500/50 rounded-md text-sm transition-colors whitespace-nowrap"
                    >
                      Remove paywall
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Visibility + danger zone (owner only) */}
          {project.is_owner && (
            <div className="mt-6 border border-red-500/30 rounded-md overflow-hidden">
              <div className="px-4 py-3 border-b border-red-500/20 bg-[#161b22]">
                <h3 className="text-sm font-semibold text-red-400">
                  Danger Zone
                </h3>
              </div>
              <div className="px-4 py-4 bg-[#161b22]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[#e6edf3]">
                      Change project visibility
                    </p>
                    <p className="text-xs text-[#8b949e] mt-0.5">
                      This project is currently{" "}
                      <span className="font-medium">{project.visibility}</span>.
                    </p>
                  </div>
                  <button
                    onClick={toggleVisibility}
                    className="flex items-center gap-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-shrink-0"
                  >
                    {project.visibility === "public" ? (
                      <>
                        <Lock size={13} /> Make private
                      </>
                    ) : (
                      <>
                        <Globe size={13} /> Make public
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════════════════
          PULL REQUESTS TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "pull-requests" && (
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#21262d] rounded-md border border-[#30363d]">
                <GitPullRequest size={15} className="text-[#58a6ff]" />
              </div>
              <h2 className="text-sm font-semibold text-[#e6edf3]">
                Pull Requests
              </h2>
            </div>

            <div className="flex gap-1 bg-[#161b22] p-1 rounded-md border border-[#30363d]">
              {["all", "open", "approved", "rejected"].map((f) => (
                <button
                  key={f}
                  onClick={() => setPrFilter(f)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    prFilter === f
                      ? "bg-[#21262d] text-[#58a6ff] border border-[#58a6ff]/30 shadow-sm"
                      : "text-[#8b949e] hover:text-[#e6edf3]"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loadingPRs ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pullRequests.length === 0 ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-md p-12 text-center">
              <GitPullRequest
                size={32}
                className="text-[#8b949e] mx-auto mb-3"
              />
              <p className="text-[#e6edf3] font-semibold mb-1">
                No pull requests yet
              </p>
              <p className="text-[#8b949e] text-sm">
                Pull requests let branch owners propose changes to the main
                project.
              </p>
            </div>
          ) : (
            <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
              {pullRequests
                .filter((pr) => prFilter === "all" || pr.status === prFilter)
                .map((pr, i) => {
                  const isOpen = pr.status === "open";
                  const isMerged = pr.status === "approved";
                  const isRejected = pr.status === "rejected";
                  return (
                    <div
                      key={pr.id}
                      onClick={() => nav(`/project/${id}/pr/${pr.id}`)}
                      className={`flex items-start gap-3 px-4 py-4 hover:bg-[#1c2128] cursor-pointer transition-colors ${
                        i < pullRequests.length - 1
                          ? "border-b border-[#21262d]"
                          : ""
                      }`}
                    >
                      {/* Status icon */}
                      <div className="pt-0.5">
                        {isOpen && (
                          <GitPullRequest
                            size={16}
                            className="text-[#3fb950] flex-shrink-0"
                          />
                        )}
                        {isMerged && (
                          <GitMerge
                            size={16}
                            className="text-purple-400 flex-shrink-0"
                          />
                        )}
                        {isRejected && (
                          <XCircle
                            size={16}
                            className="text-red-400 flex-shrink-0"
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[#e6edf3] text-sm font-semibold truncate">
                          {pr.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[#8b949e] text-xs">
                            #{pr.id}
                          </span>
                          <span className="text-[#484f58] text-xs">
                            opened by
                          </span>
                          <span className="text-[#58a6ff] text-xs">
                            @{pr.creator_username}
                          </span>
                          <span className="text-[#484f58] text-xs">·</span>
                          <span className="text-[#8b949e] text-xs">
                            {timeAgo(pr.created_at)}
                          </span>
                          <span className="text-[#484f58] text-xs">·</span>
                          <span className="font-mono text-xs text-[#8b949e] bg-[#0d1117] border border-[#30363d] rounded px-1.5 py-px">
                            {pr.branch_name ?? "—"}
                          </span>
                        </div>

                        {/* Review Note / Rejection Reason */}
                        {pr.review_note && (
                          <div
                            className={`mt-2 p-2 rounded text-xs border ${
                              isRejected
                                ? "bg-red-500/5 border-red-500/20 text-red-300"
                                : "bg-purple-500/5 border-purple-500/20 text-purple-300"
                            }`}
                          >
                            <span className="font-bold opacity-70 mr-1">
                              {isRejected ? "Reason:" : "Note:"}
                            </span>
                            {pr.review_note}
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className="flex-shrink-0 pt-0.5">
                        {isOpen && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#238636]/20 text-[#3fb950] border border-[#238636]/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />{" "}
                            Open
                          </span>
                        )}
                        {isMerged && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-900/30 text-purple-400 border border-purple-500/40">
                            <GitMerge size={10} /> Merged
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900/30 text-red-400 border border-red-500/40">
                            <XCircle size={10} /> Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          BRANCHES TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "branches" && (
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#e6edf3]">Branches</h2>
            {canWrite && (
              <button
                onClick={() => setShowBranchForm((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                New branch
              </button>
            )}
          </div>

          {/* Create branch form */}
          {showBranchForm && canWrite && (
            <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4 mb-4">
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">
                Create new branch
              </h3>
              <div className="flex gap-2">
                <input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Branch name"
                  className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm focus:border-[#58a6ff] outline-none transition-colors placeholder:text-[#6e7681]"
                  onKeyDown={(e) => e.key === "Enter" && createBranch()}
                />
                <button
                  onClick={createBranch}
                  disabled={!newBranchName.trim()}
                  className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowBranchForm(false)}
                  className="px-3 py-2 text-[#8b949e] hover:text-[#e6edf3] border border-[#30363d] rounded-md text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Branches list */}
          {loadingBranches ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : branches.length === 0 ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-md p-12 text-center">
              <GitBranch size={32} className="text-[#8b949e] mx-auto mb-3" />
              <p className="text-[#8b949e] text-sm">No branches yet.</p>
              {canWrite && (
                <button
                  onClick={() => setShowBranchForm(true)}
                  className="mt-3 bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Create branch
                </button>
              )}
            </div>
          ) : (
            <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
              {branches.map((branch, i) => (
                <div
                  key={branch.id}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-[#1c2128] transition-colors ${
                    i < branches.length - 1 ? "border-b border-[#21262d]" : ""
                  }`}
                >
                  <GitBranch
                    size={14}
                    className="text-[#8b949e] flex-shrink-0"
                  />
                  <button
                    onClick={() => nav(`/project/${id}/branch/${branch.id}`)}
                    className="text-[#58a6ff] text-sm hover:underline font-medium truncate"
                  >
                    {branch.name}
                  </button>
                  <span className="text-[#8b949e] text-xs truncate">
                    {branch.owner_username || branch.creator_username || ""}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                      branch.status === "active"
                        ? "bg-[#238636]/20 text-[#3fb950] border-[#238636]/40"
                        : branch.status === "merged"
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                          : branch.status === "rejected"
                            ? "bg-red-500/20 text-red-400 border-red-500/40"
                            : "bg-[#21262d] text-[#8b949e] border-[#30363d]"
                    }`}
                  >
                    {branch.status ?? "active"}
                  </span>
                  <span className="text-[#8b949e] text-xs flex-shrink-0 ml-auto">
                    {timeAgo(branch.created_at)}
                  </span>
                  <button
                    onClick={() => nav(`/project/${id}/branch/${branch.id}`)}
                    className="flex-shrink-0 text-xs px-2.5 py-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] rounded-md transition-colors"
                  >
                    {branch.pull_request ? "View PR" : "Open PR"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <HoverPreview
        snap={hoveredFile?.snap}
        filename={hoveredFile?.name}
        x={hoveredFile?.x}
        y={hoveredFile?.y}
      />
    </div>
  );
}
