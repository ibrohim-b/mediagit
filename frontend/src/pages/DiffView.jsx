import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import ProjectHeader from "../components/ProjectHeader";
import { api } from "../api";
import {
  Sparkles,
  Image as ImageIcon,
  ArrowLeftRight,
  Columns2,
  Layers,
  Scan,
  Thermometer,
  GitFork,
  GitCommitHorizontal,
  GitBranch,
  Code2,
  Check,
  EyeOff,
} from "lucide-react";
import FilePreview from "../components/FilePreview";
import { readPsd } from "ag-psd";
import HoverPreview from "../components/HoverPreview";

// ─── PSD blend mode → Canvas composite operation mapping ─────────────────────
const PSD_BLEND_TO_CANVAS = {
  "normal": "source-over",
  "multiply": "multiply",
  "screen": "screen",
  "overlay": "overlay",
  "darken": "darken",
  "lighten": "lighten",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  "hard-light": "hard-light",
  "soft-light": "soft-light",
  "difference": "difference",
  "exclusion": "exclusion",
  "hue": "hue",
  "saturation": "saturation",
  "color": "color",
  "luminosity": "luminosity",
  "linear-dodge": "lighter",
  "darker-color": "darken",
  "lighter-color": "lighten",
};

// ─── timeAgo ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatExactDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── AvatarCircle ─────────────────────────────────────────────────────────────
function AvatarCircle({ name, size = 6 }) {
  const initial = (name || "?")[0].toUpperCase();
  const palette = [
    "bg-purple-600", "bg-blue-600", "bg-emerald-700",
    "bg-amber-600", "bg-pink-600", "bg-indigo-600",
    "bg-teal-600", "bg-rose-600",
  ];
  const color = palette[initial.charCodeAt(0) % palette.length];
  return (
    <div className={`w-${size} h-${size} ${color} rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0`}>
      {initial}
    </div>
  );
}

// ─── shortHash ────────────────────────────────────────────────────────────────
function shortHash(id) {
  return String(id).padStart(7, "0").slice(0, 7);
}

// ─── Colormap stops ───────────────────────────────────────────────────────────
const STOPS = [
  [0.0, 0, 0, 255], [0.04, 0, 80, 255], [0.15, 0, 220, 220],
  [0.35, 0, 255, 0], [0.6, 255, 220, 0], [1.0, 255, 30, 30],
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

const loadImg = (src) =>
  new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.src = src;
  });

const CHECKERBOARD_STYLE = {
  backgroundImage: "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
  backgroundColor: "#ffffff",
};

function buildCanvasDiff(urlA, urlB, { threshold = 10, heatmap = false } = {}) {
  return Promise.all([loadImg(urlA), loadImg(urlB)]).then(([imgA, imgB]) => {
    const w = imgA.naturalWidth;
    const h = imgA.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgA, 0, 0, w, h);
    const dataA = ctx.getImageData(0, 0, w, h).data;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgB, 0, 0, w, h);
    const dataB = ctx.getImageData(0, 0, w, h).data;
    const out = ctx.createImageData(w, h);
    let changed = 0;
    for (let i = 0; i < dataA.length; i += 4) {
      const mag =
        0.299 * Math.abs(dataA[i] - dataB[i]) +
        0.587 * Math.abs(dataA[i + 1] - dataB[i + 1]) +
        0.114 * Math.abs(dataA[i + 2] - dataB[i + 2]);
      if (mag > threshold) {
        const [r, g, b] = heatmap ? lerpColor(Math.min(mag / 255, 1)) : [255, 60, 80];
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 200;
        changed++;
      }
    }
    ctx.putImageData(out, 0, 0);
    return { dataUrl: canvas.toDataURL(), changed, total: w * h, change_percent: +((changed / (w * h)) * 100).toFixed(2) };
  });
}

const MODES = [
  { key: "slider", label: "Slider", Icon: ArrowLeftRight },
  { key: "side", label: "Side by Side", Icon: Columns2 },
  { key: "onion", label: "Onion Skin", Icon: Layers },
  { key: "pixel", label: "Pixel Diff", Icon: Scan },
  { key: "heatmap", label: "Heatmap", Icon: Thermometer },
];

const HEATMAP_LEGEND = [
  { color: "#001eff", label: "Minimal" }, { color: "#00dcdc", label: "Low" },
  { color: "#00ff00", label: "Medium" }, { color: "#ffdc00", label: "High" },
  { color: "#ff1e1e", label: "Extreme" },
];


// ─── CommitSidebarItem ────────────────────────────────────────────────────────
function CommitSidebarItem({ commit, roleA, roleB, onSelectA, onSelectB, isLatest }) {
  const isA = roleA;
  const isB = roleB;

  return (
    <div
      className={`relative flex items-start gap-2 px-3 py-2.5 border-l-2 transition-colors group
        ${isB ? "border-[#3fb950] bg-[#238636]/10" : isA ? "border-[#f0883e] bg-[#f0883e]/10" : "border-transparent hover:bg-[#1c2128]"}`}
    >
      {/* Avatar */}
      <div className="pt-0.5 flex-shrink-0">
        <AvatarCircle name={commit.committer_username} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#e6edf3] leading-relaxed line-clamp-2">{commit.message}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] font-mono text-[#8b949e]">{shortHash(commit.id)}</span>
          <span className="text-[10px] text-[#8b949e]">{timeAgo(commit.created_at)}</span>
          {isLatest && (
            <span className="text-[9px] font-semibold text-[#3fb950] bg-[#238636]/20 border border-[#238636]/40 px-1 py-px rounded-full">
              latest
            </span>
          )}
        </div>

        {/* A / B toggle buttons */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onSelectB(); }}
            title="Set as AFTER (newer)"
            className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${isB
                ? "bg-[#238636]/30 text-[#3fb950] border-[#238636]/60"
                : "text-[#8b949e] border-[#30363d] hover:bg-[#21262d] hover:text-[#3fb950]"
              }`}
          >
            {isB && <Check size={8} />} After
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSelectA(); }}
            title="Set as BEFORE (older)"
            className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${isA
                ? "bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/50"
                : "text-[#8b949e] border-[#30363d] hover:bg-[#21262d] hover:text-[#f0883e]"
              }`}
          >
            {isA && <Check size={8} />} Before
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DiffView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  // ── State ──────────────────────────────────────────────────────────────────
  const [project, setProject] = useState(null);
  const [commitA, setCommitA] = useState("");   // "before" (older)
  const [commitB, setCommitB] = useState("");   // "after" (newer/latest)
  const [selectedFilename, setSelectedFilename] = useState("");
  const [snapA, setSnapA] = useState(null);
  const [snapB, setSnapB] = useState(null);
  const [mode, setMode] = useState("slider");
  const [sliderPos, setSliderPos] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [pixelDataUrl, setPixelDataUrl] = useState(null);
  const [pixelStats, setPixelStats] = useState(null);
  const [heatmapDataUrl, setHeatmapDataUrl] = useState(null);
  const [heatmapStats, setHeatmapStats] = useState(null);
  const [heatmapOpacity, setHeatmapOpacity] = useState(80);
  const [heatmapThreshold, setHeatmapThreshold] = useState(10);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [hoveredFile, setHoveredFile] = useState(null);

  const [psdLayersA, setPsdLayersA] = useState([]);
  const [psdLayersB, setPsdLayersB] = useState([]);
  const [selectedLayerName, setSelectedLayerName] = useState(null);
  const [psdUrlA, setPsdUrlA] = useState(null);
  const [psdUrlB, setPsdUrlB] = useState(null);
  const [psdLoading, setPsdLoading] = useState(false);
  const [psdObjA, setPsdObjA] = useState(null);
  const [psdObjB, setPsdObjB] = useState(null);
  const [layerVisibility, setLayerVisibility] = useState({});

  const containerRef = useRef(null);
  const isDragging = useRef(false);

  // ── FIX 1: flattenLayers — only include LEAF layers ────────────────────────
  // Previously this pushed group .canvas AND recursed into children,
  // causing every pixel to be drawn multiple times (darkening).
  const flattenLayers = useCallback((layers, depth = 0) => {
    let flat = [];
    for (const l of layers) {
      if (l.children && l.children.length > 0) {
        // It's a group — recurse into children only, skip the group's own canvas
        flat.push(...flattenLayers(l.children, depth + 1));
      } else {
        // Leaf layer — include it
        flat.push({ ...l, depth });
      }
    }
    return flat;
  }, []);

  const canvasToBlobUrl = useCallback((canvas) => new Promise((resolve) => {
    if (!canvas) return resolve(null);
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), "image/png");
  }), []);

  useEffect(() => {
    return () => {
      if (psdUrlA) URL.revokeObjectURL(psdUrlA);
      if (psdUrlB) URL.revokeObjectURL(psdUrlB);
    };
  }, [psdUrlA, psdUrlB]);


  // ── Load project + apply ?a / ?b / ?file URL params ───────────────────────
  useEffect(() => {
    api.getProject(id).then((p) => {
      setProject(p);
      const paramA = searchParams.get("a");
      const paramB = searchParams.get("b");
      const paramFile = searchParams.get("file");

      const findCommit = (val) => {
        if (val == null) return null;
        const parsed = parseInt(val, 10);
        return p.commits.find((c) => c.id === parsed) ?? null;
      };

      const matchA = findCommit(paramA);
      const matchB = findCommit(paramB);

      const resolvedBId = matchB
        ? matchB.id
        : p.commits.length >= 1 ? p.commits[0].id : "";
      const resolvedAId = matchA
        ? matchA.id
        : p.commits.length >= 2 ? p.commits[1].id : "";

      setCommitB(resolvedBId);
      setCommitA(resolvedAId);

      const cA = p.commits.find((c) => c.id === resolvedAId);
      const cB = p.commits.find((c) => c.id === resolvedBId);
      const names = new Set([
        ...(cA?.snapshots ?? []).map((s) => s.filename),
        ...(cB?.snapshots ?? []).map((s) => s.filename),
      ]);

      if (paramFile && [...names].includes(paramFile)) {
        setSelectedFilename(paramFile);
      } else if (paramFile) {
        setSelectedFilename(paramFile);
      } else {
        setSelectedFilename([...names][0] ?? "");
      }
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive union of filenames from both commits ────────────────────────────
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

  // ── When commits change: reset diff outputs ────────────────────────────────
  useEffect(() => {
    if (!project) return;
    setPixelDataUrl(null); setPixelStats(null);
    setHeatmapDataUrl(null); setHeatmapStats(null);
    setAiResult(null); setAiError(null);
    setPsdLayersA([]); setPsdLayersB([]);
    setSelectedLayerName(null); setPsdUrlA(null); setPsdUrlB(null);
    setPsdObjA(null); setPsdObjB(null); setLayerVisibility({});
    const files = getFileList();
    setSelectedFilename((current) => {
      if (!current || (files.length > 0 && !files.includes(current))) return files[0] ?? "";
      return current;
    });
  }, [project, commitA, commitB, getFileList]);

  // ── When selected filename changes: update snaps ──────────────────────────
  useEffect(() => {
    if (!project || !selectedFilename) return;
    const cA = project.commits.find((c) => c.id === commitA);
    const cB = project.commits.find((c) => c.id === commitB);
    setSnapA(cA?.snapshots?.find((s) => s.filename === selectedFilename) ?? null);
    setSnapB(cB?.snapshots?.find((s) => s.filename === selectedFilename) ?? null);
    setPixelDataUrl(null); setPixelStats(null);
    setHeatmapDataUrl(null); setHeatmapStats(null);
    setAiResult(null); setAiError(null);
    setPsdLayersA([]); setPsdLayersB([]);
    setSelectedLayerName(null); setPsdUrlA(null); setPsdUrlB(null);
    setPsdObjA(null); setPsdObjB(null); setLayerVisibility({});
  }, [selectedFilename, commitA, commitB, project]);

  // ── Parse PSD logic ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFilename.endsWith(".psd") || (!snapA && !snapB)) return;
    setPsdLoading(true);
    setPsdLayersA([]); setPsdLayersB([]);
    setSelectedLayerName("__composite__");
    setPsdObjA(null); setPsdObjB(null);
    setLayerVisibility({});

    Promise.all([
      snapA
        ? fetch(api.storageUrl(snapA.storage_path)).then((r) => r.arrayBuffer())
        : Promise.resolve(null),
      snapB
        ? fetch(api.storageUrl(snapB.storage_path)).then((r) => r.arrayBuffer())
        : Promise.resolve(null),
    ])
      .then(([abA, abB]) => {
        const isPsdBuffer = (ab) => {
          if (!ab || ab.byteLength < 4) return false;
          const v = new Uint8Array(ab);
          return v[0] === 0x38 && v[1] === 0x42 && v[2] === 0x50 && v[3] === 0x53; // 8BPS
        };

        const psdA = isPsdBuffer(abA) ? readPsd(abA) : null;
        const psdB = isPsdBuffer(abB) ? readPsd(abB) : null;

        setPsdObjA(psdA);
        setPsdObjB(psdB);

        const layersA = psdA ? flattenLayers(psdA.children || []) : [];
        const layersB = psdB ? flattenLayers(psdB.children || []) : [];
        setPsdLayersA(layersA);
        setPsdLayersB(layersB);

        // ── FIX 3: Respect PSD hidden flag when initializing visibility ──
        const allNames = new Set([
          ...layersA.map((l) => l.name),
          ...layersB.map((l) => l.name),
        ]);
        const vis = {};
        allNames.forEach((n) => {
          const inA = layersA.find((l) => l.name === n);
          const inB = layersB.find((l) => l.name === n);
          // Only default to visible if the layer isn't hidden in BOTH versions
          const hiddenInA = inA ? inA.hidden : true;
          const hiddenInB = inB ? inB.hidden : true;
          vis[n] = !(hiddenInA && hiddenInB);
        });
        setLayerVisibility(vis);

        setPsdLoading(false);
      })
      .catch((err) => {
        console.error("PSD parse error:", err);
        setPsdLoading(false);
      });
  }, [selectedFilename, snapA, snapB, flattenLayers]);

  // ── FIX 2: compositeLayersToUrl — transparent first-pass + blend modes ────
  // Previously drew everything as source-over onto opaque dark fill,
  // causing multiply/screen/etc. to interact with the background instead
  // of with other layers, making the result super dark.
  const compositeLayersToUrl = useCallback(
    (psdObj, layers, visibility) => {
      return new Promise((resolve) => {
        if (!psdObj) return resolve(null);

        const w = psdObj.width;
        const h = psdObj.height;

        // Step 1: Composite all visible layers onto a TRANSPARENT canvas
        // so blend modes interact with each other, not with a dark background
        const layerCanvas = document.createElement("canvas");
        layerCanvas.width = w;
        layerCanvas.height = h;
        const layerCtx = layerCanvas.getContext("2d");

        // Stack layers bottom-to-top (PSD lists top-first, so reverse)
        const toDraw = [...layers].reverse();

        for (const layer of toDraw) {
          // Use visibility dict as single source of truth.
          // undefined means "not yet initialized" → treat as visible (same as checkbox default)
          if (visibility[layer.name] === false) continue;
          if (!layer.canvas) continue; // no pixel data

          const x = layer.left ?? 0;
          const y = layer.top ?? 0;

          // Map the PSD blend mode to a canvas globalCompositeOperation
          // We override with source-over because browsers erase alpha channels 
          // when using Photoshop blend modes (like multiply) against a transparent canvas!
          const blendMode = "source-over"; // PSD_BLEND_TO_CANVAS[layer.blendMode] || "source-over";
          layerCtx.globalCompositeOperation = blendMode;
          layerCtx.globalAlpha = (layer.opacity ?? 255) / 255;
          layerCtx.drawImage(layer.canvas, x, y);
        }

        layerCanvas.toBlob(
          (blob) => resolve(URL.createObjectURL(blob)),
          "image/png"
        );
      });
    },
    []
  );

  // ── PSD Layer URL Generation ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFilename.endsWith(".psd")) {
      setPsdUrlA(null);
      setPsdUrlB(null);
      return;
    }

    if (selectedLayerName === "__composite__") {
      // Use the pre-composited canvas from ag-psd (the full flattened image)
      Promise.all([
        psdObjA?.canvas ? canvasToBlobUrl(psdObjA.canvas) : Promise.resolve(null),
        psdObjB?.canvas ? canvasToBlobUrl(psdObjB.canvas) : Promise.resolve(null),
      ]).then(([a, b]) => {
        if (psdUrlA) URL.revokeObjectURL(psdUrlA);
        if (psdUrlB) URL.revokeObjectURL(psdUrlB);
        setPsdUrlA(a);
        setPsdUrlB(b);
      });
    } else if (selectedLayerName === "__custom__") {
      // Multi-layer composite based on visibility toggles
      Promise.all([
        compositeLayersToUrl(psdObjA, psdLayersA, layerVisibility),
        compositeLayersToUrl(psdObjB, psdLayersB, layerVisibility),
      ]).then(([a, b]) => {
        if (psdUrlA) URL.revokeObjectURL(psdUrlA);
        if (psdUrlB) URL.revokeObjectURL(psdUrlB);
        setPsdUrlA(a);
        setPsdUrlB(b);
      });
    } else if (selectedLayerName) {
      // Single layer — draw it on the FULL canvas at correct position
      const renderSingleLayer = (psdObj, layers) => {
        const layer = layers.find((l) => l.name === selectedLayerName);
        if (!psdObj || !layer?.canvas) return Promise.resolve(null);
        const canvas = document.createElement("canvas");
        canvas.width = psdObj.width;
        canvas.height = psdObj.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(layer.canvas, layer.left ?? 0, layer.top ?? 0);
        return new Promise((res) =>
          canvas.toBlob((blob) => res(URL.createObjectURL(blob)), "image/png")
        );
      };
      Promise.all([
        renderSingleLayer(psdObjA, psdLayersA),
        renderSingleLayer(psdObjB, psdLayersB),
      ]).then(([a, b]) => {
        if (psdUrlA) URL.revokeObjectURL(psdUrlA);
        if (psdUrlB) URL.revokeObjectURL(psdUrlB);
        setPsdUrlA(a);
        setPsdUrlB(b);
      });
    }
  }, [
    selectedLayerName,
    psdLayersA,
    psdLayersB,
    psdObjA,
    psdObjB,
    selectedFilename,
    layerVisibility,
    canvasToBlobUrl,
    compositeLayersToUrl,
  ]);

  // ── Pixel diff ────────────────────────────────────────────────────────────
  useEffect(() => {
    const isPsd = selectedFilename?.endsWith(".psd");
    const uA = isPsd ? psdUrlA : (snapA ? api.storageUrl(snapA.storage_path) : null);
    const uB = isPsd ? psdUrlB : (snapB ? api.storageUrl(snapB.storage_path) : null);
    if (mode !== "pixel" || !uA || !uB) return;
    setPixelDataUrl(null); setPixelStats(null); setLoadingDiff(true);
    buildCanvasDiff(uA, uB)
      .then(({ dataUrl, changed, total, change_percent }) => {
        setPixelDataUrl(dataUrl); setPixelStats({ changed, total, change_percent }); setLoadingDiff(false);
      });
  }, [mode, snapA, snapB, selectedFilename, psdUrlA, psdUrlB]);

  // ── Heatmap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const isPsd = selectedFilename?.endsWith(".psd");
    const uA = isPsd ? psdUrlA : (snapA ? api.storageUrl(snapA.storage_path) : null);
    const uB = isPsd ? psdUrlB : (snapB ? api.storageUrl(snapB.storage_path) : null);
    if (mode !== "heatmap" || !uA || !uB) return;
    setHeatmapDataUrl(null); setHeatmapStats(null); setLoadingDiff(true);
    buildCanvasDiff(
      uA, uB,
      { threshold: heatmapThreshold, heatmap: true },
    ).then(({ dataUrl, changed, total, change_percent }) => {
      setHeatmapDataUrl(dataUrl); setHeatmapStats({ changed, total, change_percent }); setLoadingDiff(false);
    });
  }, [mode, snapA, snapB, heatmapThreshold, selectedFilename, psdUrlA, psdUrlB]);

  // ── Slider drag ───────────────────────────────────────────────────────────
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

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (!project) return <div className="text-center py-20 text-gray-500">Loading…</div>;

  // ── Derived values ────────────────────────────────────────────────────────
  const isPsd = selectedFilename.toLowerCase().endsWith(".psd");
  const urlA = isPsd ? psdUrlA : (snapA ? api.storageUrl(snapA.storage_path) : null);
  const urlB = isPsd ? psdUrlB : (snapB ? api.storageUrl(snapB.storage_path) : null);
  const commitsData = project.commits;
  const fileList = getFileList();


  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="-mx-4 -mt-6 flex flex-col"
      style={{ color: "#e6edf3", minHeight: "100vh", backgroundColor: "#0d1117" }}
    >
      <ProjectHeader project={project} activeTab="compare" />

      {/* ══ Main Content: sidebar + right area ════════════════════════════ */}
      <div className="flex" style={{ minHeight: "calc(100vh - 64px - 48px)" }}>
        {/* ── Left Sidebar: commit selector ─────────────────────────────── */}
        <div
          className="w-64 flex-shrink-0 bg-[#161b22] border-r border-[#30363d] flex flex-col"
          style={{
            position: "sticky",
            top: "112px",
            height: "calc(100vh - 112px)",
            overflowY: "auto",
          }}
        >
          {/* Sidebar header */}
          <div className="px-3 py-2.5 border-b border-[#30363d] flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeftRight size={13} className="text-[#8b949e]" />
              <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
                Compare commits
              </span>
            </div>
            <p className="text-[10px] text-[#6e7681] mt-1 leading-relaxed">
              Pick <span className="text-[#3fb950] font-semibold">After</span> and{" "}
              <span className="text-[#f0883e] font-semibold">Before</span> from the list below.
            </p>
          </div>

          {/* Legend */}
          <div className="px-3 py-2 border-b border-[#30363d] flex items-center gap-3 flex-shrink-0">
            <span className="flex items-center gap-1 text-[10px] text-[#3fb950]">
              <span className="w-2 h-2 rounded-full bg-[#3fb950] inline-block" /> After
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#f0883e]">
              <span className="w-2 h-2 rounded-full bg-[#f0883e] inline-block" /> Before
            </span>
          </div>

          {/* Commit list */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#21262d]">
            {commitsData.length === 0 ? (
              <p className="px-3 py-6 text-xs text-[#8b949e] text-center">No commits yet.</p>
            ) : (
              commitsData.map((c, idx) => (
                <CommitSidebarItem
                  key={c.id}
                  commit={c}
                  isLatest={idx === 0}
                  roleA={commitA === c.id}
                  roleB={commitB === c.id}
                  onSelectA={() => {
                    if (commitB === c.id) return;
                    setCommitA(c.id);
                  }}
                  onSelectB={() => {
                    if (commitA === c.id) return;
                    setCommitB(c.id);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right Area ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 p-4">
          {/* File Strip */}
          {fileList.length > 0 && (
            <div className="flex items-end border-b border-[#30363d] mb-4 overflow-x-auto">
              {fileList.map((name) => {
                const cACommit = commitsData.find((c) => c.id === commitA);
                const cBCommit = commitsData.find((c) => c.id === commitB);
                const inA = cACommit?.snapshots?.some((s) => s.filename === name);
                const inB = cBCommit?.snapshots?.some((s) => s.filename === name);
                const isNew = !inA && inB;
                const isRemoved = inA && !inB;
                const thumbSnap =
                  cBCommit?.snapshots?.find((s) => s.filename === name) ??
                  cACommit?.snapshots?.find((s) => s.filename === name);
                const isActive = selectedFilename === name;
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedFilename(name)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 flex-shrink-0 transition-colors ${isActive
                        ? "border-[#58a6ff] text-[#e6edf3] bg-[#1c2128]/60"
                        : "border-transparent text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128]/40"
                      }`}
                  >
                    {thumbSnap ? (
                      <FilePreview
                        src={api.storageUrl(thumbSnap.storage_path)}
                        filename={name}
                        className="w-5 h-5 object-cover rounded-sm flex-shrink-0 border border-[#30363d]"
                        onMouseEnter={(e) => setHoveredFile({ snap: thumbSnap, name, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHoveredFile(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setHoveredFile(null)}
                      />
                    ) : null}
                    <span className="truncate max-w-[120px]">{name}</span>
                    {isNew && (
                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-[#238636]/20 text-[#3fb950] border border-[#238636]/40 text-[10px] font-bold" title="Added">
                        +
                      </span>
                    )}
                    {isRemoved && (
                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-red-900/30 text-red-400 border border-red-500/40 text-[10px] font-bold" title="Removed">
                        -
                      </span>
                    )}
                    {!isNew && !isRemoved && (
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/60 ml-1" title="Modified" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Summary bar: which commits are selected */}
          {(commitA || commitB) && (
            <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-xs flex-wrap">
              {commitA && (() => {
                const c = commitsData.find((x) => x.id === commitA);
                return c ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f0883e]" />
                    <span className="text-[#f0883e] font-semibold">Before:</span>
                    <span className="text-[#e6edf3] truncate max-w-[160px]">{c.message}</span>
                    <span className="font-mono text-[#8b949e]">{shortHash(c.id)}</span>
                  </span>
                ) : null;
              })()}
              {commitA && commitB && <span className="text-[#484f58]">→</span>}
              {commitB && (() => {
                const c = commitsData.find((x) => x.id === commitB);
                return c ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
                    <span className="text-[#3fb950] font-semibold">After:</span>
                    <span className="text-[#e6edf3] truncate max-w-[160px]">{c.message}</span>
                    <span className="font-mono text-[#8b949e]">{shortHash(c.id)}</span>
                  </span>
                ) : null;
              })()}
            </div>
          )}

          {/* Mode Toggles */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => urlA && urlB && setMode(m.key)}
                disabled={!urlA || !urlB}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${!urlA || !urlB
                    ? "bg-[#161b22] border border-[#30363d] opacity-30 cursor-not-allowed"
                    : mode === m.key
                      ? "bg-[#58a6ff]/20 border border-[#58a6ff] text-[#58a6ff]"
                      : "bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:text-[#e6edf3]"
                  }`}
              >
                <m.Icon size={12} />
                {m.label}
              </button>
            ))}
          </div>

          {/* AI Analysis Panel */}
          {urlA && urlB && (
            <div className="mb-4 bg-[#161b22] border border-[#30363d] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-semibold text-[#58a6ff] flex items-center gap-1.5">
                  <Sparkles size={14} /> AI Analysis
                </span>
                <button
                  onClick={async () => {
                    setAiLoading(true); setAiResult(null); setAiError(null);
                    try {
                      const result = await api.analyzeWithAI(urlA, urlB);
                      setAiResult(result);
                    } catch (e) { setAiError(e.message); }
                    finally { setAiLoading(false); }
                  }}
                  disabled={aiLoading}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {aiLoading ? "Analyzing…" : "Analyze Changes"}
                </button>
              </div>
              {aiLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Sending images to AI…
                </div>
              )}
              {aiError && <p className="text-red-400 text-sm">{aiError}</p>}
              {aiResult && (
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{aiResult}</p>
              )}
              {!aiLoading && !aiResult && !aiError && (
                <p className="text-gray-600 text-xs">
                  Click "Analyze Changes" to get an AI description of what changed between the two images.
                </p>
              )}
            </div>
          )}

          {/* Layer Picker Panel */}
          {isPsd && (
            <div className="mb-4 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-sm">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#30363d]">
                <Layers size={14} className="text-[#58a6ff]" />
                <span className="text-sm font-semibold text-[#58a6ff]">PSD Layers</span>
                <span className="text-[10px] text-[#6e7681] ml-auto">
                  {psdLayersA.length || psdLayersB.length} layers found
                </span>
              </div>

              {psdLoading ? (
                <div className="p-4 text-xs text-gray-500 animate-pulse flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-t-[#58a6ff] border-[#30363d] rounded-full animate-spin block" />
                  Parsing PSD…
                </div>
              ) : (
                <div className="p-2 flex flex-col gap-1 max-h-60 overflow-y-auto">
                  {/* ★ Full Composite button */}
                  <button
                    onClick={() => setSelectedLayerName("__composite__")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${selectedLayerName === "__composite__"
                        ? "bg-[#1c2128] border-[#58a6ff] text-[#e6edf3]"
                        : "border-transparent text-[#8b949e] hover:bg-[#1c2128]/50"
                      }`}
                  >
                    <ImageIcon size={12} />
                    <span className="font-semibold">Full Composite</span>
                    <span className="ml-auto text-[10px] text-[#3fb950] bg-[#238636]/20 px-1.5 py-0.5 rounded">
                      recommended
                    </span>
                  </button>

                  {/* ★ Custom multi-layer toggle */}
                  <button
                    onClick={() => setSelectedLayerName("__custom__")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${selectedLayerName === "__custom__"
                        ? "bg-[#1c2128] border-[#58a6ff] text-[#e6edf3]"
                        : "border-transparent text-[#8b949e] hover:bg-[#1c2128]/50"
                      }`}
                  >
                    <Layers size={12} />
                    <span className="font-semibold">Custom Layer Mix</span>
                  </button>

                  {/* Visibility toggles (when in custom mode) */}
                  {selectedLayerName === "__custom__" && (
                    <div className="ml-4 mt-1 mb-1 flex flex-col gap-0.5 border-l border-[#30363d] pl-2">
                      {Array.from(
                        new Set([
                          ...psdLayersA.map((l) => l.name),
                          ...psdLayersB.map((l) => l.name),
                        ])
                      ).map((name) => (
                        <label
                          key={name}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#1c2128]/40 cursor-pointer text-xs text-[#8b949e]"
                        >
                          <input
                            type="checkbox"
                            checked={layerVisibility[name] ?? true}
                            onChange={(e) =>
                              setLayerVisibility((prev) => ({
                                ...prev,
                                [name]: e.target.checked,
                              }))
                            }
                            className="accent-[#58a6ff] w-3 h-3"
                          />
                          <span className={layerVisibility[name] ? "text-[#e6edf3]" : "text-[#484f58] line-through"}>
                            {name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* ★ Individual layers */}
                  <div className="border-t border-[#21262d] mt-1 pt-1">
                    <span className="text-[10px] text-[#6e7681] uppercase tracking-wider px-3 py-1 block">
                      Individual Layers
                    </span>
                    {Array.from(
                      new Set([
                        ...psdLayersA.map((l) => l.name),
                        ...psdLayersB.map((l) => l.name),
                      ])
                    ).map((name) => {
                      const lA = psdLayersA.find((l) => l.name === name);
                      const lB = psdLayersB.find((l) => l.name === name);
                      const isNew = !lA && lB;
                      const isRemoved = lA && !lB;
                      return (
                        <button
                          key={name}
                          onClick={() => setSelectedLayerName(name)}
                          className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border text-xs transition ${selectedLayerName === name
                              ? "bg-[#1c2128] border-[#58a6ff] text-[#e6edf3]"
                              : "border-transparent text-[#8b949e] hover:bg-[#1c2128]/50"
                            }`}
                        >
                          <span className="truncate flex-1 text-left font-medium">{name}</span>
                          {(lA?.hidden || lB?.hidden) && <EyeOff size={10} className="text-[#6e7681]" />}
                          {isNew && (
                            <span className="text-[9px] text-[#3fb950] bg-[#238636]/20 px-1 rounded">+new</span>
                          )}
                          {isRemoved && (
                            <span className="text-[9px] text-[#ff7b72] bg-[#da3633]/20 px-1 rounded">-del</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* ── Diff Viewer ────────────────────────────────────────────── */}
          {urlA || urlB ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
              {/* File header */}
              <div className="px-4 py-2.5 border-b border-[#30363d] flex items-center gap-3 text-sm flex-wrap">
                {urlA ? (
                  <a href={urlA} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-gray-300 hover:underline truncate">{selectedFilename}</a>
                ) : (
                  <span className="font-mono text-gray-600 italic">NONE</span>
                )}
                <span className="text-xs text-gray-600 font-mono">{snapA?.file_hash?.slice(0, 7) ?? "—"}</span>
                <span className="text-gray-600">→</span>
                {urlB ? (
                  <a href={urlB} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-gray-300 hover:underline truncate">{selectedFilename}</a>
                ) : (
                  <span className="font-mono text-gray-600 italic">NONE</span>
                )}
                <span className="text-xs text-gray-600 font-mono">{snapB?.file_hash?.slice(0, 7) ?? "—"}</span>
              </div>

              {/* Only in one commit */}
              {(!urlA || !urlB) && (
                <div className="relative" style={isPsd ? CHECKERBOARD_STYLE : {}}>
                  <img src={urlA ?? urlB} alt={selectedFilename} className="w-full object-contain" />
                  <div
                    className={`absolute inset-0 flex items-end p-4 bg-gradient-to-t ${urlB ? "from-green-950/80" : "from-red-950/80"
                      } to-transparent pointer-events-none`}
                  >
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-mono font-semibold ${urlB ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}>
                      <span className="text-lg">{urlB ? "+" : "-"}</span>
                      {urlB ? "File added in this commit" : "File removed after this commit"}
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDER MODE */}
              {mode === "slider" && urlA && urlB && (
                <div
                  ref={containerRef}
                  className="relative select-none cursor-col-resize"
                  style={{ aspectRatio: "16 / 10", ...(isPsd ? CHECKERBOARD_STYLE : {}) }}
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

              {/* SIDE BY SIDE */}
              {mode === "side" && urlA && urlB && (
                <div className="grid grid-cols-2 gap-[2px] bg-gray-800">
                  <div className="relative bg-[#161b22]" style={isPsd ? CHECKERBOARD_STYLE : {}}>
                    <img src={urlA} alt="A" className="w-full object-contain" />
                    <div className="absolute top-3 left-3 bg-red-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold">BEFORE</div>
                  </div>
                  <div className="relative bg-[#161b22]" style={isPsd ? CHECKERBOARD_STYLE : {}}>
                    <img src={urlB} alt="B" className="w-full object-contain" />
                    <div className="absolute top-3 left-3 bg-green-500/80 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold">AFTER</div>
                  </div>
                </div>
              )}

              {/* ONION SKIN */}
              {mode === "onion" && urlA && urlB && (
                <div>
                  <div className="relative" style={{ aspectRatio: "16 / 10", ...(isPsd ? CHECKERBOARD_STYLE : {}) }}>
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

              {/* PIXEL DIFF */}
              {mode === "pixel" && urlA && urlB && (
                <div>
                  <div className="relative" style={{ aspectRatio: "16 / 10", ...(isPsd ? CHECKERBOARD_STYLE : {}) }}>
                    <img src={urlA} alt="Base" className="absolute inset-0 w-full h-full object-contain opacity-30" />
                    {loadingDiff && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-sm">Generating diff…</div>
                      </div>
                    )}
                    {pixelDataUrl && <img src={pixelDataUrl} alt="Diff" className="absolute inset-0 w-full h-full object-contain z-10" />}
                  </div>
                  {pixelStats && (
                    <div className="p-4 border-t border-gray-700 flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-[#ff3c50] rounded-sm inline-block" />
                        <span className="text-sm text-gray-300">Changed pixels</span>
                      </div>
                      <span className="text-lg font-bold text-red-400 font-mono">{pixelStats.change_percent}%</span>
                      <span className="text-sm text-gray-500">{pixelStats.changed.toLocaleString()} / {pixelStats.total.toLocaleString()} px</span>
                    </div>
                  )}
                </div>
              )}

              {/* HEATMAP */}
              {mode === "heatmap" && urlA && urlB && (
                <div>
                  <div className="relative" style={{ aspectRatio: "16 / 10", ...(isPsd ? CHECKERBOARD_STYLE : {}) }}>
                    <img src={urlB} alt="After" className="absolute inset-0 w-full h-full object-contain" />
                    {loadingDiff && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-sm">Generating heatmap…</div>
                      </div>
                    )}
                    {heatmapDataUrl && (
                      <img src={heatmapDataUrl} alt="Heatmap" className="absolute inset-0 w-full h-full object-contain z-10 transition-opacity" style={{ opacity: heatmapOpacity / 100 }} />
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-700 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Intensity:</span>
                      <div className="flex items-center gap-2 flex-wrap">
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
          ) : isPsd && psdLoading ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-16 text-center text-[#8b949e] flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-t-[#58a6ff] border-[#30363d] rounded-full animate-spin mb-4" />
              <p className="font-semibold">Extracting PSD Layers</p>
              <p className="text-xs mt-2 text-[#6e7681]">This happens entirely locally in your browser.</p>
            </div>
          ) : (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-16 text-center text-gray-500">
              <div className="mb-4 flex justify-center">
                <ImageIcon size={48} className="text-gray-600" />
              </div>
              <p>Select two commits to compare</p>
              <p className="text-xs mt-2 text-gray-600">Use the sidebar on the left to pick Before and After commits.</p>
            </div>
          )}
        </div>
        {/* end right area */}
      </div>
      <HoverPreview
        snap={hoveredFile?.snap}
        filename={hoveredFile?.name}
        x={hoveredFile?.x}
        y={hoveredFile?.y}
      />
    </div>
  );
}
