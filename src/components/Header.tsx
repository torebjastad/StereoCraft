import React from 'react';
import {
  Eye,
  HelpCircle,
  Sparkles,
  Download,
  Maximize2,
  Layers,
  Gamepad2,
  Paintbrush,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface HeaderProps {
  appMode: 'studio' | 'labyrinth';
  onToggleAppMode: (mode: 'studio' | 'labyrinth') => void;
  viewingMode: 'parallel' | 'cross-eyed';
  onToggleViewingMode: (mode: 'parallel' | 'cross-eyed') => void;
  onOpenGuide: () => void;
  onExport: () => void;
  onExportDepth: () => void;
  onLoadPreset: (presetName: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  appMode,
  onToggleAppMode,
  viewingMode,
  onToggleViewingMode,
  onOpenGuide,
  onExport,
  onExportDepth,
  onLoadPreset,
}) => {
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'],
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-5 flex items-center justify-between z-20 shrink-0">
      {/* Brand & App Mode Switcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                StereoMagic <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">PRO</span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">3D Autostereogram Suite</p>
          </div>
        </div>

        {/* Studio vs Labyrinth Game Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 ml-2">
          <button
            onClick={() => onToggleAppMode('studio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              appMode === 'studio'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Studio</span>
          </button>

          <button
            onClick={() => onToggleAppMode('labyrinth')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              appMode === 'labyrinth'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/40 animate-pulse'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Play the 3D Stereoscopic Labyrinth Game in Parallel View"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>3D Labyrinth</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-400/20 text-pink-300 font-extrabold">NEW</span>
          </button>
        </div>
      </div>

      {/* Center Controls: Viewing Mode & Presets (Visible in Studio Mode) */}
      <div className="flex items-center gap-3">
        {appMode === 'studio' ? (
          <>
            {/* Viewing Mode Segmented Switch */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                onClick={() => onToggleViewingMode('parallel')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewingMode === 'parallel'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Wall-Eyed / Parallel divergence (Looking 'through' the screen - standard Magic Eye)"
              >
                Parallel Mode
              </button>
              <button
                onClick={() => onToggleViewingMode('cross-eyed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewingMode === 'cross-eyed'
                    ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Cross-Eyed convergence (Crossing your eyes in front of the screen)"
              >
                Cross-Eyed Mode
              </button>
            </div>

            {/* Preset Selector */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:border-slate-700 transition">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Presets</span>
              </button>
              <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-col py-1.5 px-1 w-44 rounded-xl bg-slate-900 border border-slate-800 shadow-xl z-30">
                <button
                  onClick={() => onLoadPreset('constellation')}
                  className="px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-indigo-600/20 hover:text-white rounded-lg transition"
                >
                  ⭐ Star Constellation
                </button>
                <button
                  onClick={() => onLoadPreset('pyramid')}
                  className="px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-indigo-600/20 hover:text-white rounded-lg transition"
                >
                  🔺 Floating Pyramid
                </button>
                <button
                  onClick={() => onLoadPreset('geometric')}
                  className="px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-indigo-600/20 hover:text-white rounded-lg transition"
                >
                  🔷 Geometry Gallery
                </button>
                <button
                  onClick={() => onLoadPreset('target')}
                  className="px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-indigo-600/20 hover:text-white rounded-lg transition"
                >
                  🎯 Nested Rings
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Stereoscopic Parallel Mode Active (Diverge Eyes on Guide Dots)</span>
          </div>
        )}
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition"
        >
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          <span>How to View</span>
        </button>

        <button
          onClick={triggerConfetti}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-bold hover:brightness-110 shadow-lg shadow-emerald-500/20 transition active:scale-95"
          title="Celebration when you lock your eyes and perceive the hidden 3D image!"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>I See It!</span>
        </button>

        {appMode === 'studio' && (
          <>
            <div className="h-5 w-px bg-slate-800 mx-1" />

            {/* Export Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={onExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition active:scale-95"
                title="Download full resolution Stereogram PNG"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export 3D</span>
              </button>
              <button
                onClick={onExportDepth}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
                title="Export Grayscale Depth Map"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}

        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
