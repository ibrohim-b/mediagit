import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

const MODES = [
  { key: "slider", label: "Slider", icon: "↔️" },
  { key: "side", label: "Side by Side", icon: "◫" },
  { key: "onion", label: "Onion Skin", icon: "👻" },
  { key: "pixel", label: "Pixel Diff", icon: "🔴" },
];

export default function DiffView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [commitA, setCommitA] = useState("");
  const [commitB, setCommitB] = useState("");
  const [snapA, setSnapA] = useState(null);
  const [snapB, setSnapB] = useState(null);
  const [fileA, setFileA] = useState("");
  const [fileB, setFileB] = useState("");
  const [mode, setMode] = useState("slider");
  const [sliderPos, setSliderPos] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const [diffResult, setDiffResult] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const containerRef = useRef(null);
  const isDragging = useRef(false);

  // Load project
  useEffect(() => {
    api.getProject(id).then((p) => {
      setProject(p);
      if (p.commits.length >= 2) {
        setCommitA(p.commits[1].id);
        setCommitB(p.commits[0].id);
      }
    });
  }, [id]);

  const matchByName = (snaps, name) =>
    snaps?.find((s) => s.filename === name) ?? snaps?.[0] ?? null;

  // Set snapshots when commits change — match by filename
  useEffect(() => {
    if (!project) return;
    const cA = project.commits.find((c) => c.id === commitA);
    const cB = project.commits.find((c) => c.id === commitB);
    const sA = cA?.snapshots?.[0] ?? null;
    const sB = matchByName(cB?.snapshots, sA?.filename);
    setSnapA(sA);
    setSnapB(sB);
    setFileA(sA?.id ?? "");
    setFileB(sB?.id ?? "");
    setDiffResult(null);
  }, [commitA, commitB, project]);

  // When user changes file A, auto-match B by name
  const handleFileAChange = (newId) => {
    setFileA(newId);
    const cA = project.commits.find((c) => c.id === commitA);
    const cB = project.commits.find((c) => c.id === commitB);
    const sA = cA?.snapshots?.find((s) => s.id === newId);
    const sB = matchByName(cB?.snapshots, sA?.filename);
    setSnapA(sA);
    setSnapB(sB);
    setFileB(sB?.id ?? "");
    setDiffResult(null);
  };

  // When user changes file B, auto-match A by name
  const handleFileBChange = (newId) => {
    setFileB(newId);
    const cA = project.commits.find((c) => c.id === commitA);
    const cB = project.commits.find((c) => c.id === commitB);
    const sB = cB?.snapshots?.find((s) => s.id === newId);
    const sA = matchByName(cA?.snapshots, sB?.filename);
    setSnapA(sA);
    setSnapB(sB);
    setFileA(sA?.id ?? "");
    setDiffResult(null);
  };

  // Generate pixel diff
  useEffect(() => {
    if (mode === "pixel" && snapA && snapB) {
      setLoadingDiff(true);
      api
        .generateDiff(snapA.storage_path, snapB.storage_path)
        .then((res) => {
          setDiffResult(res);
          setLoadingDiff(false);
        })
        .catch(() => setLoadingDiff(false));
    }
  }, [mode, snapA, snapB]);

  // Slider drag handlers
  const updateSlider = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, x)));
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      updateSlider(clientX);
    };
    const onUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [updateSlider]);

  if (!project)
    return <div className="text-center py-20 text-gray-500">Loading...</div>;

  const urlA = snapA ? api.storageUrl(snapA.storage_path) : null;
  const urlB = snapB ? api.storageUrl(snapB.storage_path) : null;
  const commitsData = project.commits;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-gray-300">
          Projects
        </Link>
        <span>/</span>
        <Link to={`/project/${id}`} className="hover:text-gray-300">
          {project.name}
        </Link>
        <span>/</span>
        <span className="text-gray-300">Compare</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">🔍 Visual Diff</h1>

      {/* Commit Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[{ label: "Before (A)", color: "text-red-400", commit: commitA, setCommit: setCommitA, file: fileA, onFileChange: handleFileAChange },
          { label: "After (B)",  color: "text-green-400", commit: commitB, setCommit: setCommitB, file: fileB, onFileChange: handleFileBChange }]
          .map(({ label, color, commit, setCommit, file, onFileChange }) => {
            const snaps = commitsData.find((c) => c.id === commit)?.snapshots ?? [];
            return (
              <div key={label} className="flex flex-col gap-2">
                <label className={`text-xs font-semibold ${color} uppercase tracking-wider`}>● {label}</label>
                <select
                  value={commit}
                  onChange={(e) => setCommit(e.target.value)}
                  className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-4 py-2.5 outline-none focus:border-[#58a6ff] transition text-sm"
                >
                  {commitsData.map((c) => (
                    <option key={c.id} value={c.id}>{c.message} — {c.id}</option>
                  ))}
                </select>
                {snaps.length > 1 && (
                  <select
                    value={file}
                    onChange={(e) => onFileChange(e.target.value)}
                    className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-4 py-2.5 outline-none focus:border-[#58a6ff] transition text-sm"
                  >
                    {snaps.map((s) => (
                      <option key={s.id} value={s.id}>{s.filename}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              mode === m.key
                ? "bg-[#58a6ff] text-black shadow-lg shadow-[#58a6ff]/20"
                : "bg-[#161b22] border border-gray-700 hover:border-gray-500"
            }`}
          >
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {/* Diff Display Area */}
      {urlA && urlB ? (
        <div className="bg-[#161b22] border border-gray-700 rounded-xl overflow-hidden">
          {/* ═══ SLIDER MODE ═══ */}
          {mode === "slider" && (
            <div
              ref={containerRef}
              className="relative select-none cursor-col-resize"
              style={{ aspectRatio: "16 / 10" }}
              onMouseDown={(e) => {
                isDragging.current = true;
                updateSlider(e.clientX);
              }}
              onTouchStart={(e) => {
                isDragging.current = true;
                updateSlider(e.touches[0].clientX);
              }}
            >
              {/* Image A — full background */}
              <img
                src={urlA}
                alt="A"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              {/* Image B — clipped */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                }}
              >
                <img
                  src={urlB}
                  alt="B"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              </div>
              {/* Slider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-20"
                style={{ left: `${sliderPos}%` }}
              >
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                w-10 h-10 bg-white rounded-full shadow-lg
                                flex items-center justify-center text-black font-bold text-lg"
                >
                  ⟺
                </div>
              </div>
              {/* Labels */}
              <div className="absolute top-3 left-3 bg-red-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold z-10">
                BEFORE
              </div>
              <div className="absolute top-3 right-3 bg-green-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold z-10">
                AFTER
              </div>
            </div>
          )}

          {/* ═══ SIDE BY SIDE ═══ */}
          {mode === "side" && (
            <div className="grid grid-cols-2 gap-[2px] bg-gray-800">
              <div className="relative bg-[#161b22]">
                <img
                  src={urlA}
                  alt="A"
                  className="w-full object-contain"
                />
                <div className="absolute top-3 left-3 bg-red-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold">
                  BEFORE
                </div>
              </div>
              <div className="relative bg-[#161b22]">
                <img
                  src={urlB}
                  alt="B"
                  className="w-full object-contain"
                />
                <div className="absolute top-3 left-3 bg-green-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold">
                  AFTER
                </div>
              </div>
            </div>
          )}

          {/* ═══ ONION SKIN ═══ */}
          {mode === "onion" && (
            <div>
              <div className="relative" style={{ aspectRatio: "16 / 10" }}>
                <img
                  src={urlA}
                  alt="A"
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <img
                  src={urlB}
                  alt="B"
                  className="absolute inset-0 w-full h-full object-contain transition-opacity duration-150"
                  style={{ opacity: opacity / 100 }}
                />
              </div>
              <div className="p-4 border-t border-gray-700 flex items-center gap-4">
                <span className="text-xs font-semibold text-red-400 w-16">
                  Before
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs font-semibold text-green-400 w-16 text-right">
                  After
                </span>
                <span className="text-sm text-[#58a6ff] font-mono w-12 text-right">
                  {opacity}%
                </span>
              </div>
            </div>
          )}

          {/* ═══ PIXEL DIFF ═══ */}
          {mode === "pixel" && (
            <div>
              <div className="relative" style={{ aspectRatio: "16 / 10" }}>
                <img
                  src={urlA}
                  alt="Base"
                  className="absolute inset-0 w-full h-full object-contain opacity-30"
                />
                {loadingDiff && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-sm">
                      Generating diff...
                    </div>
                  </div>
                )}
                {diffResult && (
                  <img
                    src={api.storageUrl(diffResult.diff_path)}
                    alt="Diff"
                    className="absolute inset-0 w-full h-full object-contain z-10"
                  />
                )}
              </div>
              {diffResult && (
                <div className="p-4 border-t border-gray-700 flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-[#ff3c50] rounded-sm inline-block" />
                    <span className="text-sm text-gray-300">
                      Changed pixels
                    </span>
                  </div>
                  <span className="text-lg font-bold text-red-400 font-mono">
                    {diffResult.change_percent}%
                  </span>
                  <span className="text-sm text-gray-500">
                    {diffResult.changed_pixels.toLocaleString()} /{" "}
                    {diffResult.total_pixels.toLocaleString()} px
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#161b22] border border-gray-700 rounded-xl p-16 text-center text-gray-500">
          <div className="text-5xl mb-4">🖼️</div>
          <p>Select two commits with images to compare</p>
        </div>
      )}
    </div>
  );
}
