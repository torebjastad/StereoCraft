import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ShapeObject,
  ShapeType,
  StereogramConfig,
  PatternType,
  EaseOfView,
} from './types/index.ts';
import { getAutotuneOptics } from './core/stereogramEngine.ts';
import { Header } from './components/Header.tsx';
import { ShapePalette } from './components/ShapePalette.tsx';
import { ShapeInspector } from './components/ShapeInspector.tsx';
import { StereogramViewport } from './components/StereogramViewport.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { ViewingGuideModal } from './components/ViewingGuideModal.tsx';
import { LabyrinthGame } from './components/LabyrinthGame.tsx';

// Initial Demo Scene: A stunning 3D composition with distinct depth planes
const INITIAL_SHAPES: ShapeObject[] = [
  {
    id: 'shape-star-center',
    type: 'star',
    x: 400,
    y: 300,
    width: 200,
    height: 200,
    rotation: 0,
    depth: 0.9,
    profile: 'dome',
    starPoints: 5,
    innerRadiusRatio: 0.45,
  },
  {
    id: 'shape-circle-topleft',
    type: 'circle',
    x: 230,
    y: 190,
    width: 110,
    height: 110,
    rotation: 0,
    depth: 0.65,
    profile: 'dome',
  },
  {
    id: 'shape-square-topright',
    type: 'square',
    x: 570,
    y: 190,
    width: 90,
    height: 90,
    rotation: 45,
    depth: 0.55,
    profile: 'beveled',
  },
  {
    id: 'shape-triangle-bottom',
    type: 'triangle',
    x: 400,
    y: 470,
    width: 140,
    height: 120,
    rotation: 0,
    depth: 0.75,
    profile: 'pyramid',
  },
];

// Helper to scale shapes uniformly from reference 800x600 canvas to target dimensions
export function scalePresetShape(
  s: ShapeObject,
  targetWidth: number,
  targetHeight: number,
  refWidth = 800,
  refHeight = 600
): ShapeObject {
  const scale = Math.min(targetWidth / refWidth, targetHeight / refHeight);
  const cx = targetWidth / 2;
  const cy = targetHeight / 2;
  const refCx = refWidth / 2;
  const refCy = refHeight / 2;

  const dx = s.x - refCx;
  const dy = s.y - refCy;

  return {
    ...s,
    x: Math.round(cx + dx * scale),
    y: Math.round(cy + dy * scale),
    width: Math.max(10, Math.round(s.width * scale)),
    height: Math.max(10, Math.round(s.height * scale)),
    cornerRadius: s.cornerRadius ? Math.max(2, Math.round(s.cornerRadius * scale)) : undefined,
  };
}

export function scaleShapesForResolutionChange(
  shapes: ShapeObject[],
  prevWidth: number,
  prevHeight: number,
  newWidth: number,
  newHeight: number
): ShapeObject[] {
  if (prevWidth === newWidth && prevHeight === newHeight) return shapes;
  return shapes.map((s) => scalePresetShape(s, newWidth, newHeight, prevWidth, prevHeight));
}

const getInitialUrlState = () => {
  if (typeof window === 'undefined') {
    return {
      mode: 'studio' as const,
      width: 1200,
      height: 900,
      period: 95,
      disparity: 18,
      grain: 2,
      pattern: 'sand' as const,
      isAutoFit: true,
      easeOfView: 'easy' as const,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') === 'labyrinth' ? ('labyrinth' as const) : ('studio' as const);
  const patternParam = params.get('pattern') as PatternType | null;
  const pattern: PatternType = patternParam || 'sand';
  const easeParam = params.get('ease') as EaseOfView | null;
  const easeOfView: EaseOfView =
    easeParam === 'easy' || easeParam === 'medium' || easeParam === 'hard' ? easeParam : 'easy';
  const res = params.get('res');
  if (res === '4k') {
    const optics = getAutotuneOptics(3840, easeOfView);
    return { mode, width: 3840, height: 2160, period: optics.patternPeriod, disparity: mode === 'labyrinth' ? 15 : optics.maxDisparity, grain: 3, pattern, isAutoFit: false, easeOfView };
  } else if (res === '2k') {
    const optics = getAutotuneOptics(2560, easeOfView);
    return { mode, width: 2560, height: 1440, period: optics.patternPeriod, disparity: mode === 'labyrinth' ? 15 : optics.maxDisparity, grain: 3, pattern, isAutoFit: false, easeOfView };
  } else if (res === '1080p') {
    const optics = getAutotuneOptics(1920, easeOfView);
    return { mode, width: 1920, height: 1080, period: optics.patternPeriod, disparity: mode === 'labyrinth' ? 15 : optics.maxDisparity, grain: 2, pattern, isAutoFit: false, easeOfView };
  } else if (res === 'hd') {
    const optics = getAutotuneOptics(1200, easeOfView);
    return { mode, width: 1200, height: 900, period: optics.patternPeriod, disparity: mode === 'labyrinth' ? 15 : optics.maxDisparity, grain: 2, pattern, isAutoFit: false, easeOfView };
  } else if (res === '800x600') {
    const optics = getAutotuneOptics(800, easeOfView);
    return { mode, width: 800, height: 600, period: optics.patternPeriod, disparity: mode === 'labyrinth' ? 15 : optics.maxDisparity, grain: 2, pattern, isAutoFit: false, easeOfView };
  }

  // Default: Fit available area!
  const leftW = 320;
  const rightW = 288;
  const topH = 64 + 48;
  const paddingX = 32;
  const paddingY = 56;
  const availW = Math.max(480, Math.floor((window.innerWidth - leftW - rightW - paddingX) / 10) * 10);
  const availH = Math.max(360, Math.floor((window.innerHeight - topH - paddingY) / 10) * 10);
  const optics = getAutotuneOptics(availW, easeOfView);

  return {
    mode,
    width: availW,
    height: availH,
    period: mode === 'labyrinth' ? 100 : optics.patternPeriod,
    disparity: mode === 'labyrinth' ? 15 : optics.maxDisparity,
    grain: 2,
    pattern,
    isAutoFit: true,
    easeOfView,
  };
};

const initialUrlState = getInitialUrlState();

export const App: React.FC = () => {
  const [appMode, setAppMode] = useState<'studio' | 'labyrinth'>(initialUrlState.mode);
  const [easeOfView, setEaseOfView] = useState<EaseOfView>(initialUrlState.easeOfView);
  const [shapes, setShapes] = useState<ShapeObject[]>(() => {
    if (initialUrlState.width === 800 && initialUrlState.height === 600) {
      return INITIAL_SHAPES;
    }
    return INITIAL_SHAPES.map((s) =>
      scalePresetShape(s, initialUrlState.width, initialUrlState.height)
    );
  });
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>('shape-star-center');

  // Optimal stereogram default configuration based on perceptual research
  const [config, setConfig] = useState<StereogramConfig>({
    patternType: initialUrlState.pattern,
    patternPeriod: initialUrlState.period,
    maxDisparity: initialUrlState.disparity,
    viewingMode: 'parallel',
    enableOcclusionRemoval: true,
    smoothingRadius: 1, // subtle anti-aliasing to prevent edge rivalry
    grainSize: initialUrlState.grain,
    showGuideDots: true,
    guideDotColor: '#6366f1',
    customImageData: null,
    easeOfView: initialUrlState.easeOfView,
  });

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: initialUrlState.width,
    height: initialUrlState.height,
  });
  const dimensionsRef = useRef<{ width: number; height: number }>(dimensions);
  dimensionsRef.current = dimensions;

  const [isStudioFullscreen, setIsStudioFullscreen] = useState<boolean>(false);
  const [isAutoFit, setIsAutoFit] = useState<boolean>(initialUrlState.isAutoFit);
  const savedDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const studioContainerRef = useRef<HTMLDivElement>(null);

  // Scale shapes uniformly when changing resolution to preserve 1:1 aspect ratio and centering
  // Decoupled from setDimensions updater to prevent React StrictMode double-transform side effects
  const handleChangeResolution = useCallback((newWidth: number, newHeight: number) => {
    const prevW = dimensionsRef.current.width;
    const prevH = dimensionsRef.current.height;

    if (prevW === newWidth && prevH === newHeight) return;

    dimensionsRef.current = { width: newWidth, height: newHeight };
    setDimensions({ width: newWidth, height: newHeight });

    setShapes((prevShapes) =>
      scaleShapesForResolutionChange(prevShapes, prevW, prevH, newWidth, newHeight)
    );
  }, []);

  const handleChangeFixedResolution = useCallback(
    (newWidth: number, newHeight: number) => {
      setIsAutoFit(false);
      handleChangeResolution(newWidth, newHeight);
    },
    [handleChangeResolution]
  );

  const handleSelectEaseOfView = useCallback(
    (newEase: EaseOfView) => {
      setEaseOfView(newEase);
      const optics = getAutotuneOptics(dimensionsRef.current.width, newEase);
      setConfig((prev) => ({
        ...prev,
        easeOfView: newEase,
        patternPeriod: appMode === 'labyrinth' ? 100 : optics.patternPeriod,
        maxDisparity: appMode === 'labyrinth' ? 15 : optics.maxDisparity,
      }));
    },
    [appMode]
  );

  // Computes the maximum available viewport area for the stereogram based on screen & GUI margins
  const calculateAvailableArea = useCallback(() => {
    if (typeof window === 'undefined') return { width: 1200, height: 900 };
    if (isStudioFullscreen || Boolean(document.fullscreenElement)) {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    // Studio windowed layout: Left sidebar 320px (w-80), Right sidebar 288px (w-72), Header 64px, Viewport tab bar 48px, Padding 32px + 56px bottom toolbar
    const leftW = 320;
    const rightW = 288;
    const topH = 64 + 48;
    const paddingX = 32;
    const paddingY = 56;
    const availW = Math.max(480, Math.floor((window.innerWidth - leftW - rightW - paddingX) / 10) * 10);
    const availH = Math.max(360, Math.floor((window.innerHeight - topH - paddingY) / 10) * 10);
    return { width: availW, height: availH };
  }, [isStudioFullscreen]);

  const [availableArea, setAvailableArea] = useState<{ width: number; height: number }>(calculateAvailableArea);

  // Fits stereogram to 100% of available display area and optimizes optics
  const handleFitToViewport = useCallback(
    (targetWidth?: number, targetHeight?: number) => {
      setIsAutoFit(true);
      const area = calculateAvailableArea();
      const finalW = targetWidth ?? area.width;
      const finalH = targetHeight ?? area.height;

      handleChangeResolution(finalW, finalH);

      // Auto-tune period and disparity to optimal eye-divergence using active easeOfView, NEVER touching grainSize
      const optics = getAutotuneOptics(finalW, easeOfView);
      setConfig((prev) => ({
        ...prev,
        patternPeriod: appMode === 'labyrinth' ? 100 : optics.patternPeriod,
        maxDisparity: appMode === 'labyrinth' ? 15 : optics.maxDisparity,
      }));
    },
    [calculateAvailableArea, handleChangeResolution, easeOfView, appMode]
  );

  // Studio Fullscreen toggle
  const toggleStudioFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && !isStudioFullscreen) {
        savedDimensionsRef.current = { ...dimensionsRef.current };
        if (studioContainerRef.current?.requestFullscreen) {
          await studioContainerRef.current.requestFullscreen();
        }
        setIsStudioFullscreen(true);
        const fullW = window.innerWidth;
        const fullH = window.innerHeight;
        handleChangeResolution(fullW, fullH);

        // Optimize optics for fullscreen width using active easeOfView, WITHOUT altering grainSize
        const optics = getAutotuneOptics(fullW, easeOfView);
        setConfig((prev) => ({
          ...prev,
          patternPeriod: optics.patternPeriod,
          maxDisparity: optics.maxDisparity,
        }));
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsStudioFullscreen(false);
        if (savedDimensionsRef.current) {
          handleChangeResolution(
            savedDimensionsRef.current.width,
            savedDimensionsRef.current.height
          );
          const optics = getAutotuneOptics(savedDimensionsRef.current.width, easeOfView);
          setConfig((prev) => ({
            ...prev,
            patternPeriod: optics.patternPeriod,
            maxDisparity: optics.maxDisparity,
          }));
        }
      }
    } catch {
      setIsStudioFullscreen((prev) => !prev);
    }
  }, [isStudioFullscreen, handleChangeResolution, easeOfView]);

  // Sync with document fullscreenchange events (e.g. user pressing Esc)
  useEffect(() => {
    const onFullscreenChange = () => {
      const isDocFs = Boolean(document.fullscreenElement);
      if (!isDocFs && isStudioFullscreen) {
        setIsStudioFullscreen(false);
        if (savedDimensionsRef.current) {
          handleChangeResolution(
            savedDimensionsRef.current.width,
            savedDimensionsRef.current.height
          );
          const optics = getAutotuneOptics(savedDimensionsRef.current.width, easeOfView);
          setConfig((prev) => ({
            ...prev,
            patternPeriod: optics.patternPeriod,
            maxDisparity: optics.maxDisparity,
          }));
        }
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isStudioFullscreen, handleChangeResolution, easeOfView]);

  // Track window resizing and re-adapt when in Auto-Fit mode
  useEffect(() => {
    let timer: number | null = null;
    const onResize = () => {
      const area = calculateAvailableArea();
      setAvailableArea(area);
      if (isAutoFit && !isStudioFullscreen) {
        if (timer) clearTimeout(timer);
        timer = window.setTimeout(() => {
          handleFitToViewport();
        }, 150);
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timer) clearTimeout(timer);
    };
  }, [isAutoFit, isStudioFullscreen, calculateAvailableArea, handleFitToViewport]);

  // Hotkey 'F' to toggle fullscreen in Studio mode
  useEffect(() => {
    if (appMode !== 'studio') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleStudioFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appMode, toggleStudioFullscreen]);

  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Canvas references for image export
  const stereogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Selected shape accessor
  const selectedShape = shapes.find((s) => s.id === selectedShapeId) || null;

  // Add Shape scaled to canvas resolution
  const handleAddShape = (type: ShapeType) => {
    const scale = Math.min(dimensions.width / 800, dimensions.height / 600);
    const id = `shape-${type}-${Date.now()}`;
    const baseSize = Math.max(20, Math.round(120 * scale));
    const newShape: ShapeObject = {
      id,
      type,
      x: Math.round(dimensions.width / 2 + (Math.random() * 60 - 30) * scale),
      y: Math.round(dimensions.height / 2 + (Math.random() * 60 - 30) * scale),
      width: baseSize,
      height: baseSize,
      rotation: 0,
      depth: 0.7,
      profile: 'dome',
      starPoints: 5,
      innerRadiusRatio: 0.45,
    };
    setShapes((prev) => [...prev, newShape]);
    setSelectedShapeId(id);
  };

  // Update selected shape
  const handleUpdateSelectedShape = (updated: Partial<ShapeObject>) => {
    if (!selectedShapeId) return;
    setShapes((prev) =>
      prev.map((s) => (s.id === selectedShapeId ? { ...s, ...updated } : s))
    );
  };

  // Update shape by ID (from stage drag)
  const handleUpdateShapeById = useCallback((id: string, updated: Partial<ShapeObject>) => {
    setShapes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updated } : s))
    );
  }, []);

  // Duplicate shape
  const handleDuplicateShape = () => {
    if (!selectedShape) return;
    const newId = `shape-${selectedShape.type}-${Date.now()}`;
    const dup: ShapeObject = {
      ...selectedShape,
      id: newId,
      x: selectedShape.x + 30,
      y: selectedShape.y + 30,
    };
    setShapes((prev) => [...prev, dup]);
    setSelectedShapeId(newId);
  };

  // Delete shape
  const handleDeleteShape = () => {
    if (!selectedShapeId) return;
    setShapes((prev) => prev.filter((s) => s.id !== selectedShapeId));
    setSelectedShapeId(null);
  };

  // Move layer up / down
  const handleMoveLayer = (direction: 'up' | 'down') => {
    if (!selectedShapeId) return;
    setShapes((prev) => {
      const idx = prev.findIndex((s) => s.id === selectedShapeId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  };

  // Clear all
  const handleClearAll = () => {
    setShapes([]);
    setSelectedShapeId(null);
  };

  // Load Presets scaled to current canvas resolution
  const handleLoadPreset = (presetName: string) => {
    let presetShapes: ShapeObject[] = [];
    let selectedId = '';

    switch (presetName) {
      case 'constellation':
        presetShapes = [
          {
            id: 'st-c',
            type: 'star',
            x: 400,
            y: 300,
            width: 220,
            height: 220,
            rotation: 0,
            depth: 0.95,
            profile: 'dome',
            starPoints: 5,
            innerRadiusRatio: 0.45,
          },
          {
            id: 'st-1',
            type: 'circle',
            x: 200,
            y: 190,
            width: 80,
            height: 80,
            rotation: 0,
            depth: 0.6,
            profile: 'dome',
          },
          {
            id: 'st-2',
            type: 'square',
            x: 600,
            y: 190,
            width: 70,
            height: 70,
            rotation: 45,
            depth: 0.5,
            profile: 'beveled',
          },
          {
            id: 'st-3',
            type: 'triangle',
            x: 400,
            y: 480,
            width: 100,
            height: 90,
            rotation: 0,
            depth: 0.7,
            profile: 'pyramid',
          },
        ];
        selectedId = 'st-c';
        break;

      case 'pyramid':
        presetShapes = [
          {
            id: 'pyr-base',
            type: 'square',
            x: 400,
            y: 300,
            width: 320,
            height: 320,
            rotation: 0,
            depth: 0.4,
            profile: 'flat',
            cornerRadius: 12,
          },
          {
            id: 'pyr-mid',
            type: 'square',
            x: 400,
            y: 300,
            width: 220,
            height: 220,
            rotation: 0,
            depth: 0.65,
            profile: 'flat',
            cornerRadius: 8,
          },
          {
            id: 'pyr-top',
            type: 'square',
            x: 400,
            y: 300,
            width: 120,
            height: 120,
            rotation: 0,
            depth: 0.9,
            profile: 'pyramid',
            cornerRadius: 4,
          },
        ];
        selectedId = 'pyr-top';
        break;

      case 'geometric':
        presetShapes = [
          {
            id: 'g-circ',
            type: 'circle',
            x: 220,
            y: 300,
            width: 130,
            height: 130,
            rotation: 0,
            depth: 0.9,
            profile: 'dome',
          },
          {
            id: 'g-sq',
            type: 'square',
            x: 340,
            y: 300,
            width: 110,
            height: 110,
            rotation: 0,
            depth: 0.7,
            profile: 'beveled',
          },
          {
            id: 'g-tri',
            type: 'triangle',
            x: 460,
            y: 300,
            width: 120,
            height: 110,
            rotation: 0,
            depth: 0.5,
            profile: 'pyramid',
          },
          {
            id: 'g-star',
            type: 'star',
            x: 580,
            y: 300,
            width: 130,
            height: 130,
            rotation: 0,
            depth: 0.85,
            profile: 'dome',
            starPoints: 6,
          },
        ];
        selectedId = 'g-star';
        break;

      case 'target':
        presetShapes = [
          {
            id: 't-outer',
            type: 'circle',
            x: 400,
            y: 300,
            width: 320,
            height: 320,
            rotation: 0,
            depth: 0.35,
            profile: 'flat',
          },
          {
            id: 't-mid',
            type: 'circle',
            x: 400,
            y: 300,
            width: 220,
            height: 220,
            rotation: 0,
            depth: 0.65,
            profile: 'dome',
          },
          {
            id: 't-inner',
            type: 'circle',
            x: 400,
            y: 300,
            width: 100,
            height: 100,
            rotation: 0,
            depth: 1.0,
            profile: 'dome',
          },
        ];
        selectedId = 't-inner';
        break;
    }

    if (presetShapes.length > 0) {
      const scaled = presetShapes.map((s) =>
        scalePresetShape(s, dimensions.width, dimensions.height)
      );
      setShapes(scaled);
      setSelectedShapeId(selectedId);
    }
  };

  // Export handlers
  const handleExportStereogram = () => {
    const canvas = stereogramCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `stereogram-${config.patternType}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleExportDepth = () => {
    const canvas = depthCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `stereogram-depthmap-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Header */}
      <Header
        appMode={appMode}
        onToggleAppMode={(mode) => {
          setAppMode(mode);
          if (mode === 'labyrinth') {
            setConfig((prev) => ({
              ...prev,
              patternPeriod: 100,
              maxDisparity: 15,
            }));
          }
        }}
        viewingMode={config.viewingMode}
        onToggleViewingMode={(mode) => setConfig((prev) => ({ ...prev, viewingMode: mode }))}
        onOpenGuide={() => setIsGuideOpen(true)}
        onExport={handleExportStereogram}
        onExportDepth={handleExportDepth}
        onLoadPreset={handleLoadPreset}
        onToggleFullscreen={appMode === 'studio' ? toggleStudioFullscreen : undefined}
        isFullscreen={isStudioFullscreen}
      />

      {/* Main Mode View */}
      {appMode === 'studio' ? (
        <main ref={studioContainerRef} className="flex-1 flex overflow-hidden relative">
          {/* Left Column: Shape Palette + Inspector */}
          {!isStudioFullscreen && (
            <aside className="w-80 border-r border-slate-800/80 bg-slate-900/50 backdrop-blur-md p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
              <ShapePalette
                onAddShape={handleAddShape}
                onClearAll={handleClearAll}
                shapeCount={shapes.length}
              />

              {/* Layers List */}
              {shapes.length > 0 && (
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Layers ({shapes.length})
                  </span>
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                    {shapes.map((s, idx) => {
                      const isSel = s.id === selectedShapeId;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedShapeId(s.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between transition ${
                            isSel
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="capitalize">
                            {idx + 1}. {s.type}
                          </span>
                          <span className="font-mono text-[10px] opacity-80">
                            Z: {Math.round(s.depth * 100)}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shape Inspector */}
              <ShapeInspector
                selectedShape={selectedShape}
                onUpdateShape={handleUpdateSelectedShape}
                onDuplicateShape={handleDuplicateShape}
                onDeleteShape={handleDeleteShape}
                onMoveLayer={handleMoveLayer}
              />
            </aside>
          )}

          {/* Center: Stereogram Viewport */}
          <StereogramViewport
            shapes={shapes}
            config={config}
            canvasWidth={dimensions.width}
            canvasHeight={dimensions.height}
            selectedShapeId={selectedShapeId}
            onSelectShape={setSelectedShapeId}
            onUpdateShape={handleUpdateShapeById}
            onStereogramRendered={(canvas) => {
              stereogramCanvasRef.current = canvas;
            }}
            onDepthRendered={(canvas) => {
              depthCanvasRef.current = canvas;
            }}
            isFullscreen={isStudioFullscreen}
            onToggleFullscreen={toggleStudioFullscreen}
            onFitToViewport={handleFitToViewport}
            isAutoFit={isAutoFit}
            onChangeConfig={(upd) => setConfig((prev) => ({ ...prev, ...upd }))}
            easeOfView={easeOfView}
            onSelectEaseOfView={handleSelectEaseOfView}
          />

          {/* Right Column: Optics, Disparity, Resolution & Engine Controls */}
          {!isStudioFullscreen && (
            <SettingsPanel
              config={config}
              onChangeConfig={(upd) => setConfig((prev) => ({ ...prev, ...upd }))}
              canvasWidth={dimensions.width}
              canvasHeight={dimensions.height}
              onChangeResolution={handleChangeFixedResolution}
              onFitToViewport={() => handleFitToViewport()}
              isAutoFit={isAutoFit}
              availableArea={availableArea}
              easeOfView={easeOfView}
              onSelectEaseOfView={handleSelectEaseOfView}
            />
          )}
        </main>
      ) : (
        /* Labyrinth Game Mode */
        <main className="flex-1 flex overflow-hidden">
          <LabyrinthGame
            config={config}
            canvasWidth={dimensions.width}
            canvasHeight={dimensions.height}
            onChangeConfig={(upd) => setConfig((prev) => ({ ...prev, ...upd }))}
          />
          {/* Compact Settings Panel on the side */}
          <SettingsPanel
            config={config}
            onChangeConfig={(upd) => setConfig((prev) => ({ ...prev, ...upd }))}
            canvasWidth={dimensions.width}
            canvasHeight={dimensions.height}
            onChangeResolution={handleChangeFixedResolution}
            easeOfView={easeOfView}
            onSelectEaseOfView={handleSelectEaseOfView}
          />
        </main>
      )}

      {/* Viewing Guide Modal */}
      <ViewingGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onSwitchMode={(mode) => setConfig((prev) => ({ ...prev, viewingMode: mode }))}
      />
    </div>
  );
};

export default App;
