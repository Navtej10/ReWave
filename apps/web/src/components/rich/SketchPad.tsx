import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button, cx } from "../ui/index";
import { seededRandom } from "../../wave/format";
import { Modal } from "./Modal";
import { CloseIcon, EraserIcon, PencilIcon, RedoIcon, UndoIcon } from "./richIcons";

/** Logical drawing size. The backing store is drawn at 2x for crisp lines. */
const BASE_W = 800;
const DEFAULT_H = 520;
const SCALE = 2;

interface Point {
  x: number;
  y: number;
}
interface Stroke {
  tool: "pen" | "eraser" | "clear";
  color: string;
  width: number;
  points: Point[];
}

const WIDTHS = [
  { id: "thin", label: "Thin", px: 2 },
  { id: "medium", label: "Medium", px: 5 },
  { id: "thick", label: "Thick", px: 10 },
] as const;

const COLORS = [
  { id: "ink", label: "Ink", cssVar: "--ink" },
  { id: "blue", label: "Blue", cssVar: "--blue-deep" },
  { id: "terracotta", label: "Terracotta", cssVar: "--terracotta-deep" },
  { id: "green", label: "Green", cssVar: "--success" },
] as const;

function readVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const pts = s.points;
  if (pts.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = s.width;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, s.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i += 1) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
  ctx.restore();
}

export interface SketchPadProps {
  /** Annotate mode: draw on top of this image. */
  backgroundUrl?: string;
  title?: string;
  onSave: (file: File) => void;
  onCancel: () => void;
}

export function SketchPad({ backgroundUrl, title = "Sketch", onSave, onCancel }: SketchPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const strokes = useRef<Stroke[]>([]);
  const redo = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [colorId, setColorId] = useState<(typeof COLORS)[number]["id"]>("ink");
  const [widthId, setWidthId] = useState<(typeof WIDTHS)[number]["id"]>("medium");
  const [version, setVersion] = useState(0);
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [bgError, setBgError] = useState(false);

  const height = bg ? Math.min(1100, Math.max(240, Math.round((BASE_W * bg.naturalHeight) / bg.naturalWidth))) : DEFAULT_H;

  // Load the image being annotated.
  useEffect(() => {
    if (!backgroundUrl) return;
    const img = new Image();
    img.onload = () => setBg(img);
    img.onerror = () => setBgError(true);
    img.src = backgroundUrl;
  }, [backgroundUrl]);

  // Paper grain, drawn (not CSS) so it ends up in the exported PNG. Deterministic flecks.
  const flecks = useMemo(() => {
    const rand = seededRandom(7);
    return Array.from({ length: 260 }, () => ({
      x: rand() * BASE_W,
      y: rand() * 1100,
      r: 0.4 + rand() * 1.1,
      a: 0.04 + rand() * 0.1,
    }));
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const layer = layerRef.current ?? (layerRef.current = document.createElement("canvas"));
    layer.width = BASE_W * SCALE;
    layer.height = height * SCALE;
    const lctx = layer.getContext("2d");
    if (!lctx) return;
    lctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    for (const s of strokes.current) {
      if (s.tool === "clear") lctx.clearRect(0, 0, BASE_W, height);
      else paintStroke(lctx, s);
    }

    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, BASE_W, height);
    ctx.fillStyle = readVar("--paper-card", "#faf4e4");
    ctx.fillRect(0, 0, BASE_W, height);
    if (bg) {
      ctx.drawImage(bg, 0, 0, BASE_W, height);
    } else {
      ctx.fillStyle = readVar("--ink-soft", "#5a5147");
      for (const f of flecks) {
        if (f.y > height) continue;
        ctx.globalAlpha = f.a;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(layer, 0, 0, BASE_W, height);
    if (current.current) {
      // Live stroke goes straight on the visible canvas; eraser preview is a paper-colored line.
      const live = current.current;
      paintStroke(ctx, live.tool === "eraser" ? { ...live, tool: "pen", color: readVar("--paper-card", "#faf4e4") } : live);
    }
  }, [bg, height, flecks]);

  useLayoutEffect(() => {
    render();
  }, [render, version]);

  function pointAt(e: PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * BASE_W) / rect.width,
      y: ((e.clientY - rect.top) * height) / rect.height,
    };
  }

  function jitter(p: Point): Point {
    // A touch of hand shake for the pen only.
    return tool === "pen" ? { x: p.x + (Math.random() - 0.5) * 0.9, y: p.y + (Math.random() - 0.5) * 0.9 } : p;
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const w = WIDTHS.find((x) => x.id === widthId)?.px ?? 5;
    const colorVar = COLORS.find((c) => c.id === colorId)?.cssVar ?? "--ink";
    current.current = {
      tool,
      color: readVar(colorVar, "#2a2622"),
      width: tool === "eraser" ? w * 3 : w,
      points: [jitter(pointAt(e))],
    };
    render();
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const s = current.current;
    if (!s) return;
    const p = pointAt(e);
    const last = s.points[s.points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
    s.points.push(jitter(p));
    render();
  }

  function endStroke() {
    const s = current.current;
    if (!s) return;
    current.current = null;
    strokes.current.push(s);
    redo.current = [];
    setVersion((v) => v + 1);
  }

  const undo = () => {
    const s = strokes.current.pop();
    if (s) redo.current.push(s);
    setVersion((v) => v + 1);
  };
  const redoFn = () => {
    const s = redo.current.pop();
    if (s) strokes.current.push(s);
    setVersion((v) => v + 1);
  };
  const clear = () => {
    if (strokes.current.length === 0) return;
    strokes.current.push({ tool: "clear", color: "", width: 0, points: [] });
    redo.current = [];
    setVersion((v) => v + 1);
  };

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((k === "z" && e.shiftKey) || k === "y") {
      e.preventDefault();
      redoFn();
    }
  }

  function save() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      onSave(new File([blob], `sketch-${Date.now()}.png`, { type: "image/png" }));
    }, "image/png");
  }

  const canUndo = strokes.current.length > 0;
  const canRedo = redo.current.length > 0;
  const waitingForImage = Boolean(backgroundUrl) && !bg && !bgError;

  return (
    <Modal label={title} onClose={onCancel} className="sketch sketch-a ink-card rc-sketch" initialFocus="[data-autofocus]">
      <div onKeyDown={onKeyDown} className="rc-sketch__inner">
        <div className="rc-sketch__head">
          <h2 className="rc-pcomp__title">{title}</h2>
          <button type="button" className="sketch sketch-b rc-iconbtn" aria-label={`Close ${title.toLowerCase()}`} onClick={onCancel}>
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="rc-sketch__tools" role="toolbar" aria-label="Drawing tools">
          <div className="rc-sketch__group" role="group" aria-label="Tool">
            <button
              type="button"
              data-autofocus
              className={cx("sketch sketch-b rc-tool", tool === "pen" && "is-on")}
              aria-pressed={tool === "pen"}
              aria-label="Pen"
              data-tip="Pen"
              onClick={() => setTool("pen")}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className={cx("sketch sketch-b rc-tool", tool === "eraser" && "is-on")}
              aria-pressed={tool === "eraser"}
              aria-label="Eraser"
              data-tip="Eraser"
              onClick={() => setTool("eraser")}
            >
              <EraserIcon />
            </button>
          </div>

          <div className="rc-sketch__group" role="group" aria-label="Ink color">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cx("sketch sketch-c rc-swatch", `rc-swatch--${c.id}`, colorId === c.id && "is-on")}
                aria-pressed={colorId === c.id}
                aria-label={c.label}
                onClick={() => {
                  setColorId(c.id);
                  setTool("pen");
                }}
              />
            ))}
          </div>

          <div className="rc-sketch__group" role="group" aria-label="Stroke width">
            {WIDTHS.map((w) => (
              <button
                key={w.id}
                type="button"
                className={cx("sketch sketch-a rc-wbtn", widthId === w.id && "is-on")}
                aria-pressed={widthId === w.id}
                aria-label={w.label}
                onClick={() => setWidthId(w.id)}
              >
                <svg viewBox="0 0 28 12" width="28" height="12" aria-hidden="true" focusable="false">
                  <path d="M2 7 Q8 3 14 6.5 T26 5" strokeWidth={w.px / 1.6} />
                </svg>
              </button>
            ))}
          </div>

          <div className="rc-sketch__group" role="group" aria-label="History">
            <button type="button" className="sketch sketch-b rc-tool" aria-label="Undo" data-tip="Undo" disabled={!canUndo} onClick={undo}>
              <UndoIcon />
            </button>
            <button type="button" className="sketch sketch-b rc-tool" aria-label="Redo" data-tip="Redo" disabled={!canRedo} onClick={redoFn}>
              <RedoIcon />
            </button>
            <Button variant="ghost" disabled={!canUndo} onClick={clear}>
              Clear
            </Button>
          </div>
        </div>

        <div className="rc-sketch__stage">
          <canvas
            ref={canvasRef}
            className="sketch sketch-c rc-sketch__canvas"
            width={BASE_W * SCALE}
            height={height * SCALE}
            role="img"
            aria-label="Drawing canvas. Draw with a mouse, finger or stylus."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
        </div>

        {bgError ? (
          <p className="rc-error" role="alert">
            Couldn&rsquo;t load the image to annotate. You can still draw on blank paper.
          </p>
        ) : null}

        <div className="rc-pcomp__foot">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={waitingForImage || (strokes.current.length === 0 && !bg)} onClick={save}>
            {backgroundUrl ? "Attach annotated image" : "Attach sketch"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
