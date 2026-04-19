import { useState, useEffect } from "react";
import { readPsd } from "ag-psd";

const psdCache = new Map();

export default function FilePreview({ src, filename, className = "", style = {}, onClick, onMouseEnter, onMouseLeave, ...props }) {
  const [psdUrl, setPsdUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isPsd = filename?.toLowerCase().endsWith(".psd") || src?.toLowerCase().includes(".psd");

  useEffect(() => {
    if (!isPsd || !src) {
      setPsdUrl(null);
      setImgError(false);
      return;
    }

    if (psdCache.has(src)) {
      setPsdUrl(psdCache.get(src));
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setImgError(false);

    const loadPsd = async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        // Check content type to avoid parsing HTML as PSD (happens on some 404/SPA setups)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          throw new Error("Received HTML instead of binary data");
        }

        const buffer = await response.arrayBuffer();
        if (!active) return;

        // Verify PSD signature manually to avoid ag-psd throwing a loud error if possible
        // PSD signature is always '8BPS' (0x38 0x42 0x50 0x53)
        const view = new Uint8Array(buffer);
        if (view.length < 4 || 
            view[0] !== 0x38 || view[1] !== 0x42 || 
            view[2] !== 0x50 || view[3] !== 0x53) {
          throw new Error("Invalid PSD signature");
        }

        // Skip layer data to make it light and fast
        const psd = readPsd(buffer, { skipLayerImageData: true });

        if (psd.canvas) {
          // Create a small thumbnail to save memory and improve performance
          const maxDim = 400; 
          let w = psd.canvas.width;
          let h = psd.canvas.height;
          
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.floor(w * ratio);
            h = Math.floor(h * ratio);
          }

          const thumbCanvas = document.createElement("canvas");
          thumbCanvas.width = w || 1;
          thumbCanvas.height = h || 1;
          const ctx = thumbCanvas.getContext("2d");
          ctx.drawImage(psd.canvas, 0, 0, w, h);

          // Convert to JPEG for smaller blob size (lightweight)
          thumbCanvas.toBlob((blob) => {
            if (active) {
              const url = URL.createObjectURL(blob);
              psdCache.set(src, url);
              setPsdUrl(url);
              setLoading(false);
            }
          }, "image/jpeg", 0.7); // Reduced quality slightly for "light" requirement
        } else {
          if (active) {
            setLoading(false);
            setImgError(true);
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          // Use warn instead of error for "expected" parsing failures
          console.warn(`PSD preview notice for ${src}:`, err.message || err);
          if (active) {
            setLoading(false);
            setImgError(true);
          }
        }
      }
    };

    loadPsd();

    return () => {
      active = false;
      controller.abort();
    };
  }, [src, isPsd]);

  const commonProps = {
    className,
    style,
    onClick,
    onMouseEnter,
    onMouseLeave,
    ...props
  };

  if (isPsd) {
    if (loading) {
      return (
        <div 
          {...commonProps}
          className={`${className} flex items-center justify-center bg-[#161b22] border border-[#30363d]`}
        >
          <div className="w-5 h-5 border-2 border-[#58a6ff]/30 border-t-[#58a6ff] rounded-full animate-spin" />
        </div>
      );
    }
    if (psdUrl) {
      return (
        <img 
          {...commonProps}
          src={psdUrl} 
          alt={filename} 
        />
      );
    }
    return (
      <div 
        {...commonProps}
        className={`${className} flex items-center justify-center bg-[#161b22] border border-[#30363d]`}
      >
        <div className="flex flex-col items-center justify-center">
          <span className="text-xl mb-1 opacity-50">🎨</span>
          <span className="text-[10px] text-[#58a6ff] font-bold">PSD</span>
        </div>
      </div>
    );
  }

  if (imgError) {
    return (
      <div 
        {...commonProps}
        className={`${className} flex items-center justify-center bg-[#161b22] border border-[#30363d]`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
    );
  }

  return (
    <img 
      {...commonProps}
      src={src} 
      alt={filename} 
      onError={() => setImgError(true)}
    />
  );
}
