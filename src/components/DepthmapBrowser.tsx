import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DecodedDepthmap,
  DepthmapEntry,
  EaseOfView,
  PatternType,
  ShapeObject,
  StereogramConfig,
} from '../types/index.ts';
import {
  DEFAULT_BROWSER_FILL_RATIO,
  createCenteredDepthmapShape,
  stepSlideshowIndex,
} from '../core/depthmapBrowser.ts';
import { renderDepthMap } from '../core/depthRenderer.ts';
import {
  createImageDataHelper,
  generateStereogram,
} from '../core/stereogramEngine.ts';
import {
  LoadedDepthmapFolder,
  decodeDepthmapFromUrl,
  getProjectDepthmapsFolder,
  loadLocalFolderFromFileList,
  pickLocalFolderWithDirectoryPicker,
  supportsDirectoryPicker,
} from '../utils/depthmapFolderLoader.ts';
import { MeshReliefViewer } from './MeshReliefViewer.tsx';
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Contrast,
  Download,
  Eye,
  FolderOpen,
  Grid,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize,
  Maximize2,
  Minimize2,
  Paintbrush,
  Play,
  Printer,
  RotateCcw,
  Search,
  Sliders,
  X,
} from 'lucide-react';

export type BrowserViewMode = 'grid' | 'slideshow';
export type SlideshowDisplayTab = 'stereogram' | 'depth' | '3d-mesh';

interface DepthmapBrowserProps {
  config: StereogramConfig;
  canvasWidth: number;
  canvasHeight: number;
  onChangeConfig: (updated: Partial<StereogramConfig>) => void;
  easeOfView: EaseOfView;
  onSelectEaseOfView: (ease: EaseOfView) => void;
  onStereogramRendered?: (canvas: HTMLCanvasElement) => void;
  onDepthRendered?: (canvas: HTMLCanvasElement) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onFitToViewport?: (width?: number, height?: number) => void;
  isAutoFit?: boolean;
  onExport?: () => void;
  onPrint?: () => void;
  onOpenInStudio?: (shape: ShapeObject) => void;
  onViewModeChange?: (viewMode: BrowserViewMode) => void;
}

const QUICK_PATTERNS: { id: PatternType; label: string; icon: string }[] = [
  { id: 'sand', label: 'Sand', icon: '🏜️' },
  { id: 'emerald-moss', label: 'Moss', icon: '🌲' },
  { id: 'ocean-trench', label: 'Ocean', icon: '🌊' },
  { id: 'cosmic', label: 'Cosmic', icon: '🌌' },
  { id: 'retro-90s', label: 'Retro', icon: '🎨' },
];

const FILL_RATIO_PRESETS = [
  { value: 0.6, label: '60%' },
  { value: DEFAULT_BROWSER_FILL_RATIO, label: '75% (3/4)' },
  { value: 0.85, label: '85%' },
  { value: 0.95, label: '95%' },
];

export const DepthmapBrowser: React.FC<DepthmapBrowserProps> = ({
  config,
  canvasWidth,
  canvasHeight,
  onChangeConfig,
  easeOfView,
  onSelectEaseOfView,
  onStereogramRendered,
  onDepthRendered,
  isFullscreen = false,
  onToggleFullscreen,
  onFitToViewport,
  isAutoFit,
  onExport,
  onPrint,
  onOpenInStudio,
  onViewModeChange,
}) => {
  const [folder, setFolder] = useState<LoadedDepthmapFolder>(() => getProjectDepthmapsFolder());
  const [viewMode, setViewMode] = useState<BrowserViewMode>('grid');
  const [displayTab, setDisplayTab] = useState<SlideshowDisplayTab>('stereogram');
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fillRatio, setFillRatio] = useState<number>(DEFAULT_BROWSER_FILL_RATIO);
  const [invertDepth, setInvertDepth] = useState<boolean>(false);
  const [isHoldingPeek, setIsHoldingPeek] = useState<boolean>(false);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [folderStatusMsg, setFolderStatusMsg] = useState<string | null>(null);
  const [activeDecoded, setActiveDecoded] = useState<{
    entryId: string;
    decoded: DecodedDepthmap;
  } | null>(null);

  const folderRef = useRef<LoadedDepthmapFolder>(folder);
  folderRef.current = folder;

  const decodedCacheRef = useRef<Map<string, DecodedDepthmap>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);
  const cleanExportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayAreaRef = useRef<HTMLDivElement>(null);
  const filmstripItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Notify parent when switching between grid and slideshow so right SettingsPanel can adapt
  useEffect(() => {
    onViewModeChange?.(viewMode);
  }, [viewMode, onViewModeChange]);

  // Entering fullscreen from grid automatically jumps into Slideshow mode
  useEffect(() => {
    if (isFullscreen && viewMode === 'grid' && folder.entries.length > 0) {
      setViewMode('slideshow');
    }
  }, [isFullscreen, viewMode, folder.entries.length]);

  // Revoke local Object URLs on unmount
  useEffect(() => {
    return () => {
      folderRef.current.cleanup();
    };
  }, []);

  // Filtered entries for grid search (slideshow navigates all filtered entries cleanly)
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return folder.entries;
    return folder.entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.fileName.toLowerCase().includes(q) ||
        e.relativePath.toLowerCase().includes(q)
    );
  }, [folder.entries, searchQuery]);

  // Clamp activeIndex if filtered list shrinks
  const safeActiveIndex = useMemo(() => {
    if (filteredEntries.length === 0) return -1;
    if (activeIndex < 0) return 0;
    if (activeIndex >= filteredEntries.length) return filteredEntries.length - 1;
    return activeIndex;
  }, [activeIndex, filteredEntries.length]);

  const activeEntry: DepthmapEntry | null =
    safeActiveIndex >= 0 ? filteredEntries[safeActiveIndex] : null;

  // Apply a newly loaded folder cleanly
  const applyNewFolder = useCallback((nextFolder: LoadedDepthmapFolder) => {
    folderRef.current.cleanup();
    decodedCacheRef.current.clear();
    setFolder(nextFolder);
    setActiveIndex(0);
    setSearchQuery('');
    setActiveDecoded(null);
    setLoadError(null);
    if (nextFolder.entries.length === 0) {
      setFolderStatusMsg(`No supported depthmap images found in "${nextFolder.folderName}".`);
    } else {
      setFolderStatusMsg(null);
    }
  }, []);

  // Open custom folder from user's computer
  const handleChooseCustomFolder = useCallback(async () => {
    setFolderStatusMsg(null);
    if (supportsDirectoryPicker()) {
      try {
        const picked = await pickLocalFolderWithDirectoryPicker();
        if (picked) {
          applyNewFolder(picked);
        }
        return;
      } catch (err) {
        // Fallback to <input webkitdirectory> if File System Access API is blocked/unavailable
        console.warn('showDirectoryPicker failed, falling back to directory input:', err);
      }
    }
    fileInputRef.current?.click();
  }, [applyNewFolder]);

  // Fallback <input webkitdirectory> handler
  const handleDirectoryInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const loaded = loadLocalFolderFromFileList(files);
      applyNewFolder(loaded);
      // Reset value so picking the same folder again still fires onChange
      e.target.value = '';
    },
    [applyNewFolder]
  );

  // Reset back to the default project `depthmaps/` folder
  const handleResetToProjectFolder = useCallback(() => {
    const projectFolder = getProjectDepthmapsFolder();
    applyNewFolder(projectFolder);
  }, [applyNewFolder]);

  // Slideshow navigation
  const goToNext = useCallback(() => {
    if (filteredEntries.length <= 1) return;
    setActiveIndex((prev) => stepSlideshowIndex(prev, 1, filteredEntries.length));
  }, [filteredEntries.length]);

  const goToPrev = useCallback(() => {
    if (filteredEntries.length <= 1) return;
    setActiveIndex((prev) => stepSlideshowIndex(prev, -1, filteredEntries.length));
  }, [filteredEntries.length]);

  const openSlideshowAt = useCallback((idx: number) => {
    setActiveIndex(idx);
    setViewMode('slideshow');
  }, []);

  // Measure available slideshow display area and fit stereogram canvas
  const handleMeasureAndFit = useCallback(() => {
    if (displayAreaRef.current) {
      const rect = displayAreaRef.current.getBoundingClientRect();
      const availW = Math.max(480, Math.floor((rect.width - 32) / 10) * 10);
      const availH = Math.max(360, Math.floor((rect.height - 32) / 10) * 10);
      onFitToViewport?.(availW, availH);
    } else {
      onFitToViewport?.();
    }
  }, [onFitToViewport]);

  // Auto-fit canvas to the wider slideshow display area when entering slideshow mode
  useEffect(() => {
    if (viewMode !== 'slideshow' || isFullscreen || !isAutoFit) return;
    const rafId = window.requestAnimationFrame(() => {
      handleMeasureAndFit();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [viewMode, isFullscreen, isAutoFit, handleMeasureAndFit]);

  // Decode the active depthmap image & prefetch adjacent slides for instant arrow navigation
  useEffect(() => {
    if (!activeEntry) {
      setActiveDecoded(null);
      setIsLoadingImage(false);
      return;
    }

    let cancelled = false;
    const cached = decodedCacheRef.current.get(activeEntry.id);
    if (cached) {
      setActiveDecoded({ entryId: activeEntry.id, decoded: cached });
      setIsLoadingImage(false);
      setLoadError(null);
    } else {
      setIsLoadingImage(true);
      setLoadError(null);
      decodeDepthmapFromUrl(activeEntry.url)
        .then((decoded) => {
          decodedCacheRef.current.set(activeEntry.id, decoded);
          if (!cancelled) {
            setActiveDecoded({ entryId: activeEntry.id, decoded });
            setIsLoadingImage(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setIsLoadingImage(false);
            setLoadError(err instanceof Error ? err.message : 'Failed to decode image.');
          }
        });
    }

    // Background prefetch of next and previous slides in slideshow mode
    if (viewMode === 'slideshow' && filteredEntries.length > 1) {
      const neighborIndices = [
        stepSlideshowIndex(safeActiveIndex, 1, filteredEntries.length),
        stepSlideshowIndex(safeActiveIndex, -1, filteredEntries.length),
      ];
      for (const nIdx of neighborIndices) {
        const neighbor = filteredEntries[nIdx];
        if (neighbor && !decodedCacheRef.current.has(neighbor.id)) {
          decodeDepthmapFromUrl(neighbor.url)
            .then((decoded) => {
              decodedCacheRef.current.set(neighbor.id, decoded);
            })
            .catch(() => {
              // Ignore prefetch errors; surfaced only if user visits that slide
            });
        }
      }
    }

    return () => {
      cancelled = true;
    };
  }, [activeEntry, viewMode, filteredEntries, safeActiveIndex]);

  // Keyboard shortcuts in Slideshow mode (ArrowLeft / ArrowRight / Home / End / I / Esc)
  useEffect(() => {
    if (viewMode !== 'slideshow') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'Home' && filteredEntries.length > 0) {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === 'End' && filteredEntries.length > 0) {
        e.preventDefault();
        setActiveIndex(filteredEntries.length - 1);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setInvertDepth((prev) => !prev);
      } else if (e.key === 'Escape' && !isFullscreen) {
        e.preventDefault();
        setViewMode('grid');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, goToNext, goToPrev, filteredEntries.length, isFullscreen]);

  // Auto-scroll active thumbnail in bottom filmstrip into view
  useEffect(() => {
    if (viewMode !== 'slideshow' || isFullscreen || !activeEntry) return;
    const btn = filmstripItemRefs.current.get(activeEntry.id);
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [viewMode, isFullscreen, activeEntry]);

  // Build centered 3/4-scaled ShapeObject for the active depthmap
  const activeShape = useMemo<ShapeObject | null>(() => {
    if (!activeEntry || !activeDecoded || activeDecoded.entryId !== activeEntry.id) {
      return null;
    }
    return createCenteredDepthmapShape(
      activeEntry,
      activeDecoded.decoded,
      canvasWidth,
      canvasHeight,
      {
        fillRatio,
        depth: 0.98,
        invertDepth,
      }
    );
  }, [activeEntry, activeDecoded, canvasWidth, canvasHeight, fillRatio, invertDepth]);

  // Compute depth map buffer
  const depthMap = useMemo(() => {
    if (!activeShape) {
      return new Float32Array(canvasWidth * canvasHeight);
    }
    return renderDepthMap([activeShape], canvasWidth, canvasHeight, config.smoothingRadius);
  }, [activeShape, canvasWidth, canvasHeight, config.smoothingRadius]);

  // Compute stereogram ImageData when in slideshow mode (or keep ready for export)
  const [stereogramImageData, setStereogramImageData] = useState<ImageData>(() =>
    createImageDataHelper(canvasWidth, canvasHeight)
  );

  useEffect(() => {
    if (viewMode !== 'slideshow' || !activeShape) return;
    const imgData = generateStereogram(depthMap, canvasWidth, canvasHeight, config);
    setStereogramImageData(imgData);
  }, [viewMode, activeShape, depthMap, canvasWidth, canvasHeight, config]);

  // Draw depth map canvas
  useEffect(() => {
    if (viewMode !== 'slideshow') return;
    const depthCanvas = depthCanvasRef.current;
    if (!depthCanvas) return;
    const ctx = depthCanvas.getContext('2d');
    if (!ctx) return;

    const imgData = createImageDataHelper(canvasWidth, canvasHeight);
    const data = imgData.data;
    for (let i = 0; i < depthMap.length; i++) {
      const v = Math.round(depthMap[i] * 255);
      const p = i * 4;
      data[p] = v;
      data[p + 1] = v;
      data[p + 2] = v;
      data[p + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    onDepthRendered?.(depthCanvas);
  }, [viewMode, depthMap, canvasWidth, canvasHeight, onDepthRendered]);

  // Maintain clean export canvas for PNG download & Print
  useEffect(() => {
    if (viewMode !== 'slideshow') return;
    if (!cleanExportCanvasRef.current) {
      cleanExportCanvasRef.current = document.createElement('canvas');
    }
    const cleanCanvas = cleanExportCanvasRef.current;
    cleanCanvas.width = canvasWidth;
    cleanCanvas.height = canvasHeight;
    const ctx = cleanCanvas.getContext('2d');
    if (ctx && stereogramImageData.width === canvasWidth && stereogramImageData.height === canvasHeight) {
      ctx.putImageData(stereogramImageData, 0, 0);
      onStereogramRendered?.(cleanCanvas);
    }
  }, [viewMode, stereogramImageData, canvasWidth, canvasHeight, onStereogramRendered]);

  // Draw main stereogram canvas (with optional Hold-to-Peek cyan-indigo heatmap blend)
  useEffect(() => {
    if (viewMode !== 'slideshow') return;
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (stereogramImageData.width !== canvasWidth || stereogramImageData.height !== canvasHeight) {
      return;
    }

    if (!isHoldingPeek) {
      ctx.putImageData(stereogramImageData, 0, 0);
      return;
    }

    const peekAlpha = 0.75;
    const blended = createImageDataHelper(canvasWidth, canvasHeight);
    const bData = blended.data;
    const sData = stereogramImageData.data;

    for (let i = 0; i < depthMap.length; i++) {
      const z = depthMap[i];
      const p = i * 4;
      const dzR = Math.round(z * 99);
      const dzG = Math.round(z * 102);
      const dzB = Math.round(z * 241);

      bData[p] = Math.round(sData[p] * (1 - peekAlpha) + dzR * peekAlpha);
      bData[p + 1] = Math.round(sData[p + 1] * (1 - peekAlpha) + dzG * peekAlpha);
      bData[p + 2] = Math.round(sData[p + 2] * (1 - peekAlpha) + dzB * peekAlpha);
      bData[p + 3] = 255;
    }
    ctx.putImageData(blended, 0, 0);
  }, [viewMode, stereogramImageData, depthMap, isHoldingPeek, canvasWidth, canvasHeight]);

  // Hidden directory input for universal browser fallback
  const directoryInputProps = {
    webkitdirectory: '',
    directory: '',
  } as React.InputHTMLAttributes<HTMLInputElement>;

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col h-screen w-screen bg-slate-950 overflow-hidden select-none'
          : 'flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative min-w-0'
      }
    >
      {/* Hidden local folder input fallback */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleDirectoryInputChange}
        className="hidden"
        {...directoryInputProps}
      />

      {/* Fullscreen Floating HUD */}
      {isFullscreen && viewMode === 'slideshow' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-2 rounded-2xl glass-panel border border-white/10 shadow-2xl backdrop-blur-xl max-w-[96vw] overflow-x-auto">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs shrink-0">
            <Play className="w-3.5 h-3.5" />
            <span className="max-w-44 truncate">{activeEntry?.name ?? 'Slideshow'}</span>
            {filteredEntries.length > 0 && (
              <span className="font-mono text-[11px] text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                {safeActiveIndex + 1} / {filteredEntries.length}
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-slate-700 shrink-0" />

          {/* Quick Prev / Next */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={goToPrev}
              disabled={filteredEntries.length <= 1}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition cursor-pointer"
              title="Previous depthmap (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToNext}
              disabled={filteredEntries.length <= 1}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition cursor-pointer"
              title="Next depthmap (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 shrink-0" />

          {/* Quick Pattern Switcher */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
            {QUICK_PATTERNS.map((p) => (
              <button
                key={p.id}
                onClick={() => onChangeConfig({ patternType: p.id })}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                  config.patternType === p.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{p.icon}</span>
                <span className="hidden lg:inline">{p.label}</span>
              </button>
            ))}
          </div>

          {/* Hold to Peek */}
          {displayTab === 'stereogram' && (
            <button
              onMouseDown={() => setIsHoldingPeek(true)}
              onMouseUp={() => setIsHoldingPeek(false)}
              onMouseLeave={() => setIsHoldingPeek(false)}
              onTouchStart={() => setIsHoldingPeek(true)}
              onTouchEnd={() => setIsHoldingPeek(false)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border select-none shrink-0 ${
                isHoldingPeek
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm scale-95'
                  : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-slate-200'
              }`}
              title="Press and hold to reveal the hidden depthmap"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Peek</span>
            </button>
          )}

          {/* Invert Depth */}
          <button
            onClick={() => setInvertDepth((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border shrink-0 ${
              invertDepth
                ? 'bg-amber-600/30 border-amber-500/50 text-amber-200'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title="Invert Depth (I)"
          >
            <Contrast className="w-3.5 h-3.5" />
          </button>

          {/* Guide Dots */}
          <button
            onClick={() => onChangeConfig({ showGuideDots: !config.showGuideDots })}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border shrink-0 ${
              config.showGuideDots
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-400'
            }`}
          >
            <span>{config.showGuideDots ? 'Dots ON' : 'Dots OFF'}</span>
          </button>

          {/* Ease of View */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
            {(['easy', 'medium', 'hard'] as EaseOfView[]).map((e) => (
              <button
                key={e}
                onClick={() => onSelectEaseOfView(e)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer capitalize ${
                  easeOfView === e
                    ? e === 'easy'
                      ? 'bg-emerald-600 text-white'
                      : e === 'medium'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {onExport && (
            <button
              onClick={onExport}
              className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 transition cursor-pointer shrink-0"
              title="Save Stereogram PNG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {onPrint && (
            <button
              onClick={onPrint}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer shrink-0"
              title="Print Stereogram (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          )}

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white font-semibold text-xs border border-rose-500/40 transition cursor-pointer shrink-0"
              title="Exit Fullscreen (Esc / F)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          )}
        </div>
      )}

      {/* Windowed Top Browser Toolbar */}
      {!isFullscreen && (
        <div className="min-h-13 border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/60 backdrop-blur-md shrink-0">
          {/* Left: Folder Info + Picker Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Active Folder Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-bold text-slate-100 max-w-44 truncate" title={folder.folderName}>
                {folder.folderName}/
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  folder.source === 'project'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {folder.source === 'project' ? 'Project Default' : 'Local Folder'}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {filteredEntries.length}
                {searchQuery ? `/${folder.entries.length}` : ''} imgs
              </span>
            </div>

            {/* Choose Custom Local Folder */}
            <button
              onClick={handleChooseCustomFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-200 hover:text-white text-xs font-semibold transition cursor-pointer active:scale-95"
              title="Select a custom folder of depthmap images from your computer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Choose Folder…</span>
            </button>

            {/* Reset to Project depthmaps/ folder */}
            {folder.source === 'local' && (
              <button
                onClick={handleResetToProjectFolder}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/70 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
                title="Switch back to the project's default depthmaps/ folder"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Default depthmaps/</span>
              </button>
            )}
          </div>

          {/* Center: Grid vs Slideshow Switcher (+ Display Tabs in Slideshow) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Explorer</span>
              </button>
              <button
                onClick={() => setViewMode('slideshow')}
                disabled={filteredEntries.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-40 ${
                  viewMode === 'slideshow'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Slideshow</span>
              </button>
            </div>

            {viewMode === 'slideshow' && (
              <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
                {(
                  [
                    { id: 'stereogram', label: 'Stereogram', icon: Eye },
                    { id: 'depth', label: 'Depth Map', icon: Sliders },
                    { id: '3d-mesh', label: '3D Mesh', icon: Box },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setDisplayTab(tab.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        displayTab === tab.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title={tab.label}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Search (Grid) OR Slideshow Controls */}
          <div className="flex items-center gap-2">
            {viewMode === 'grid' ? (
              <>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter depthmaps…"
                    className="pl-8 pr-7 py-1.5 w-48 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => openSlideshowAt(safeActiveIndex >= 0 ? safeActiveIndex : 0)}
                  disabled={filteredEntries.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold shadow-md shadow-cyan-600/25 transition cursor-pointer disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Slideshow</span>
                </button>
              </>
            ) : (
              <>
                {/* Scale Preset (defaults to 75% = 3/4) */}
                <div
                  className="hidden md:flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900 border border-slate-800"
                  title="Depthmap centered fill scale relative to screen (default 3/4 = 75%)"
                >
                  <span className="text-[10px] font-bold uppercase text-slate-400 px-1">Scale</span>
                  {FILL_RATIO_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setFillRatio(preset.value)}
                      className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                        Math.abs(fillRatio - preset.value) < 0.005
                          ? 'bg-cyan-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Invert Depth */}
                <button
                  onClick={() => setInvertDepth((v) => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    invertDepth
                      ? 'bg-amber-600/25 border-amber-500/60 text-amber-200'
                      : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-slate-300 hover:text-white'
                  }`}
                  title="Invert light/dark depth values (Hotkey: I)"
                >
                  <Contrast className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Invert</span>
                </button>

                {/* Hold to Peek */}
                {displayTab === 'stereogram' && (
                  <button
                    onMouseDown={() => setIsHoldingPeek(true)}
                    onMouseUp={() => setIsHoldingPeek(false)}
                    onMouseLeave={() => setIsHoldingPeek(false)}
                    onTouchStart={() => setIsHoldingPeek(true)}
                    onTouchEnd={() => setIsHoldingPeek(false)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border select-none ${
                      isHoldingPeek
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm scale-95'
                        : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-slate-200 hover:text-white'
                    }`}
                    title="Press and hold to peek at the centered 3/4 depthmap"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Hold to Peek</span>
                  </button>
                )}

                {/* Open in Studio */}
                {onOpenInStudio && activeShape && (
                  <button
                    onClick={() => onOpenInStudio(activeShape)}
                    className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
                    title="Edit this centered depthmap inside Studio"
                  >
                    <Paintbrush className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Edit in Studio</span>
                  </button>
                )}

                {/* Fit Viewport */}
                {onFitToViewport && (
                  <button
                    onClick={handleMeasureAndFit}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                      isAutoFit
                        ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300'
                        : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-slate-300'
                    }`}
                    title="Fit stereogram resolution to the available viewport"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                )}

                {/* Fullscreen Slideshow */}
                {onToggleFullscreen && (
                  <button
                    onClick={onToggleFullscreen}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white transition cursor-pointer"
                    title="Fullscreen Slideshow (F)"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Fullscreen</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* VIEW 1: FOLDER EXPLORER GALLERY GRID */}
      {viewMode === 'grid' && !isFullscreen && (
        <div className="flex-1 overflow-y-auto p-5">
          {folderStatusMsg && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
              <span>{folderStatusMsg}</span>
              {folder.source === 'local' && (
                <button
                  onClick={handleResetToProjectFolder}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold cursor-pointer"
                >
                  Back to project depthmaps/
                </button>
              )}
            </div>
          )}

          {filteredEntries.length === 0 ? (
            <div className="h-full min-h-80 flex flex-col items-center justify-center text-center gap-4 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-slate-600" />
              </div>
              <div className="space-y-1 max-w-md">
                <h2 className="text-base font-bold text-slate-200">
                  {searchQuery ? 'No matching depthmaps' : 'No depthmap images in this folder'}
                </h2>
                <p className="text-xs text-slate-400">
                  {searchQuery
                    ? `No files matched "${searchQuery}". Try clearing the filter.`
                    : 'Choose a folder containing PNG, JPG, or WebP depthmap images, or return to the project depthmaps folder.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
                <button
                  onClick={handleChooseCustomFolder}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Choose Local Folder…</span>
                </button>
                {folder.source === 'local' && (
                  <button
                    onClick={handleResetToProjectFolder}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Open Project depthmaps/
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-4">
              {/* Info banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Every depthmap is automatically <strong className="text-slate-200">centered &amp; scaled to 3/4 (75%)</strong> of the screen. Click any image to open it in <strong className="text-cyan-300">Slideshow Mode</strong> and browse with <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">→</kbd> arrows.
                  </span>
                </div>
              </div>

              {/* Responsive Thumbnail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredEntries.map((entry, idx) => {
                  const isSelected = idx === safeActiveIndex;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => openSlideshowAt(idx)}
                      className={`group rounded-2xl overflow-hidden border text-left transition flex flex-col cursor-pointer bg-slate-900/80 hover:-translate-y-0.5 ${
                        isSelected
                          ? 'border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/15'
                          : 'border-slate-800 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10'
                      }`}
                    >
                      {/* Centered 3/4 preview frame */}
                      <div className="relative aspect-[4/3] w-full bg-black flex items-center justify-center overflow-hidden p-2">
                        <img
                          src={entry.url}
                          alt={entry.name}
                          loading="lazy"
                          className="max-w-[75%] max-h-[75%] object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[10px] font-mono font-bold text-slate-300">
                          #{idx + 1}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-600 text-white text-[11px] font-bold shadow-md">
                            <Play className="w-3 h-3" />
                            <span>View 3D</span>
                          </span>
                        </div>
                      </div>

                      {/* Metadata footer */}
                      <div className="px-3 py-2.5 border-t border-slate-800/80">
                        <div
                          className="text-xs font-bold text-slate-100 truncate group-hover:text-cyan-300 transition"
                          title={entry.name}
                        >
                          {entry.name}
                        </div>
                        <div
                          className="text-[10px] font-mono text-slate-500 truncate mt-0.5"
                          title={entry.relativePath}
                        >
                          {entry.fileName}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SLIDESHOW MODE (3/4 CENTERED STEREOGRAM WITH ARROW NAVIGATION) */}
      {viewMode === 'slideshow' && (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Main Display Area */}
          <div
            ref={displayAreaRef}
            className={`flex-1 relative flex items-center justify-center overflow-hidden ${
              isFullscreen ? 'p-0 w-full h-full' : 'p-4'
            }`}
          >
            {/* Left Arrow Overlay Button */}
            {filteredEntries.length > 1 && (
              <button
                onClick={goToPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-slate-900/65 hover:bg-cyan-600/90 border border-white/15 hover:border-cyan-300/60 text-white backdrop-blur-md shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="Previous depthmap (Left Arrow ←)"
                aria-label="Previous depthmap"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Right Arrow Overlay Button */}
            {filteredEntries.length > 1 && (
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-slate-900/65 hover:bg-cyan-600/90 border border-white/15 hover:border-cyan-300/60 text-white backdrop-blur-md shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="Next depthmap (Right Arrow →)"
                aria-label="Next depthmap"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Loading / Error State */}
            {isLoadingImage && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs pointer-events-none">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 shadow-xl">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>Loading depthmap…</span>
                </div>
              </div>
            )}

            {loadError && (
              <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-sm max-w-md text-center space-y-2">
                <div className="font-bold">Could not load depthmap</div>
                <div className="text-xs opacity-80">{loadError}</div>
              </div>
            )}

            {/* 1. Stereogram Main Canvas */}
            {!loadError && (
              <div
                className={`relative max-w-full max-h-full flex items-center justify-center ${
                  displayTab === 'stereogram' ? 'block' : 'hidden'
                }`}
                style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
              >
                <canvas
                  ref={mainCanvasRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  className={
                    isFullscreen
                      ? 'w-full h-full block'
                      : 'w-full h-full object-contain rounded-xl shadow-2xl border border-slate-800'
                  }
                  style={isFullscreen ? { imageRendering: 'pixelated' } : undefined}
                />

                {/* Guide Dots Overlay Indicator */}
                {config.showGuideDots && (
                  <div
                    className="absolute pointer-events-none flex items-center"
                    style={{
                      top: `${Math.max(2.5, Math.min(4.5, (24 / canvasHeight) * 100))}%`,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: `${(config.patternPeriod / canvasWidth) * 100}%`,
                    }}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/80 -translate-x-1/2 ring-2 ring-white/60 guide-dot-glow" />
                    <div className="flex-1" />
                    <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/80 translate-x-1/2 ring-2 ring-white/60 guide-dot-glow" />
                  </div>
                )}
              </div>
            )}

            {/* 2. Centered 3/4 Depth Map Canvas */}
            {!loadError && (
              <div
                className={`relative max-w-full max-h-full flex items-center justify-center ${
                  displayTab === 'depth' ? 'block' : 'hidden'
                }`}
                style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
              >
                <canvas
                  ref={depthCanvasRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  className="w-full h-full object-contain rounded-xl shadow-2xl border border-slate-800"
                />
              </div>
            )}

            {/* 3. 3D Relief Mesh Viewer */}
            {!loadError && displayTab === '3d-mesh' && (
              <div className="w-full h-full">
                <MeshReliefViewer
                  depthMap={depthMap}
                  width={canvasWidth}
                  height={canvasHeight}
                />
              </div>
            )}
          </div>

          {/* Bottom Slideshow Bar + Filmstrip (Windowed Mode) */}
          {!isFullscreen && (
            <div className="border-t border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-4 py-2.5 flex flex-col gap-2 shrink-0">
              {/* Slide Controls Row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={goToPrev}
                    disabled={filteredEntries.length <= 1}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                    title="Previous image (←)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev</span>
                  </button>

                  <button
                    onClick={goToNext}
                    disabled={filteredEntries.length <= 1}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                    title="Next image (→)"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="h-4 w-px bg-slate-800 mx-1" />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400 shrink-0">
                        {safeActiveIndex + 1} / {filteredEntries.length}
                      </span>
                      <span className="text-xs font-bold text-slate-100 truncate">
                        {activeEntry?.name ?? '—'}
                      </span>
                      <span className="hidden sm:inline text-[11px] font-mono text-slate-500 truncate">
                        ({activeEntry?.fileName})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                  {activeShape && (
                    <span className="hidden md:inline font-mono text-slate-400">
                      Centered {Math.round(fillRatio * 100)}% • {activeShape.width}×{activeShape.height}px
                    </span>
                  )}
                  <span className="hidden lg:inline text-slate-600">•</span>
                  <span className="hidden lg:inline">
                    Use <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">←</kbd>{' '}
                    <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">→</kbd> arrows
                  </span>
                </div>
              </div>

              {/* Scrollable Thumbnail Filmstrip */}
              {filteredEntries.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {filteredEntries.map((entry, idx) => {
                    const isCurrent = idx === safeActiveIndex;
                    return (
                      <button
                        key={entry.id}
                        ref={(el) => {
                          if (el) filmstripItemRefs.current.set(entry.id, el);
                          else filmstripItemRefs.current.delete(entry.id);
                        }}
                        onClick={() => setActiveIndex(idx)}
                        className={`relative shrink-0 w-16 h-12 rounded-lg overflow-hidden border bg-black flex items-center justify-center p-1 transition cursor-pointer ${
                          isCurrent
                            ? 'border-cyan-400 ring-2 ring-cyan-500/40 scale-105'
                            : 'border-slate-800 opacity-65 hover:opacity-100 hover:border-slate-600'
                        }`}
                        title={`${idx + 1}. ${entry.name} (${entry.fileName})`}
                      >
                        <img
                          src={entry.url}
                          alt={entry.name}
                          loading="lazy"
                          className="max-w-[75%] max-h-[75%] object-contain"
                        />
                        <span className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold text-slate-300 drop-shadow">
                          {idx + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
