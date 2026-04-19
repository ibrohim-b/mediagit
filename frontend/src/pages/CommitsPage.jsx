import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import FilePreview from "../components/FilePreview";
import HoverPreview from "../components/HoverPreview";
import {
  ArrowLeft,
  GitCommitHorizontal,
  Copy,
  Check,
  RotateCcw,
  GitFork,
  Clock,
  ChevronRight,
  History,
  ArrowRight,
  GitBranch,
  List,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const date = new Date(dateStr + (dateStr.endsWith("Z") ? "" : "Z"));
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
  return `${Math.floor(diff / 31536000)} years ago`;
}

function formatDateHeader(dateStr) {
  const date = new Date(dateStr + (dateStr.endsWith("Z") ? "" : "Z"));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatExactDate(dateStr) {
  const date = new Date(dateStr + (dateStr.endsWith("Z") ? "" : "Z"));
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupCommitsByDate(commits) {
  const groups = [];
  const map = new Map();
  commits.forEach((c) => {
    const d = new Date(c.created_at + (c.created_at.endsWith("Z") ? "" : "Z"));
    const key = d.toDateString();
    if (!map.has(key)) {
      const group = { label: formatDateHeader(c.created_at), commits: [] };
      map.set(key, group);
      groups.push(group);
    }
    map.get(key).commits.push(c);
  });
  return groups;
}

function shortId(id) {
  if (!id) return "";
  return String(id).padStart(7, "0").slice(0, 7);
}

// ─── AvatarCircle ─────────────────────────────────────────────────────────────

function AvatarCircle({ name, size = "w-8 h-8", textSize = "text-sm" }) {
  const initial = (name || "?")[0].toUpperCase();
  const palette = [
    "bg-purple-600",
    "bg-blue-600",
    "bg-emerald-700",
    "bg-amber-600",
    "bg-pink-600",
    "bg-indigo-600",
    "bg-teal-600",
    "bg-rose-600",
  ];
  const color = palette[initial.charCodeAt(0) % palette.length];
  return (
    <div
      className={`${size} rounded-full ${color} flex items-center justify-center ${textSize} font-semibold text-white flex-shrink-0 select-none`}
    >
      {initial}
    </div>
  );
}



// ─── SnapshotThumbnails ───────────────────────────────────────────────────────

function SnapshotThumbnails({ snapshots }) {
  const [hoverInfo, setHoverInfo] = useState(null);

  if (!snapshots || snapshots.length === 0) return null;

  const MAX_SHOWN = 4;
  const shown = snapshots.slice(0, MAX_SHOWN);
  const extra = snapshots.length - MAX_SHOWN;

  const handleMouseEnter = (e, snap) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverInfo({
      snap,
      x: rect.right,
      y: rect.top + rect.height / 2,
    });
  };

  const handleMouseMove = (e, snap) => {
    e.stopPropagation();
    setHoverInfo((prev) =>
      prev?.snap?.id === snap.id ? { snap, x: e.clientX, y: e.clientY } : prev,
    );
  };

  const handleMouseLeave = (e) => {
    e.stopPropagation();
    setHoverInfo(null);
  };

  return (
    <>
      <HoverPreview
        snap={hoverInfo?.snap}
        x={hoverInfo?.x}
        y={hoverInfo?.y}
      />
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {shown.map((snap) => (
          <div
            key={snap.id}
            className="relative w-10 h-10 rounded border border-[#30363d] overflow-hidden bg-[#0d1117] flex-shrink-0 cursor-default hover:border-[#58a6ff] transition-colors"
            title={snap.filename}
            onMouseEnter={(e) => handleMouseEnter(e, snap)}
            onMouseMove={(e) => handleMouseMove(e, snap)}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <FilePreview
              src={api.storageUrl(snap.storage_path)}
              filename={snap.filename}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        {extra > 0 && (
          <div
            className="w-10 h-10 rounded border border-[#30363d] bg-[#21262d] flex items-center justify-center flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[#8b949e] text-xs font-medium">+{extra}</span>
          </div>
        )}
        <span className="text-[#8b949e] text-xs ml-1">
          {snapshots.length} file{snapshots.length !== 1 ? "s" : ""}
        </span>
      </div>
    </>
  );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy full hash"
      className="p-1 rounded hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
    >
      {copied ? (
        <Check size={13} className="text-[#3fb950]" />
      ) : (
        <Copy size={13} />
      )}
    </button>
  );
}

// ─── CommitRow (list view) ────────────────────────────────────────────────────

function CommitRow({
  commit,
  isLatest,
  isOwner,
  onRollback,
  projectId,
  onNavigate,
}) {
  const hash = shortId(commit.id);

  return (
    <div
      onClick={() => onNavigate(commit.id)}
      className="group relative flex items-start justify-between gap-4 px-4 py-3 bg-[#161b22] border border-[#30363d] rounded-md hover:border-[#58a6ff] hover:bg-[#1c2128] transition-all duration-150 cursor-pointer"
    >
      {/* ── Left: avatar + info ── */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="pt-0.5">
          <AvatarCircle name={commit.committer_username} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[#e6edf3] font-semibold text-sm leading-snug truncate">
            {commit.message || (
              <span className="italic text-[#8b949e]">(no message)</span>
            )}
          </p>

          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[#8b949e] text-xs">
              <span className="text-[#58a6ff] font-medium">
                @{commit.committer_username}
              </span>{" "}
              committed{" "}
              <span
                title={commit.created_at}
                className="inline-flex items-center gap-0.5"
              >
                <Clock size={11} className="inline" />{" "}
                {timeAgo(commit.created_at)}
              </span>
            </span>
          </div>

          <SnapshotThumbnails snapshots={commit.snapshots} />
        </div>
      </div>

      {/* ── Right: hash + actions ── */}
      <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
        <div className="flex items-center gap-0.5 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1">
          <span className="font-mono text-xs text-[#8b949e] tracking-wide select-all">
            {hash}
          </span>
          <CopyButton text={String(commit.id)} />
        </div>

        <div
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(commit.id);
          }}
          title="View diff for this commit"
          className="p-1.5 rounded border border-[#30363d] bg-[#21262d] text-[#8b949e] group-hover:text-[#58a6ff] group-hover:border-[#58a6ff] transition-colors cursor-pointer"
        >
          <ChevronRight size={14} />
        </div>

        {isOwner && !isLatest && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRollback(commit.id);
            }}
            title="Rollback to this commit"
            className="p-1.5 rounded border border-[#30363d] bg-[#21262d] hover:bg-[#da3633] hover:border-[#da3633] text-[#8b949e] hover:text-white transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-[#58a6ff] rounded-full p-0.5">
          <ArrowRight size={10} className="text-[#0d1117]" />
        </div>
      </div>
    </div>
  );
}

// ─── DateGroupHeader ──────────────────────────────────────────────────────────

function DateGroupHeader({ label }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-2">
      <span className="text-[#8b949e] text-sm font-semibold whitespace-nowrap">
        Commits on {label}
      </span>
      <div className="flex-1 border-t border-[#21262d]" />
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const colors = [
  "#3fb950", // Green (main)
  "#58a6ff", // Blue
  "#8957e5", // Purple
  "#d29922", // Gold
  "#f85149", // Red
  "#a371f7", // Light purple
  "#2ea043"  // Emerald
];

// ─── main page ────────────────────────────────────────────────────────────────

export default function CommitsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("timeline"); // "timeline" | "list"
  const [tooltipInfo, setTooltipInfo] = useState(null); // { commit, isLatest, x, y }

  const containerRef = useRef(null);
  const nodeRefs = useRef({});
  const [nodePositions, setNodePositions] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projData, timelineData] = await Promise.all([
        api.getProject(id),
        api.getTimeline(id).catch(() => ({ nodes: [], branches: [] }))
      ]);
      setProject(projData);
      setTimeline(timelineData);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRollback = async (commitId) => {
    if (
      !confirm(
        "Are you sure you want to rollback to this commit?\n\nAll commits newer than this one will be permanently removed.",
      )
    )
      return;
    try {
      await api.rollback(id, commitId);
      await load();
    } catch (err) {
      alert("Rollback failed: " + (err?.detail ?? "Unknown error"));
    }
  };

  // Navigate to diff: always compare clicked commit vs latest target
  const handleCommitNavigate = useCallback(
    (clickedId) => {
      const projectCommits = project?.commits ?? [];
      if (!projectCommits.length) return;
      const params = new URLSearchParams();
      const latestId = projectCommits[0].id;
      if (String(clickedId) === String(latestId)) {
        // Compare second oldest vs latest so diff isn't empty
        if (projectCommits[1]) params.set("a", String(projectCommits[1].id));
      } else {
        params.set("a", String(clickedId));
      }
      params.set("b", String(latestId));
      navigate(`/project/${id}/diff?${params.toString()}`);
    },
    [id, navigate, project]
  );

  // ── Computing Nodes and Graph ──────────────────────────────────────────────

  const timelineNodes = useMemo(() => timeline?.nodes ?? [], [timeline]);
  const mainCommits = useMemo(() => project?.commits ?? [], [project]);

  // Track map for Metro graph
  const trackMap = useMemo(() => ({ "main": 0 }), []);
  let nextTrack = 1;
  const getTrack = useCallback((branchId) => {
    if (!branchId || branchId === 'main') return 0;
    if (trackMap[branchId] === undefined) {
      trackMap[branchId] = nextTrack++;
    }
    return trackMap[branchId];
  }, []);

  // Assign track properties to timeline nodes
  useMemo(() => {
    timelineNodes.forEach(n => {
      n.track = getTrack(n.branch_id);
    });
  }, [timelineNodes, getTrack]);

  const maxTrack = useMemo(() => {
    return timelineNodes.reduce((acc, n) => Math.max(acc, n.track || 0), 0);
  }, [timelineNodes]);

  const TRACK_GAP = 24;
  const paddingLeft = Math.max(80, 56 + (maxTrack + 1) * TRACK_GAP);
  const getDotLeft = useCallback((track) => 32 + (track * TRACK_GAP) - paddingLeft, [paddingLeft]);

  // Measure Node Elements Positions for SVG Drawing
  const measureNodes = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPos = {};
    let changed = false;
    
    Object.entries(nodeRefs.current).forEach(([nodeId, el]) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left - containerRect.left + rect.width / 2;
        const cy = rect.top - containerRect.top + rect.height / 2;
        if (!nodePositions[nodeId] || nodePositions[nodeId].x !== cx || nodePositions[nodeId].y !== cy) {
            changed = true;
        }
        newPos[nodeId] = { x: cx, y: cy };
      }
    });

    if (changed) setNodePositions(newPos);
  }, [nodePositions]);

  useEffect(() => {
    if (viewMode !== "timeline" || !timelineNodes.length) return;
    const observer = new ResizeObserver(measureNodes);
    if (containerRef.current) observer.observe(containerRef.current);
    measureNodes();
    
    // Safety measures to capture thumbnail loading changes
    const t1 = setTimeout(measureNodes, 100);
    const t2 = setTimeout(measureNodes, 500);
    const t3 = setTimeout(measureNodes, 1500);
    
    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [viewMode, timelineNodes, measureNodes]);

  // Generating edges for the graph
  const edges = useMemo(() => {
    if (!timelineNodes.length) return [];
    
    const newEdges = [];
    timelineNodes.forEach((node, idx) => {
      // 1. Parent is usually the previous exact commit on the same branch
      let prevNode = timelineNodes.slice(idx + 1).find(n => n.branch_id === node.branch_id);
      if (prevNode) {
        newEdges.push({
          child: node.id,
          parent: prevNode.id,
          track: node.track
        });
      } else if (node.branch_id !== 'main') {
        // Forking from main limit (new branch)
        const bInfo = timeline?.branches?.find(b => b.id === node.branch_id);
        if (bInfo && bInfo.base_commit_id) {
          newEdges.push({
            child: node.id,
            parent: bInfo.base_commit_id,
            track: node.track,
            isFork: true
          });
        }
      }
      
      // 2. Cross-Merge connection
      if (node.is_main && node.type === 'merge' && node.src_branch_id) {
        let srcLatest = timelineNodes.slice(idx + 1).find(n => n.branch_id === node.src_branch_id);
        if (srcLatest) {
          newEdges.push({
            child: node.id,
            parent: srcLatest.id,
            track: getTrack(node.src_branch_id),
            isMerge: true
          });
        }
      }
    });
    return newEdges;
  }, [timelineNodes, timeline, getTrack]);

  // Determine latest commits
  const latestCommitIds = useMemo(() => {
    const latest = new Set();
    const seen = new Set();
    timelineNodes.forEach(n => {
      if (!seen.has(n.branch_id)) {
        seen.add(n.branch_id);
        latest.add(n.id);
      }
    });
    return latest;
  }, [timelineNodes]);

  // Groups
  const groups = useMemo(() => {
    return groupCommitsByDate(viewMode === "timeline" ? timelineNodes : mainCommits);
  }, [viewMode, timelineNodes, mainCommits]);


  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0d1117" }}
      >
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8b949e] text-sm">Loading commits…</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0d1117" }}
      >
        <p className="text-[#8b949e]">Project not found.</p>
      </div>
    );
  }

  const isOwner = project.is_owner;

  // ── Tooltip clamped position ───────────────────────────────────────────────
  const tooltipLeft =
    tooltipInfo != null
      ? Math.min(tooltipInfo.x + 20, window.innerWidth - 304)
      : 0;
  const tooltipTop =
    tooltipInfo != null
      ? Math.max(8, Math.min(tooltipInfo.y - 60, window.innerHeight - 260))
      : 0;

  return (
    <div
      className="min-h-screen -mx-4 -mt-6"
      style={{ backgroundColor: "#0d1117", color: "#e6edf3" }}
    >
      <ProjectHeader project={project} activeTab="commits" />
      <div className="max-w-4xl mx-auto px-4 py-6 mt-6">
        {/* Page header */}
        <div className="mb-6">
          {/* Heading row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#21262d] rounded-md border border-[#30363d]">
                <History size={18} className="text-[#58a6ff]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#e6edf3] leading-tight">
                  Commits
                </h1>
                <p className="text-[#8b949e] text-sm mt-0.5">
                  {mainCommits.length} {mainCommits.length === 1 ? "commit" : "commits"} total on main
                </p>
              </div>
            </div>

            {/* Stats pill */}
            <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded-md px-3 py-1.5">
              <GitCommitHorizontal size={14} className="text-[#3fb950]" />
              <span className="text-[#8b949e] text-sm">
                <span className="text-[#e6edf3] font-semibold">
                  {mainCommits.length}
                </span>{" "}
                {mainCommits.length === 1 ? "commit" : "commits"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Hint bar ────────────────────────────────────────────────────── */}
        {mainCommits.length >= 2 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-[#161b22] border border-[#21262d] text-[#8b949e] text-xs">
            <ArrowRight size={12} className="text-[#58a6ff] flex-shrink-0" />
            <span>
              Click any commit to compare it against the latest version in the
              Diff Viewer.
            </span>
          </div>
        )}

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="border-t border-[#21262d] mb-4" />

        {/* ── View toggle ─────────────────────────────────────────────────── */}
        {mainCommits.length > 0 && (
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border transition-colors ${
                viewMode === "timeline"
                  ? "bg-[#21262d] border-[#58a6ff] text-[#58a6ff]"
                  : "bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#8b949e]"
              }`}
            >
              <GitBranch size={14} />
              Timeline
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border transition-colors ${
                viewMode === "list"
                  ? "bg-[#21262d] border-[#58a6ff] text-[#58a6ff]"
                  : "bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#8b949e]"
              }`}
            >
              <List size={14} />
              List
            </button>
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {mainCommits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center mb-4">
              <GitCommitHorizontal size={28} className="text-[#8b949e]" />
            </div>
            <h2 className="text-[#e6edf3] font-semibold text-lg mb-2">
              No commits yet
            </h2>
            <p className="text-[#8b949e] text-sm max-w-sm">
              This project doesn't have any commits yet. Go back to the project
              and upload some files to create the first commit.
            </p>
            <Link
              to={`/project/${id}`}
              className="mt-5 inline-flex items-center gap-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              <ArrowLeft size={14} />
              Go to project
            </Link>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TIMELINE VIEW — Metro / railway style graph with proper curves
        ══════════════════════════════════════════════════════════════════ */}
        {viewMode === "timeline" && timelineNodes.length > 0 && (
          <div className="relative" ref={containerRef} style={{ paddingLeft: `${paddingLeft}px` }}>
            {/* ── Background SVG Rail Tracks ──────────────────────────────── */}
            <svg 
              className="absolute top-0 left-0 w-full h-full pointer-events-none" 
              style={{ zIndex: 0 }}
            >
              {edges.map((edge, i) => {
                const cPos = nodePositions[edge.child];
                const pPos = nodePositions[edge.parent];
                if (!cPos || !pPos) return null;

                const x1 = cPos.x;
                const y1 = cPos.y;
                const x2 = pPos.x;
                const y2 = pPos.y;

                let d = "";
                if (x1 === x2) {
                  // Direct timeline progression
                  d = `M ${x1} ${y1} L ${x2} ${y2}`;
                } else {
                  // Smooth curve for branches & merges
                  const midY = (y1 + y2) / 2;
                  d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
                }

                const color = colors[edge.track % colors.length];

                return (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity={edge.isMerge || edge.isFork ? "0.6" : "1"}
                    strokeDasharray={edge.isFork ? "6 4" : "none"}
                    className="transition-all duration-300"
                  />
                );
              })}
            </svg>

            {/* ── Content Grouped by Date ─────────────────────────────────── */}
            {groups.map((group, gi) => (
              <div key={gi}>
                <div
                  className="relative mb-4"
                  style={{ marginTop: gi === 0 ? 2 : 32 }}
                >
                  <div
                    className="flex items-center"
                    style={{ marginLeft: `-${paddingLeft - 8}px` }}
                  >
                    <span className="relative z-10 inline-flex items-center gap-1.5 text-xs font-medium text-[#e6edf3] bg-[#21262d] border border-[#30363d] shadow-sm rounded-full px-3 py-1 whitespace-nowrap">
                       {group.label}
                    </span>
                    <div className="flex-1 h-px bg-[#30363d] ml-3" />
                  </div>
                </div>

                {group.commits.map((commit) => {
                  const isLatest = latestCommitIds.has(commit.id);
                  const trackColor = colors[commit.track % colors.length];
                  
                  return (
                    <div key={commit.id} className="relative mb-6">
                      {/* ── Metro Track Node ──────────────────────────────── */}
                      <div
                        ref={(el) => (nodeRefs.current[commit.id] = el)}
                        className="absolute z-10 w-3.5 h-3.5 rounded-full border-[2.5px] cursor-pointer transition-all duration-200 hover:scale-[1.3]"
                        style={{
                          left: `${getDotLeft(commit.track)}px`,
                          top: '16px',
                          backgroundColor: "#0d1117",
                          borderColor: trackColor,
                          boxShadow: isLatest ? `0 0 10px ${trackColor}a0, 0 0 20px ${trackColor}40` : "none",
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipInfo({
                            commit,
                            isLatest,
                            x: rect.right,
                            y: rect.top + rect.height / 2,
                          });
                        }}
                        onMouseLeave={() => setTooltipInfo(null)}
                      />

                      {/* ── Commits Card ──────────────────────────────────── */}
                      <div
                        className="cursor-pointer hover:bg-[#1c2128] rounded-md px-3 py-3 transition-colors duration-200 bg-[#161b22] border border-[#30363d] hover:border-[#58a6ff] shadow-sm flex flex-col"
                        onClick={() => handleCommitNavigate(commit.id)}
                      >
                        <div className="flex items-start justify-between min-w-0">
                          <div className="flex flex-col min-w-0 flex-1 pr-4">
                            <p className="text-[#e6edf3] font-semibold text-sm leading-snug truncate">
                              {commit.message || (
                                <span className="italic text-[#8b949e]">
                                  (no message)
                                </span>
                              )}
                            </p>
                            
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[#58a6ff] text-xs font-medium">
                                @{commit.committer_username}
                              </span>
                              <span className="text-[#484f58] text-xs select-none">
                                ·
                              </span>
                              <span className="text-[#8b949e] text-xs flex items-center gap-1">
                                <Clock size={10} />
                                {timeAgo(commit.created_at)}
                              </span>
                              <span className="text-[#484f58] text-xs select-none">
                                ·
                              </span>
                              <span className="font-mono text-[11px] text-[#8b949e] bg-[#0d1117] border border-[#30363d] rounded px-1.5 py-0.5 tracking-wider">
                                {shortId(commit.id)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Tags block */}
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {commit.branch_name && commit.branch_name !== 'main' && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-[#a371f7] bg-[#a371f7]/10 border border-[#a371f7]/30 rounded-full px-2 py-0.5">
                                <GitBranch size={10} />
                                {commit.branch_name}
                              </span>
                            )}
                            {commit.type === 'merge' && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-[#8957e5] bg-[#8957e5]/10 border border-[#8957e5]/30 rounded-full px-2 py-0.5">
                                Merge
                              </span>
                            )}
                            {isLatest && (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold text-[#3fb950] bg-[#3fb950]/10 border border-[#3fb950]/30 rounded-full px-2 py-0.5">
                                Latest
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Thumbnails */}
                        {commit.snapshots && commit.snapshots.length > 0 && (
                          <div className="mt-2.5">
                            <SnapshotThumbnails snapshots={commit.snapshots} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* ── Commit node tooltip (portal, fixed position) ──────────── */}
            {tooltipInfo &&
              createPortal(
                <div
                  style={{
                    position: "fixed",
                    left: tooltipLeft,
                    top: tooltipTop,
                    zIndex: 9999,
                  }}
                  className="bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl p-3 w-72 pointer-events-none"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AvatarCircle
                      name={tooltipInfo.commit.committer_username}
                      size="w-7 h-7"
                      textSize="text-xs"
                    />
                    <span className="text-[#e6edf3] text-sm font-medium truncate">
                      {tooltipInfo.commit.committer_username}
                    </span>
                    {tooltipInfo.isLatest && (
                      <span className="ml-auto inline-flex items-center text-[10px] uppercase font-bold text-[#3fb950] bg-[#3fb950]/10 border border-[#3fb950]/30 rounded-full px-2 py-0.5">
                        latest
                      </span>
                    )}
                  </div>

                  <p className="text-[#e6edf3] text-sm font-semibold leading-snug mb-1">
                    {tooltipInfo.commit.message || (
                      <span className="italic text-[#8b949e]">
                        (no message)
                      </span>
                    )}
                  </p>

                  <p className="text-[#8b949e] text-[11px]">
                    {formatExactDate(tooltipInfo.commit.created_at)}
                  </p>

                  <div className="border-t border-[#30363d] my-2.5" />

                  {(tooltipInfo.commit.snapshots ?? []).length > 0 ? (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        {(tooltipInfo.commit.snapshots ?? [])
                          .slice(0, 3)
                          .map((snap) => (
                            <div
                              key={snap.id}
                              className="w-8 h-8 rounded border border-[#30363d] overflow-hidden bg-[#0d1117] flex-shrink-0"
                            >
                              <img
                                src={api.storageUrl(snap.storage_path)}
                                alt={snap.filename}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            </div>
                          ))}
                        {(tooltipInfo.commit.snapshots ?? []).length > 3 && (
                          <div className="w-8 h-8 rounded border border-[#30363d] bg-[#21262d] flex items-center justify-center flex-shrink-0">
                            <span className="text-[#8b949e] text-xs">
                              +{(tooltipInfo.commit.snapshots ?? []).length - 3}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-[#8b949e] text-[11px]">
                        {(tooltipInfo.commit.snapshots ?? []).length} file
                        {(tooltipInfo.commit.snapshots ?? []).length !== 1
                          ? "s"
                          : ""}{" "}
                        changed
                      </p>
                    </>
                  ) : (
                    <p className="text-[#484f58] text-[11px] italic">
                      No files in this commit
                    </p>
                  )}

                  <div className="border-t border-[#30363d] my-2.5" />

                  <div className="flex items-center gap-1.5 text-[#58a6ff] text-xs font-medium">
                    <ArrowRight size={12} />
                    View diff
                  </div>
                </div>,
                document.body
              )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            LIST VIEW — date-grouped commit cards (original style)
        ══════════════════════════════════════════════════════════════════ */}
        {viewMode === "list" && mainCommits.length > 0 && (
          <>
            {groups.map((group, gi) => (
              <div key={gi}>
                <DateGroupHeader label={group.label} />
                <div className="flex flex-col gap-1.5">
                  {group.commits.map((commit) => {
                    const globalIdx = mainCommits.findIndex(
                      (c) => c.id === commit.id,
                    );
                    const isLatest = globalIdx === 0;
                    return (
                      <CommitRow
                        key={commit.id}
                        commit={commit}
                        isLatest={isLatest}
                        isOwner={isOwner}
                        onRollback={handleRollback}
                        projectId={id}
                        onNavigate={handleCommitNavigate}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Bottom padding ──────────────────────────────────────────────── */}
        {(timelineNodes.length > 0 || mainCommits.length > 0) && <div className="mt-8 pb-4" />}
      </div>
    </div>
  );
}
