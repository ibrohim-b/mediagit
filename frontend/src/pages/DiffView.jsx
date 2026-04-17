import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

// Colormap stops: [normPos, R, G, B]
const STOPS = [
  [0.00,   0,   0, 255],
  [0.04,   0,  80, 255],
  [0.15,   0, 220, 220],
  [0.35,   0, 255,   0],
  [0.60, 255, 220,   0],
  [1.00, 255,  30,  30],
];

function lerpColor(norm) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, r0, g0, b0] = STOPS[i];
    const [t1, r1, g1, b1] = STOPS[i + 1];
    if (norm <= t1) {
      const t = (norm - t0) / (t1 - t0);
      return [r0 + t * (r1 - r0), g0 + t * (g1 - g0), b0 + t * (b1 - b0)];
    }
  }
  return STOPS[STOPS.length - 1].slice(1);
}

function buildHeatmap(urlA, urlB, threshold) {
  return new Promise((resolve) => {
    const loadImg = (src) => new Promise((res) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.src = src;
    });
    Promise.all([loadImg(urlA), loadImg(urlB)]).then(([imgA, imgB]) => {
      const w = imgA.naturalWidth;
      const h = imgA.naturalHeight;
      const offscreen = document.createElement("canvas");
      offscreen.width = w; offscreen.height = h;
      const ctx = offscreen.getContext("2d");

      ctx.drawImage(imgA, 0, 0, w, h);
      const dataA = ctx.getImageData(0, 0, w, h).data;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(imgB, 0, 0, w, h);
      const dataB = ctx.getImageData(0, 0, w, h).data;

      const out = ctx.createImageData(w, h);
      let changed = 0;
      for (let i = 0; i < dataA.length; i += 4) {
        const mag = 0.299 * Math.abs(dataA[i] - dataB[i])
                  + 0.587 * Math.abs(dataA[i+1] - dataB[i+1])
                  + 0.114 * Math.abs(dataA[i+2] - dataB[i+2]);
        if (mag > threshold) {
          const norm = Math.min(mag / 255, 1);
          const [r, g, b] = lerpColor(norm);
          out.data[i]   = r;
          out.data[i+1] = g;
          out.data[i+2] = b;
          out.data[i+3] = 200;
          changed++;
        }
      }
      ctx.putImageData(out, 0, 0);
      resolve({
        dataUrl: offscreen.toDataURL(),
        changed,
        total: w * h,
        change_percent: +((changed / (w * h)) * 100).toFixed(2),
      });
    });
  });
}

const MODES = [
  { key: "slider", label: "Slider", icon: "↔️" },
  { key: "side", label: "Side by Side", icon: "◫" },
  { key: "onion", label: "Onion Skin", icon: "👻" },
  { key: "pixel", label: "Pixel Diff", icon: "🔴" },
  { key: "heatmap", label: "Heatmap", icon: "🌡️" },
];

const HEATMAP_LEGEND = [
  { color: "#001eff", label: "Minimal" },
  { color: "#00dcdc", label: "Low" },
  { color: "#00ff00", label: "Medium" },
  { color: "#ffdc00", label: "High" },
  { color: "#ff1e1e", label: "Extreme" },
];

export default function DiffView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [commitA, setCommitA] = useState("");
  const [commitB, setCommitB] = useState("");
  const [selectedFilename, setSelectedFilename] = useState("");
  const [snapA, setSnapA] = useState(null);
  const [snapB, setSnapB] = useState(null);
  const [mode, setMode] = useState("slider");
  const [sliderPos, setSliderPos] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const [diffResult, setDiffResult] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [heatmapDataUrl, setHeatmapDataUrl] = useState(null);
  const [heatmapStats, setHeatmapStats] = useState(null);
  const [heatmapOpacity, setHeatmapOpacity] = useState(80);
  const [heatmapThreshold, setHeatmapThreshold] = useState(10);

  const containerRef = useRef(null);
  const isDragging = useRef(false);

  useEffect(() => {
    api.getProject(id).then((p) => {
      setProject(p);
      if (p.commits.length >= 2) {
        setCommitA(p.commits[1].id);
        setCommitB(p.commits[0].id);
      }
    });
  }, [id]);

  // Derive union of filenames from both commits
  const getFileList = useCallback(() => {
    if (!project) return [];
    const cA = project.commits.find((c) => c.id === commitA);
    const cB = project.commits.find((c) => c.id === commitB);
    const names = new Set([
      ...(cA?.snapshots ?? []).map((s) => s.filename),
      ...(cB?.snapshots ?? []).map((s) => s.filename),
    ]);
    return [...names];
  }, [project, commitA, commitB]);

  // When commits change, reset to first file
  useEffect(() => {
    if (!project) return;
    const files = getFileList();
    const name = files[0] ?? "";
    setSelectedFilename(name);
    setDiffResult(null);
  }, [commitA, commitB, project]);

  // When selected filename changes, update snaps
  useEffect(() => {
    if (!project || !selectedFilename) return;
    const cA = project.commits.find((c) => c.id === commitA);
    const cB = project.commits.find((c) => c.id === commitB);
    setSnapA(cA?.snapshots?.find((s) => s.filename === selectedFilename) ?? null);
    setSnapB(cB?.snapshots?.find((s) => s.filename === selectedFilename) ?? null);
    setDiffResult(null);
    setHeatmapDataUrl(null);
    setHeatmapStats(null);
  }, [selectedFilename, commitA, commitB, project]);

  // Server-side pixel diff
  useEffect(() => {
    if (mode === "pixel" && snapA && snapB) {
      setLoadingDiff(true);
      api
        .generateDiff(snapA.storage_path, snapB.storage_path)
        .then((res) => { setDiffResult(res); setLoadingDiff(false); })
        .catch(() => setLoadingDiff(false));
    }
  }, [mode, snapA, snapB]);

  // Client-side heatmap (no server storage)
  useEffect(() => {
    if (mode !== "heatmap" || !snapA || !snapB) return;
    setHeatmapDataUrl(null);
    setHeatmapStats(null);
    setLoadingDiff(true);
    buildHeatmap(api.storageUrl(snapA.storage_path), api.storageUrl(snapB.storage_path), heatmapThreshold)
      .then(({ dataUrl, changed, total, change_percent }) => {
        setHeatmapDataUrl(dataUrl);
        setHeatmapStats({ changed, total, change_percent });
        setLoadingDiff(false);
      });
  }, [mode, snapA, snapB, heatmapThreshold]);

  const updateSlider = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setSliderPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      e.preventDefault();
      updateSlider(e.touches ? e.touches[0].clientX : e.clientX);
    };
    const onUp = () => { isDragging.current = false; };
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
  const fileList = getFileList();

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-gray-300">Projects</Link>
        <span>/</span>
        <Link to={`/project/${id}`} className="hover:text-gray-300">{project.name}</Link>
        <span>/</span>
        <span className="text-gray-300">Compare</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">🔍 Visual Diff</h1>

      {/* Commit Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { label: "Before (A)", color: "text-red-400", value: commitA, onChange: setCommitA },
          { label: "After (B)",  color: "text-green-400", value: commitB, onChange: setCommitB },
        ].map(({ label, color, value, onChange }) => (
          <div key={label}>
            <label className={`text-xs font-semibold ${color} uppercase tracking-wider mb-1 block`}>● {label}</label>
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-4 py-2.5 outline-none focus:border-[#58a6ff] transition text-sm"
            >
              {commitsData.map((c) => (
                <option key={c.id} value={c.id}>{c.message} — {c.id}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => urlA && urlB && setMode(m.key)}
            disabled={!urlA || !urlB}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              !urlA || !urlB
                ? "bg-[#161b22] border border-gray-700 opacity-30 cursor-not-allowed"
                : mode === m.key
                ? "bg-[#58a6ff] text-black shadow-lg shadow-[#58a6ff]/20"
                : "bg-[#161b22] border border-gray-700 hover:border-gray-500"
            }`}
          >
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {/* Main layout: sidebar + diff area */}
      <div className="flex gap-4 items-start">

        {/* File Sidebar */}
        {fileList.length > 0 && (
          <div className="w-56 shrink-0 bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Files <span className="text-gray-600 font-normal">({fileList.length})</span>
            </div>
            {fileList.map((name) => {
              const inA = commitsData.find((c) => c.id === commitA)?.snapshots?.some((s) => s.filename === name);
              const inB = commitsData.find((c) => c.id === commitB)?.snapshots?.some((s) => s.filename === name);
              const isNew = !inA && inB;
              const isRemoved = inA && !inB;
              return (
                <button
                  key={name}
                  onClick={() => setSelectedFilename(name)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition border-l-2 ${
                    selectedFilename === name
                      ? "bg-[#1c2128] border-[#58a6ff] text-white"
                      : "border-transparent hover:bg-[#1c2128] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span className={`text-xs font-bold w-3 shrink-0 ${isNew ? "text-green-400" : isRemoved ? "text-red-400" : "text-gray-600"}`}>
                    {isNew ? "A" : isRemoved ? "D" : "M"}
                  </span>
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Diff Display Area */}
        <div className="flex-1 min-w-0">
          {(urlA || urlB) ? (
            <div className="bg-[#161b22] border border-gray-700 rounded-xl overflow-hidden">
              {/* File header like GitHub */}
              <div className="px-4 py-2.5 border-b border-gray-700 flex items-center gap-3 text-sm">
                {urlA
                  ? <a href={urlA} target="_blank" rel="noopener noreferrer" className="font-mono text-gray-300 hover:underline">{selectedFilename}</a>
                  : <span className="font-mono text-gray-600 italic">NONE</span>}
                <span className="text-xs text-gray-600 font-mono">{snapA?.file_hash?.slice(0, 7) ?? "—"}</span>
                <span className="text-gray-600">→</span>
                {urlB
                  ? <a href={urlB} target="_blank" rel="noopener noreferrer" className="font-mono text-gray-300 hover:underline">{selectedFilename}</a>
                  : <span className="font-mono text-gray-600 italic">NONE</span>}
                <span className="text-xs text-gray-600 font-mono">{snapB?.file_hash?.slice(0, 7) ?? "—"}</span>
              </div>

              {/* ═══ ONLY IN ONE COMMIT ═══ */}
              {(!urlA || !urlB) && (
                <div className="relative">
                  <img src={urlA ?? urlB} alt={selectedFilename} className="w-full object-contain" />
                  <div className={`absolute inset-0 flex items-end p-4 bg-gradient-to-t ${urlB ? "from-green-950/80" : "from-red-950/80"} to-transparent pointer-events-none`}>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-mono font-semibold ${urlB ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                      <span className="text-lg">{urlB ? "+" : "-"}</span>
                      {urlB ? "File added in this commit" : "File removed after this commit"}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ SLIDER MODE ═══ */}
              {mode === "slider" && urlA && urlB && (
                <div
                  ref={containerRef}
                  className="relative select-none cursor-col-resize"
                  style={{ aspectRatio: "16 / 10" }}
                  onMouseDown={(e) => { isDragging.current = true; updateSlider(e.clientX); }}
                  onTouchStart={(e) => { isDragging.current = true; updateSlider(e.touches[0].clientX); }}
                >
                  <img src={urlA} alt="A" className="absolute inset-0 w-full h-full object-contain pointer-events-none" draggable={false} />
                  <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                    <img src={urlB} alt="B" className="w-full h-full object-contain pointer-events-none" draggable={false} />
                  </div>
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white z-20" style={{ left: `${sliderPos}%` }}>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-black font-bold text-lg">⟺</div>
                  </div>
                  <div className="absolute top-3 left-3 bg-red-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold z-10">BEFORE</div>
                  <div className="absolute top-3 right-3 bg-green-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold z-10">AFTER</div>
                </div>
              )}

              {/* ═══ SIDE BY SIDE ═══ */}
              {mode === "side" && urlA && urlB && (
                <div className="grid grid-cols-2 gap-[2px] bg-gray-800">
                  <div className="relative bg-[#161b22]">
                    <img src={urlA} alt="A" className="w-full object-contain" />
                    <div className="absolute top-3 left-3 bg-red-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold">BEFORE</div>
                  </div>
                  <div className="relative bg-[#161b22]">
                    <img src={urlB} alt="B" className="w-full object-contain" />
                    <div className="absolute top-3 left-3 bg-green-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold">AFTER</div>
                  </div>
                </div>
              )}

              {/* ═══ ONION SKIN ═══ */}
              {mode === "onion" && urlA && urlB && (
                <div>
                  <div className="relative" style={{ aspectRatio: "16 / 10" }}>
                    <img src={urlA} alt="A" className="absolute inset-0 w-full h-full object-contain" />
                    <img src={urlB} alt="B" className="absolute inset-0 w-full h-full object-contain transition-opacity duration-150" style={{ opacity: opacity / 100 }} />
                  </div>
                  <div className="p-4 border-t border-gray-700 flex items-center gap-4">
                    <span className="text-xs font-semibold text-red-400 w-16">Before</span>
                    <input type="range" min="0" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="flex-1" />
                    <span className="text-xs font-semibold text-green-400 w-16 text-right">After</span>
                    <span className="text-sm text-[#58a6ff] font-mono w-12 text-right">{opacity}%</span>
                  </div>
                </div>
              )}

              {/* ═══ PIXEL DIFF ═══ */}
              {mode === "pixel" && urlA && urlB && (
                <div>
                  <div className="relative" style={{ aspectRatio: "16 / 10" }}>
                    <img src={urlA} alt="Base" className="absolute inset-0 w-full h-full object-contain opacity-30" />
                    {loadingDiff && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-sm">Generating diff...</div>
                      </div>
                    )}
                    {diffResult && (
                      <img src={api.storageUrl(diffResult.diff_path)} alt="Diff" className="absolute inset-0 w-full h-full object-contain z-10" />
                    )}
                  </div>
                  {diffResult && (
                    <div className="p-4 border-t border-gray-700 flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-[#ff3c50] rounded-sm inline-block" />
                        <span className="text-sm text-gray-300">Changed pixels</span>
                      </div>
                      <span className="text-lg font-bold text-red-400 font-mono">{diffResult.change_percent}%</span>
                      <span className="text-sm text-gray-500">{diffResult.changed_pixels.toLocaleString()} / {diffResult.total_pixels.toLocaleString()} px</span>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ HEATMAP (client-side, no server storage) ═══ */}
              {mode === "heatmap" && urlA && urlB && (
                <div>
                  <div className="relative" style={{ aspectRatio: "16 / 10" }}>
                    <img src={urlB} alt="After" className="absolute inset-0 w-full h-full object-contain" />
                    {loadingDiff && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-sm">Generating heatmap...</div>
                      </div>
                    )}
                    {heatmapDataUrl && (
                      <img
                        src={heatmapDataUrl}
                        alt="Heatmap"
                        className="absolute inset-0 w-full h-full object-contain z-10 transition-opacity"
                        style={{ opacity: heatmapOpacity / 100 }}
                      />
                    )}
                  </div>

                  <div className="p-4 border-t border-gray-700 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Intensity:</span>
                      <div className="flex items-center gap-2">
                        {HEATMAP_LEGEND.map(({ color, label }) => (
                          <div key={label} className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
                            <span className="text-xs text-gray-400">{label}</span>
                          </div>
                        ))}
                      </div>
                      {heatmapStats && (
                        <span className="ml-auto text-sm font-mono text-red-400 font-bold">{heatmapStats.change_percent}% changed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-20">Overlay</span>
                      <input type="range" min="0" max="100" value={heatmapOpacity} onChange={(e) => setHeatmapOpacity(Number(e.target.value))} className="flex-1" />
                      <span className="text-xs text-[#58a6ff] font-mono w-10 text-right">{heatmapOpacity}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-20">Threshold</span>
                      <input type="range" min="1" max="80" value={heatmapThreshold} onChange={(e) => setHeatmapThreshold(Number(e.target.value))} className="flex-1" />
                      <span className="text-xs text-[#58a6ff] font-mono w-10 text-right">{heatmapThreshold}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#161b22] border border-gray-700 rounded-xl p-16 text-center text-gray-500">
              <div className="text-5xl mb-4">🖼️</div>
              <p>Select two commits to compare</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
