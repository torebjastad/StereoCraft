import React, { useRef } from 'react';
import {
  StereogramConfig,
  PatternType,
  EaseOfView,
} from '../types/index.ts';
import { getAutotuneOptics } from '../core/stereogramEngine.ts';
import {
  Palette,
  Eye,
  Sliders,
  Upload,
  CheckCircle2,
  Info,
  Maximize,
} from 'lucide-react';

interface SettingsPanelProps {
  config: StereogramConfig;
  onChangeConfig: (updated: Partial<StereogramConfig>) => void;
  canvasWidth: number;
  canvasHeight: number;
  onChangeResolution: (width: number, height: number) => void;
  onFitToViewport?: () => void;
  isAutoFit?: boolean;
  availableArea?: { width: number; height: number };
  easeOfView?: EaseOfView;
  onSelectEaseOfView?: (ease: EaseOfView) => void;
  mode?: 'studio' | 'labyrinth';
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  config,
  onChangeConfig,
  canvasWidth,
  canvasHeight,
  onChangeResolution,
  onFitToViewport,
  isAutoFit,
  availableArea,
  easeOfView = 'easy',
  onSelectEaseOfView,
  mode = 'studio',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patterns: { id: PatternType; label: string; desc: string; icon: string }[] = [
    { id: 'sand', label: 'Desert Sand (Default)', desc: 'Warm terracotta & ochre stippling', icon: '🏜️' },
    { id: 'retro-90s', label: 'Retro 90s Neon', desc: 'Vibrant Magic Eye confetti palette', icon: '🎨' },
    { id: 'color-noise', label: 'Micro-Contrast Noise', desc: 'Saturated high-contrast RGB grain', icon: '✨' },
    { id: 'cosmic', label: 'Cosmic Nebula', desc: 'Deep violet, cyan & pinpoint stars', icon: '🌌' },
    { id: 'organic-flow', label: 'Organic Flow', desc: 'Smooth Perlin-noise marble waves', icon: '🌊' },
    { id: 'custom', label: 'Custom Texture', desc: 'Wrap your own image/wallpaper', icon: '🖼️' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = img.width;
      offscreen.height = img.height;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        onChangeConfig({
          patternType: 'custom',
          customImageData: imgData,
        });
      }
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <aside className="w-80 border-l border-slate-800/80 bg-slate-900/50 backdrop-blur-md p-4 flex flex-col gap-5 overflow-y-auto shrink-0 text-slate-200">
      {/* Pattern Selector */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Palette className="w-3.5 h-3.5 text-indigo-400" />
          <span>Pattern & Texture</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {patterns.map((p) => {
            const isSelected = config.patternType === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (p.id === 'custom' && !config.customImageData) {
                    fileInputRef.current?.click();
                  } else {
                    onChangeConfig({ patternType: p.id });
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500/70 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{p.icon}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">{p.label}</div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{p.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Upload trigger */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        {config.patternType === 'custom' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-1.5 px-3 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Choose New Image</span>
          </button>
        )}
      </div>

      <div className="h-px bg-slate-800" />

      {/* Optics & Disparity Tuning */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Optics & Disparity</span>
          </div>
        </div>

        {/* Ease of View (Autotune Selector) */}
        <div className="space-y-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-200">Ease of View</span>
              <div className="relative group">
                <Info className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-400 cursor-pointer transition" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-3 rounded-xl bg-slate-900 border border-slate-700 text-[11px] text-slate-300 shadow-2xl z-50 pointer-events-none leading-relaxed">
                  <strong className="text-white block mb-1">Viewing Ease vs. 3D Immersion:</strong>
                  • <span className="text-emerald-400 font-semibold">Easy {mode === 'labyrinth' ? '(Default)' : '(0.5×)'}</span>: {mode === 'labyrinth' ? '100px period & 15px disparity. Fast, effortless 3D lock for tracking the moving cube.' : 'Half period & disparity. Eyes diverge effortlessly, snapping into 3D with minimal eye strain.'}<br />
                  • <span className="text-indigo-400 font-semibold">Medium {mode === 'studio' ? '(Default)' : '(0.75×)'}</span>: {mode === 'labyrinth' ? '140px period & 22px disparity. Balanced depth and comfortable movement.' : '3/4 scale. Balanced depth separation and comfortable convergence.'}<br />
                  • <span className="text-rose-400 font-semibold">Hard (1.0×)</span>: {mode === 'labyrinth' ? '180px period & 30px disparity. Deep canyons and intense 3D ridges.' : 'Full scale. Deep, dramatic 3D immersion and maximum elevation.'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-indigo-400 capitalize">
              {easeOfView} mode
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-900/80 border border-slate-800">
            <button
              onClick={() => onSelectEaseOfView?.('easy')}
              className={`py-1.5 px-1.5 rounded-md text-xs font-bold transition cursor-pointer text-center ${
                easeOfView === 'easy'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 ring-1 ring-emerald-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Easy: 0.5x period & disparity. Effortless 3D lock, minimal strain"
            >
              <div>Easy</div>
              <div className="text-[9px] font-normal opacity-80">Quick Lock</div>
            </button>

            <button
              onClick={() => onSelectEaseOfView?.('medium')}
              className={`py-1.5 px-1.5 rounded-md text-xs font-bold transition cursor-pointer text-center ${
                easeOfView === 'medium'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Medium: 0.75x period & disparity. Balanced depth and comfort"
            >
              <div>Medium</div>
              <div className="text-[9px] font-normal opacity-80">Balanced</div>
            </button>

            <button
              onClick={() => onSelectEaseOfView?.('hard')}
              className={`py-1.5 px-1.5 rounded-md text-xs font-bold transition cursor-pointer text-center ${
                easeOfView === 'hard'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30 ring-1 ring-rose-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Hard: 1.0x period & disparity. Maximum deep 3D immersion"
            >
              <div>Hard</div>
              <div className="text-[9px] font-normal opacity-80">Deep 3D</div>
            </button>
          </div>
        </div>

        {/* Repetition Period (S) */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              Pattern Period (Strip Width)
            </span>
            <span className="font-mono text-indigo-400 font-bold">{config.patternPeriod}px</span>
          </div>
          <input
            type="range"
            min="70"
            max="320"
            step="5"
            value={config.patternPeriod}
            onChange={(e) => onChangeConfig({ patternPeriod: parseInt(e.target.value) })}
            className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
          />
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Info className="w-3 h-3 text-slate-400 shrink-0" />
            <span>100-130px (Standard), 160-240px (1080p to 4K) for 2.8-3.5 cm eye separation.</span>
          </div>
        </div>

        {/* Max Depth Disparity (Delta S) */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-300">Max Disparity (3D Depth)</span>
            <span className="font-mono text-indigo-400 font-bold">{config.maxDisparity}px</span>
          </div>
          <input
            type="range"
            min="8"
            max="70"
            step="2"
            value={config.maxDisparity}
            onChange={(e) => onChangeConfig({ maxDisparity: parseInt(e.target.value) })}
            className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
          />
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Info className="w-3 h-3 text-slate-400 shrink-0" />
            <span>Keep between 15% and 24% of period to avoid double vision (diplopia).</span>
          </div>
        </div>

        {/* Grain Size (Dot Scale) */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-300">Grain / Dot Scale</span>
            <span className="font-mono text-indigo-400 font-bold">{config.grainSize}px</span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((g) => (
              <button
                key={g}
                onClick={() => onChangeConfig({ grainSize: g })}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                  config.grainSize === g
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {g}px
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-400 block">
            2px on Standard/1080p, 3-4px on 2K/4K displays gives tactile binocular fusion.
          </span>
        </div>

        {/* Depth Smoothing / Anti-Aliasing */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-300">Edge Anti-Aliasing</span>
            <span className="font-mono text-indigo-400 font-bold">{config.smoothingRadius}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            value={config.smoothingRadius}
            onChange={(e) => onChangeConfig({ smoothingRadius: parseInt(e.target.value) })}
            className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
          />
          <span className="text-[10px] text-slate-400 block">
            Softens abrupt cliff edges to eliminate visual tearing and ocular rivalry.
          </span>
        </div>

        {/* Thimbleby Occlusion Removal */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
          <div>
            <div className="text-xs font-bold text-slate-200">Echo Suppression</div>
            <div className="text-[10px] text-slate-400">Thimbleby Hidden Surface Removal</div>
          </div>
          <input
            type="checkbox"
            checked={config.enableOcclusionRemoval}
            onChange={(e) => onChangeConfig({ enableOcclusionRemoval: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        {/* Guide Dots Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Convergence Guide Dots</span>
            </div>
            <div className="text-[10px] text-slate-400">Dual alignment dots at top</div>
          </div>
          <input
            type="checkbox"
            checked={config.showGuideDots}
            onChange={(e) => onChangeConfig({ showGuideDots: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>
      </div>

      <div className="h-px bg-slate-800" />

      {/* Resolution Selector */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Resolution Presets
          </label>
          <span className="text-[10px] text-indigo-400 font-mono font-bold">
            {canvasWidth} × {canvasHeight}
          </span>
        </div>

        {/* Auto-Fit Available Area Button */}
        {onFitToViewport && (
          <button
            onClick={onFitToViewport}
            className={`w-full py-2 px-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
              isAutoFit
                ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border-indigo-500 text-white shadow-md shadow-indigo-500/20 ring-1 ring-indigo-400/40'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:border-indigo-500/50 hover:bg-slate-800'
            }`}
            title="Automatically check available area between GUI elements and scale stereogram as large as possible"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Maximize className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[11px] font-bold leading-tight flex items-center gap-1.5">
                  <span>Fit Available Area</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-extrabold uppercase">
                    Auto
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  Max size without black bars {availableArea ? `(${availableArea.width} × ${availableArea.height})` : ''}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
              Fill
            </span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {[
            { w: 800, h: 600, label: '800 × 600', sub: 'Standard (Fast)', period: 110, disparity: 20, grain: 2 },
            { w: 1200, h: 900, label: '1200 × 900', sub: 'HD 4:3', period: 130, disparity: 24, grain: 2 },
            { w: 1920, h: 1080, label: '1920 × 1080', sub: 'Full HD 1080p', period: 160, disparity: 30, grain: 2 },
            { w: 2560, h: 1440, label: '2560 × 1440', sub: '2K QHD', period: 200, disparity: 38, grain: 3 },
            { w: 3840, h: 2160, label: '3840 × 2160', sub: '4K UHD ★', period: 240, disparity: 46, grain: 3, span: true },
          ].map((res) => {
            const isCur = canvasWidth === res.w && canvasHeight === res.h;
            return (
              <button
                key={res.label}
                onClick={() => {
                  onChangeResolution(res.w, res.h);
                  const optics = getAutotuneOptics(res.w, easeOfView, mode);
                  onChangeConfig({
                    patternPeriod: optics.patternPeriod,
                    maxDisparity: optics.maxDisparity,
                  });
                }}
                className={`py-2 px-2 rounded-xl border text-center transition ${
                  res.span ? 'col-span-2' : ''
                } ${
                  isCur
                    ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-400/40'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-600'
                }`}
              >
                <div className="text-[11px] font-bold leading-none">{res.label}</div>
                <div className="text-[9px] text-slate-400 mt-1">{res.sub}</div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
