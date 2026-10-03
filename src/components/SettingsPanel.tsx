import React, { useRef } from 'react';
import {
  StereogramConfig,
  PatternType,
} from '../types/index.ts';
import {
  Palette,
  Eye,
  Sliders,
  Upload,
  CheckCircle2,
  Info,
  Sparkles,
} from 'lucide-react';

interface SettingsPanelProps {
  config: StereogramConfig;
  onChangeConfig: (updated: Partial<StereogramConfig>) => void;
  canvasWidth: number;
  canvasHeight: number;
  onChangeResolution: (width: number, height: number) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  config,
  onChangeConfig,
  canvasWidth,
  canvasHeight,
  onChangeResolution,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patterns: { id: PatternType; label: string; desc: string; icon: string }[] = [
    { id: 'retro-90s', label: 'Retro 90s Neon', desc: 'Vibrant Magic Eye confetti palette', icon: '🎨' },
    { id: 'color-noise', label: 'Micro-Contrast Noise', desc: 'Saturated high-contrast RGB grain', icon: '✨' },
    { id: 'cosmic', label: 'Cosmic Nebula', desc: 'Deep violet, cyan & pinpoint stars', icon: '🌌' },
    { id: 'organic-flow', label: 'Organic Flow', desc: 'Smooth Perlin-noise marble waves', icon: '🌊' },
    { id: 'sand', label: 'Desert Sand', desc: 'Warm terracotta & ochre stippling', icon: '🏜️' },
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
          <button
            onClick={() => {
              const preset = [
                { w: 800, h: 600, period: 100, disparity: 18, grain: 2 },
                { w: 1200, h: 900, period: 130, disparity: 24, grain: 2 },
                { w: 1920, h: 1080, period: 160, disparity: 30, grain: 2 },
                { w: 2560, h: 1440, period: 200, disparity: 38, grain: 3 },
                { w: 3840, h: 2160, period: 240, disparity: 46, grain: 3 },
              ].find((p) => p.w === canvasWidth && p.h === canvasHeight);
              if (preset) {
                onChangeConfig({
                  patternPeriod: preset.period,
                  maxDisparity: preset.disparity,
                  grainSize: preset.grain,
                });
              } else {
                const recPeriod = Math.max(90, Math.min(300, Math.round(canvasWidth * 0.075 + 45)));
                const recDisparity = Math.max(16, Math.min(64, Math.round(recPeriod * 0.19)));
                const recGrain = canvasWidth >= 2560 ? 3 : 2;
                onChangeConfig({
                  patternPeriod: recPeriod,
                  maxDisparity: recDisparity,
                  grainSize: recGrain,
                });
              }
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-lg border border-indigo-500/30 transition capitalize cursor-pointer"
            title="Auto-tune period and disparity to optimal eye-divergence for this resolution"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Auto-Tune</span>
          </button>
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Resolution Presets
          </label>
          <span className="text-[10px] text-indigo-400 font-mono font-bold">
            {canvasWidth} × {canvasHeight}
          </span>
        </div>
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
                  onChangeConfig({
                    patternPeriod: res.period,
                    maxDisparity: res.disparity,
                    grainSize: res.grain,
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
