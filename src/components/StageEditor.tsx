import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ShapeObject } from '../types/index.ts';

interface StageEditorProps {
  shapes: ShapeObject[];
  selectedShapeId: string | null;
  onSelectShape: (id: string | null) => void;
  onUpdateShape: (id: string, updated: Partial<ShapeObject>) => void;
  canvasWidth: number;
  canvasHeight: number;
}

type DragMode = 'move' | 'rotate' | 'scale';

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
  corner?: 'tl' | 'tr' | 'br' | 'bl';
  origDist?: number;
}

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

  const [dragState, setDragState] = useState<DragState | null>(null);

  // RAF scheduler to batch mousemove updates at display refresh rate without dropping frames
  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{ id: string; update: Partial<ShapeObject> } | null>(null);

  const scheduleUpdate = useCallback(
    (id: string, update: Partial<ShapeObject>) => {
      pendingUpdateRef.current = { id, update };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (pendingUpdateRef.current) {
            onUpdateShape(pendingUpdateRef.current.id, pendingUpdateRef.current.update);
            pendingUpdateRef.current = null;
          }
        });
      }
    },
    [onUpdateShape]
  );

  // Convert client mouse coordinates to canvas internal coordinates
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [canvasWidth, canvasHeight]
  );

  // Draw 2D stage
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#090d16'; // slate-950
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Subtle coordinate grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvasWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    // Center crosshair
    ctx.strokeStyle = '#334155';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(canvasWidth / 2, 0);
    ctx.lineTo(canvasWidth / 2, canvasHeight);
    ctx.moveTo(0, canvasHeight / 2);
    ctx.lineTo(canvasWidth, canvasHeight / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw all shapes in layer order
    shapes.forEach((shape) => {
      const isSelected = shape.id === selectedShapeId;

      ctx.save();
      ctx.translate(shape.x, shape.y);
      ctx.rotate((shape.rotation * Math.PI) / 180);

      // Depth brightness representation: higher depth = brighter fill
      const brightness = Math.round(50 + shape.depth * 180);
      const fillColor = `rgb(${brightness}, ${brightness}, ${brightness})`;

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = isSelected ? '#6366f1' : '#64748b';
      ctx.lineWidth = isSelected ? 3 : 1.5;

      const halfW = shape.width / 2;
      const halfH = shape.height / 2;

      ctx.beginPath();

      switch (shape.type) {
        case 'circle': {
          ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
          break;
        }
        case 'square': {
          ctx.roundRect(-halfW, -halfH, shape.width, shape.height, shape.cornerRadius || 8);
          break;
        }
        case 'triangle': {
          ctx.moveTo(0, -halfH);
          ctx.lineTo(halfW, halfH * 0.8);
          ctx.lineTo(-halfW, halfH * 0.8);
          ctx.closePath();
          break;
        }
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
      }

      ctx.fill();
      ctx.stroke();

      // If selected, draw transform bounding box, rotation stem, and corner handles
      if (isSelected) {
        // Dashed bounding box
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-halfW, -halfH, shape.width, shape.height);
        ctx.setLineDash([]);

        // Rotation stem line
        ctx.beginPath();
        ctx.moveTo(0, -halfH);
        ctx.lineTo(0, -halfH - 26);
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Rotation handle (outer circle + inner dot)
        ctx.beginPath();
        ctx.arc(0, -halfH - 26, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = '#4f46e5';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -halfH - 26, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // 4 Corner scale handles
        const corners = [
          { x: -halfW, y: -halfH }, // TL
          { x: halfW, y: -halfH },  // TR
          { x: halfW, y: halfH },   // BR
          { x: -halfW, y: halfH },  // BL
        ];

        corners.forEach((c) => {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 2;
          ctx.fillRect(c.x - 4.5, c.y - 4.5, 9, 9);
          ctx.strokeRect(c.x - 4.5, c.y - 4.5, 9, 9);
        });

        // Center pivot point
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();

      // Draw depth badge above shape
      ctx.save();
      ctx.fillStyle = isSelected ? '#6366f1' : '#1e293b';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      const text = `Z: ${Math.round(shape.depth * 100)}%`;
      const metrics = ctx.measureText(text);
      const textW = metrics.width + 10;
      const textH = 16;
      ctx.fillRect(shape.x - textW / 2, shape.y - halfH - 20, textW, textH);
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, shape.x, shape.y - halfH - 12);
      ctx.restore();

      // If active drag on this shape, draw floating feedback badge
      if (dragState && dragState.shapeId === shape.id) {
        ctx.save();
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        let badgeText = '';
        if (dragState.mode === 'rotate') {
          badgeText = `🔄 ${shape.rotation}°`;
        } else if (dragState.mode === 'scale') {
          badgeText = `📐 ${shape.width} × ${shape.height}px`;
        } else if (dragState.mode === 'move') {
          badgeText = `📍 ${shape.x}, ${shape.y}`;
        }

        if (badgeText) {
          const m = ctx.measureText(badgeText);
          const bw = m.width + 14;
          const bh = 22;
          const by = shape.y + halfH + 16;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(shape.x - bw / 2, by, bw, bh, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, shape.x, by + bh / 2);
        }
        ctx.restore();
      }
    });
  }, [shapes, selectedShapeId, canvasWidth, canvasHeight, dragState]);

  // Handle mousedown on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    // 1. If there is a selected shape, first test its interactive handles
    const selectedShape = shapes.find((s) => s.id === selectedShapeId);
    if (selectedShape) {
      const { u, v } = toLocalCoords(
        x,
        y,
        selectedShape.x,
        selectedShape.y,
        selectedShape.rotation
      );
      const halfW = selectedShape.width / 2;
      const halfH = selectedShape.height / 2;

      // Check rotation handle at (0, -halfH - 26)
      const rotDist = Math.hypot(u, v - (-halfH - 26));
      if (rotDist <= 14) {
        setDragState({
          mode: 'rotate',
          shapeId: selectedShape.id,
          startX: x,
          startY: y,
          origX: selectedShape.x,
          origY: selectedShape.y,
          origW: selectedShape.width,
          origH: selectedShape.height,
          origRotation: selectedShape.rotation,
        });
        return;
      }

      // Check corner scale handles (TL, TR, BR, BL)
      const tlDist = Math.hypot(u - (-halfW), v - (-halfH));
      const trDist = Math.hypot(u - halfW, v - (-halfH));
      const brDist = Math.hypot(u - halfW, v - halfH);
      const blDist = Math.hypot(u - (-halfW), v - halfH);

      const hitCorner = (corner: 'tl' | 'tr' | 'br' | 'bl') => {
        setDragState({
          mode: 'scale',
          shapeId: selectedShape.id,
          startX: x,
          startY: y,
          origX: selectedShape.x,
          origY: selectedShape.y,
          origW: selectedShape.width,
          origH: selectedShape.height,
          origRotation: selectedShape.rotation,
          corner,
          origDist: Math.hypot(halfW, halfH),
        });
      };

      if (tlDist <= 12) {
        hitCorner('tl');
        return;
      }
      if (trDist <= 12) {
        hitCorner('tr');
        return;
      }
      if (brDist <= 12) {
        hitCorner('br');
        return;
      }
      if (blDist <= 12) {
        hitCorner('bl');
        return;
      }

      // Check if clicked inside selected shape body
      if (Math.abs(u) <= halfW + 4 && Math.abs(v) <= halfH + 4) {
        setDragState({
          mode: 'move',
          shapeId: selectedShape.id,
          startX: x,
          startY: y,
          origX: selectedShape.x,
          origY: selectedShape.y,
          origW: selectedShape.width,
          origH: selectedShape.height,
          origRotation: selectedShape.rotation,
        });
        return;
      }
    }

    // 2. Hit-test other shapes from top layer to bottom
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      const { u, v } = toLocalCoords(x, y, shape.x, shape.y, shape.rotation);
      const halfW = shape.width / 2;
      const halfH = shape.height / 2;

      let isHit = false;
      if (shape.type === 'circle') {
        isHit = (u * u) / (halfW * halfW) + (v * v) / (halfH * halfH) <= 1.0;
      } else {
        isHit = Math.abs(u) <= halfW && Math.abs(v) <= halfH;
      }

      if (isHit) {
        onSelectShape(shape.id);
        setDragState({
          mode: 'move',
          shapeId: shape.id,
          startX: x,
          startY: y,
          origX: shape.x,
          origY: shape.y,
          origW: shape.width,
          origH: shape.height,
          origRotation: shape.rotation,
        });
        return;
      }
    }

    // 3. Clicked empty background
    onSelectShape(null);
  };

  // Handle mousemove for hovering cursor updates and active dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCoords(e);

    // If active dragging:
    if (dragState) {
      if (dragState.mode === 'move') {
        const deltaX = x - dragState.startX;
        const deltaY = y - dragState.startY;
        scheduleUpdate(dragState.shapeId, {
          x: Math.round(dragState.origX + deltaX),
          y: Math.round(dragState.origY + deltaY),
        });
      } else if (dragState.mode === 'rotate') {
        const dx = x - dragState.origX;
        const dy = y - dragState.origY;
        let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);
        while (deg > 180) deg -= 360;
        while (deg <= -180) deg += 360;
        if (e.shiftKey) {
          deg = Math.round(deg / 15) * 15;
        }
        scheduleUpdate(dragState.shapeId, { rotation: deg });
      } else if (dragState.mode === 'scale') {
        const { u, v } = toLocalCoords(
          x,
          y,
          dragState.origX,
          dragState.origY,
          dragState.origRotation
        );

        if (e.shiftKey) {
          // Free scale width and height independently
          const newW = Math.max(20, Math.min(canvasWidth * 0.95, Math.round(2 * Math.abs(u))));
          const newH = Math.max(20, Math.min(canvasHeight * 0.95, Math.round(2 * Math.abs(v))));
          scheduleUpdate(dragState.shapeId, { width: newW, height: newH });
        } else {
          // Proportional uniform scale
          const currentDist = Math.hypot(u, v);
          const scale = currentDist / Math.max(1, dragState.origDist || 1);
          const newW = Math.max(20, Math.min(canvasWidth * 0.95, Math.round(dragState.origW * scale)));
          const newH = Math.max(20, Math.min(canvasHeight * 0.95, Math.round(dragState.origH * scale)));
          scheduleUpdate(dragState.shapeId, { width: newW, height: newH });
        }
      }
      return;
    }

    // Dynamic hover cursor when not dragging
    const selectedShape = shapes.find((s) => s.id === selectedShapeId);
    if (selectedShape) {
      const { u, v } = toLocalCoords(
        x,
        y,
        selectedShape.x,
        selectedShape.y,
        selectedShape.rotation
      );
      const halfW = selectedShape.width / 2;
      const halfH = selectedShape.height / 2;

      // Rotation handle
      if (Math.hypot(u, v - (-halfH - 26)) <= 14) {
        canvas.style.cursor = 'grab';
        return;
      }

      // Corners
      if (Math.hypot(u - (-halfW), v - (-halfH)) <= 12) {
        canvas.style.cursor = getResizeCursor(-135, selectedShape.rotation);
        return;
      }
      if (Math.hypot(u - halfW, v - (-halfH)) <= 12) {
        canvas.style.cursor = getResizeCursor(-45, selectedShape.rotation);
        return;
      }
      if (Math.hypot(u - halfW, v - halfH) <= 12) {
        canvas.style.cursor = getResizeCursor(45, selectedShape.rotation);
        return;
      }
      if (Math.hypot(u - (-halfW), v - halfH) <= 12) {
        canvas.style.cursor = getResizeCursor(135, selectedShape.rotation);
        return;
      }

      // Inside selected shape body
      if (Math.abs(u) <= halfW && Math.abs(v) <= halfH) {
        canvas.style.cursor = 'move';
        return;
      }
    }

    // Over any other shape
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      const { u, v } = toLocalCoords(x, y, shape.x, shape.y, shape.rotation);
      if (Math.abs(u) <= shape.width / 2 && Math.abs(v) <= shape.height / 2) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }

    canvas.style.cursor = 'default';
  };

  const handleMouseUp = () => {
    // Flush any pending RAF update immediately
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingUpdateRef.current) {
      onUpdateShape(pendingUpdateRef.current.id, pendingUpdateRef.current.update);
      pendingUpdateRef.current = null;
    }
    setDragState(null);
  };

  // Mouse wheel zooms/scales the selected shape up or down smoothly
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!selectedShapeId) return;
    const shape = shapes.find((s) => s.id === selectedShapeId);
    if (!shape) return;

    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.05 : 0.95;
    const newW = Math.max(20, Math.min(canvasWidth * 0.95, Math.round(shape.width * factor)));
    const newH = Math.max(20, Math.min(canvasHeight * 0.95, Math.round(shape.height * factor)));
    onUpdateShape(shape.id, { width: newW, height: newH });
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
          width={canvasWidth}
          height={canvasHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
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
