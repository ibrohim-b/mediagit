import { createPortal } from "react-dom";
import FilePreview from "./FilePreview";
import { api } from "../api";

export default function HoverPreview({ snap, filename, src, x, y }) {
  if (!snap && !src) return null;

  const displaySrc = src || (snap?.storage_path ? api.storageUrl(snap.storage_path) : null);
  const displayFilename = filename || snap?.filename;

  if (!displaySrc) return null;

  const PREVIEW_WIDTH = 320;
  const PREVIEW_HEIGHT = 340;
  const OFFSET = 16;

  let left = x + OFFSET;
  if (left + PREVIEW_WIDTH > window.innerWidth - 10) {
    left = x - PREVIEW_WIDTH - OFFSET;
  }
  if (left < 10) left = 10;

  let top = y - PREVIEW_HEIGHT / 2;
  if (top + PREVIEW_HEIGHT > window.innerHeight - 10) {
    top = window.innerHeight - PREVIEW_HEIGHT - 10;
  }
  if (top < 10) top = 10;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left,
        top,
        width: PREVIEW_WIDTH,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      className="bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl p-3 animate-in fade-in zoom-in duration-150"
    >
      <div className="w-full rounded overflow-hidden bg-[#0d1117] flex items-center justify-center border border-[#30363d]" style={{ height: 260 }}>
        <FilePreview
          src={displaySrc}
          filename={displayFilename}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      <p className="text-[#e6edf3] text-xs mt-2.5 truncate text-center font-medium px-2">
        {displayFilename}
      </p>
    </div>,
    document.body
  );
}
