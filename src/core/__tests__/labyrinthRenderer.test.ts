import { describe, it, expect } from 'vitest';
import { generateMaze } from '../mazeGenerator.ts';
import {
  getLabyrinthBounds,
  renderBaseMazeDepth,
  compositeLabyrinthFrame,
  stepBallPhysics,
  renderBallStereoOverlay,
  eraseBallStereoOverlay,
  renderConeDepth,
  eraseConeDepth,
  renderFloatingSquareDepth,
  eraseFloatingSquareDepth,
  renderGoalStarDepth,
  renderInvertedMazeDepth,
  isPointOnRidge,
  renderLabyrinthStereoRows,
  generateLabyrinthStereogram,
} from '../labyrinthRenderer.ts';

describe('labyrinthRenderer', () => {
  const width = 400;
  const height = 300;
  const maze = generateMaze(7, 5, 123);
  const bounds = getLabyrinthBounds(maze, width, height);

  it('computes valid bounds within the canvas margins', () => {
    expect(bounds.x).toBeGreaterThan(0);
    expect(bounds.y).toBeGreaterThan(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    expect(bounds.cellW).toBeGreaterThan(15);
    expect(bounds.cellH).toBeGreaterThan(15);
    expect(bounds.cellW).toBe(bounds.cellH); // Uniform square cells
  });

  it('computes centered bounds with generous margins in fullscreen mode', () => {
    const fsW = 3840;
    const fsH = 2160;
    const fsBounds = getLabyrinthBounds(maze, fsW, fsH, { isFullscreen: true });
    // Side margins should be at least 20% of canvas width
    expect(fsBounds.x).toBeGreaterThanOrEqual(fsW * 0.2);
    expect(fsW - (fsBounds.x + fsBounds.width)).toBeGreaterThanOrEqual(fsW * 0.2);
    // Maze should be horizontally centered
    expect(Math.abs(fsBounds.x - (fsW - (fsBounds.x + fsBounds.width)))).toBeLessThanOrEqual(2);
    // Cells should be square
    expect(fsBounds.cellW).toBe(fsBounds.cellH);
  });

  it('renders base maze depth buffer with floor and elevated walls', () => {
    const depth = renderBaseMazeDepth(maze, width, height, bounds);
    expect(depth.length).toBe(width * height);

    // Floor center should have floor depth (~0.08)
    const startCenterX = Math.round(bounds.x + bounds.cellW / 2);
    const startCenterY = Math.round(bounds.y + bounds.cellH / 2);
    const centerIdx = startCenterY * width + startCenterX;
    expect(depth[centerIdx]).toBeGreaterThan(0.05);
    expect(depth[centerIdx]).toBeLessThan(0.4);

    // Outer wall exit doorway has open floor depth (< 0.4)
    const exitX = Math.round(bounds.x + bounds.width);
    const exitY = Math.round(bounds.y + maze.goalY * bounds.cellH + bounds.cellH / 2);
    const exitIdx = exitY * width + exitX;
    expect(depth[exitIdx]).toBeLessThan(0.4);

    // Wall perimeter (away from exit) should have elevated depth (> 0.5)
    const wallIdx = bounds.y * width + (bounds.x + bounds.cellW);
    expect(depth[wallIdx]).toBeGreaterThan(0.5);
  });

  it('composites ball and 3D time text onto the base depth buffer', () => {
    const baseDepth = renderBaseMazeDepth(maze, width, height, bounds);
    const ball = {
      x: bounds.x + bounds.cellW / 2,
      y: bounds.y + bounds.cellH / 2,
      vx: 0,
      vy: 0,
      radius: 8,
    };

    const timeStr = 'TIME: 04.2';
    const composite = compositeLabyrinthFrame(baseDepth, width, height, ball, timeStr);

    // Ball apex must be close to 0.95
    const ballIdx = Math.round(ball.y) * width + Math.round(ball.x);
    expect(composite[ballIdx]).toBeGreaterThan(0.9);

    // Time text area (y = 16) must have non-zero elevated depth
    let hasTextDepth = false;
    for (let x = 0; x < width; x++) {
      if (composite[18 * width + x] > 0.8) {
        hasTextDepth = true;
        break;
      }
    }
    expect(hasTextDepth).toBe(true);
  });

  it('updates ball physics and collides with boundaries and walls', () => {
    const ball = {
      x: bounds.x + bounds.cellW / 2,
      y: bounds.y + bounds.cellH / 2,
      vx: 0,
      vy: 0,
      radius: 6,
    };

    // Accelerate to the right
    const step1 = stepBallPhysics(ball, maze, bounds, { x: 1, y: 0 }, 0.05);
    expect(step1.ball.x).toBeGreaterThan(ball.x);
    expect(step1.ball.vx).toBeGreaterThan(0);

    // If accelerated hard into outer left wall, ball should be clamped
    let testBall = { ...ball, x: bounds.x + 8 };
    const stepLeft = stepBallPhysics(testBall, maze, bounds, { x: -1, y: 0 }, 0.5);
    expect(stepLeft.ball.x).toBeGreaterThanOrEqual(bounds.x + bounds.wallThickness / 2 + ball.radius);
  });

  it('renders localized ball stereo overlay without touching pixels outside its bounding box', () => {
    const testW = 600;
    const testH = 400;
    const cleanData = new Uint8ClampedArray(testW * testH * 4);
    // Fill cleanData with a mock background pattern
    for (let i = 0; i < cleanData.length; i += 4) {
      cleanData[i] = (i % 256);
      cleanData[i + 1] = ((i / 4) % 256);
      cleanData[i + 2] = 120;
      cleanData[i + 3] = 255;
    }

    const targetData = new Uint8ClampedArray(cleanData);
    const ball: import('../labyrinthRenderer.ts').BallState = {
      x: 250,
      y: 180,
      vx: 0,
      vy: 0,
      radius: 12,
    };

    const overlayOpts = {
      patternPeriod: 140,
      maxDisparity: 26,
      viewingMode: 'parallel' as const,
    };

    const box = renderBallStereoOverlay(targetData, cleanData, testW, testH, ball, overlayOpts);

    // Bounding box should be local and well within canvas
    expect(box.minX).toBeGreaterThan(0);
    expect(box.maxX).toBeLessThan(testW);
    expect(box.minY).toBeGreaterThan(0);
    expect(box.maxY).toBeLessThan(testH);

    // CRITICAL: Pixels to the right of the ball (x > box.maxX) MUST be bit-for-bit identical
    for (let y = box.minY; y <= box.maxY; y++) {
      for (let x = box.maxX + 1; x < testW; x++) {
        const idx = (y * testW + x) * 4;
        expect(targetData[idx]).toBe(cleanData[idx]);
        expect(targetData[idx + 1]).toBe(cleanData[idx + 1]);
        expect(targetData[idx + 2]).toBe(cleanData[idx + 2]);
        expect(targetData[idx + 3]).toBe(cleanData[idx + 3]);
      }
    }

    // CRITICAL: Pixels to the left of the ball (x < box.minX) MUST be bit-for-bit identical
    for (let y = box.minY; y <= box.maxY; y++) {
      for (let x = 0; x < box.minX; x++) {
        const idx = (y * testW + x) * 4;
        expect(targetData[idx]).toBe(cleanData[idx]);
        expect(targetData[idx + 1]).toBe(cleanData[idx + 1]);
        expect(targetData[idx + 2]).toBe(cleanData[idx + 2]);
        expect(targetData[idx + 3]).toBe(cleanData[idx + 3]);
      }
    }

    // Inside the ball overlay, some pixels should be stamped
    let diffCount = 0;
    for (let y = box.minY; y <= box.maxY; y++) {
      for (let x = box.minX; x <= box.maxX; x++) {
        const idx = (y * testW + x) * 4;
        if (targetData[idx] !== cleanData[idx]) {
          diffCount++;
        }
      }
    }
    expect(diffCount).toBeGreaterThan(10);

    // Erasing the ball overlay restores targetData to cleanData
    eraseBallStereoOverlay(targetData, cleanData, testW, testH, ball, overlayOpts);
    let residualDiff = 0;
    for (let i = 0; i < targetData.length; i += 4) {
      if (
        targetData[i] !== cleanData[i] ||
        targetData[i + 1] !== cleanData[i + 1] ||
        targetData[i + 2] !== cleanData[i + 2]
      ) {
        residualDiff++;
      }
    }
    expect(residualDiff).toBe(0);
  });

  it('renders and erases 3D cone depth with linear slope and sharp apex', () => {
    const testW = 100;
    const testH = 100;
    const cleanDepth = new Float32Array(testW * testH).fill(0.08);
    const workDepth = new Float32Array(cleanDepth);

    const cx = 50;
    const cy = 50;
    const radius = 10;

    renderConeDepth(workDepth, testW, testH, cx, cy, radius, 0.08, 0.98);

    // Apex at (50, 50) must be 0.98
    expect(workDepth[cy * testW + cx]).toBeCloseTo(0.98, 2);

    // Midpoint at radius/2 (dist = 5) must be roughly halfway: 0.08 + 0.90 * 0.5 = 0.53
    expect(workDepth[cy * testW + (cx + 5)]).toBeCloseTo(0.53, 2);

    // Rim at radius (dist = 10) must be 0.08
    expect(workDepth[cy * testW + (cx + 10)]).toBeCloseTo(0.08, 2);

    // Beyond rim must still be 0.08
    expect(workDepth[cy * testW + (cx + 12)]).toBeCloseTo(0.08, 2);

    // Erase cone restores workDepth to cleanDepth bit-for-bit
    eraseConeDepth(workDepth, cleanDepth, testW, testH, cx, cy, radius);
    for (let i = 0; i < workDepth.length; i++) {
      expect(workDepth[i]).toBe(cleanDepth[i]);
    }
  });

  it('renders and erases 3D floating square plateau depth without self-occlusion', () => {
    const testW = 100;
    const testH = 100;
    const cleanDepth = new Float32Array(testW * testH).fill(0.08);
    const workDepth = new Float32Array(cleanDepth);

    const cx = 50;
    const cy = 50;
    const squareSize = 20;

    renderFloatingSquareDepth(workDepth, testW, testH, cx, cy, squareSize, 0.98);

    // Center and entire square interior must be flat elevated plateau at 0.98
    expect(workDepth[cy * testW + cx]).toBeCloseTo(0.98, 2);
    expect(workDepth[cy * testW + (cx + 8)]).toBeCloseTo(0.98, 2);
    expect(workDepth[(cy + 8) * testW + cx]).toBeCloseTo(0.98, 2);
    expect(workDepth[(cy - 8) * testW + (cx - 8)]).toBeCloseTo(0.98, 2);

    // Outside the square footprint (dist > 10) must remain clean floor at 0.08
    expect(workDepth[cy * testW + (cx + 15)]).toBeCloseTo(0.08, 2);
    expect(workDepth[(cy + 15) * testW + cx]).toBeCloseTo(0.08, 2);

    // Erase restores workDepth to cleanDepth bit-for-bit
    eraseFloatingSquareDepth(workDepth, cleanDepth, testW, testH, cx, cy, squareSize);
    for (let i = 0; i < workDepth.length; i++) {
      expect(workDepth[i]).toBe(cleanDepth[i]);
    }
  });

  it('renders elevated 5-pointed Big 3D Star plateau at goal with circular foundation dais', () => {
    const testW = 120;
    const testH = 120;
    const depth = new Float32Array(testW * testH).fill(0.08);

    const cx = 60;
    const cy = 60;
    const outerRadius = 30;
    const starZ = 0.94;
    const daisZ = 0.55;

    renderGoalStarDepth(depth, testW, testH, cx, cy, outerRadius, starZ, daisZ, 0.42);

    // 1. Star center must be flat elevated plateau at starZ (0.94)
    expect(depth[cy * testW + cx]).toBeCloseTo(starZ, 2);

    // 2. Upright top tip points straight UP (-Y direction, dy = -28)
    const topTipIdx = (cy - 28) * testW + cx;
    expect(depth[topTipIdx]).toBeCloseTo(starZ, 2);

    // 3. Valley between tips at 36 deg: inner valley radius is ~30 * 0.42 = 12.6
    // At r = 20 along 36 deg ray, it's outside the star but inside daisRadius (30 * 0.60 = 18)
    // Outside outerRadius (> 30), depth must be untouched floor (0.08)
    const outsideIdx = (cy - 35) * testW + cx;
    expect(depth[outsideIdx]).toBeCloseTo(0.08, 2);

    // 4. Dais area near center (e.g. r = 10) must be at least daisZ
    const daisIdx = (cy + 10) * testW + cx;
    expect(depth[daisIdx]).toBeGreaterThanOrEqual(daisZ);
  });

  it('renders inverted labyrinth depth buffer with chasm floor and elevated ridges', () => {
    const invDepth = renderInvertedMazeDepth(maze, width, height, bounds);
    expect(invDepth.length).toBe(width * height);

    // Far corner outside maze should be deep chasm (~0.05)
    expect(invDepth[0]).toBeCloseTo(0.05, 2);

    // Start cell center must be an elevated ridge (~0.82)
    const startCenterX = Math.round(bounds.x + bounds.cellW / 2);
    const startCenterY = Math.round(bounds.y + bounds.cellH / 2);
    const startIdx = startCenterY * width + startCenterX;
    expect(invDepth[startIdx]).toBeGreaterThan(0.75);

    // Goal cell ridge must be elevated (~0.82)
    const goalCenterX = Math.round(bounds.x + maze.goalX * bounds.cellW + bounds.cellW / 2);
    const goalCenterY = Math.round(bounds.y + maze.goalY * bounds.cellH + bounds.cellH / 2);
    const goalIdx = goalCenterY * width + goalCenterX;
    expect(invDepth[goalIdx]).toBeGreaterThan(0.75);

    // Landing platform outside the maze must be elevated (> 0.80)
    const platformX = Math.min(width - 8, Math.round(bounds.x + bounds.width + bounds.cellW * 0.9));
    const platformIdx = goalCenterY * width + platformX;
    expect(invDepth[platformIdx]).toBeGreaterThan(0.80);
  });

  it('checks isPointOnRidge accurately and detects falling off into the abyss', () => {
    const startCenterX = bounds.x + bounds.cellW / 2;
    const startCenterY = bounds.y + bounds.cellH / 2;

    // Start cell center is safely on ridge
    expect(isPointOnRidge(startCenterX, startCenterY, maze, bounds)).toBe(true);

    // Far off the canvas is NOT on ridge
    expect(isPointOnRidge(10, 10, maze, bounds)).toBe(false);

    // Inverted physics step: if player falls off ridge, respawns at start
    const ball = {
      x: startCenterX,
      y: startCenterY,
      vx: 0,
      vy: 0,
      radius: 6,
    };

    // Safe small move along corridor
    const safeStep = stepBallPhysics(ball, maze, bounds, { x: 0, y: 0 }, 0.016, { isInverted: true });
    expect(safeStep.hasFallen).toBe(false);
    expect(safeStep.ball.x).toBeCloseTo(startCenterX, 1);

    // Test a point that is off the ridge
    const offRidgeBall = {
      x: bounds.x - 50,
      y: bounds.y - 50,
      vx: 0,
      vy: 0,
      radius: 6,
    };
    const fallenStep = stepBallPhysics(offRidgeBall, maze, bounds, { x: 0, y: 0 }, 0.016, { isInverted: true });
    expect(fallenStep.hasFallen).toBe(true);
    // Must respawn at start cell center
    expect(fallenStep.ball.x).toBeCloseTo(startCenterX, 1);
    expect(fallenStep.ball.y).toBeCloseTo(startCenterY, 1);
  });

  it('renders labyrinth stereogram with continuous texture coordinates and preserves left-side pixels', () => {
    const depthA = new Float32Array(width * height);
    const depthB = new Float32Array(width * height);

    // Ball A at x = 200, y = 150
    renderFloatingSquareDepth(depthA, width, height, 200, 150, 20, 0.98);
    // Ball B slightly moved to x = 204, y = 150
    renderFloatingSquareDepth(depthB, width, height, 204, 150, 20, 0.98);

    const config = {
      patternPeriod: 80,
      maxDisparity: 14,
      viewingMode: 'parallel' as const,
      patternType: 'sand' as const,
      grainSize: 1,
      enableOcclusionRemoval: true,
      smoothingRadius: 1,
      showGuideDots: false,
      guideDotColor: '#6366f1',
      customImageData: null,
      easeOfView: 'easy' as const,
    };

    const imgA = generateLabyrinthStereogram(depthA, width, height, config);
    const imgB = generateLabyrinthStereogram(depthB, width, height, config);

    expect(imgA.width).toBe(width);
    expect(imgA.height).toBe(height);

    // On row 150, all pixels to the left of the ball (x < 185) MUST BE 100% BIT-FOR-BIT IDENTICAL
    const rowOffset = 150 * width * 4;
    for (let x = 0; x < 185; x++) {
      const idx = rowOffset + x * 4;
      expect(imgA.data[idx]).toBe(imgB.data[idx]);
      expect(imgA.data[idx + 1]).toBe(imgB.data[idx + 1]);
      expect(imgA.data[idx + 2]).toBe(imgB.data[idx + 2]);
    }

    // Direct renderLabyrinthStereoRows slice test
    const sliceData = new Uint8ClampedArray(imgA.data);
    renderLabyrinthStereoRows(depthB, width, height, config, 150, 150, sliceData);
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      expect(sliceData[idx]).toBe(imgB.data[idx]);
      expect(sliceData[idx + 1]).toBe(imgB.data[idx + 1]);
      expect(sliceData[idx + 2]).toBe(imgB.data[idx + 2]);
    }
  });

  it('triggers goal victory when passing through classic outer wall exit', () => {
    const exitY = bounds.y + maze.goalY * bounds.cellH + bounds.cellH / 2;
    const nearExitBall = {
      x: bounds.x + bounds.width - 2,
      y: exitY,
      vx: 10,
      vy: 0,
      radius: 6,
    };

    const step = stepBallPhysics(nearExitBall, maze, bounds, { x: 1, y: 0 }, 0.05);
    expect(step.hasReachedGoal).toBe(true);
    expect(step.ball.x).toBeGreaterThanOrEqual(bounds.x + bounds.width - 2);
  });

  it('triggers goal victory when reaching inverted landing platform', () => {
    const goalY = bounds.y + maze.goalY * bounds.cellH + bounds.cellH / 2;
    const onBridgeBall = {
      x: bounds.x + bounds.width + 10,
      y: goalY,
      vx: 10,
      vy: 0,
      radius: 6,
    };

    const step = stepBallPhysics(onBridgeBall, maze, bounds, { x: 1, y: 0 }, 0.05, { isInverted: true });
    expect(step.hasReachedGoal).toBe(true);
    expect(step.hasFallen).toBe(false);
  });
});

