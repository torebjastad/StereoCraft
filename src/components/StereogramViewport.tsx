import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  StereogramConfig,
  ShapeObject,
  PatternType,
  EaseOfView,
} from '../types/index.ts';
import { renderDepthMap } from '../core/depthRenderer.ts';
import { generateStereogram, createImageDataHelper } from '../core/stereogramEngine.ts';
import { generateParallaxView } from '../core/wigglegram.ts';
import { MeshReliefViewer } from './MeshReliefViewer.tsx';
import { StageEditor } from './StageEditor.tsx';
import {
  Eye,
  Layers,
  Box,
  SplitSquareVertical,
  Activity,
  Sliders,
  Maximize,
  Maximize2,
  Minimize2,
  Download,
  Printer,
} from 'lucide-react';

interface StereogramViewportProps {
  shapes: ShapeObject[];
  config: StereogramConfig;
  canvasWidth: number;
  canvasHeight: number;
  selectedShapeId: string | null;
  onSelectShape: (id: string | null) => void;
  onUpdateShape: (id: string, updated: Partial<ShapeObject>) => void;
  onStereogramRendered?: (canvas: HTMLCanvasElement) => void;
  onDepthRendered?: (canvas: HTMLCanvasElement) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onFitToViewport?: (width?: number, height?: number) => void;
  isAutoFit?: boolean;
  onChangeConfig?: (updated: Partial<StereogramConfig>) => void;
  easeOfView?: EaseOfView;
  onSelectEaseOfView?: (ease: EaseOfView) => void;
  onExport?: () => void;
  onPrint?: () => void;
}

export type ViewTab = 'stereogram' | 'stage' | 'depth' | 'split' | '3d-mesh';

export const StereogramViewport: React.FC<StereogramViewportProps> = ({
  shapes,
  config,
  canvasWidth,
  canvasHeight,
  selectedShapeId,
  onSelectShape,
  onUpdateShape,
  onStereogramRendered,
  onDepthRendered,
  isFullscreen,
  onToggleFullscreen,
  onFitToViewport,
  isAutoFit,
  onChangeConfig,
  easeOfView = 'easy',
  onSelectEaseOfView,
  onExport,
  onPrint,
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('stereogram');
  const [peekAmount, setPeekAmount] = useState<number>(0); // 0 = 100% stereogram, 1 = 100% depth map
  const [isWiggleActive, setIsWiggleActive] = useState<boolean>(false);
  const [wiggleSpeed, setWiggleSpeed] = useState<number>(120); // ms per frame
  const [isHoldingPeek, setIsHoldingPeek] = useState<boolean>(false);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);
  const cleanExportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayAreaRef = useRef<HTMLDivElement>(null);

  const PATTERNS: { id: PatternType; label: string; icon: string }[] = [
    { id: 'sand', label: 'Sand', icon: '🏜️' },
    { id: 'retro-90s', label: 'Retro', icon: '🎨' },
    { id: 'color-noise', label: 'Noise', icon: '✨' },
    { id: 'cosmic', label: 'Cosmic', icon: '🌌' },
    { id: 'organic-flow', label: 'Flow', icon: '🌊' },
  ];

  const handleMeasureAndFit = () => {
    if (displayAreaRef.current) {
      const rect = displayAreaRef.current.getBoundingClientRect();
      const availW = Math.max(480, Math.floor((rect.width - 32) / 10) * 10);
      const bottomPadding = activeTab === 'stereogram' ? 56 : 0;
      const availH = Math.max(360, Math.floor((rect.height - 32 - bottomPadding) / 10) * 10);
      onFitToViewport?.(availW, availH);
    } else {
      onFitToViewport?.();
    }
  };

  // Compute Depth Map
  const depthMap = useMemo(() => {
    return renderDepthMap(shapes, canvasWidth, canvasHeight, config.smoothingRadius);
  }, [shapes, canvasWidth, canvasHeight, config.smoothingRadius]);

  // Compute Stereogram ImageData lazily and debounced
  const isStereogramTab = activeTab === 'stereogram' || activeTab === 'split';
  const isDirtyRef = useRef<boolean>(false);

  const [stereogramImageData, setStereogramImageData] = useState<ImageData>(() => {
    return generateStereogram(depthMap, canvasWidth, canvasHeight, config);
  });

  // Keep stereogram updated without blocking 2D stage interaction
  useEffect(() => {
    // If dimensions change, regenerate immediately to avoid size mismatch
    if (
      stereogramImageData.width !== canvasWidth ||
      stereogramImageData.height !== canvasHeight
    ) {
      const imgData = generateStereogram(depthMap, canvasWidth, canvasHeight, config);
      setStereogramImageData(imgData);
      isDirtyRef.current = false;
      return;
    }

    if (!isStereogramTab) {
      // Mark dirty when on 2D stage, depth map, or 3D mesh tab
      isDirtyRef.current = true;
      // Background update after user has been idle for 400ms
      const idleTimer = setTimeout(() => {
        if (isDirtyRef.current) {
          isDirtyRef.current = false;
          const imgData = generateStereogram(depthMap, canvasWidth, canvasHeight, config);
          setStereogramImageData(imgData);
        }
      }, 400);
      return () => clearTimeout(idleTimer);
    }

    // On stereogram/split tab: if returning from stage tab with pending changes, update immediately
    if (isDirtyRef.current) {
      isDirtyRef.current = false;
      const imgData = generateStereogram(depthMap, canvasWidth, canvasHeight, config);
      setStereogramImageData(imgData);
      return;
    }

    // Interactive slider changes (disparity, period, etc.) debounced at 40ms
    const timer = setTimeout(() => {
      const imgData = generateStereogram(depthMap, canvasWidth, canvasHeight, config);
      setStereogramImageData(imgData);
    }, 40);

    return () => clearTimeout(timer);
  }, [depthMap, canvasWidth, canvasHeight, config, isStereogramTab, stereogramImageData.width, stereogramImageData.height]);

  // Draw Depth Map to secondary canvas for export and depth view
  useEffect(() => {
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
    if (onDepthRendered) onDepthRendered(depthCanvas);
  }, [depthMap, canvasWidth, canvasHeight, onDepthRendered]);

  // Maintain pristine, unblended stereogram canvas for clean PNG export & printing
  useEffect(() => {
    if (!cleanExportCanvasRef.current) {
      cleanExportCanvasRef.current = document.createElement('canvas');
    }
    const cleanCanvas = cleanExportCanvasRef.current;
    cleanCanvas.width = canvasWidth;
    cleanCanvas.height = canvasHeight;
    const ctx = cleanCanvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(stereogramImageData, 0, 0);
    }
    if (onStereogramRendered) {
      onStereogramRendered(cleanCanvas);
    }
  }, [stereogramImageData, canvasWidth, canvasHeight, onStereogramRendered]);

  // Handle Main Canvas Rendering with Peek and Wigglegram
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Normal or blended view
    const currentPeek = isHoldingPeek ? 0.75 : peekAmount;

    if (currentPeek === 0 && !isWiggleActive) {
      // Direct render stereogram
      ctx.putImageData(stereogramImageData, 0, 0);
      if (onStereogramRendered) onStereogramRendered(canvas);
      return;
    }

    if (currentPeek > 0 && !isWiggleActive) {
      // Blend stereogram with colored depth map
      const blended = createImageDataHelper(canvasWidth, canvasHeight);
      const bData = blended.data;
      const sData = stereogramImageData.data;

      for (let i = 0; i < depthMap.length; i++) {
        const z = depthMap[i];
        const p = i * 4;

        // Depth map with nice cyan-indigo heatmap glow
        const dzR = Math.round(z * 99);
        const dzG = Math.round(z * 102);
        const dzB = Math.round(z * 241);

        bData[p] = Math.round(sData[p] * (1 - currentPeek) + dzR * currentPeek);
        bData[p + 1] = Math.round(sData[p + 1] * (1 - currentPeek) + dzG * currentPeek);
        bData[p + 2] = Math.round(sData[p + 2] * (1 - currentPeek) + dzB * currentPeek);
        bData[p + 3] = 255;
      }
      ctx.putImageData(blended, 0, 0);
      return;
    }

    // Wigglegram animation loop
    if (isWiggleActive) {
      let isLeft = true;
      const parallaxShift = 10;
      const leftView = generateParallaxView(stereogramImageData, depthMap, canvasWidth, canvasHeight, -parallaxShift);
      const rightView = generateParallaxView(stereogramImageData, depthMap, canvasWidth, canvasHeight, parallaxShift);

      const intervalId = setInterval(() => {
        if (!ctx) return;
        ctx.putImageData(isLeft ? leftView : rightView, 0, 0);
        isLeft = !isLeft;
      }, wiggleSpeed);

      return () => clearInterval(intervalId);
    }
  }, [
    stereogramImageData,
    depthMap,
    peekAmount,
    isHoldingPeek,
    isWiggleActive,
    wiggleSpeed,
    canvasWidth,
    canvasHeight,
    onStereogramRendered,
  ]);

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col h-screen w-screen bg-slate-950 overflow-hidden select-none'
          : 'flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative'
      }
    >
      {/* Floating HUD Bar in Fullscreen Mode */}
      {isFullscreen && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-2xl glass-panel border border-white/10 shadow-2xl backdrop-blur-xl max-w-[96vw] overflow-x-auto">
          <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs shrink-0">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">StereoCraft Studio</span>
          </div>

          <div className="h-4 w-px bg-slate-700 shrink-0" />

          {/* View Tabs in Fullscreen */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
            {(
              [
                { id: 'stereogram', label: 'Stereogram', icon: Eye },
                { id: 'stage', label: '2D Stage', icon: Layers },
                { id: 'depth', label: 'Depth', icon: Sliders },
                { id: 'split', label: 'Split', icon: SplitSquareVertical },
                { id: '3d-mesh', label: '3D Mesh', icon: Box },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isSel = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    isSel
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-slate-700 shrink-0" />

          {/* Quick Pattern Switcher in Fullscreen */}
          {onChangeConfig && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
              {PATTERNS.map((p) => (
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
          )}

          {/* Guide Dots Toggle in Fullscreen */}
          {onChangeConfig && (
            <button
              onClick={() => onChangeConfig({ showGuideDots: !config.showGuideDots })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border shrink-0 ${
                config.showGuideDots
                  ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{config.showGuideDots ? 'Dots ON' : 'Dots OFF'}</span>
            </button>
          )}

          {/* Ease of View Selector in Fullscreen */}
          {onSelectEaseOfView && (
            <div className="flex items-center p-0.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
              {(['easy', 'medium', 'hard'] as EaseOfView[]).map((e) => (
                <button
                  key={e}
                  onClick={() => onSelectEaseOfView(e)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer capitalize ${
                    easeOfView === e
                      ? e === 'easy'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : e === 'medium'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`${e.toUpperCase()} Viewing Mode (${e === 'easy' ? '0.5x' : e === 'medium' ? '0.75x' : '1.0x'})`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <div className="h-4 w-px bg-slate-700 shrink-0" />

          {/* Resolution Badge in Fullscreen */}
          <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
            {canvasWidth} × {canvasHeight}
          </span>

          {/* Export & Print in Fullscreen */}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white font-semibold text-xs border border-indigo-500/40 transition active:scale-95 cursor-pointer shadow-sm shrink-0"
              title="Save Stereogram to PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Save PNG</span>
            </button>
          )}

          {onPrint && (
            <button
              onClick={onPrint}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition active:scale-95 cursor-pointer shadow-sm shrink-0"
              title="Print Stereogram (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xl:inline">Print</span>
            </button>
          )}

          {/* Exit Fullscreen Button */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white font-semibold text-xs border border-rose-500/40 transition active:scale-95 cursor-pointer shadow-sm shrink-0"
              title="Exit Fullscreen Mode (Esc / F)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit (Esc)</span>
            </button>
          )}
        </div>
      )}

      {/* Top Viewport Toolbar in Windowed Mode */}
      {!isFullscreen && (
        <div className="h-12 border-b border-slate-800/80 px-4 flex items-center justify-between bg-slate-900/50 backdrop-blur-md shrink-0">
          {/* View Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('stereogram')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === 'stereogram'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Stereogram</span>
            </button>

            <button
              onClick={() => setActiveTab('stage')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === 'stage'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D Stage</span>
            </button>

            <button
              onClick={() => setActiveTab('depth')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === 'depth'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Depth Map</span>
            </button>

            <button
              onClick={() => setActiveTab('split')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === 'split'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>

            <button
              onClick={() => setActiveTab('3d-mesh')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === '3d-mesh'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Relief Mesh</span>
            </button>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2.5">
            {/* Status Indicators */}
            <div className="hidden lg:flex items-center gap-2.5 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Period: <strong className="text-slate-200">{config.patternPeriod}px</strong></span>
              </span>
              <span className="text-slate-600">•</span>
              <span>Max Disparity: <strong className="text-slate-200">{config.maxDisparity}px</strong></span>
              <span className="text-slate-600">•</span>
              <span className="capitalize font-mono text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                {easeOfView}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            {/* Fit Viewport Button */}
            {onFitToViewport && (
              <button
                onClick={handleMeasureAndFit}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  isAutoFit
                    ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300 shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-slate-300 hover:text-white'
                }`}
                title="Scale stereogram resolution to fill the available display area completely without black bars"
              >
                <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Fit Viewport</span>
              </button>
            )}

            {/* Fullscreen Button */}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white transition cursor-pointer shadow-sm active:scale-95"
                title="Fullscreen Mode (F)"
              >
                <Maximize className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fullscreen</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Display Area */}
      <div
        ref={displayAreaRef}
        className={`flex-1 relative flex items-center justify-center overflow-hidden ${
          isFullscreen ? 'p-0 w-full h-full' : 'p-4'
        }`}
      >
        {/* 1. Stereogram Main Canvas */}
        <div
          className={`relative max-w-full max-h-full flex items-center justify-center ${
            activeTab === 'stereogram' ? 'block' : 'hidden'
          }`}
          style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
        >
          <canvas
            ref={mainCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className={
              isFullscreen
                ? 'w-full h-full object-contain'
                : 'w-full h-full object-contain rounded-xl shadow-2xl border border-slate-800'
            }
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

        {/* 2. Interactive 2D Stage Editor */}
        {activeTab === 'stage' && (
          <div className="w-full h-full">
            <StageEditor
              shapes={shapes}
              selectedShapeId={selectedShapeId}
              onSelectShape={onSelectShape}
              onUpdateShape={onUpdateShape}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
            />
          </div>
        )}

        {/* 3. Pure Depth Map View */}
        <div
          className={`relative max-w-full max-h-full flex items-center justify-center ${
            activeTab === 'depth' ? 'block' : 'hidden'
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

        {/* 4. Split Screen Side-by-Side View */}
        {activeTab === 'split' && (
          <div className="grid grid-cols-2 gap-4 w-full h-full max-h-[85vh]">
            <div className="relative flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden">
              <span className="absolute top-3 left-4 text-xs font-bold text-slate-300 z-10">
                Autostereogram
              </span>
              <img
                src={mainCanvasRef.current?.toDataURL()}
                alt="Stereogram"
                className="w-full h-full object-contain rounded-lg shadow-md"
              />
            </div>
            <div className="relative flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden">
              <span className="absolute top-3 left-4 text-xs font-bold text-slate-300 z-10">
                Depth Map (3D Relief)
              </span>
              <img
                src={depthCanvasRef.current?.toDataURL()}
                alt="Depth Map"
                className="w-full h-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        )}

        {/* 5. 3D Relief Mesh Viewer (WebGL) */}
        {activeTab === '3d-mesh' && (
          <div className="w-full h-full">
            <MeshReliefViewer
              depthMap={depthMap}
              width={canvasWidth}
              height={canvasHeight}
            />
          </div>
        )}
      </div>

      {/* Floating Bottom Revealer Toolbar */}
      {activeTab === 'stereogram' && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-2xl glass-panel shadow-2xl flex items-center gap-4 border border-white/10 z-10">
          {/* Hold to Peek Button */}
          <button
            onMouseDown={() => setIsHoldingPeek(true)}
            onMouseUp={() => setIsHoldingPeek(false)}
            onMouseLeave={() => setIsHoldingPeek(false)}
            onTouchStart={() => setIsHoldingPeek(true)}
            onTouchEnd={() => setIsHoldingPeek(false)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 select-none ${
              isHoldingPeek
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/50 scale-95'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
            }`}
            title="Press and hold to momentarily reveal the hidden 3D depth map"
          >
            <Eye className="w-4 h-4 text-indigo-400" />
            <span>Hold to Peek</span>
          </button>

          {/* Smooth Peek Slider */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">Peek</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={peekAmount}
              onChange={(e) => setPeekAmount(parseFloat(e.target.value))}
              className="w-24 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
              title="Gradually blend between stereogram and depth map"
            />
          </div>

          <div className="h-5 w-px bg-slate-800" />

          {/* 3D Wigglegram Toggle */}
          <button
            onClick={() => setIsWiggleActive(!isWiggleActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              isWiggleActive
                ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/50 animate-pulse'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
            title="Motion parallax simulation: wiggles left and right eye perspective to reveal 3D depth instantly in motion!"
          >
            <Activity className="w-4 h-4 text-pink-300" />
            <span>3D Wigglegram {isWiggleActive ? 'ON' : 'OFF'}</span>
          </button>

          {isWiggleActive && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Speed</span>
              <input
                type="range"
                min="60"
                max="240"
                step="20"
                value={wiggleSpeed}
                onChange={(e) => setWiggleSpeed(parseInt(e.target.value))}
                className="w-16 cursor-pointer h-1 bg-slate-700 rounded-lg appearance-none"
                title="Adjust wiggle oscillation speed"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
