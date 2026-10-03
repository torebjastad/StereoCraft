import React from 'react';
import {
  ShapeObject,
  DepthProfileType,
} from '../types/index.ts';
import {
  Copy,
  Trash2,
  RotateCw,
  Move,
  Maximize2,
  Sliders,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface ShapeInspectorProps {
  selectedShape: ShapeObject | null;
  onUpdateShape: (updated: Partial<ShapeObject>) => void;
  onDuplicateShape: () => void;
  onDeleteShape: () => void;
  onMoveLayer: (direction: 'up' | 'down') => void;
}

export const ShapeInspector: React.FC<ShapeInspectorProps> = ({
  selectedShape,
  onUpdateShape,
  onDuplicateShape,
  onDeleteShape,
  onMoveLayer,
}) => {
  if (!selectedShape) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <Sliders className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
        <p className="text-xs font-medium">Select a shape on the stage to edit its 3D depth, rotation, scale, and relief profile.</p>
      </div>
    );
  }

  const profiles: { id: DepthProfileType; label: string; desc: string }[] = [
    { id: 'flat', label: 'Flat', desc: 'Uniform plateau depth' },
    { id: 'dome', label: 'Dome', desc: 'Smooth spherical volume' },
    { id: 'pyramid', label: 'Pyramid', desc: 'Linear conical apex' },
    { id: 'beveled', label: 'Beveled', desc: 'Flat top with chamfered edges' },
  ];

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
      {/* Title & Quick Actions */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-500/20" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {selectedShape.type} Inspector
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMoveLayer('up')}
            className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            title="Bring Layer Forward"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMoveLayer('down')}
            className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            title="Send Layer Backward"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDuplicateShape}
            className="p-1 rounded-md bg-slate-800/80 hover:bg-indigo-600/30 text-indigo-300"
            title="Duplicate Shape"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDeleteShape}
            className="p-1 rounded-md bg-slate-800/80 hover:bg-rose-600/30 text-rose-400"
            title="Delete Shape"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Depth Level Slider */}
      <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" />
            3D Elevation / Depth
          </span>
          <span className="font-mono text-indigo-400 font-bold">
            {Math.round(selectedShape.depth * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.02"
          value={selectedShape.depth}
          onChange={(e) => onUpdateShape({ depth: parseFloat(e.target.value) })}
          className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-medium">
          <span>Shallow (0.1)</span>
          <span>Standard (0.6)</span>
          <span>Deep 3D (1.0)</span>
        </div>
      </div>

      {/* 3D Surface Profile Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300">3D Relief Profile</label>
        <div className="grid grid-cols-2 gap-1.5">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => onUpdateShape({ profile: p.id })}
              className={`p-2.5 rounded-xl border text-left transition ${
                selectedShape.profile === p.id
                  ? 'bg-indigo-600/20 border-indigo-500/60 text-white'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-bold leading-none mb-1">{p.label}</div>
              <div className="text-[10px] text-slate-400 leading-tight">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Transform: Position & Dimensions */}
      <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Move className="w-3.5 h-3.5 text-indigo-400" />
          <span>Position & Size</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">X Position</span>
            <input
              type="number"
              value={Math.round(selectedShape.x)}
              onChange={(e) => onUpdateShape({ x: parseInt(e.target.value) || 0 })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Y Position</span>
            <input
              type="number"
              value={Math.round(selectedShape.y)}
              onChange={(e) => onUpdateShape({ y: parseInt(e.target.value) || 0 })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Width</span>
            <input
              type="number"
              min="20"
              max="600"
              value={Math.round(selectedShape.width)}
              onChange={(e) => {
                const w = Math.max(10, parseInt(e.target.value) || 10);
                onUpdateShape({ width: w });
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Height</span>
            <input
              type="number"
              min="20"
              max="600"
              value={Math.round(selectedShape.height)}
              onChange={(e) => {
                const h = Math.max(10, parseInt(e.target.value) || 10);
                onUpdateShape({ height: h });
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Quick uniform scale slider */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Maximize2 className="w-3 h-3 text-indigo-400" /> Uniform Scale
            </span>
            <span className="text-slate-400 font-mono">{Math.round(selectedShape.width)}px</span>
          </div>
          <input
            type="range"
            min="30"
            max="300"
            value={selectedShape.width}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              const ratio = selectedShape.height / (selectedShape.width || 1);
              onUpdateShape({ width: val, height: Math.round(val * ratio) });
            }}
            className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
          />
        </div>
      </div>

      {/* Rotation Slider */}
      <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
            Rotation
          </span>
          <span className="font-mono text-slate-300">{Math.round(selectedShape.rotation)}°</span>
        </div>
        <input
          type="range"
          min="0"
          max="360"
          value={selectedShape.rotation}
          onChange={(e) => onUpdateShape({ rotation: parseFloat(e.target.value) })}
          className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
        />
      </div>

      {/* Star Specific Controls */}
      {selectedShape.type === 'star' && (
        <div className="space-y-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <label className="text-xs font-semibold text-slate-300">Star Properties</label>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Points</span>
              <span className="font-mono">{selectedShape.starPoints ?? 5}</span>
            </div>
            <input
              type="range"
              min="3"
              max="12"
              step="1"
              value={selectedShape.starPoints ?? 5}
              onChange={(e) => onUpdateShape({ starPoints: parseInt(e.target.value) })}
              className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
            />
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Point Sharpness (Inner Ratio)</span>
              <span className="font-mono">{Math.round((selectedShape.innerRadiusRatio ?? 0.45) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.8"
              step="0.05"
              value={selectedShape.innerRadiusRatio ?? 0.45}
              onChange={(e) => onUpdateShape({ innerRadiusRatio: parseFloat(e.target.value) })}
              className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
