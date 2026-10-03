import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Download,
  X,
  FileText,
  Check,
  Sparkles,
} from 'lucide-react';
import { printStereogram, downloadCanvasAsPng, getStereogramDownloadFilename } from '../core/exportUtils.ts';
import { StereogramConfig } from '../types/index.ts';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: HTMLCanvasElement | null;
  depthCanvas?: HTMLCanvasElement | null;
  config: StereogramConfig;
  dimensions: { width: number; height: number };
  appMode: 'studio' | 'labyrinth';
  labyrinthLevel?: number;
  onDownloadPNG?: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  canvas,
  depthCanvas: _depthCanvas,
  config,
  dimensions,
  appMode,
  labyrinthLevel,
  onDownloadPNG,
}) => {
  // Default orientation to landscape if width >= height, otherwise portrait
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(() => {
    return dimensions.width >= dimensions.height ? 'landscape' : 'portrait';
  });

  const [includeTitle, setIncludeTitle] = useState<boolean>(true);
  const [includeInstructions, setIncludeInstructions] = useState<boolean>(true);
  const [printSuccess, setPrintSuccess] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Update orientation default whenever dimensions change or modal opens
  useEffect(() => {
    if (isOpen) {
      setOrientation(dimensions.width >= dimensions.height ? 'landscape' : 'portrait');
      setPrintSuccess(false);
      setDownloadSuccess(false);
    }
  }, [isOpen, dimensions.width, dimensions.height]);

  // Generate preview data URL from canvas
  const previewDataUrl = useMemo(() => {
    if (!canvas || !isOpen) return '';
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }, [canvas, isOpen]);

  // Pattern display label
  const patternLabel = useMemo(() => {
    const raw = config.patternType.replace(/-/g, ' ');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [config.patternType]);

  const titleText = appMode === 'labyrinth' ? `StereoCraft 3D Labyrinth Level ${labyrinthLevel || 1}` : 'StereoCraft 3D Autostereogram';

  // Handle direct print
  const handlePrint = () => {
    if (!canvas) return;
    printStereogram({
      canvas,
      title: titleText,
      patternName: patternLabel,
      viewingMode: config.viewingMode,
      dimensions,
      includeTitle,
      includeInstructions,
      orientation,
    });
    setPrintSuccess(true);
    setTimeout(() => setPrintSuccess(false), 2500);
  };

  // Handle direct download
  const handleDownload = () => {
    if (onDownloadPNG) {
      onDownloadPNG();
    } else if (canvas) {
      const filename = getStereogramDownloadFilename({
        patternType: config.patternType,
        appMode,
        width: dimensions.width,
        height: dimensions.height,
        level: labyrinthLevel,
      });
      downloadCanvasAsPng(canvas, filename);
    }
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  // Keyboard navigation: Enter to print, Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrint, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden ring-1 ring-white/10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Print Stereogram</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {dimensions.width} × {dimensions.height}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Send full-resolution 3D artwork directly to your printer or export to PDF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Preview & Settings */}
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto">
          {/* Left Column: Live Paper Preview */}
          <div className="flex-1 bg-slate-950 p-6 flex flex-col items-center justify-center min-h-[360px] border-b md:border-b-0 md:border-r border-slate-800/80 overflow-hidden relative">
            <div className="absolute top-3 left-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Print Sheet Preview ({orientation})</span>
            </div>

            {/* Simulated Paper Sheet */}
            <div
              className={`bg-white text-slate-900 rounded-sm shadow-2xl p-4 flex flex-col items-center justify-between transition-all duration-300 max-w-full ${
                orientation === 'landscape'
                  ? 'w-[420px] aspect-[1.414/1] max-h-[300px]'
                  : 'w-[280px] aspect-[1/1.414] max-h-[380px]'
              }`}
            >
              {/* Optional Header on Paper */}
              {includeTitle ? (
                <div className="text-center w-full mb-1">
                  <div className="text-[11px] font-extrabold tracking-tight text-slate-900 leading-tight">
                    {titleText}
                  </div>
                  <div className="text-[8px] text-slate-500 font-medium">
                    {config.viewingMode === 'parallel' ? 'Parallel Viewing' : 'Cross-Eyed Viewing'} • {patternLabel}
                  </div>
                </div>
              ) : (
                <div />
              )}

              {/* Stereogram Image on Paper */}
              <div className="flex-1 w-full flex items-center justify-center overflow-hidden my-1">
                {previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt="Stereogram Preview"
                    className="max-w-full max-h-full object-contain rounded-xs shadow-xs border border-slate-200"
                  />
                ) : (
                  <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-400 text-xs italic">
                    Rendering stereogram...
                  </div>
                )}
              </div>

              {/* Optional Instructions on Paper */}
              {includeInstructions ? (
                <div className="text-[7.5px] leading-tight text-slate-600 bg-slate-50 border border-slate-200 rounded p-1.5 w-full text-center mt-1">
                  <span className="font-bold text-slate-800">👁️ Viewing Guide: </span>
                  {config.viewingMode === 'cross-eyed'
                    ? 'Cross eyes gently until the two guide dots at the top fuse into three dots. Focus on center dot.'
                    : "Relax eyes and look 'through' the paper into the distance until guide dots merge into three dots."}
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>

          {/* Right Column: Print Settings & Actions */}
          <div className="w-full md:w-80 p-6 flex flex-col justify-between gap-5 bg-slate-900/50">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Paper Orientation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOrientation('landscape')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      orientation === 'landscape'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <span>Landscape</span>
                    {dimensions.width >= dimensions.height && (
                      <span className="text-[9px] px-1 rounded bg-indigo-500/30 text-indigo-200 uppercase font-bold">
                        Fit
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setOrientation('portrait')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      orientation === 'portrait'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <span>Portrait</span>
                    {dimensions.width < dimensions.height && (
                      <span className="text-[9px] px-1 rounded bg-indigo-500/30 text-indigo-200 uppercase font-bold">
                        Fit
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Page Elements
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 text-xs text-slate-300 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={includeTitle}
                      onChange={(e) => setIncludeTitle(e.target.checked)}
                      className="rounded accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Title & Metadata</div>
                      <div className="text-[10px] text-slate-400">Header caption with pattern and mode</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 text-xs text-slate-300 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={includeInstructions}
                      onChange={(e) => setIncludeInstructions(e.target.checked)}
                      className="rounded accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Viewing Instructions</div>
                      <div className="text-[10px] text-slate-400">Printed tips for locking 3D stereopsis</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Printing Tip */}
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-slate-300 text-[11px] leading-relaxed">
                <span className="font-bold text-indigo-400 flex items-center gap-1 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Print Quality Tip:
                </span>
                In the browser print dialog, choose <strong className="text-white">Color</strong> and set margins to <strong className="text-white">Default or Minimum</strong>. Standard photo or inkjet paper yields crisp 3D popping depth!
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                onClick={handlePrint}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
              >
                {printSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Sent to Printer!</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Print Now (Enter)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
              >
                {downloadSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PNG Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Save to PNG File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
