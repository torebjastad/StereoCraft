import { StereogramConfig, PatternType, EaseOfView } from '../types/index.ts';

// PRNG for consistent, reproducible procedural patterns
function pseudoRandom(x: number, y: number, seed: number = 1337): number {
  let h = (x * 374761393 + y * 668265263 + seed) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// 2D Perlin-like smooth noise for organic patterns
function smoothNoise2D(x: number, y: number, scale: number): number {
  const sx = x * scale;
  const sy = y * scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;

  // Smoothstep interpolation
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);

  const n00 = pseudoRandom(x0, y0);
  const n10 = pseudoRandom(x0 + 1, y0);
  const n01 = pseudoRandom(x0, y0 + 1);
  const n11 = pseudoRandom(x0 + 1, y0 + 1);

  const nx0 = n00 * (1 - u) + n10 * u;
  const nx1 = n01 * (1 - u) + n11 * u;
  return nx0 * (1 - v) + nx1 * v;
}

// Retro 90s Magic Eye vibrant palette
const RETRO_90S_COLORS: [number, number, number][] = [
  [255, 0, 128],   // Neon Pink
  [0, 240, 255],   // Cyan
  [120, 255, 0],   // Electric Lime
  [255, 230, 0],   // Bright Yellow
  [140, 0, 255],   // Electric Violet
  [255, 100, 0],   // Neon Orange
  [20, 20, 80],    // Deep Indigo
  [240, 240, 255], // Off White
];

// Cosmic Nebula palette
const COSMIC_COLORS: [number, number, number][] = [
  [15, 8, 38],     // Deep Space Navy
  [64, 18, 110],   // Dark Nebula Purple
  [138, 43, 226],  // Blue Violet
  [236, 72, 153],  // Magenta Glow
  [56, 189, 248],  // Starlight Cyan
  [255, 255, 255], // Star White
];

// Desert Sand palette
const SAND_COLORS: [number, number, number][] = [
  [194, 154, 108], // Warm Sand
  [226, 194, 143], // Pale Gold
  [143, 97, 60],   // Terracotta
  [84, 49, 28],    // Dark Clay
  [245, 230, 200], // Desert Cream
];

/**
 * Procedural color sampler for pattern roots
 */
export function samplePatternColor(
  patternType: PatternType,
  x: number,
  y: number,
  period: number,
  grainSize: number,
  customImageData?: ImageData | null
): [number, number, number] {
  if (patternType === 'custom' && customImageData) {
    const cw = customImageData.width;
    const ch = customImageData.height;
    // Map to custom pattern tile
    const px = Math.floor(Math.abs(x)) % cw;
    const py = Math.floor(Math.abs(y)) % ch;
    const idx = (py * cw + px) * 4;
    return [
      customImageData.data[idx],
      customImageData.data[idx + 1],
      customImageData.data[idx + 2],
    ];
  }

  // Periodic horizontal wrapping ensures background texture strip repeats seamlessly with patternPeriod.
  // Any disjoint set root separated by multiples of period samples the IDENTICAL color,
  // preventing horizontal streak artifacts when objects move or occlusions split equivalence classes!
  const effectivePeriod = Math.max(1, period);
  const wrappedX = ((Math.floor(x) % effectivePeriod) + effectivePeriod) % effectivePeriod;

  // Grain quantized coordinates
  const gx = Math.floor(wrappedX / grainSize);
  const gy = Math.floor(y / grainSize);

  switch (patternType) {
    case 'retro-90s': {
      // Combination of micro dots + confetti shapes
      const randVal = pseudoRandom(gx, gy);
      const colorIdx = Math.floor(randVal * RETRO_90S_COLORS.length);
      return RETRO_90S_COLORS[colorIdx];
    }

    case 'cosmic': {
      const n1 = smoothNoise2D(gx, gy, 0.08);
      const n2 = smoothNoise2D(gx, gy, 0.2);
      const star = pseudoRandom(gx, gy);
      if (star > 0.985) {
        return [255, 255, 255]; // pinpoint star
      }
      const val = Math.min(1, Math.max(0, n1 * 0.7 + n2 * 0.3));
      const idx = Math.min(COSMIC_COLORS.length - 1, Math.floor(val * COSMIC_COLORS.length));
      return COSMIC_COLORS[idx];
    }

    case 'organic-flow': {
      const n = smoothNoise2D(gx, gy, 0.05);
      const bands = Math.sin(n * 20 + gy * 0.1);
      const r = Math.floor(128 + 127 * Math.sin(bands));
      const g = Math.floor(128 + 127 * Math.sin(bands + 2.0));
      const b = Math.floor(128 + 127 * Math.cos(bands + 4.0));
      return [r, g, b];
    }

    case 'sand': {
      const randVal = pseudoRandom(gx, gy);
      const noise = smoothNoise2D(gx, gy, 0.08);
      const combined = (randVal * 0.4 + noise * 0.6);
      const colorIdx = Math.min(SAND_COLORS.length - 1, Math.floor(combined * SAND_COLORS.length));
      return SAND_COLORS[colorIdx];
    }

    case 'color-noise':
    default: {
      // High-contrast vibrant RGB dots
      const r = Math.floor(pseudoRandom(gx, gy, 1) * 256);
      const g = Math.floor(pseudoRandom(gx, gy, 2) * 256);
      const b = Math.floor(pseudoRandom(gx, gy, 3) * 256);
      return [r, g, b];
    }
  }
}

export function createImageDataHelper(width: number, height: number): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(width, height);
  }
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
    colorSpace: 'srgb',
  } as ImageData;
}

/**
 * Renders a specific range of scanlines [startY, endY] of an autostereogram into targetData buffer.
 * Enables ultra-high-speed (sub-10ms) dirty-rect rendering for 60 FPS interactive games.
 */
export function renderStereogramRows(
  depthMap: Float32Array,
  width: number,
  height: number,
  config: StereogramConfig,
  startY: number,
  endY: number,
  targetData: Uint8ClampedArray
): void {
  const {
    patternType,
    patternPeriod,
    maxDisparity,
    viewingMode,
    enableOcclusionRemoval,
    grainSize,
    customImageData,
  } = config;

  const isCrossEyed = viewingMode === 'cross-eyed';
  const parent = new Int32Array(width);

  function find(i: number): number {
    let root = i;
    while (parent[root] !== root) {
      root = parent[root];
    }
    let curr = i;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  }

  function union(i: number, j: number): void {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) {
      if (ri < rj) {
        parent[rj] = ri;
      } else {
        parent[ri] = rj;
      }
    }
  }

  const rowR = new Uint8Array(width);
  const rowG = new Uint8Array(width);
  const rowB = new Uint8Array(width);

  const effectivePeriod = Math.max(1, patternPeriod);
  const patternCache = new Uint8Array(effectivePeriod * 3);

  const clampedStartY = Math.max(0, startY);
  const clampedEndY = Math.min(height - 1, endY);

  for (let y = clampedStartY; y <= clampedEndY; y++) {
    const rowOffset = y * width;

    // Reset Union-Find
    for (let x = 0; x < width; x++) {
      parent[x] = x;
    }

    // Step 0: Find maximum elevation on this row to avoid redundant ray marching
    let rowMaxZ = 0;
    if (enableOcclusionRemoval) {
      for (let x = 0; x < width; x++) {
        const z = depthMap[rowOffset + x];
        if (z > rowMaxZ) rowMaxZ = z;
      }
    }

    let prevRight = -1;
    let prevLeft = -1;

    // Step 1: Constraint calculation with Thimbleby hidden surface removal
    for (let x = 0; x < width; x++) {
      const z = depthMap[rowOffset + x];

      // Disparity shift
      const disp = Math.round(z * maxDisparity);
      const sep = isCrossEyed ? patternPeriod + disp : patternPeriod - disp;

      const left = x - Math.floor(sep / 2);
      const right = left + sep;

      if (left >= 0 && right < width) {
        let isVisible = true;

        // Only ray march if enabled and point is below the highest point on the row
        if (enableOcclusionRemoval && rowMaxZ > 0.001 && z < rowMaxZ) {
          // Thimbleby-Inglis-Witten directional line-of-sight hidden surface removal (1994)
          // The line of sight from 3D surface point (x, z) to the left eye screen pixel (left)
          // travels leftward over horizontal distance (x - left) up to eye elevation zEye.
          // The line of sight to the right eye screen pixel (right) travels rightward over (right - x).
          const halfSep = Math.max(1, Math.floor(sep / 2));
          const zEye = 2.0;
          const slope = (zEye - z) / halfSep;

          // 1. Check left sightline: obstacles between x and left (leftward)
          for (let t = 1; t <= halfSep; t++) {
            const rayZ = z + t * slope;
            if (rayZ >= 1.0) break;
            const leftK = x - t;
            if (leftK >= 0 && depthMap[rowOffset + leftK] > rayZ) {
              isVisible = false;
              break;
            }
          }

          // 2. Check right sightline: obstacles between x and right (rightward)
          if (isVisible) {
            for (let t = 1; t <= halfSep; t++) {
              const rayZ = z + t * slope;
              if (rayZ >= 1.0) break;
              const rightK = x + t;
              if (rightK < width && depthMap[rowOffset + rightK] > rayZ) {
                isVisible = false;
                break;
              }
            }
          }
        }

        if (isVisible) {
          // Continuous slope gap-filling: on sloping surfaces (where d(sep)/dx != 0),
          // integer rounding of disparity causes left or right screen projections to skip 1-2 pixels.
          // In textured stereograms, skipped pixels become unconstrained roots that sample out-of-phase
          // base pattern colors, producing contour step lines ("height indications on a map") that echo
          // across the scanline to the right edge. Linking skipped pixels smoothly eliminates these tears.
          if (prevRight >= 0 && right > prevRight + 1 && right - prevRight <= 3) {
            for (let gap = prevRight + 1; gap < right; gap++) {
              const frac = (gap - prevRight) / (right - prevRight);
              const interpLeft = Math.round(prevLeft + frac * (left - prevLeft));
              union(interpLeft, gap);
            }
          }

          if (prevLeft >= 0 && left > prevLeft + 1 && left - prevLeft <= 3) {
            for (let gap = prevLeft + 1; gap < left; gap++) {
              const frac = (gap - prevLeft) / (left - prevLeft);
              const interpRight = Math.round(prevRight + frac * (right - prevRight));
              union(gap, interpRight);
            }
          }

          union(left, right);
          prevLeft = left;
          prevRight = right;
        }
      }
    }

    // Step 2: Pre-sample single period strip of pattern colors for row y (95% faster)
    for (let px = 0; px < effectivePeriod; px++) {
      const [r, g, b] = samplePatternColor(
        patternType,
        px,
        y,
        effectivePeriod,
        grainSize,
        customImageData
      );
      const cIdx = px * 3;
      patternCache[cIdx] = r;
      patternCache[cIdx + 1] = g;
      patternCache[cIdx + 2] = b;
    }

    // Step 3: Assign colors to disjoint set roots and propagate
    for (let x = 0; x < width; x++) {
      const root = find(x);
      if (root === x) {
        const cX = ((x % effectivePeriod) + effectivePeriod) % effectivePeriod;
        const cIdx = cX * 3;
        rowR[x] = patternCache[cIdx];
        rowG[x] = patternCache[cIdx + 1];
        rowB[x] = patternCache[cIdx + 2];
      } else {
        rowR[x] = rowR[root];
        rowG[x] = rowG[root];
        rowB[x] = rowB[root];
      }
    }

    // Step 4: Write scanline to ImageData buffer
    let pixelIdx = rowOffset * 4;
    for (let x = 0; x < width; x++) {
      targetData[pixelIdx] = rowR[x];
      targetData[pixelIdx + 1] = rowG[x];
      targetData[pixelIdx + 2] = rowB[x];
      targetData[pixelIdx + 3] = 255;
      pixelIdx += 4;
    }
  }
}

/**
 * Main Thimbleby-Inglis-Witten SIRDS/SIS generation engine
 */
export function generateStereogram(
  depthMap: Float32Array,
  width: number,
  height: number,
  config: StereogramConfig
): ImageData {
  const imgData = createImageDataHelper(width, height);
  renderStereogramRows(depthMap, width, height, config, 0, height - 1, imgData.data);

  // Draw optional convergence guide dots at the top
  if (config.showGuideDots) {
    drawGuideDots(imgData.data, width, height, config.patternPeriod, config.guideDotColor);
  }

  return imgData;
}

/**
 * Draws two convergence guide dots separated by exactly patternPeriod
 * positioned symmetrically at the top center of the image.
 */
export function drawGuideDots(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  period: number,
  dotColorHex: string = '#6366f1'
): void {
  // Parse hex color
  let cr = 99, cg = 102, cb = 241;
  if (dotColorHex.startsWith('#') && dotColorHex.length === 7) {
    cr = parseInt(dotColorHex.slice(1, 3), 16);
    cg = parseInt(dotColorHex.slice(3, 5), 16);
    cb = parseInt(dotColorHex.slice(5, 7), 16);
  }

  const dotRadius = Math.max(6, Math.round(width * 0.0075));
  const centerY = Math.max(24, Math.round(height * 0.04));
  if (centerY + dotRadius >= height) return;

  const centerX = Math.floor(width / 2);
  const leftX = Math.round(centerX - period / 2);
  const rightX = Math.round(centerX + period / 2);

  const dots = [leftX, rightX];

  for (const cx of dots) {
    if (cx - dotRadius < 0 || cx + dotRadius >= width) continue;

    for (let dy = -dotRadius - 2; dy <= dotRadius + 2; dy++) {
      const py = centerY + dy;
      if (py < 0 || py >= height) continue;

      for (let dx = -dotRadius - 2; dx <= dotRadius + 2; dx++) {
        const px = cx + dx;
        if (px < 0 || px >= width) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const pIdx = (py * width + px) * 4;

        if (dist <= dotRadius) {
          // Solid dot color
          data[pIdx] = cr;
          data[pIdx + 1] = cg;
          data[pIdx + 2] = cb;
          data[pIdx + 3] = 255;
        } else if (dist <= dotRadius + 1.5) {
          // Dark border for high contrast against any pattern
          data[pIdx] = 0;
          data[pIdx + 1] = 0;
          data[pIdx + 2] = 0;
          data[pIdx + 3] = 255;
        }
      }
    }
  }
}

/**
 * Calculates optimal stereogram optics (patternPeriod and maxDisparity)
 * tailored to canvas width, viewing ease, and application mode:
 * - Studio mode:
 *   - 'easy': 0.5x of base autotune (quickest convergence, minimal eye effort)
 *   - 'medium': 0.75x of base autotune (balanced depth and comfort - DEFAULT for Studio)
 *   - 'hard': 1.0x of base autotune (full maximum 3D immersion and depth separation)
 * - Labyrinth mode:
 *   - 'easy': 100px period, 15px disparity (effortless 3D lock for tracking the moving cube - DEFAULT for Labyrinth)
 *   - 'medium': 140px period, 22px disparity (balanced 3D elevation and comfort)
 *   - 'hard': 180px period, 30px disparity (maximum dramatic depth separation)
 */
export function getAutotuneOptics(
  width: number,
  ease: EaseOfView = 'easy',
  mode: 'studio' | 'labyrinth' = 'studio'
): { patternPeriod: number; maxDisparity: number } {
  if (mode === 'labyrinth') {
    // In Labyrinth mode, the player tracks a real-time moving 3D cube.
    // Disparity is tuned for comfortable stereopsis without diplopia during rapid navigation.
    const scale = width > 1600 ? Math.min(1.3, width / 1600) : 1.0;
    if (ease === 'easy') {
      return {
        patternPeriod: Math.round(100 * scale),
        maxDisparity: Math.round(15 * scale),
      };
    } else if (ease === 'medium') {
      return {
        patternPeriod: Math.round(140 * scale),
        maxDisparity: Math.round(22 * scale),
      };
    } else {
      return {
        patternPeriod: Math.round(180 * scale),
        maxDisparity: Math.round(30 * scale),
      };
    }
  }

  // Studio Mode:
  const basePeriod = Math.max(90, Math.min(280, Math.round(width * 0.075 + 45)));
  const baseDisparity = Math.max(16, Math.min(52, Math.round(basePeriod * 0.185)));

  let factor = 0.5;
  if (ease === 'easy') {
    factor = 0.5;
  } else if (ease === 'medium') {
    factor = 0.75;
  } else if (ease === 'hard') {
    factor = 1.0;
  }

  const patternPeriod = Math.max(40, Math.round(basePeriod * factor));
  const maxDisparity = Math.max(6, Math.round(baseDisparity * factor));

  return { patternPeriod, maxDisparity };
}
