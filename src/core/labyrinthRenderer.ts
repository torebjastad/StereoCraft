import { MazeGrid } from './mazeGenerator.ts';
import { renderTextDepth, measureTextWidth } from './textDepthRenderer.ts';
import { smoothDepthMap } from './depthRenderer.ts';
import { samplePatternColor } from './stereogramEngine.ts';
import { PatternType } from '../types/index.ts';

export interface LabyrinthBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  cellW: number;
  cellH: number;
  wallThickness: number;
  gap: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  size?: number;
}

/**
 * Computes pixel layout bounding geometry for a maze grid
 * Centered with generous margins to prevent peripheral eye focus loss
 */
export function getLabyrinthBounds(
  maze: MazeGrid,
  canvasWidth: number,
  canvasHeight: number,
  options?: { isFullscreen?: boolean }
): LabyrinthBounds {
  const isFullscreen = options?.isFullscreen ?? false;

  // Generous margins: in fullscreen mode, enforce even more luxurious margins (22% side margin)
  // so the stereogram pattern surrounds the central maze with ample stereoscopic buffer
  const sideMarginRatio = isFullscreen ? 0.22 : 0.16;
  const topMarginRatio = isFullscreen ? 0.20 : 0.15;
  const bottomMarginRatio = isFullscreen ? 0.20 : 0.10;

  const marginSide = Math.max(isFullscreen ? 80 : 50, Math.floor(canvasWidth * sideMarginRatio));
  const marginTop = Math.max(isFullscreen ? 160 : 80, Math.floor(canvasHeight * topMarginRatio));
  const marginBottom = Math.max(isFullscreen ? 140 : 45, Math.floor(canvasHeight * bottomMarginRatio));

  const availW = canvasWidth - marginSide * 2;
  const availH = canvasHeight - marginTop - marginBottom;

  // Use uniform square cells so corridors and movement are symmetrical and never stretched
  const cellDim = Math.max(20, Math.min(Math.floor(availW / maze.cols), Math.floor(availH / maze.rows)));
  const cellW = cellDim;
  const cellH = cellDim;

  const actualW = cellW * maze.cols;
  const actualH = cellH * maze.rows;

  // Perfectly centered horizontally and vertically on the canvas
  const x = Math.floor((canvasWidth - actualW) / 2);
  const y = marginTop + Math.floor((availH - actualH) / 2);

  // Walls twice as thick (56% of cell dimension) for imposing 3D stone/hedge relief
  const wallThickness = Math.max(12, Math.floor(cellDim * 0.56));
  const gap = cellDim - wallThickness;

  return {
    x,
    y,
    width: actualW,
    height: actualH,
    cellW,
    cellH,
    wallThickness,
    gap,
  };
}

/**
 * Pre-renders the static 3D depth map of the maze corridors, walls, and goal pad
 * High-contrast depth settings: deep floor (0.08) and elevated walls (0.88)
 */
export function renderBaseMazeDepth(
  maze: MazeGrid,
  canvasWidth: number,
  canvasHeight: number,
  bounds: LabyrinthBounds,
  options?: { isInverted?: boolean }
): Float32Array {
  if (options?.isInverted) {
    return renderInvertedMazeDepth(maze, canvasWidth, canvasHeight, bounds);
  }

  const depthBuffer = new Float32Array(canvasWidth * canvasHeight);
  const { x: ox, y: oy, cellW, cellH, wallThickness } = bounds;

  const floorZ = 0.08; // Deep trench corridor floor
  const wallZ = 0.88;  // Towering 3D stone/hedge walls

  // 1. Fill maze floor area
  for (let py = oy; py < oy + bounds.height; py++) {
    const rowOffset = py * canvasWidth;
    for (let px = ox; px < ox + bounds.width; px++) {
      depthBuffer[rowOffset + px] = floorZ;
    }
  }

  // Helper to draw a wall rect with flat elevated plateau and chamfered edges
  const drawWall = (wx: number, wy: number, ww: number, wh: number) => {
    const minX = Math.max(0, wx);
    const maxX = Math.min(canvasWidth - 1, wx + ww);
    const minY = Math.max(0, wy);
    const maxY = Math.min(canvasHeight - 1, wy + wh);
    const bevelDist = Math.max(2, Math.floor(wallThickness * 0.25));

    for (let py = minY; py <= maxY; py++) {
      const rowOffset = py * canvasWidth;
      const dy = Math.min(py - wy, wy + wh - py);

      for (let px = minX; px <= maxX; px++) {
        const dx = Math.min(px - wx, wx + ww - px);
        const distFromEdge = Math.min(dx, dy);

        // Chamfered/beveled 3D relief for wall top with wide flat plateau
        const bevel = Math.min(1.0, distFromEdge / bevelDist);
        const zVal = floorZ + (wallZ - floorZ) * (bevel * bevel * (3 - 2 * bevel));

        const idx = rowOffset + px;
        depthBuffer[idx] = Math.max(depthBuffer[idx], zVal);
      }
    }
  };

  // 2. Outer boundary walls
  const halfWall = Math.floor(wallThickness / 2);
  drawWall(ox - halfWall, oy - halfWall, bounds.width + wallThickness, wallThickness); // Top
  drawWall(ox - halfWall, oy + bounds.height - halfWall, bounds.width + wallThickness, wallThickness); // Bottom
  drawWall(ox - halfWall, oy - halfWall, wallThickness, bounds.height + wallThickness); // Left
  drawWall(ox + bounds.width - halfWall, oy - halfWall, wallThickness, bounds.height + wallThickness); // Right

  // 3. Inner maze walls
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const cell = maze.cells[r][c];
      const cx = ox + c * cellW;
      const cy = oy + r * cellH;

      if (cell.walls.right && c < maze.cols - 1) {
        drawWall(cx + cellW - halfWall, cy - halfWall, wallThickness, cellH + wallThickness);
      }
      if (cell.walls.bottom && r < maze.rows - 1) {
        drawWall(cx - halfWall, cy + cellH - halfWall, cellW + wallThickness, wallThickness);
      }
    }
  }

  // 4. Goal Star: Elevated Big 3D Star plateau rising ABOVE the maze walls (z = 0.94)
  const goalCenterX = ox + maze.goalX * cellW + cellW / 2;
  const goalCenterY = oy + maze.goalY * cellH + cellH / 2;
  const cellDim = Math.min(cellW, cellH);
  const starRadius = Math.max(22, Math.floor(cellDim * 0.95));

  renderGoalStarDepth(depthBuffer, canvasWidth, canvasHeight, goalCenterX, goalCenterY, starRadius, 0.94, 0.55, 0.42);

  // Subtle anti-aliasing to smooth micro-cliff edges without blurring walls
  return smoothDepthMap(depthBuffer, canvasWidth, canvasHeight, 1);
}

/**
 * Renders a Big 3D Star (stor 5-takket stjerne) at the maze goal cell.
 * The star features:
 * 1. An elevated circular foundation dais (z = 0.55)
 * 2. A towering 5-pointed star plateau (z = 0.94) with outer radius spanning ~95% of cell dimension,
 *    rising proudly ABOVE the maze walls (0.88).
 * 3. Flat plateau geometry ensuring zero ray-marching self-occlusion so all 5 points and the body
 *    fuse into a crisp, unmistakable 3D beacon visible across the entire labyrinth!
 */
export function renderGoalStarDepth(
  depthBuffer: Float32Array,
  canvasWidth: number,
  canvasHeight: number,
  centerX: number,
  centerY: number,
  outerRadius: number,
  starZ: number = 0.94,
  daisZ: number = 0.55,
  innerRatio: number = 0.42
): void {
  const rCeil = Math.ceil(outerRadius);
  const minY = Math.max(0, Math.floor(centerY - rCeil));
  const maxY = Math.min(canvasHeight - 1, Math.ceil(centerY + rCeil));
  const minX = Math.max(0, Math.floor(centerX - rCeil));
  const maxX = Math.min(canvasWidth - 1, Math.ceil(centerX + rCeil));

  const points = 5;
  const step = Math.PI / points; // 36 degrees
  const daisRadius = outerRadius * 0.60;

  for (let py = minY; py <= maxY; py++) {
    const rowOffset = py * canvasWidth;
    const dy = py - centerY;

    for (let px = minX; px <= maxX; px++) {
      const dx = px - centerX;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > outerRadius) continue;

      const idx = rowOffset + px;

      // 1. Raised circular foundation dais beneath the star
      if (r <= daisRadius && daisZ > 0) {
        depthBuffer[idx] = Math.max(depthBuffer[idx], daisZ);
      }

      // 2. 5-pointed Star Plateau
      if (r === 0) {
        depthBuffer[idx] = Math.max(depthBuffer[idx], starZ);
        continue;
      }

      // Angle from 0 to 2*PI, offset so top tip points straight up (-Y axis)
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      while (angle < 0) angle += Math.PI * 2;
      while (angle >= Math.PI * 2) angle -= Math.PI * 2;

      const piece = angle % (step * 2);
      const relAngle = piece > step ? 2 * step - piece : piece;
      const t = relAngle / step; // 0 at tip (r = outerRadius), 1 at inner valley (r = outerRadius * innerRatio)
      const maxR = outerRadius * (1.0 - t * (1.0 - innerRatio));

      if (r <= maxR) {
        depthBuffer[idx] = Math.max(depthBuffer[idx], starZ);
      }
    }
  }
}

/**
 * Pre-renders the static 3D depth map for "The Inverted Labyrinth".
 * In this mode, the labyrinth corridors are HIGH 3D RIDGES (z = 0.82),
 * and the surrounding areas (where walls used to be) are a DEEP CHASM / VOID (z = 0.05).
 * The goal at the final cell is the Big 3D Star (z = 0.94) perched on the final ridge peak!
 */
export function renderInvertedMazeDepth(
  maze: MazeGrid,
  canvasWidth: number,
  canvasHeight: number,
  bounds: LabyrinthBounds
): Float32Array {
  const depthBuffer = new Float32Array(canvasWidth * canvasHeight);
  const { x: ox, y: oy, cellW, cellH, gap } = bounds;

  const chasmZ = 0.05; // Bottomless abyss
  const ridgeZ = 0.82; // High elevated ridge pathway

  // 1. Fill canvas with chasm depth
  depthBuffer.fill(chasmZ);

  // Ridge width is the corridor gap
  const ridgeWidth = gap;
  const halfRidge = Math.floor(ridgeWidth / 2);

  // Helper to draw a ridge rectangle
  const drawRidgeRect = (rx: number, ry: number, rw: number, rh: number) => {
    const minX = Math.max(0, Math.floor(rx));
    const maxX = Math.min(canvasWidth - 1, Math.ceil(rx + rw));
    const minY = Math.max(0, Math.floor(ry));
    const maxY = Math.min(canvasHeight - 1, Math.ceil(ry + rh));

    for (let py = minY; py <= maxY; py++) {
      const rowOffset = py * canvasWidth;
      for (let px = minX; px <= maxX; px++) {
        const idx = rowOffset + px;
        depthBuffer[idx] = Math.max(depthBuffer[idx], ridgeZ);
      }
    }
  };

  // 2. Render connected ridges
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const cell = maze.cells[r][c];
      const cx = ox + c * cellW + cellW / 2;
      const cy = oy + r * cellH + cellH / 2;

      // Central junction for this cell
      drawRidgeRect(cx - halfRidge, cy - halfRidge, ridgeWidth, ridgeWidth);

      // Horizontal ridge to right neighbor
      if (!cell.walls.right && c < maze.cols - 1) {
        drawRidgeRect(cx - halfRidge, cy - halfRidge, cellW + halfRidge * 2, ridgeWidth);
      }

      // Vertical ridge to bottom neighbor
      if (!cell.walls.bottom && r < maze.rows - 1) {
        drawRidgeRect(cx - halfRidge, cy - halfRidge, ridgeWidth, cellH + halfRidge * 2);
      }
    }
  }

  // 3. Goal Star: Elevated Big 3D Star plateau rising at the goal ridge peak (z = 0.94)
  const goalCenterX = ox + maze.goalX * cellW + cellW / 2;
  const goalCenterY = oy + maze.goalY * cellH + cellH / 2;
  const cellDim = Math.min(cellW, cellH);
  const starRadius = Math.max(22, Math.floor(cellDim * 0.95));

  renderGoalStarDepth(depthBuffer, canvasWidth, canvasHeight, goalCenterX, goalCenterY, starRadius, 0.94, 0.55, 0.42);

  // Subtle anti-aliasing to smooth micro-cliff edges without blurring ridge tops
  return smoothDepthMap(depthBuffer, canvasWidth, canvasHeight, 1);
}

/**
 * Checks whether a 2D coordinate (x, y) is safely on top of a ridge in "The Inverted Labyrinth".
 * Returns true if the point is on the ridge pathway, or false if it has fallen off into the abyss.
 */
export function isPointOnRidge(
  x: number,
  y: number,
  maze: MazeGrid,
  bounds: LabyrinthBounds,
  margin: number = 2
): boolean {
  const { x: ox, y: oy, cellW, cellH, gap } = bounds;
  const halfRidge = gap / 2 + margin;

  // Check goal area: if within goal star radius, player is safe
  const goalCenterX = ox + maze.goalX * cellW + cellW / 2;
  const goalCenterY = oy + maze.goalY * cellH + cellH / 2;
  const cellDim = Math.min(cellW, cellH);
  if (Math.hypot(x - goalCenterX, y - goalCenterY) <= cellDim * 0.70) {
    return true;
  }

  // Which cell is (x, y) in?
  const c = Math.floor((x - ox) / cellW);
  const r = Math.floor((y - oy) / cellH);

  // If outside maze grid bounds, fallen
  if (c < 0 || c >= maze.cols || r < 0 || r >= maze.rows) {
    return false;
  }

  const cell = maze.cells[r][c];
  const cx = ox + c * cellW + cellW / 2;
  const cy = oy + r * cellH + cellH / 2;
  const dx = x - cx;
  const dy = y - cy;

  // 1. Central junction of the cell
  if (Math.abs(dx) <= halfRidge && Math.abs(dy) <= halfRidge) {
    return true;
  }

  // 2. Horizontal bridge to right
  if (!cell.walls.right && dx > 0 && Math.abs(dy) <= halfRidge) {
    return true;
  }

  // 3. Horizontal bridge to left
  if (!cell.walls.left && dx < 0 && Math.abs(dy) <= halfRidge) {
    return true;
  }

  // 4. Vertical bridge to bottom
  if (!cell.walls.bottom && dy > 0 && Math.abs(dx) <= halfRidge) {
    return true;
  }

  // 5. Vertical bridge to top
  if (!cell.walls.top && dy < 0 && Math.abs(dx) <= halfRidge) {
    return true;
  }

  return false;
}

/**
 * Renders a 3D floating square plateau (svevende firkant) into the depth buffer.
 * Spans the corridor gap between maze walls at an elevated plateau (0.98),
 * hovering visibly above the maze walls (0.88).
 * Because it is a flat plateau (like the walls), all points have equal elevation,
 * preventing any self-occlusion artifacts and providing an unmistakable 3D planar tile!
 */
export function renderFloatingSquareDepth(
  depthBuffer: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  size: number,
  squareZ: number = 0.98
): void {
  const halfSize = Math.floor(size / 2);
  const minX = Math.max(0, Math.round(x - halfSize));
  const maxX = Math.min(width - 1, Math.round(x + halfSize));
  const minY = Math.max(0, Math.round(y - halfSize));
  const maxY = Math.min(height - 1, Math.round(y + halfSize));

  for (let py = minY; py <= maxY; py++) {
    const rowOffset = py * width;
    for (let px = minX; px <= maxX; px++) {
      depthBuffer[rowOffset + px] = Math.max(depthBuffer[rowOffset + px], squareZ);
    }
  }
}

/**
 * Erases a previously rendered 3D floating square by restoring clean base maze depth.
 */
export function eraseFloatingSquareDepth(
  depthBuffer: Float32Array,
  cleanMazeDepth: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  size: number
): void {
  const halfSize = Math.floor(size / 2);
  const minX = Math.max(0, Math.round(x - halfSize));
  const maxX = Math.min(width - 1, Math.round(x + halfSize));
  const minY = Math.max(0, Math.round(y - halfSize));
  const maxY = Math.min(height - 1, Math.round(y + halfSize));

  for (let py = minY; py <= maxY; py++) {
    const rowOffset = py * width;
    for (let px = minX; px <= maxX; px++) {
      depthBuffer[rowOffset + px] = cleanMazeDepth[rowOffset + px];
    }
  }
}

/**
 * Renders a sharp 3D cone (kjegle) into the depth buffer.
 * A cone features a sharp apex (0.98) and a constant linear slope down to floorZ (0.08).
 */
export function renderConeDepth(
  depthBuffer: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
  floorZ: number = 0.08,
  coneApexZ: number = 0.98
): void {
  const rCeil = Math.ceil(radius);
  for (let dy = -rCeil; dy <= rCeil; dy++) {
    const py = Math.round(y + dy);
    if (py < 0 || py >= height) continue;
    const rowOffset = py * width;

    for (let dx = -rCeil; dx <= rCeil; dx++) {
      const px = Math.round(x + dx);
      if (px < 0 || px >= width) continue;

      const d2 = dx * dx + dy * dy;
      if (d2 <= radius * radius) {
        const rFrac = Math.sqrt(d2) / radius;
        // Linear conical profile with sharp summit
        const coneZ = floorZ + (coneApexZ - floorZ) * (1.0 - rFrac);
        const idx = rowOffset + px;
        depthBuffer[idx] = Math.max(depthBuffer[idx], coneZ);
      }
    }
  }
}

/**
 * Erases a previously rendered 3D cone by restoring clean base maze depth.
 */
export function eraseConeDepth(
  depthBuffer: Float32Array,
  cleanMazeDepth: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): void {
  const rCeil = Math.ceil(radius);
  for (let dy = -rCeil; dy <= rCeil; dy++) {
    const py = Math.round(y + dy);
    if (py < 0 || py >= height) continue;
    const rowOffset = py * width;

    for (let dx = -rCeil; dx <= rCeil; dx++) {
      const px = Math.round(x + dx);
      if (px < 0 || px >= width) continue;

      const d2 = dx * dx + dy * dy;
      if (d2 <= radius * radius) {
        const idx = rowOffset + px;
        depthBuffer[idx] = cleanMazeDepth[idx];
      }
    }
  }
}

/**
 * Composites dynamic floating square and 3D time text onto the pre-rendered base maze
 */
export function compositeLabyrinthFrame(
  baseDepth: Float32Array,
  canvasWidth: number,
  canvasHeight: number,
  ball: BallState,
  timeText: string
): Float32Array {
  // Fast buffer copy
  const depth = new Float32Array(baseDepth);

  // 1. Render 3D player object as a prominent floating square
  const { x: bx, y: by, radius: br, size: bSize } = ball;
  const squareSize = bSize || Math.round(br * 2);
  renderFloatingSquareDepth(depth, canvasWidth, canvasHeight, bx, by, squareSize, 0.98);

  // 2. Render 3D stereogram time text at the top
  const textScale = Math.max(3, Math.min(6, Math.floor(canvasWidth / 260)));
  const textWidth = measureTextWidth(timeText, textScale);
  const textX = Math.floor((canvasWidth - textWidth) / 2);
  const textY = Math.max(16, Math.floor(canvasHeight * 0.035));
  const textElevation = 0.96; // High 3D floating plane

  renderTextDepth(depth, canvasWidth, canvasHeight, timeText, textX, textY, textScale, textElevation);

  return depth;
}

/**
 * Updates ball physics with acceleration, friction, and collision against maze walls
 */
export function stepBallPhysics(
  ball: BallState,
  maze: MazeGrid,
  bounds: LabyrinthBounds,
  input: { x: number; y: number },
  dt: number,
  options?: { isInverted?: boolean }
): { ball: BallState; hasReachedGoal: boolean; hasFallen?: boolean } {
  const { x: ox, y: oy, cellW, cellH, wallThickness } = bounds;

  const cellDimension = Math.min(cellW, cellH);
  const accel = Math.max(650, cellDimension * 14); // Responsive acceleration across all resolutions
  const friction = 0.90;
  const maxSpeed = Math.max(240, cellDimension * 4.5); // Snappy top speed (~4.5 cells/sec)

  let vx = ball.vx * friction + input.x * accel * dt;
  let vy = ball.vy * friction + input.y * accel * dt;

  // Clamp max speed
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed > maxSpeed) {
    vx = (vx / speed) * maxSpeed;
    vy = (vy / speed) * maxSpeed;
  }

  let newX = ball.x + vx * dt;
  let newY = ball.y + vy * dt;

  // Mode branch: Inverted Labyrinth (riding ridges over abyss) vs Classic Labyrinth (walled corridors)
  if (options?.isInverted) {
    const onRidge = isPointOnRidge(newX, newY, maze, bounds, 2);
    if (!onRidge) {
      // Fallen off ridge! Respawn at start cell center
      const startX = ox + bounds.cellW / 2;
      const startY = oy + bounds.cellH / 2;
      return {
        ball: {
          x: startX,
          y: startY,
          vx: 0,
          vy: 0,
          radius: ball.radius,
          size: ball.size,
        },
        hasReachedGoal: false,
        hasFallen: true,
      };
    }

    // Check goal condition
    const goalCenterX = ox + maze.goalX * cellW + cellW / 2;
    const goalCenterY = oy + maze.goalY * cellH + cellH / 2;
    const distToGoal = Math.sqrt((newX - goalCenterX) ** 2 + (newY - goalCenterY) ** 2);
    const hasReachedGoal = distToGoal < (bounds.gap ? bounds.gap * 0.52 : Math.min(cellW, cellH) * 0.38);

    return {
      ball: {
        x: newX,
        y: newY,
        vx,
        vy,
        radius: ball.radius,
        size: ball.size,
      },
      hasReachedGoal,
      hasFallen: false,
    };
  }

  // Classic Labyrinth mode: Collision with outer boundaries
  const halfWall = wallThickness / 2;
  const minX = ox + halfWall + ball.radius;
  const maxX = ox + bounds.width - halfWall - ball.radius;
  const minY = oy + halfWall + ball.radius;
  const maxY = oy + bounds.height - halfWall - ball.radius;

  if (newX < minX) { newX = minX; vx = 0; }
  if (newX > maxX) { newX = maxX; vx = 0; }
  if (newY < minY) { newY = minY; vy = 0; }
  if (newY > maxY) { newY = maxY; vy = 0; }

  // Collision with inner cell walls
  const currentCellX = Math.floor((newX - ox) / cellW);
  const currentCellY = Math.floor((newY - oy) / cellH);

  if (currentCellX >= 0 && currentCellX < maze.cols && currentCellY >= 0 && currentCellY < maze.rows) {
    const cell = maze.cells[currentCellY][currentCellX];
    const cellLeft = ox + currentCellX * cellW;
    const cellRight = cellLeft + cellW;
    const cellTop = oy + currentCellY * cellH;
    const cellBottom = cellTop + cellH;

    // Check Right Wall
    if (cell.walls.right && newX + ball.radius > cellRight - halfWall) {
      newX = cellRight - halfWall - ball.radius;
      vx = 0;
    }
    // Check Left Wall
    if (cell.walls.left && newX - ball.radius < cellLeft + halfWall) {
      newX = cellLeft + halfWall + ball.radius;
      vx = 0;
    }
    // Check Bottom Wall
    if (cell.walls.bottom && newY + ball.radius > cellBottom - halfWall) {
      newY = cellBottom - halfWall - ball.radius;
      vy = 0;
    }
    // Check Top Wall
    if (cell.walls.top && newY - ball.radius < cellTop + halfWall) {
      newY = cellTop + halfWall + ball.radius;
      vy = 0;
    }
  }

  // Check goal condition
  const goalCenterX = ox + maze.goalX * cellW + cellW / 2;
  const goalCenterY = oy + maze.goalY * cellH + cellH / 2;
  const distToGoal = Math.sqrt((newX - goalCenterX) ** 2 + (newY - goalCenterY) ** 2);
  const hasReachedGoal = distToGoal < (bounds.gap ? bounds.gap * 0.52 : Math.min(cellW, cellH) * 0.38);

  return {
    ball: {
      x: newX,
      y: newY,
      vx,
      vy,
      radius: ball.radius,
      size: ball.size,
    },
    hasReachedGoal,
    hasFallen: false,
  };
}

export interface BallOverlayOptions {
  patternPeriod: number;
  maxDisparity: number;
  viewingMode?: 'parallel' | 'cross-eyed';
  patternType?: PatternType;
  grainSize?: number;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Erases a previously rendered 3D stereoscopic ball overlay by restoring original
 * background stereogram pixels from cleanData.
 * Only restores the exact segment [minX, maxX]; pixels outside remain untouched.
 */
export function eraseBallStereoOverlay(
  targetData: Uint8ClampedArray,
  cleanData: Uint8ClampedArray,
  canvasWidth: number,
  canvasHeight: number,
  ball: { x: number; y: number; radius: number },
  options: BallOverlayOptions
): BoundingBox {
  const { patternPeriod, maxDisparity, viewingMode = 'parallel' } = options;
  const isCrossEyed = viewingMode === 'cross-eyed';
  const zFloor = 0.08;
  const zTop = 0.98;

  const R = ball.radius;

  const sFloor = isCrossEyed
    ? patternPeriod + Math.round(zFloor * maxDisparity)
    : patternPeriod - Math.round(zFloor * maxDisparity);
  const sTop = isCrossEyed
    ? patternPeriod + Math.round(zTop * maxDisparity)
    : patternPeriod - Math.round(zFloor * maxDisparity);
  const sMax = Math.max(sFloor, sTop);

  const minY = Math.max(0, Math.floor(ball.y - R) - 1);
  const maxY = Math.min(canvasHeight - 1, Math.ceil(ball.y + R) + 1);
  const minX = Math.max(0, Math.floor(ball.x - R - sMax / 2) - 4);
  const maxX = Math.min(canvasWidth - 1, Math.ceil(ball.x + R + sMax / 2) + 4);

  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * canvasWidth;
    for (let x = minX; x <= maxX; x++) {
      const idx = (rowOffset + x) * 4;
      targetData[idx] = cleanData[idx];
      targetData[idx + 1] = cleanData[idx + 1];
      targetData[idx + 2] = cleanData[idx + 2];
      targetData[idx + 3] = 255;
    }
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Renders a localized 3D stereoscopic ball overlay directly onto targetData.
 * Uses localized Thimbleby-Inglis-Witten Union-Find anchored on cleanData.
 *
 * CRUCIAL PROPERTIES:
 * 1. 100% Invisible in 2D (True Autostereogram / Camouflage):
 *    No artificial lighting, shading, or tint is added. Every pixel color is sampled
 *    directly from cleanData[root] or object-space pattern dots, perfectly preserving the background pattern texture.
 * 2. Temporally Coherent Smooth Pursuit (Eliminates Motion Disparity Collapse):
 *    When patternType is provided, dot colors on the ball are locked to local coordinates (dx, dy).
 *    As the ball rolls, the dots move WITH the ball rather than scrambling at 60 Hz,
 *    allowing the visual cortex to maintain binocular disparity fusion without flattening out.
 * 3. Zero Right-Edge Distortion / Echoes:
 *    Only constraints for points on the ball (x in [bx - r, bx + r]) are unioned.
 *    Pixels outside the ball's stereo footprint (x < minX or x > maxX) are NEVER modified,
 *    preventing the transitive phase propagation of the 1D algorithm to the right edge.
 */
export function renderBallStereoOverlay(
  targetData: Uint8ClampedArray,
  cleanData: Uint8ClampedArray,
  canvasWidth: number,
  canvasHeight: number,
  ball: { x: number; y: number; radius: number },
  options: BallOverlayOptions
): BoundingBox {
  const { patternPeriod, maxDisparity, viewingMode = 'parallel', patternType, grainSize } = options;
  const isCrossEyed = viewingMode === 'cross-eyed';
  const zFloor = 0.08;
  const zTop = 0.98;

  const R = ball.radius;
  const rCeil = Math.ceil(R);

  const sFloor = isCrossEyed
    ? patternPeriod + Math.round(zFloor * maxDisparity)
    : patternPeriod - Math.round(zFloor * maxDisparity);
  const sTop = isCrossEyed
    ? patternPeriod + Math.round(zTop * maxDisparity)
    : patternPeriod - Math.round(zFloor * maxDisparity);
  const sMax = Math.max(sFloor, sTop);

  const minY = Math.max(0, Math.floor(ball.y - R) - 1);
  const maxY = Math.min(canvasHeight - 1, Math.ceil(ball.y + R) + 1);
  const minX = Math.max(0, Math.floor(ball.x - R - sMax / 2) - 4);
  const maxX = Math.min(canvasWidth - 1, Math.ceil(ball.x + R + sMax / 2) + 4);
  const span = maxX - minX + 1;

  // Local disjoint-set arrays for the scanline segment [minX, maxX]
  const parent = new Int32Array(span);
  const rootColorR = new Uint8Array(span);
  const rootColorG = new Uint8Array(span);
  const rootColorB = new Uint8Array(span);
  const isConstrained = new Uint8Array(span);

  function find(localIdx: number): number {
    let root = localIdx;
    while (parent[root] !== root) {
      root = parent[root];
    }
    let curr = localIdx;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  }

  function union(localI: number, localJ: number): void {
    const ri = find(localI);
    const rj = find(localJ);
    if (ri !== rj) {
      if (ri < rj) {
        parent[rj] = ri;
      } else {
        parent[ri] = rj;
      }
    }
  }

  for (let dy = -rCeil; dy <= rCeil; dy++) {
    const y = Math.round(ball.y + dy);
    if (y < 0 || y >= canvasHeight) continue;
    const dy2 = dy * dy;
    if (dy2 > R * R) continue;

    const rx = Math.ceil(Math.sqrt(R * R - dy2));
    const rowOffset = y * canvasWidth;

    // Reset local Union-Find for this scanline segment
    for (let i = 0; i < span; i++) {
      parent[i] = i;
      isConstrained[i] = 0;
    }

    // Step 1: Add stereoscopic constraints ONLY for points on the 3D ball
    for (let dx = -rx; dx <= rx; dx++) {
      const d2 = dx * dx + dy2;
      if (d2 > R * R) continue;

      const px = Math.round(ball.x + dx);
      if (px < 0 || px >= canvasWidth) continue;

      // Player object elevation profile: elevated floating square plateau (0.98)
      const z = zTop;

      const disp = Math.round(z * maxDisparity);
      const sep = isCrossEyed ? patternPeriod + disp : patternPeriod - disp;

      const left = px - Math.floor(sep / 2);
      const right = left + sep;

      if (left >= minX && right <= maxX) {
        const localI = left - minX;
        const localJ = right - minX;
        union(localI, localJ);

        isConstrained[localI] = 1;
        isConstrained[localJ] = 1;

        if (patternType) {
          // Object-space texture coordinates: translates smoothly with the ball
          // This provides temporal coherence so the dots don't scramble 60x/sec during rolling
          const dotX = Math.round(dx + R + 128);
          const dotY = Math.round(dy + R + 128);
          const [cr, cg, cb] = samplePatternColor(
            patternType,
            dotX,
            dotY,
            patternPeriod,
            grainSize || 2
          );
          const root = find(localI);
          rootColorR[root] = cr;
          rootColorG[root] = cg;
          rootColorB[root] = cb;
        }
      }
    }

    // Step 2: Write pixels
    // Constrained ball pixels get the stereoscopic correspondence.
    // Unconstrained background pixels retain cleanData bit-for-bit.
    for (let i = 0; i < span; i++) {
      const globalX = minX + i;
      const targetIdx = (rowOffset + globalX) * 4;

      if (isConstrained[i]) {
        const root = find(i);
        if (patternType) {
          targetData[targetIdx] = rootColorR[root];
          targetData[targetIdx + 1] = rootColorG[root];
          targetData[targetIdx + 2] = rootColorB[root];
        } else {
          const rootX = minX + root;
          const rootIdx = (rowOffset + rootX) * 4;
          targetData[targetIdx] = cleanData[rootIdx];
          targetData[targetIdx + 1] = cleanData[rootIdx + 1];
          targetData[targetIdx + 2] = cleanData[rootIdx + 2];
        }
      } else {
        targetData[targetIdx] = cleanData[targetIdx];
        targetData[targetIdx + 1] = cleanData[targetIdx + 1];
        targetData[targetIdx + 2] = cleanData[targetIdx + 2];
      }
      targetData[targetIdx + 3] = 255;
    }
  }

  return { minX, maxX, minY, maxY };
}


