import React, { useState, useRef, useCallback } from 'react';
import {
  ShapeObject,
  ShapeType,
  StereogramConfig,
  PatternType,
} from './types/index.ts';
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
    return { mode: 'studio' as const, width: 800, height: 600, period: 100, disparity: 18, grain: 2, pattern: 'sand' as const };
  }
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') === 'labyrinth' ? ('labyrinth' as const) : ('studio' as const);
  const patternParam = params.get('pattern') as PatternType | null;
  const pattern: PatternType = patternParam || 'sand';
  const res = params.get('res');
  if (res === '4k') {
    return { mode, width: 3840, height: 2160, period: 180, disparity: mode === 'labyrinth' ? 15 : 24, grain: 3, pattern };
  } else if (res === '2k') {
    return { mode, width: 2560, height: 1440, period: 140, disparity: mode === 'labyrinth' ? 15 : 20, grain: 3, pattern };
  } else if (res === '1080p') {
    return { mode, width: 1920, height: 1080, period: 120, disparity: mode === 'labyrinth' ? 15 : 18, grain: 2, pattern };
  } else if (res === 'hd') {
    return { mode, width: 1200, height: 900, period: 100, disparity: mode === 'labyrinth' ? 15 : 16, grain: 2, pattern };
  }
  return { mode, width: 800, height: 600, period: 100, disparity: mode === 'labyrinth' ? 15 : 18, grain: 2, pattern };
};

const initialUrlState = getInitialUrlState();

export const App: React.FC = () => {
  const [appMode, setAppMode] = useState<'studio' | 'labyrinth'>(initialUrlState.mode);
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
  });

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: initialUrlState.width,
    height: initialUrlState.height,
  });
  const dimensionsRef = useRef<{ width: number; height: number }>(dimensions);
  dimensionsRef.current = dimensions;

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
      />

      {/* Main Mode View */}
      {appMode === 'studio' ? (
        <main className="flex-1 flex overflow-hidden">
          {/* Left Column: Shape Palette + Inspector */}
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
          />

          {/* Right Column: Optics, Disparity, Resolution & Engine Controls */}
          <SettingsPanel
            config={config}
            onChangeConfig={(upd) => setConfig((prev) => ({ ...prev, ...upd }))}
            canvasWidth={dimensions.width}
            canvasHeight={dimensions.height}
            onChangeResolution={handleChangeResolution}
          />
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
            onChangeResolution={handleChangeResolution}
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
