import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { ShapeObject } from '../types/index.ts';
import { clearTextLayoutCache, drawFittedText } from '../utils/canvasText.ts';

interface StageEditorProps {
  shapes: ShapeObject[];
  selectedShapeId: string | null;
  onSelectShape: (id: string | null) => void;
  onUpdateShape: (id: string, updated: Partial<ShapeObject>) => void;
  canvasWidth: number;
  canvasHeight: number;
}

type DragMode = 'move' | 'rotate' | 'scale';
type Corner = 'tl' | 'tr' | 'br' | 'bl';
type Handle = 'rotate' | Corner;

interface DragState {
  mode: DragMode;
  shapeId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  origRotation: number;
  corner?: Corner;
  origDist?: number;
}

/**
 * The stage is a pure editing surface, so it never needs more internal pixels than a
 * typical screen can show. Capping the backing store keeps 2K/4K canvases as cheap to
 * redraw as an 800x600 one; coordinates stay in logical canvas units via a transform.
 */
const MAX_STAGE_PIXELS = 1400;

/** How often (ms) an in-progress drag is pushed to app state (the stage itself redraws every frame). */
const COMMIT_INTERVAL_MS = 90;

const MIN_SHAPE_SIZE = 12;
const ROTATE_STEM = 26;

/**
 * Transforms canvas coordinates (x, y) to shape-local coordinates (u, v)
 */
function toLocalCoords(
  canvasX: number,
  canvasY: number,
  shapeX: number,
  shapeY: number,
  rotationDeg: number
): { u: number; v: number } {
  const dx = canvasX - shapeX;
  const dy = canvasY - shapeY;
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    u: dx * cos - dy * sin,
    v: dx * sin + dy * cos,
  };
}

/**
 * Computes an appropriate resize cursor based on corner angle and shape rotation
 */
function getResizeCursor(cornerAngleDeg: number, shapeRotation: number): string {
  const total = (((cornerAngleDeg + shapeRotation) % 180) + 180) % 180;
  if (total >= 22.5 && total < 67.5) return 'nwse-resize';
  if (total >= 67.5 && total < 112.5) return 'ns-resize';
  if (total >= 112.5 && total < 157.5) return 'nesw-resize';
  return 'ew-resize';
}

const CORNER_ANGLES: Record<Corner, number> = { tl: -135, tr: -45, br: 45, bl: 135 };

/**
 * Tests the transform handles of a (selected) shape. `ui` is the logical-units-per-screen-pixel
 * factor so handles keep a constant on-screen size at any canvas resolution.
 */
function hitHandle(shape: ShapeObject, x: number, y: number, ui: number): Handle | null {
  const { u, v } = toLocalCoords(x, y, shape.x, shape.y, shape.rotation);
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;

  if (Math.hypot(u, v + halfH + ROTATE_STEM * ui) <= 14 * ui) return 'rotate';

  const r = 12 * ui;
  if (Math.hypot(u + halfW, v + halfH) <= r) return 'tl';
  if (Math.hypot(u - halfW, v + halfH) <= r) return 'tr';
  if (Math.hypot(u - halfW, v - halfH) <= r) return 'br';
  if (Math.hypot(u + halfW, v - halfH) <= r) return 'bl';
  return null;
}

function isInsideBody(shape: ShapeObject, x: number, y: number, pad: number): boolean {
  const { u, v } = toLocalCoords(x, y, shape.x, shape.y, shape.rotation);
  return Math.abs(u) <= shape.width / 2 + pad && Math.abs(v) <= shape.height / 2 + pad;
}

function hitShapeBody(shape: ShapeObject, x: number, y: number): boolean {
  const { u, v } = toLocalCoords(x, y, shape.x, shape.y, shape.rotation);
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;
  if (shape.type === 'circle') {
    return (u * u) / (halfW * halfW) + (v * v) / (halfH * halfH) <= 1.0;
  }
  return Math.abs(u) <= halfW && Math.abs(v) <= halfH;
}

/**
 * Clamps a uniform scale factor so the shape keeps its proportions, never collapses
 * below a grabbable size, and never outgrows the canvas.
 */
function clampUniformScale(
  scale: number,
  w: number,
  h: number,
  canvasW: number,
  canvasH: number
): number {
  const minScale = MIN_SHAPE_SIZE / Math.max(1, Math.min(w, h));
  const maxScale = Math.max(1, Math.min((canvasW * 0.95) / w, (canvasH * 0.95) / h));
  return Math.min(Math.max(scale, minScale), Math.max(minScale, maxScale));
}

function traceShapePath(ctx: CanvasRenderingContext2D, shape: ShapeObject): void {
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;
  ctx.beginPath();

  switch (shape.type) {
    case 'circle':
      ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
      break;
    case 'square':
      ctx.roundRect(-halfW, -halfH, shape.width, shape.height, shape.cornerRadius || 8);
      break;
    case 'triangle':
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, halfH * 0.8);
      ctx.lineTo(-halfW, halfH * 0.8);
      ctx.closePath();
      break;
    case 'star': {
      const points = shape.starPoints || 5;
      const innerRatio = shape.innerRadiusRatio || 0.45;
      const step = Math.PI / points;
      for (let i = 0; i < points * 2; i++) {
        const rad = i * step - Math.PI / 2;
        const r = i % 2 === 0 ? halfW : halfW * innerRatio;
        const px = Math.cos(rad) * r;
        const py = Math.sin(rad) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default:
      break;
  }
}

/** Static backdrop (fill, grid, centre cross) rendered once per size and blitted every frame. */
function createBackground(
  pixelW: number,
  pixelH: number,
  canvasW: number,
  canvasH: number
): HTMLCanvasElement {
  const bg = document.createElement('canvas');
  bg.width = pixelW;
  bg.height = pixelH;
  const ctx = bg.getContext('2d');
  if (!ctx) return bg;

  const rs = pixelW / canvasW;
  ctx.setTransform(rs, 0, 0, rs, 0, 0);
  const hairline = 1 / rs;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = hairline;
  const gridSize = Math.round(40 * Math.max(1, Math.min(canvasW / 800, canvasH / 600)));
  ctx.beginPath();
  for (let x = 0; x < canvasW; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasH);
  }
  for (let y = 0; y < canvasH; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvasW, y);
  }
  ctx.stroke();

  ctx.strokeStyle = '#334155';
  ctx.setLineDash([4 * hairline * 2, 4 * hairline * 2]);
  ctx.beginPath();
  ctx.moveTo(canvasW / 2, 0);
  ctx.lineTo(canvasW / 2, canvasH);
  ctx.moveTo(0, canvasH / 2);
  ctx.lineTo(canvasW, canvasH / 2);
  ctx.stroke();
  return bg;
}

export const StageEditor: React.FC<StageEditorProps> = ({
  shapes,
  selectedShapeId,
  onSelectShape,
  onUpdateShape,
  canvasWidth,
  canvasHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Backing-store size (see MAX_STAGE_PIXELS)
  const renderScale = Math.min(1, MAX_STAGE_PIXELS / Math.max(canvasWidth, canvasHeight));
  const pixelW = Math.max(1, Math.round(canvasWidth * renderScale));
  const pixelH = Math.max(1, Math.round(canvasHeight * renderScale));

  // Latest props mirrored into refs so imperative handlers/draw loop never see stale values
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const selectedIdRef = useRef(selectedShapeId);
  selectedIdRef.current = selectedShapeId;
  const dimsRef = useRef({ width: canvasWidth, height: canvasHeight });
  dimsRef.current = { width: canvasWidth, height: canvasHeight };
  const onUpdateRef = useRef(onUpdateShape);
  onUpdateRef.current = onUpdateShape;
  const onSelectRef = useRef(onSelectShape);
  onSelectRef.current = onSelectShape;

  // Interaction state lives in refs: dragging never triggers a React render
  const dragRef = useRef<DragState | null>(null);
  const overrideRef = useRef<{ id: string; update: Partial<ShapeObject> } | null>(null);
  const lastCommitRef = useRef(0);
  const uiScaleRef = useRef(1);
  const cursorRef = useRef('default');
  const drawRafRef = useRef<number | null>(null);
  const bgRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);

  const setCursor = (value: string) => {
    if (cursorRef.current === value) return;
    cursorRef.current = value;
    if (canvasRef.current) canvasRef.current.style.cursor = value;
  };

  // Convert client pointer coordinates to canvas (logical) coordinates
  const getCanvasCoords = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (dimsRef.current.width / rect.width),
      y: (e.clientY - rect.top) * (dimsRef.current.height / rect.height),
    };
  };

  const draw = useCallback(() => {
    drawRafRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width: cw, height: ch } = dimsRef.current;
    const rs = canvas.width / cw;
    const ui = uiScaleRef.current;

    // Backdrop
    const bgKey = `${canvas.width}x${canvas.height}@${cw}x${ch}`;
    if (!bgRef.current || bgRef.current.key !== bgKey) {
      bgRef.current = { key: bgKey, canvas: createBackground(canvas.width, canvas.height, cw, ch) };
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bgRef.current.canvas, 0, 0);
    ctx.setTransform(rs, 0, 0, rs, 0, 0);

    // Apply the live drag override on top of committed shapes
    const override = overrideRef.current;
    const list = override
      ? shapesRef.current.map((s) => (s.id === override.id ? { ...s, ...override.update } : s))
      : shapesRef.current;
    const selectedId = selectedIdRef.current;
    let selected: ShapeObject | null = null;

    for (const shape of list) {
      const isSelected = shape.id === selectedId;
      if (isSelected) selected = shape;

      const halfW = shape.width / 2;
      const halfH = shape.height / 2;
      const brightness = Math.round(50 + shape.depth * 180);
      const fillColor = `rgb(${brightness}, ${brightness}, ${brightness})`;

      ctx.save();
      ctx.translate(shape.x, shape.y);
      ctx.rotate((shape.rotation * Math.PI) / 180);

      if (shape.type === 'text') {
        if ((shape.text ?? '').trim()) {
          ctx.save();
          ctx.translate(-halfW, -halfH);
          drawFittedText(ctx, shape, shape.width, shape.height, fillColor);
          ctx.restore();
        } else {
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.5 * ui;
          ctx.setLineDash([4 * ui, 4 * ui]);
          ctx.strokeRect(-halfW, -halfH, shape.width, shape.height);
        }
      } else {
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = isSelected ? '#6366f1' : '#64748b';
        ctx.lineWidth = (isSelected ? 3 : 1.5) * ui;
        traceShapePath(ctx, shape);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      // Depth badge above shape
      ctx.save();
      ctx.font = `bold ${10 * ui}px JetBrains Mono, monospace`;
      const label = `Z: ${Math.round(shape.depth * 100)}%`;
      const textW = ctx.measureText(label).width + 10 * ui;
      const textH = 16 * ui;
      const badgeY = shape.y - halfH - 20 * ui;
      ctx.fillStyle = isSelected ? '#6366f1' : '#1e293b';
      ctx.fillRect(shape.x - textW / 2, badgeY, textW, textH);
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, shape.x, badgeY + textH / 2);
      ctx.restore();
    }

    // Selection chrome is drawn last so no later layer can hide the handles
    if (selected) {
      const halfW = selected.width / 2;
      const halfH = selected.height / 2;

      ctx.save();
      ctx.translate(selected.x, selected.y);
      ctx.rotate((selected.rotation * Math.PI) / 180);

      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 1.5 * ui;
      ctx.setLineDash([4 * ui, 4 * ui]);
      ctx.strokeRect(-halfW, -halfH, selected.width, selected.height);
      ctx.setLineDash([]);

      // Rotation stem + handle
      const stem = ROTATE_STEM * ui;
      ctx.beginPath();
      ctx.moveTo(0, -halfH);
      ctx.lineTo(0, -halfH - stem);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, -halfH - stem, 7.5 * ui, 0, Math.PI * 2);
      ctx.fillStyle = '#4f46e5';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * ui;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -halfH - stem, 2.5 * ui, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Corner scale handles
      const hs = 9 * ui;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2 * ui;
      for (const [cx, cy] of [
        [-halfW, -halfH],
        [halfW, -halfH],
        [halfW, halfH],
        [-halfW, halfH],
      ]) {
        ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
        ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
      }

      // Centre pivot
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5 * ui, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = ui;
      ctx.stroke();
      ctx.restore();

      // Floating feedback badge while dragging
      const drag = dragRef.current;
      if (drag && drag.shapeId === selected.id) {
        let badgeText = '';
        if (drag.mode === 'rotate') badgeText = `🔄 ${selected.rotation}°`;
        else if (drag.mode === 'scale') badgeText = `📐 ${selected.width} × ${selected.height}px`;
        else badgeText = `📍 ${selected.x}, ${selected.y}`;

        ctx.save();
        ctx.font = `bold ${11 * ui}px JetBrains Mono, monospace`;
        const bw = ctx.measureText(badgeText).width + 14 * ui;
        const bh = 22 * ui;
        const by = selected.y + halfH + 16 * ui;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5 * ui;
        ctx.beginPath();
        ctx.roundRect(selected.x - bw / 2, by, bw, bh, 6 * ui);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, selected.x, by + bh / 2);
        ctx.restore();
      }
    }
  }, []);

  const requestDraw = useCallback(() => {
    if (drawRafRef.current === null) {
      drawRafRef.current = requestAnimationFrame(draw);
    }
  }, [draw]);

  // Prop-driven redraws are synchronous so resizing the backing store never flashes blank
  useLayoutEffect(() => {
    draw();
  }, [draw, shapes, selectedShapeId, canvasWidth, canvasHeight, pixelW, pixelH]);

  // Keep handle sizes constant on screen: logical units per displayed CSS pixel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ui = Math.min(8, Math.max(0.5, dimsRef.current.width / rect.width));
      if (Math.abs(ui - uiScaleRef.current) > 0.01) {
        uiScaleRef.current = ui;
        requestDraw();
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight, requestDraw]);

  // Redraw text once web fonts are available
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    const refresh = () => {
      clearTextLayoutCache();
      requestDraw();
    };
    document.fonts.ready.then(refresh);
    document.fonts.addEventListener('loadingdone', refresh);
    return () => document.fonts.removeEventListener('loadingdone', refresh);
  }, [requestDraw]);

  // Native non-passive wheel listener so preventDefault works (React's onWheel is passive)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      const id = selectedIdRef.current;
      if (!id) return;
      const shape = shapesRef.current.find((s) => s.id === id);
      if (!shape) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.05 : 0.95;
      const { width: cw, height: ch } = dimsRef.current;
      const scale = clampUniformScale(factor, shape.width, shape.height, cw, ch);
      onUpdateRef.current(shape.id, {
        width: Math.round(shape.width * scale),
        height: Math.round(shape.height * scale),
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(
    () => () => {
      if (drawRafRef.current !== null) cancelAnimationFrame(drawRafRef.current);
    },
    []
  );

  const beginDrag = (
    e: React.PointerEvent<HTMLCanvasElement>,
    mode: DragMode,
    shape: ShapeObject,
    x: number,
    y: number,
    extra?: Partial<DragState>
  ) => {
    dragRef.current = {
      mode,
      shapeId: shape.id,
      startX: x,
      startY: y,
      origX: shape.x,
      origY: shape.y,
      origW: shape.width,
      origH: shape.height,
      origRotation: shape.rotation,
      ...extra,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    requestDraw();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { x, y } = getCanvasCoords(e);
    const ui = uiScaleRef.current;
    const list = shapesRef.current;

    // 1. Handles / body of the already-selected shape take priority
    const selected = list.find((s) => s.id === selectedIdRef.current);
    if (selected) {
      const handle = hitHandle(selected, x, y, ui);
      if (handle === 'rotate') {
        beginDrag(e, 'rotate', selected, x, y);
        return;
      }
      if (handle) {
        beginDrag(e, 'scale', selected, x, y, {
          corner: handle,
          origDist: Math.hypot(selected.width / 2, selected.height / 2),
        });
        return;
      }
      if (isInsideBody(selected, x, y, 4 * ui)) {
        beginDrag(e, 'move', selected, x, y);
        return;
      }
    }

    // 2. Hit-test other shapes from top layer to bottom
    for (let i = list.length - 1; i >= 0; i--) {
      const shape = list[i];
      if (hitShapeBody(shape, x, y)) {
        onSelectRef.current(shape.id);
        beginDrag(e, 'move', shape, x, y);
        return;
      }
    }

    // 3. Empty background
    onSelectRef.current(null);
  };

  const applyDrag = (drag: DragState, x: number, y: number, shiftKey: boolean) => {
    const { width: cw, height: ch } = dimsRef.current;
    let update: Partial<ShapeObject> | null = null;

    if (drag.mode === 'move') {
      update = {
        x: Math.round(drag.origX + (x - drag.startX)),
        y: Math.round(drag.origY + (y - drag.startY)),
      };
    } else if (drag.mode === 'rotate') {
      let deg = Math.round((Math.atan2(y - drag.origY, x - drag.origX) * 180) / Math.PI + 90);
      while (deg > 180) deg -= 360;
      while (deg <= -180) deg += 360;
      if (shiftKey) deg = Math.round(deg / 15) * 15;
      update = { rotation: deg };
    } else {
      const { u, v } = toLocalCoords(x, y, drag.origX, drag.origY, drag.origRotation);
      if (shiftKey) {
        // Free scale width and height independently
        update = {
          width: Math.max(MIN_SHAPE_SIZE, Math.min(cw * 0.95, Math.round(2 * Math.abs(u)))),
          height: Math.max(MIN_SHAPE_SIZE, Math.min(ch * 0.95, Math.round(2 * Math.abs(v)))),
        };
      } else {
        // Proportional uniform scale
        const raw = Math.hypot(u, v) / Math.max(1, drag.origDist || 1);
        const scale = clampUniformScale(raw, drag.origW, drag.origH, cw, ch);
        update = {
          width: Math.round(drag.origW * scale),
          height: Math.round(drag.origH * scale),
        };
      }
    }

    overrideRef.current = { id: drag.shapeId, update };
    requestDraw();

    // Push to app state at a modest rate so the inspector tracks the drag without
    // making every pointer event pay for a full app re-render
    const now = performance.now();
    if (now - lastCommitRef.current >= COMMIT_INTERVAL_MS) {
      lastCommitRef.current = now;
      onUpdateRef.current(drag.shapeId, update);
    }
  };

  const updateHoverCursor = (x: number, y: number) => {
    const ui = uiScaleRef.current;
    const list = shapesRef.current;
    const selected = list.find((s) => s.id === selectedIdRef.current);

    if (selected) {
      const handle = hitHandle(selected, x, y, ui);
      if (handle === 'rotate') return setCursor('grab');
      if (handle) return setCursor(getResizeCursor(CORNER_ANGLES[handle], selected.rotation));
      if (isInsideBody(selected, x, y, 0)) return setCursor('move');
    }

    for (let i = list.length - 1; i >= 0; i--) {
      if (hitShapeBody(list[i], x, y)) return setCursor('pointer');
    }
    setCursor('default');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    const drag = dragRef.current;
    if (drag) {
      applyDrag(drag, x, y, e.shiftKey);
      return;
    }
    updateHoverCursor(x, y);
  };

  const finishDrag = () => {
    const override = overrideRef.current;
    dragRef.current = null;
    overrideRef.current = null;
    if (override) {
      onUpdateRef.current(override.id, override.update);
    }
    requestDraw();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col items-center justify-center p-3 overflow-hidden bg-slate-950/60 rounded-xl border border-slate-800"
    >
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
        <span className="text-xs font-bold text-slate-300">2D Depth Map Stage</span>
        <span className="text-[10px] text-slate-500 font-mono">
          {canvasWidth} × {canvasHeight}
        </span>
      </div>

      <div
        className="relative max-w-full max-h-full flex items-center justify-center"
        style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
      >
        <canvas
          ref={canvasRef}
          width={pixelW}
          height={pixelH}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          style={{ touchAction: 'none' }}
          className="w-full h-full object-contain rounded-lg shadow-2xl border border-slate-800"
        />
      </div>

      <div className="absolute bottom-2 left-4 text-[10px] text-slate-400 pointer-events-none flex items-center gap-4 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800/80">
        <span>🖱️ <strong>Move</strong>: Drag body</span>
        <span>📐 <strong>Scale</strong>: Drag corners (Shift for free-scale)</span>
        <span>🔄 <strong>Rotate</strong>: Drag top handle (Shift for 15° snap)</span>
        <span>🔍 <strong>Zoom</strong>: Mouse wheel</span>
      </div>
    </div>
  );
};
