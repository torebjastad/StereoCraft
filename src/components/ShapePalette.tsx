import React from 'react';
import { Circle, Square, Triangle, Star, Type, Trash2 } from 'lucide-react';
import { ShapeType } from '../types/index.ts';

interface ShapePaletteProps {
  onAddShape: (type: ShapeType) => void;
  onClearAll: () => void;
  shapeCount: number;
}

export const ShapePalette: React.FC<ShapePaletteProps> = ({
  onAddShape,
  onClearAll,
  shapeCount,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Add Shapes
        </span>
        {shapeCount > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition"
            title="Clear all shapes"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        <button
          onClick={() => onAddShape('circle')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95"
          title="Add Circle"
        >
          <Circle className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Circle</span>
        </button>

        <button
          onClick={() => onAddShape('square')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95"
          title="Add Square"
        >
          <Square className="w-4 h-4 text-pink-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Square</span>
        </button>

        <button
          onClick={() => onAddShape('triangle')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95"
          title="Add Triangle"
        >
          <Triangle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Triangle</span>
        </button>

        <button
          onClick={() => onAddShape('star')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95"
          title="Add 5-Point Star"
        >
          <Star className="w-4 h-4 text-teal-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Star</span>
        </button>

        <button
          onClick={() => onAddShape('text')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95"
          title="Add 3D Text"
        >
          <Type className="w-4 h-4 text-sky-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Text</span>
        </button>
      </div>
    </div>
  );
};
