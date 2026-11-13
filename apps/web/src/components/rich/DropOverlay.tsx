import { useRef, useState, type DragEvent } from "react";
import { DashedPanel, Sparkle } from "../ui/index";

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

export interface FileDrop {
  dragging: boolean;
  /** Spread onto the element that should accept drops. */
  bind: {
    onDragEnter: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDragLeave: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
  };
}

/** Drag-and-drop with an enter/leave counter so child elements do not cause flicker. */
export function useFileDrop(onFiles: (files: File[]) => void): FileDrop {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  return {
    dragging,
    bind: {
      onDragEnter(e) {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      },
      onDragOver(e) {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      },
      onDragLeave(e) {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop(e) {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      },
    },
  };
}

/** Full-column overlay shown while files are dragged over the page. */
export function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="rc-drop" aria-hidden="true">
      <DashedPanel className="rc-drop__panel">
        <Sparkle size={34} rotate={8} className="rc-drop__spark" />
        <p className="rc-drop__title">Drop to attach</p>
        <p className="rc-drop__sub">Images, videos, PDFs, docs and zips</p>
      </DashedPanel>
    </div>
  );
}
