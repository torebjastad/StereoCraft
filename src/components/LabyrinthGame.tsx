import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  generateMaze,
  MazeGrid,
} from '../core/mazeGenerator.ts';
import {
  getLabyrinthBounds,
  renderBaseMazeDepth,
  stepBallPhysics,
  renderPlayerShapeDepth,
  erasePlayerShapeDepth,
  calculatePlayerDotSeparation,
  renderLabyrinthStereoRows,
  generateLabyrinthStereogram,
  PlayerShapeType,
  BallState,
  LabyrinthBounds,
} from '../core/labyrinthRenderer.ts';
import {
  createImageDataHelper,
  getAutotuneOptics,
  getDefaultGrainForPattern,
} from '../core/stereogramEngine.ts';
import {
  renderTextDepth,
  measureTextWidth,
} from '../core/textDepthRenderer.ts';
import { StereogramConfig, PatternType, EaseOfView } from '../types/index.ts';
import {
  Play,
  RotateCcw,
  Trophy,
  Clock,
  Eye,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Maximize,
  Minimize,
  Download,
  Printer,
  Sliders,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LabyrinthGameProps {
  config: StereogramConfig;
  canvasWidth?: number;
  canvasHeight?: number;
  onChangeConfig?: (updated: Partial<StereogramConfig>) => void;
  easeOfView?: EaseOfView;
  onSelectEaseOfView?: (ease: EaseOfView) => void;
  onStereogramRendered?: (canvas: HTMLCanvasElement) => void;
  onExport?: () => void;
  onPrint?: () => void;
}

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_SETTINGS: Record<Difficulty, { cols: number; rows: number; label: string }> = {
  easy: { cols: 7, rows: 5, label: 'Easy (7×5)' },
  medium: { cols: 11, rows: 8, label: 'Medium (11×8)' },
  hard: { cols: 15, rows: 11, label: 'Hard (15×11)' },
};

export const LABYRINTH_TEXTURE_PROGRESSION: PatternType[] = [
  'sand',
  'emerald-moss',
  'ocean-trench',
  'volcanic-magma',
  'cosmic',
  'marble-vein',
  'organic-flow',
];

const PATTERNS: { id: PatternType; label: string; icon: string }[] = [
  { id: 'sand', label: 'Sand', icon: '🏜️' },
  { id: 'emerald-moss', label: 'Moss', icon: '🌲' },
  { id: 'ocean-trench', label: 'Ocean', icon: '🌊' },
  { id: 'volcanic-magma', label: 'Magma', icon: '🌋' },
  { id: 'cosmic', label: 'Cosmic', icon: '🌌' },
  { id: 'marble-vein', label: 'Marble', icon: '🏛️' },
  { id: 'organic-flow', label: 'Flow', icon: '🧬' },
  { id: 'retro-90s', label: 'Retro', icon: '🎨' },
  { id: 'color-noise', label: 'Noise', icon: '✨' },
];

// Format stopwatch string: "00:14.2"
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  const padMins = mins.toString().padStart(2, '0');
  const padSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
  return `${padMins}:${padSecs}`;
};

export const LabyrinthGame: React.FC<LabyrinthGameProps> = ({
  config,
  canvasWidth = 800,
  canvasHeight = 600,
  onChangeConfig,
  easeOfView = 'easy',
  onSelectEaseOfView,
  onStereogramRendered,
  onExport,
  onPrint,
}) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won'>('idle');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isPeeking, setIsPeeking] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('fullscreen') === 'true' || params.get('fs') === '1';
  });
  const [labyrinthMode, setLabyrinthMode] = useState<'classic' | 'inverted'>(() => {
    if (typeof window === 'undefined') return 'classic';
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'inverted' || params.get('type') === 'inverted' ? 'inverted' : 'classic';
  });
  const [fallNotice, setFallNotice] = useState<boolean>(false);
  const fallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidden Player Debug Panel (toggle via ` or Shift+D or HUD button)
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);
  const [playerDebug, setPlayerDebug] = useState<{
    shape: PlayerShapeType;
    sizeMultiplier: number;
    depth: number;
    baseZ: number;
    bevelRatio: number;
    dualDotMode: 'overlay' | 'depth' | 'both';
    dualDotColor: string;
    dualDotRadius: number;
    dotOffsetX?: number; // Optional user offset; defaults to -Half period (-S/2) for exact ridge alignment
  }>({
    shape: 'dual-dots',
    sizeMultiplier: 1.0,
    depth: 0.98,
    baseZ: 0.50,
    bevelRatio: 0.35,
    dualDotMode: 'overlay',
    dualDotColor: '#ffffff',
    dualDotRadius: 5,
  });

  const playerDebugRef = useRef(playerDebug);
  useEffect(() => {
    playerDebugRef.current = playerDebug;
  }, [playerDebug]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const timerStartRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  // Measure screen resolution for fullscreen mode
  const [fullscreenDimensions, setFullscreenDimensions] = useState<{ width: number; height: number }>(() => {
    if (typeof window === 'undefined') return { width: 1920, height: 1080 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.min(3840, Math.max(1200, Math.round(window.innerWidth * dpr)));
    const h = Math.min(2160, Math.max(800, Math.round(window.innerHeight * dpr)));
    return { width: w, height: h };
  });

  // Track screen size changes during fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.min(3840, Math.max(1200, Math.round(window.innerWidth * dpr)));
      const h = Math.min(2160, Math.max(800, Math.round(window.innerHeight * dpr)));
      setFullscreenDimensions({ width: w, height: h });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && !isFullscreen) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      // Fallback to CSS fullscreen
      setIsFullscreen((prev) => !prev);
    }
  }, [isFullscreen]);

  // Sync with document fullscreenchange events (e.g. user presses Esc)
  useEffect(() => {
    const onFullscreenChange = () => {
      const isDocFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isDocFs);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  const activeWidth = isFullscreen ? fullscreenDimensions.width : canvasWidth;
  const activeHeight = isFullscreen ? fullscreenDimensions.height : canvasHeight;

  // Auto-tune pattern period & disparity (Default: 100px period, 15px maxDisparity for labyrinth in easy mode)
  const activeConfig = useMemo(() => {
    const optics = getAutotuneOptics(activeWidth, easeOfView, 'labyrinth');
    const period = isFullscreen ? optics.patternPeriod : (config.patternPeriod ?? optics.patternPeriod);
    const disparity = isFullscreen ? optics.maxDisparity : (config.maxDisparity ?? optics.maxDisparity);
    return {
      ...config,
      patternPeriod: period,
      maxDisparity: disparity,
      grainSize: config.grainSize ?? 2,
    };
  }, [config, isFullscreen, activeWidth, easeOfView]);

  // High-performance dirty-scanline stereogram buffers
  const depthBufferRef = useRef<Float32Array | null>(null);
  const cleanMazeDepthRef = useRef<Float32Array | null>(null);
  const activeImageDataRef = useRef<ImageData | null>(null);
  const prevBallPosRef = useRef<{ x: number; y: number; radius: number; size?: number } | null>(null);
  const prevTextSecRef = useRef<number>(-1);

  // Generate Maze
  const [maze, setMaze] = useState<MazeGrid>(() => {
    const { cols, rows } = DIFFICULTY_SETTINGS['easy'];
    return generateMaze(cols, rows);
  });

  // Calculate layout bounds with isFullscreen option
  const bounds: LabyrinthBounds = useMemo(() => {
    return getLabyrinthBounds(maze, activeWidth, activeHeight, { isFullscreen });
  }, [maze, activeWidth, activeHeight, isFullscreen]);

  // Floating Square / Cube initial state
  const initialBall: BallState = useMemo(() => {
    const startX = bounds.x + bounds.cellW / 2;
    const startY = bounds.y + bounds.cellH / 2;
    const squareSize = labyrinthMode === 'inverted'
      ? Math.max(16, Math.round(bounds.gap * 1.35))
      : bounds.gap;
    const radius = Math.max(3, Math.floor((labyrinthMode === 'inverted' ? bounds.gap : squareSize) * 0.44));
    return {
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      radius,
      size: squareSize,
    };
  }, [bounds, labyrinthMode]);

  const ballRef = useRef<BallState>(initialBall);

  // Reset ball reference when maze or bounds change
  useEffect(() => {
    ballRef.current = initialBall;
    prevBallPosRef.current = { ...initialBall };
  }, [initialBall]);

  // Load Best Time from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`stereogram_labyrinth_best_${difficulty}`);
    if (saved) {
      setBestTime(parseFloat(saved));
    } else {
      setBestTime(null);
    }
  }, [difficulty]);

  const [level, setLevel] = useState<number>(1);

  // Start new maze level (advances texture and maze geometry)
  const handleStartNewMaze = (newDiff: Difficulty = difficulty, isNextLevel: boolean = true) => {
    const nextLvl = isNextLevel ? level + 1 : level;
    if (isNextLevel) {
      setLevel(nextLvl);
      const nextPattern = LABYRINTH_TEXTURE_PROGRESSION[(nextLvl - 1) % LABYRINTH_TEXTURE_PROGRESSION.length];
      onChangeConfig?.({
        patternType: nextPattern,
        grainSize: getDefaultGrainForPattern(nextPattern),
      });
    }
    const { cols, rows } = DIFFICULTY_SETTINGS[newDiff];
    const newMaze = generateMaze(cols, rows);
    setMaze(newMaze);
    setGameState('idle');
    setElapsedTime(0);
    prevTextSecRef.current = -1;
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = '00:00.0';
    }
  };

  // Start / Restart game
  const handleStartGame = () => {
    ballRef.current = initialBall;
    prevBallPosRef.current = { ...initialBall };
    setElapsedTime(0);
    prevTextSecRef.current = 0;
    timerStartRef.current = performance.now();
    setGameState('playing');
  };

  // Keyboard Event Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling on arrow keys and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ' || e.key === 'Spacebar') {
        setIsPeeking(true);
      }

      // 'F' or 'f' toggles Fullscreen
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleFullscreen();
      }

      // Escape exits fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }

      // Hidden Debug Panel Toggle: ` (backtick / tilde) or Shift+D
      if (
        (e.key === '`' || e.key === '~' || (e.key === 'D' && e.shiftKey)) &&
        !['input', 'textarea'].includes((document.activeElement?.tagName || '').toLowerCase())
      ) {
        e.preventDefault();
        setShowDebugPanel((prev) => !prev);
      }

      keysPressed.current[e.key.toLowerCase()] = true;
      keysPressed.current[e.key] = true;

      // Auto start on movement if idle
      if (gameState === 'idle' && ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        handleStartGame();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        setIsPeeking(false);
      }
      keysPressed.current[e.key.toLowerCase()] = false;
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameState, initialBall, isFullscreen, toggleFullscreen]);

  // Peeking Helper
  const renderFullPeeking = (
    ctx: CanvasRenderingContext2D,
    activeImg: ImageData,
    depth: Float32Array,
    width: number,
    height: number
  ) => {
    const blended = createImageDataHelper(width, height);
    const bData = blended.data;
    const sData = activeImg.data;
    for (let i = 0; i < depth.length; i++) {
      const z = depth[i];
      const p = i * 4;
      const dzR = Math.round(z * 99);
      const dzG = Math.round(z * 102);
      const dzB = Math.round(z * 241);
      bData[p] = Math.round(sData[p] * 0.25 + dzR * 0.75);
      bData[p + 1] = Math.round(sData[p + 1] * 0.25 + dzG * 0.75);
      bData[p + 2] = Math.round(sData[p + 2] * 0.25 + dzB * 0.75);
      bData[p + 3] = 255;
    }
    ctx.putImageData(blended, 0, 0);

    // Draw exit goal marker in radar peek mode
    ctx.save();
    const cellDim = Math.min(bounds.cellW, bounds.cellH);
    const goalCenterY = bounds.y + maze.goalY * bounds.cellH + bounds.cellH / 2;

    if (labyrinthMode === 'inverted') {
      // Inverted mode: Landing platform marker outside the maze
      const bridgeLen = Math.max(16, Math.floor(bounds.cellW * 0.85));
      const platformDim = Math.max(20, Math.floor(cellDim * 1.15));
      const platformCenterX = Math.min(activeWidth - platformDim / 2 - 4, bounds.x + bounds.width + bridgeLen + platformDim / 2);

      // Glowing Landing Platform Pad
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.fillRect(platformCenterX - platformDim / 2, goalCenterY - platformDim / 2, platformDim, platformDim);
      ctx.strokeRect(platformCenterX - platformDim / 2, goalCenterY - platformDim / 2, platformDim, platformDim);

      // Target ring
      ctx.beginPath();
      ctx.arc(platformCenterX, goalCenterY, platformDim * 0.3, 0, Math.PI * 2);
      ctx.strokeStyle = '#ecfdf5';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Classic mode: Outer wall exit gateway opening
      const exitX = bounds.x + bounds.width;
      const exitDoorH = bounds.cellH * 0.85;

      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;

      // Illuminated gateway arch
      ctx.strokeRect(exitX - 4, goalCenterY - exitDoorH / 2, 16, exitDoorH);
      ctx.fillRect(exitX - 4, goalCenterY - exitDoorH / 2, 16, exitDoorH);

      // Arrow pointing out of the maze
      ctx.beginPath();
      ctx.moveTo(exitX - 2, goalCenterY);
      ctx.lineTo(exitX + 18, goalCenterY);
      ctx.lineTo(exitX + 10, goalCenterY - 6);
      ctx.moveTo(exitX + 18, goalCenterY);
      ctx.lineTo(exitX + 10, goalCenterY + 6);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  };

  // Helper to draw dual dots on 2D canvas overlay
  const drawDualDotsOverlay = useCallback((ctx: CanvasRenderingContext2D, px: number, py: number) => {
    const period = activeConfig.patternPeriod || 100;
    const dispFraction = (activeConfig.maxDisparity ?? 15) / period;
    const pD = playerDebugRef.current;
    const sep = calculatePlayerDotSeparation(period, pD.depth, dispFraction, 'parallel');
    const halfSep = Math.round(sep / 2);
    const radius = pD.dualDotRadius;
    const color = pD.dualDotColor;
    // Default calibration offset: -Half Period (-S/2) locks the fused 3D dot directly over the ridge
    const defaultOffset = -Math.round(period / 2);
    const offset = pD.dotOffsetX !== undefined ? pD.dotOffsetX : defaultOffset;
    const cx = px + offset;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;

    // Left Dot
    ctx.beginPath();
    ctx.arc(cx - halfSep, py, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right Dot
    ctx.beginPath();
    ctx.arc(cx + halfSep, py, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }, [activeConfig.patternPeriod, activeConfig.maxDisparity]);

  // Helper to cleanly restore stereogram background beneath previous dual dots (zero smearing)
  const clearPreviousDotsOverlay = useCallback((ctx: CanvasRenderingContext2D, activeImg: ImageData, px: number, py: number) => {
    const period = activeConfig.patternPeriod || 100;
    const dispFraction = (activeConfig.maxDisparity ?? 15) / period;
    const pD = playerDebugRef.current;
    const sep = calculatePlayerDotSeparation(period, pD.depth, dispFraction, 'parallel');
    const halfSep = Math.round(sep / 2);
    const defaultOffset = -Math.round(period / 2);
    const offset = pD.dotOffsetX !== undefined ? pD.dotOffsetX : defaultOffset;
    const cx = px + offset;
    // Large padding covering the dot radius (up to 14px), shadow glow (10px) + safety margin
    const clearPad = pD.dualDotRadius + 18;

    const clearRegion = (dotX: number, dotY: number) => {
      const sx = Math.max(0, Math.floor(dotX - clearPad));
      const sy = Math.max(0, Math.floor(dotY - clearPad));
      const sw = Math.min(activeWidth - sx, Math.ceil(clearPad * 2));
      const sh = Math.min(activeHeight - sy, Math.ceil(clearPad * 2));
      if (sw > 0 && sh > 0) {
        ctx.putImageData(activeImg, 0, 0, sx, sy, sw, sh);
      }
    };

    clearRegion(cx - halfSep, py);
    clearRegion(cx + halfSep, py);
  }, [activeConfig.patternPeriod, activeConfig.maxDisparity, activeWidth, activeHeight]);

  const renderPeekingRows = (
    ctx: CanvasRenderingContext2D,
    activeImg: ImageData,
    depth: Float32Array,
    width: number,
    startY: number,
    endY: number
  ) => {
    const rowCount = endY - startY + 1;
    const sliceImg = ctx.createImageData(width, rowCount);
    const sData = activeImg.data;
    const bData = sliceImg.data;
    let dstIdx = 0;
    for (let py = startY; py <= endY; py++) {
      const rowOffset = py * width;
      for (let px = 0; px < width; px++) {
        const srcIdx = (rowOffset + px) * 4;
        const z = depth[rowOffset + px];
        const dzR = Math.round(z * 99);
        const dzG = Math.round(z * 102);
        const dzB = Math.round(z * 241);

        bData[dstIdx] = Math.round(sData[srcIdx] * 0.25 + dzR * 0.75);
        bData[dstIdx + 1] = Math.round(sData[srcIdx + 1] * 0.25 + dzG * 0.75);
        bData[dstIdx + 2] = Math.round(sData[srcIdx + 2] * 0.25 + dzB * 0.75);
        bData[dstIdx + 3] = 255;
        dstIdx += 4;
      }
    }
    ctx.putImageData(sliceImg, 0, startY);
  };

  // Full Initial Stereogram Generation (runs once per maze / resolution / config change)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Static base maze depth (Classic corridors or Inverted ridges)
    const cleanMazeDepth = renderBaseMazeDepth(maze, activeWidth, activeHeight, bounds, {
      isInverted: labyrinthMode === 'inverted',
    });
    cleanMazeDepthRef.current = cleanMazeDepth;

    // 2. Working depth buffer
    const depth = new Float32Array(cleanMazeDepth);
    depthBufferRef.current = depth;

    // 3. Render initial 3D text at the top
    const textScale = Math.max(3, Math.min(6, Math.floor(activeWidth / 260)));
    const initialText = gameState === 'won' ? 'GOAL! WIN!' : 'TIME: 00:00';
    const textWidth = measureTextWidth(initialText, textScale, 2);
    const textX = Math.floor((activeWidth - textWidth) / 2);
    const textY = isFullscreen ? Math.max(130, Math.floor(activeHeight * 0.11)) : Math.max(16, Math.floor(activeHeight * 0.035));
    renderTextDepth(depth, activeWidth, activeHeight, initialText, textX, textY, textScale, 0.96);

    // 4. Render initial 3D player shape into working depth buffer (if depth enabled)
    const baseSquareSize = initialBall.size || (labyrinthMode === 'inverted' ? Math.round(bounds.gap * 1.35) : bounds.gap);
    const playerSize = Math.round(baseSquareSize * playerDebug.sizeMultiplier);
    const shouldRenderInDepth = playerDebug.shape !== 'dual-dots' || playerDebug.dualDotMode === 'depth' || playerDebug.dualDotMode === 'both';

    if (shouldRenderInDepth) {
      renderPlayerShapeDepth(
        depth,
        activeWidth,
        activeHeight,
        initialBall.x,
        initialBall.y,
        playerSize,
        playerDebug.depth,
        {
          shape: playerDebug.shape,
          beveled: true,
          bevelRatio: playerDebug.bevelRatio,
          baseZ: playerDebug.baseZ,
          depth: playerDebug.depth,
          patternPeriod: activeConfig.patternPeriod,
          disparityRange: (activeConfig.maxDisparity ?? 15) / (activeConfig.patternPeriod || 100),
          viewingMode: 'parallel',
        }
      );
    }

    // 5. Generate active stereogram with continuous texture-coordinate engine
    const activeStereogram = generateLabyrinthStereogram(depth, activeWidth, activeHeight, {
      ...activeConfig,
      viewingMode: 'parallel',
      showGuideDots: activeConfig.showGuideDots,
    });
    activeImageDataRef.current = activeStereogram;
    prevBallPosRef.current = { ...initialBall };
    prevTextSecRef.current = 0;

    // 6. Blit to canvas
    if (isPeeking) {
      renderFullPeeking(ctx, activeStereogram, depth, activeWidth, activeHeight);
    } else {
      ctx.putImageData(activeStereogram, 0, 0);

      // If dual-dots overlay mode is enabled, draw the dual dots on top
      if (playerDebug.shape === 'dual-dots' && (playerDebug.dualDotMode === 'overlay' || playerDebug.dualDotMode === 'both')) {
        drawDualDotsOverlay(ctx, initialBall.x, initialBall.y);
      }
    }
    if (onStereogramRendered) {
      onStereogramRendered(canvas);
    }
  }, [maze, bounds, activeWidth, activeHeight, activeConfig, labyrinthMode, playerDebug, onStereogramRendered]);

  // Re-draw when spacebar peek toggles
  useEffect(() => {
    const canvas = canvasRef.current;
    const depth = depthBufferRef.current;
    const activeImg = activeImageDataRef.current;
    if (!canvas || !depth || !activeImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isPeeking) {
      renderFullPeeking(ctx, activeImg, depth, activeWidth, activeHeight);
    } else {
      ctx.putImageData(activeImg, 0, 0);
    }
  }, [isPeeking, activeWidth, activeHeight]);

  // High-Performance 60 FPS Game Loop
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      let currentElapsed = 0;

      if (gameState === 'playing') {
        currentElapsed = (now - timerStartRef.current) / 1000;
        // Direct DOM update avoids React component reconciliation overhead during 60 FPS loop
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = formatTime(currentElapsed);
        }

        // Gather input
        let ix = 0;
        let iy = 0;
        const k = keysPressed.current;
        if (k['w'] || k['arrowup']) iy -= 1;
        if (k['s'] || k['arrowdown']) iy += 1;
        if (k['a'] || k['arrowleft']) ix -= 1;
        if (k['d'] || k['arrowright']) ix += 1;

        // Normalize diagonal
        if (ix !== 0 && iy !== 0) {
          ix *= 0.7071;
          iy *= 0.7071;
        }

        // Physics step
        const { ball: nextBall, hasReachedGoal, hasFallen } = stepBallPhysics(
          ballRef.current,
          maze,
          bounds,
          { x: ix, y: iy },
          dt,
          { isInverted: labyrinthMode === 'inverted' }
        );
        ballRef.current = nextBall;

        if (hasFallen) {
          setFallNotice(true);
          if (fallTimeoutRef.current) clearTimeout(fallTimeoutRef.current);
          fallTimeoutRef.current = setTimeout(() => setFallNotice(false), 1600);
        }

        // Check victory
        if (hasReachedGoal) {
          setGameState('won');
          setElapsedTime(currentElapsed);
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.5 },
            colors: ['#6366f1', '#ec4899', '#10b981', '#f59e0b'],
          });

          // Save Best Time
          const finalScore = parseFloat(currentElapsed.toFixed(1));
          const currentBest = localStorage.getItem(`stereogram_labyrinth_best_${difficulty}`);
          if (!currentBest || finalScore < parseFloat(currentBest)) {
            localStorage.setItem(`stereogram_labyrinth_best_${difficulty}`, finalScore.toString());
            setBestTime(finalScore);
          }
        }
      }

      // DIRTY SCANLINE STEREOGRAM UPDATE
      const canvas = canvasRef.current;
      const depth = depthBufferRef.current;
      const cleanDepth = cleanMazeDepthRef.current;
      const activeImg = activeImageDataRef.current;
      const prevBall = prevBallPosRef.current;
      const currBall = ballRef.current;

      if (canvas && depth && cleanDepth && activeImg && prevBall) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // A. 3D Timer Text update (only once per second)
          const curSec = Math.floor(currentElapsed);
          if (gameState === 'playing' && curSec !== prevTextSecRef.current) {
            prevTextSecRef.current = curSec;
            const textScale = Math.max(3, Math.min(6, Math.floor(activeWidth / 260)));
            const textStr = `TIME: ${formatTime(currentElapsed)}`;
            const textW = measureTextWidth(textStr, textScale, 2);
            const textX = Math.floor((activeWidth - textW) / 2);
            const textY = isFullscreen ? Math.max(130, Math.floor(activeHeight * 0.11)) : Math.max(16, Math.floor(activeHeight * 0.035));
            const textH = textScale * 7 + 4;

            // Restore clean depth in text region
            const startRow = textY;
            const endRow = Math.min(activeHeight - 1, textY + textH);
            for (let py = startRow; py <= endRow; py++) {
              const rowStart = py * activeWidth;
              for (let px = 0; px < activeWidth; px++) {
                depth[rowStart + px] = cleanDepth[rowStart + px];
              }
            }

            // Draw new 3D time text
            renderTextDepth(depth, activeWidth, activeHeight, textStr, textX, textY, textScale, 0.96);

            // Re-render only text rows in stereogram
            renderLabyrinthStereoRows(
              depth,
              activeWidth,
              activeHeight,
              { ...activeConfig, viewingMode: 'parallel' },
              startRow,
              endRow,
              activeImg.data
            );

            // Blit text rows to canvas
            if (isPeeking) {
              renderPeekingRows(ctx, activeImg, depth, activeWidth, startRow, endRow);
            } else {
              const dirtyH = endRow - startRow + 1;
              ctx.putImageData(activeImg, 0, 0, 0, startRow, activeWidth, dirtyH);
            }
          }

          // B. 3D Player Movement (instantaneous 60 FPS scanline update)
          const ballMoved = Math.abs(currBall.x - prevBall.x) > 0.01 || Math.abs(currBall.y - prevBall.y) > 0.01;
          if (ballMoved) {
            const pD = playerDebugRef.current;
            const basePrevSize = prevBall.size || bounds.gap;
            const baseCurrSize = currBall.size || bounds.gap;
            const prevSize = Math.round(basePrevSize * pD.sizeMultiplier);
            const currSize = Math.round(baseCurrSize * pD.sizeMultiplier);

            const isDualDotsOverlayOnly = pD.shape === 'dual-dots' && pD.dualDotMode === 'overlay';
            const shouldRenderInDepth = !isDualDotsOverlayOnly;

            const shapeOpts = {
              shape: pD.shape,
              beveled: true,
              bevelRatio: pD.bevelRatio,
              baseZ: pD.baseZ,
              depth: pD.depth,
              patternPeriod: activeConfig.patternPeriod,
              disparityRange: (activeConfig.maxDisparity ?? 15) / (activeConfig.patternPeriod || 100),
              viewingMode: 'parallel' as const,
            };

            // Clear previous 2D dual dots if they were drawn on canvas overlay
            const hadOverlayDots = pD.shape === 'dual-dots' && (pD.dualDotMode === 'overlay' || pD.dualDotMode === 'both');
            if (hadOverlayDots) {
              clearPreviousDotsOverlay(ctx, activeImg, prevBall.x, prevBall.y);
            }

            if (shouldRenderInDepth) {
              // Step 1: Erase previous player shape from working depth buffer
              erasePlayerShapeDepth(depth, cleanDepth, activeWidth, activeHeight, prevBall.x, prevBall.y, prevSize, shapeOpts);

              // Step 2: Render new 3D player shape into working depth buffer
              renderPlayerShapeDepth(depth, activeWidth, activeHeight, currBall.x, currBall.y, currSize, pD.depth, shapeOpts);

              // Step 3: Compute minimal dirty scanlines span for the player shape movement
              const prevHalf = Math.ceil(prevSize / 2);
              const currHalf = Math.ceil(currSize / 2);
              const minY = Math.max(0, Math.floor(Math.min(prevBall.y - prevHalf, currBall.y - currHalf)) - 2);
              const maxY = Math.min(activeHeight - 1, Math.ceil(Math.max(prevBall.y + prevHalf, currBall.y + currHalf)) + 2);

              // Step 4: Re-render only dirty scanlines through continuous texture-coordinate engine
              renderLabyrinthStereoRows(
                depth,
                activeWidth,
                activeHeight,
                { ...activeConfig, viewingMode: 'parallel' },
                minY,
                maxY,
                activeImg.data
              );

              // Step 5: Blit dirty scanlines to canvas
              if (isPeeking) {
                renderPeekingRows(ctx, activeImg, depth, activeWidth, minY, maxY);
              } else {
                ctx.putImageData(activeImg, 0, 0, 0, minY, activeWidth, maxY - minY + 1);
              }
            }

            // If dual dots overlay is enabled (overlay or both), draw new 2D dual dots
            if (pD.shape === 'dual-dots' && (pD.dualDotMode === 'overlay' || pD.dualDotMode === 'both')) {
              drawDualDotsOverlay(ctx, currBall.x, currBall.y);
            }

            // Save new square position as previous for next tick
            prevBallPosRef.current = { x: currBall.x, y: currBall.y, radius: currBall.radius, size: baseCurrSize };
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [
    gameState,
    maze,
    bounds,
    activeWidth,
    activeHeight,
    activeConfig,
    isPeeking,
    difficulty,
    labyrinthMode,
  ]);

  // On-screen D-Pad handler
  const handleDirectionPress = useCallback((dir: 'up' | 'down' | 'left' | 'right', isDown: boolean) => {
    const keyMap = {
      up: 'arrowup',
      down: 'arrowdown',
      left: 'arrowleft',
      right: 'arrowright',
    };
    keysPressed.current[keyMap[dir]] = isDown;
    if (gameState === 'idle' && isDown) {
      handleStartGame();
    }
  }, [gameState]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-950 overflow-hidden text-slate-100 select-none ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen'
          : 'relative flex-1 h-full'
      }`}
    >
      {/* Top Game Bar - In Windowed Mode */}
      {!isFullscreen && (
        <div className="h-14 border-b border-slate-800/80 px-5 flex items-center justify-between bg-slate-900/50 backdrop-blur-md shrink-0">
          {/* Title & Mode */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 font-bold text-xs">
              <Eye className="w-3.5 h-3.5" />
              <span>Stereo Labyrinth 3D</span>
              <span className="text-[10px] text-indigo-300 font-mono bg-indigo-500/30 px-1.5 py-0.5 rounded-md">
                Lvl {level}
              </span>
            </div>

            {/* Difficulty Selector */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDifficulty(d);
                    handleStartNewMaze(d);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    difficulty === d
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {DIFFICULTY_SETTINGS[d].label}
                </button>
              ))}
            </div>

            {/* Labyrinth Mode Selector: Classic Walls vs Inverted Ridges */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                onClick={() => setLabyrinthMode('classic')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  labyrinthMode === 'classic'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Classic Labyrinth: Navigate corridors between 3D walls"
              >
                <span>🏰</span>
                <span>Classic</span>
              </button>
              <button
                onClick={() => setLabyrinthMode('inverted')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  labyrinthMode === 'inverted'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="The Inverted Labyrinth: Ride the high 3D ridges! Don't fall into the abyss!"
              >
                <span>⛰️</span>
                <span>Inverted Ridges</span>
              </button>
            </div>

            {/* 3D Ease of View Selector */}
            {onSelectEaseOfView && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">3D Ease:</span>
                <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
                  {(['easy', 'medium', 'hard'] as EaseOfView[]).map((e) => (
                    <button
                      key={e}
                      onClick={() => onSelectEaseOfView(e)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer capitalize ${
                        easeOfView === e
                          ? e === 'easy'
                            ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40'
                            : e === 'medium'
                            ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/40'
                            : 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title={`3D Ease of View: ${e.toUpperCase()} (${e === 'easy' ? '100px period / 15px disparity' : e === 'medium' ? '140px / 22px' : '180px / 30px'})`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live HUD Stats & Action Buttons */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <div className="text-xs">
                <span className="text-slate-400 text-[10px] block leading-none">TIME (In 3D Text)</span>
                <span ref={timeDisplayRef} className="font-mono text-base font-extrabold text-white">
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </div>

            {bestTime !== null && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Best: <strong>{formatTime(bestTime)}</strong></span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {gameState === 'idle' ? (
                <button
                  onClick={handleStartGame}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition active:scale-95 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Roll</span>
                </button>
              ) : (
                <button
                  onClick={() => handleStartNewMaze()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                  title="Generate New Random Maze"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>New Maze</span>
                </button>
              )}

              {/* Guide Dots Toggle */}
              {onChangeConfig && (
                <button
                  onClick={() => onChangeConfig({ showGuideDots: !activeConfig.showGuideDots })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    activeConfig.showGuideDots
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                  title={activeConfig.showGuideDots ? 'Hide Convergence Guide Dots' : 'Show Convergence Guide Dots'}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{activeConfig.showGuideDots ? 'Guide Dots' : 'No Dots'}</span>
                </button>
              )}

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white font-semibold text-xs border border-indigo-500/40 transition active:scale-95 cursor-pointer shadow-sm"
                title="Enter Fullscreen Mode (F) - Stereogram covers entire screen"
              >
                <Maximize className="w-3.5 h-3.5" />
                <span>Fullscreen</span>
              </button>

              {/* Player Debug Panel Toggle (Shortcut: ~ or Shift+D) */}
              <button
                onClick={() => setShowDebugPanel((prev) => !prev)}
                className={`p-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  showDebugPanel
                    ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700'
                }`}
                title="Toggle Player 3D Debug Tuner (` or Shift+D)"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating HUD Bar - In Fullscreen Mode */}
      {isFullscreen && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-2xl glass-panel border border-white/10 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Labyrinth Lvl {level}</span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Difficulty in Fullscreen */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900/80 border border-slate-800">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDifficulty(d);
                  handleStartNewMaze(d);
                }}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  difficulty === d
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Labyrinth Mode Toggle in Fullscreen */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900/80 border border-slate-800">
            <button
              onClick={() => setLabyrinthMode('classic')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                labyrinthMode === 'classic'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🏰</span>
              <span>Classic</span>
            </button>
            <button
              onClick={() => setLabyrinthMode('inverted')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                labyrinthMode === 'inverted'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>⛰️</span>
              <span>Inverted</span>
            </button>
          </div>

          {/* Ease of View in Fullscreen HUD */}
          {onSelectEaseOfView && (
            <div className="flex items-center p-0.5 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
              {(['easy', 'medium', 'hard'] as EaseOfView[]).map((e) => (
                <button
                  key={e}
                  onClick={() => onSelectEaseOfView(e)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer capitalize ${
                    easeOfView === e
                      ? e === 'easy'
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40'
                        : e === 'medium'
                        ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/40'
                        : 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`3D Ease: ${e.toUpperCase()}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Quick Pattern Switcher in Fullscreen */}
          {onChangeConfig && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-900/80 border border-slate-800">
              {PATTERNS.map((p) => {
                const isSelected = activeConfig.patternType === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      onChangeConfig({
                        patternType: p.id,
                        grainSize: getDefaultGrainForPattern(p.id),
                      })
                    }
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={`Switch pattern to ${p.label}`}
                  >
                    <span>{p.icon}</span>
                    <span className="hidden md:inline">{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="h-4 w-px bg-slate-700" />

          {/* Live Time Display */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span ref={timeDisplayRef} className="font-mono text-sm font-extrabold text-white">
              {formatTime(elapsedTime)}
            </span>
          </div>

          {bestTime !== null && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>{formatTime(bestTime)}</span>
            </div>
          )}

          <div className="h-4 w-px bg-slate-700" />

          {/* New Maze Button */}
          <button
            onClick={() => handleStartNewMaze()}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Generate New Maze"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Guide Dots in Fullscreen */}
          {onChangeConfig && (
            <button
              onClick={() => onChangeConfig({ showGuideDots: !activeConfig.showGuideDots })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                activeConfig.showGuideDots
                  ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
              }`}
              title={activeConfig.showGuideDots ? 'Hide Convergence Guide Dots' : 'Show Convergence Guide Dots'}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{activeConfig.showGuideDots ? 'Dots ON' : 'Dots OFF'}</span>
            </button>
          )}

          {/* Export & Print in Fullscreen */}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white font-semibold text-xs border border-indigo-500/40 transition active:scale-95 cursor-pointer shadow-sm"
              title="Save Stereogram to PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save PNG</span>
            </button>
          )}

          {onPrint && (
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition active:scale-95 cursor-pointer shadow-sm"
              title="Print Stereogram (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Print</span>
            </button>
          )}

          {/* Exit Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white font-semibold text-xs border border-rose-500/40 transition active:scale-95 cursor-pointer shadow-sm"
            title="Exit Fullscreen Mode (Esc / F)"
          >
            <Minimize className="w-3.5 h-3.5" />
            <span>Exit (Esc)</span>
          </button>
        </div>
      )}

      {/* Main Game Stage Area */}
      <div
        className={`relative overflow-hidden flex items-center justify-center ${
          isFullscreen ? 'w-full h-full p-0 flex-1' : 'flex-1 p-4'
        }`}
      >
        <div
          className={
            isFullscreen
              ? 'absolute inset-0 w-full h-full flex items-center justify-center'
              : 'relative max-w-full max-h-full flex items-center justify-center'
          }
          style={isFullscreen ? undefined : { aspectRatio: `${activeWidth} / ${activeHeight}` }}
        >
          <canvas
            ref={canvasRef}
            width={activeWidth}
            height={activeHeight}
            className={
              isFullscreen
                ? 'absolute inset-0 w-full h-full object-cover'
                : 'w-full h-full object-contain rounded-xl shadow-2xl border border-slate-800'
            }
          />

          {/* Convergence Guide Dots Indicator */}
          {activeConfig.showGuideDots && (
            <div
              className="absolute pointer-events-none flex items-center z-10"
              style={{
                top: isFullscreen ? '96px' : `${Math.max(2.5, Math.min(4.5, (24 / activeHeight) * 100))}%`,
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${(activeConfig.patternPeriod / activeWidth) * 100}%`,
              }}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/80 -translate-x-1/2 ring-2 ring-white/60 guide-dot-glow" />
              <div className="flex-1" />
              <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/80 translate-x-1/2 ring-2 ring-white/60 guide-dot-glow" />
            </div>
          )}

          {/* Victory Overlay */}
          {gameState === 'won' && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200 z-20">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-xl shadow-amber-500/30 mb-3">
                <Trophy className="w-8 h-8 text-slate-950" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-1">
                Level {level} Solved! 🎉
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                You navigated the stereoscopic 3D maze in:
              </p>
              <div className="text-3xl font-mono font-extrabold text-indigo-400 px-6 py-2 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner mb-6">
                {formatTime(elapsedTime)}
              </div>
              <button
                onClick={() => handleStartNewMaze(difficulty, true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold text-sm hover:brightness-110 shadow-lg shadow-indigo-600/40 transition active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Play Next Maze (Level {level + 1})</span>
              </button>
            </div>
          )}

          {/* Fall Notice in Inverted Ridge Mode */}
          {fallNotice && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-2xl bg-red-600/90 text-white font-extrabold text-xs shadow-2xl backdrop-blur-md animate-bounce border border-red-400 z-30 flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>Fell off the ridge into the abyss! Respawned at start!</span>
            </div>
          )}

          {/* Start Prompt Overlay */}
          {gameState === 'idle' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl glass-panel text-xs text-slate-300 pointer-events-none flex items-center gap-2 shadow-2xl border border-white/10 z-20 max-w-xl text-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span>
                {playerDebug.shape === 'dual-dots' ? (
                  <>
                    Align eyes with the 2 guide dots at top. In 3D you will see <strong>three player dots</strong>: navigate the labyrinth with the <strong>center dot</strong> using <strong>WASD / Arrow Keys</strong>! {isFullscreen ? '(Press F or Esc to exit fullscreen)' : '(Press F for Fullscreen)'}
                  </>
                ) : labyrinthMode === 'inverted' ? (
                  <>Align eyes with the 2 guide dots at top, then press <strong>WASD / Arrow Keys</strong> to balance the 3D Cube on the high ridges to the <strong>Big 3D Star</strong>! Don't fall into the abyss! {isFullscreen ? '(Press F or Esc to exit fullscreen)' : '(Press F for Fullscreen)'}</>
                ) : (
                  <>Align eyes with the 2 guide dots at top, then press <strong>WASD / Arrow Keys</strong> to navigate the 3D Square into the <strong>Big 3D Star (stor stjerne)</strong> at the exit! {isFullscreen ? '(Press F or Esc to exit fullscreen)' : '(Press F for Fullscreen)'}</>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Floating Controls: Radar Peek & On-Screen D-Pad */}
        <div className="absolute bottom-5 right-6 flex flex-col items-end gap-3 z-20">
          {/* Radar Peek Button */}
          <button
            onMouseDown={() => setIsPeeking(true)}
            onMouseUp={() => setIsPeeking(false)}
            onMouseLeave={() => setIsPeeking(false)}
            onTouchStart={() => setIsPeeking(true)}
            onTouchEnd={() => setIsPeeking(false)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 select-none shadow-xl border border-white/10 cursor-pointer ${
              isPeeking
                ? 'bg-indigo-600 text-white scale-95 shadow-indigo-600/50'
                : 'glass-panel text-slate-300 hover:text-white'
            }`}
            title="Hold Spacebar or hold this button to peek 2D X-Ray depth radar"
          >
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hold for X-Ray Peek</span>
          </button>

          {/* Virtual D-Pad for Touch/Mouse */}
          <div className="glass-panel p-2 rounded-2xl flex flex-col items-center gap-1 shadow-2xl border border-white/10">
            <button
              onMouseDown={() => handleDirectionPress('up', true)}
              onMouseUp={() => handleDirectionPress('up', false)}
              onTouchStart={() => handleDirectionPress('up', true)}
              onTouchEnd={() => handleDirectionPress('up', false)}
              className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 active:bg-indigo-600 active:text-white transition cursor-pointer"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div className="flex gap-1">
              <button
                onMouseDown={() => handleDirectionPress('left', true)}
                onMouseUp={() => handleDirectionPress('left', false)}
                onTouchStart={() => handleDirectionPress('left', true)}
                onTouchEnd={() => handleDirectionPress('left', false)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 active:bg-indigo-600 active:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onMouseDown={() => handleDirectionPress('down', true)}
                onMouseUp={() => handleDirectionPress('down', false)}
                onTouchStart={() => handleDirectionPress('down', true)}
                onTouchEnd={() => handleDirectionPress('down', false)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 active:bg-indigo-600 active:text-white transition cursor-pointer"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onMouseDown={() => handleDirectionPress('right', true)}
                onMouseUp={() => handleDirectionPress('right', false)}
                onTouchStart={() => handleDirectionPress('right', true)}
                onTouchEnd={() => handleDirectionPress('right', false)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 active:bg-indigo-600 active:text-white transition cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Hidden Player Debug Tuning Modal Panel */}
        {showDebugPanel && (
          <div className="absolute top-4 right-4 z-40 w-80 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-4 text-xs select-none animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white text-sm">Player 3D Tuner</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded">
                  DEBUG
                </span>
              </div>
              <button
                onClick={() => setShowDebugPanel(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Close Debug Panel (` or Shift+D)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
              {/* Shape Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1.5">
                  Player Representation Shape
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'square', label: 'Square Tile', icon: '⏹️' },
                      { id: 'circle', label: 'Circle Disc', icon: '⏺️' },
                      { id: 'pyramid', label: 'Pyramid', icon: '🔺' },
                      { id: 'dual-dots', label: 'Dual Dots 3D', icon: '👀' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setPlayerDebug((prev) => ({ ...prev, shape: s.id }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition cursor-pointer ${
                        playerDebug.shape === s.id
                          ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dual Dot Specific Settings */}
              {playerDebug.shape === 'dual-dots' && (
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                  <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Dual Dot Guide Fusion Mode</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Two dots separated by exact stereo disparity. When eyes fuse them, the middle dot is the exact 3D player position.
                  </p>

                  {/* Render Mode */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                      Dot Render Pipeline
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'overlay', label: 'Overlay' },
                          { id: 'depth', label: '3D Depth' },
                          { id: 'both', label: 'Both' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setPlayerDebug((prev) => ({ ...prev, dualDotMode: m.id }))}
                          className={`py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                            playerDebug.dualDotMode === m.id
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dot Color */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                      Dot Color (Overlay)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#38bdf8', '#ffffff'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setPlayerDebug((prev) => ({ ...prev, dualDotColor: c }))}
                          className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                            playerDebug.dualDotColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Dot Radius */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Dot Radius</span>
                      <span className="font-mono text-amber-300">{playerDebug.dualDotRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={12}
                      step={1}
                      value={playerDebug.dualDotRadius}
                      onChange={(e) =>
                        setPlayerDebug((prev) => ({ ...prev, dualDotRadius: parseInt(e.target.value) }))
                      }
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Horizontal Calibration Offset */}
                  <div>
                    {(() => {
                      const period = activeConfig.patternPeriod || 100;
                      const defaultOffset = -Math.round(period / 2);
                      const currentVal = playerDebug.dotOffsetX !== undefined ? playerDebug.dotOffsetX : defaultOffset;
                      const isDefault = playerDebug.dotOffsetX === undefined || playerDebug.dotOffsetX === defaultOffset;

                      return (
                        <>
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Center Parallax Offset (X Shift)</span>
                            <span className="font-mono text-amber-300">
                              {currentVal > 0 ? `+${currentVal}px` : `${currentVal}px`} {isDefault ? '(Default -S/2)' : ''}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-Math.round(period * 0.75)}
                            max={Math.round(period * 0.75)}
                            step={1}
                            value={currentVal}
                            onChange={(e) =>
                              setPlayerDebug((prev) => ({ ...prev, dotOffsetX: parseInt(e.target.value) }))
                            }
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                          <div className="flex gap-1 mt-1.5">
                            <button
                              onClick={() => setPlayerDebug((prev) => ({ ...prev, dotOffsetX: defaultOffset }))}
                              className={`flex-1 py-0.5 rounded text-[9px] font-semibold transition cursor-pointer ${
                                isDefault ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                              title="Default: -Half period (-S/2) shifts dots left to lock fused center dot directly on ridge"
                            >
                              -Half Period (Default)
                            </button>
                            <button
                              onClick={() => setPlayerDebug((prev) => ({ ...prev, dotOffsetX: 0 }))}
                              className={`flex-1 py-0.5 rounded text-[9px] transition cursor-pointer ${
                                playerDebug.dotOffsetX === 0 ? 'bg-amber-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                            >
                              Center (0)
                            </button>
                            <button
                              onClick={() => setPlayerDebug((prev) => ({ ...prev, dotOffsetX: Math.round(period / 2) }))}
                              className="flex-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-300 transition cursor-pointer"
                              title="Shift +S/2 right"
                            >
                              +Half Period
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Visual Guide explanation */}
                  <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-[10px] text-indigo-200 leading-normal">
                    👀 <strong>Binocular Fusion Guide:</strong> When focusing your eyes in 3D, you will see <strong>three dots</strong>. The <strong>center dot</strong> is the fused 3D player — steer with this center dot to stay on the ridges!
                  </div>
                </div>
              )}

              {/* Size Multiplier */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Size Multiplier</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {playerDebug.sizeMultiplier.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={playerDebug.sizeMultiplier}
                  onChange={(e) =>
                    setPlayerDebug((prev) => ({ ...prev, sizeMultiplier: parseFloat(e.target.value) }))
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Elevation Depth (z) */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Player 3D Elevation (Top Z)</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {playerDebug.depth.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.60}
                  max={1.00}
                  step={0.02}
                  value={playerDebug.depth}
                  onChange={(e) =>
                    setPlayerDebug((prev) => ({ ...prev, depth: parseFloat(e.target.value) }))
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Bevel Base Z */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Bevel Base Height (Bottom Z)</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {playerDebug.baseZ.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.20}
                  max={0.80}
                  step={0.05}
                  value={playerDebug.baseZ}
                  onChange={(e) =>
                    setPlayerDebug((prev) => ({ ...prev, baseZ: parseFloat(e.target.value) }))
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Bevel Ratio */}
              {playerDebug.shape !== 'dual-dots' && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span>Bevel / Chamfer Tapering Ratio</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {Math.round(playerDebug.bevelRatio * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
                    max={0.70}
                    step={0.05}
                    value={playerDebug.bevelRatio}
                    onChange={(e) =>
                      setPlayerDebug((prev) => ({ ...prev, bevelRatio: parseFloat(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              )}

              {/* Reset to Defaults */}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[10px] text-slate-500">Shortcut: ` or Shift+D</span>
                <button
                  onClick={() =>
                    setPlayerDebug({
                      shape: 'dual-dots',
                      sizeMultiplier: 1.0,
                      depth: 0.98,
                      baseZ: 0.50,
                      bevelRatio: 0.35,
                      dualDotMode: 'overlay',
                      dualDotColor: '#ffffff',
                      dualDotRadius: 5,
                    })
                  }
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
