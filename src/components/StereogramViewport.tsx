import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  StereogramConfig,
  ShapeObject,
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
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('stereogram');
  const [peekAmount, setPeekAmount] = useState<number>(0); // 0 = 100% stereogram, 1 = 100% depth map
  const [isWiggleActive, setIsWiggleActive] = useState<boolean>(false);
  const [wiggleSpeed, setWiggleSpeed] = useState<number>(120); // ms per frame
  const [isHoldingPeek, setIsHoldingPeek] = useState<boolean>(false);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);

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
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Top Viewport Toolbar */}
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

        {/* Status Indicators */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Period: <strong className="text-slate-200">{config.patternPeriod}px</strong></span>
          </span>
          <span className="text-slate-600">•</span>
          <span>Max Disparity: <strong className="text-slate-200">{config.maxDisparity}px</strong></span>
        </div>
      </div>

      {/* Main Display Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
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
            className="w-full h-full object-contain rounded-xl shadow-2xl border border-slate-800"
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
