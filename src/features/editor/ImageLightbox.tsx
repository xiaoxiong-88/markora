import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";

/** Image lightbox: zoom, pan, Escape to close. */
export function ImageLightbox({
  src,
  alt,
  onClose,
  onEditSrc,
}: {
  src: string;
  alt: string;
  onClose: () => void;
  onEditSrc?: (newSrc: string) => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      onClick={onClose}
    >
      <div className="no-print flex items-center justify-end gap-1 p-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn text-white" aria-label="Zoom in" onClick={() => setScale((s) => Math.min(8, s * 1.25))}>
          <ZoomIn size={16} />
        </button>
        <button type="button" className="icon-btn text-white" aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.1, s / 1.25))}>
          <ZoomOut size={16} />
        </button>
        <button type="button" className="icon-btn text-white" aria-label="Reset zoom" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>
          1:1
        </button>
        {onEditSrc && (
          <button
            type="button"
            className="icon-btn text-white"
            aria-label="Edit image source"
            onClick={() => {
              const next = window.prompt("Image path", src);
              if (next) onEditSrc(next);
            }}
          >
            ✎
          </button>
        )}
        <button type="button" className="icon-btn text-white" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div
        className="flex flex-1 items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          setDragging(true);
          e.preventDefault();
        }}
        onMouseMove={(e) => {
          if (dragging) {
            setOffset((o) => ({ x: o.x + e.movementX, y: o.y + e.movementY }));
          }
        }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            cursor: dragging ? "grabbing" : "grab",
            maxWidth: "90vw",
            maxHeight: "80vh",
          }}
        />
      </div>
      <div className="p-2 text-center text-xs text-white/70">{alt || src}</div>
    </div>
  );
}
