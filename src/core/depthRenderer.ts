import { ShapeObject, DepthProfileType } from '../types/index.ts';

/**
 * Calculates depth at normalized coordinate (nx, ny) for a circle
 */
function getCircleDepth(nx: number, ny: number, profile: DepthProfileType, maxDepth: number): number {
  const r2 = nx * nx + ny * ny;
  if (r2 > 1.0) return 0;
  const r = Math.sqrt(r2);

  switch (profile) {
    case 'dome':
      // Smooth spherical/cosine dome
      return maxDepth * Math.cos(r * (Math.PI / 2));
    case 'pyramid':
      // Cone
      return maxDepth * (1 - r);
    case 'beveled': {
      const edgeDist = 1 - r;
      const bevelWidth = 0.3;
      const t = Math.min(1, edgeDist / bevelWidth);
      return maxDepth * (t * t * (3 - 2 * t)); // smoothstep
    }
    case 'flat':
    default:
      return maxDepth;
  }
}

/**
 * Calculates depth for a square / rectangle
 */
function getSquareDepth(nx: number, ny: number, profile: DepthProfileType, maxDepth: number): number {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  if (ax > 1.0 || ay > 1.0) return 0;

  const d = 1.0 - Math.max(ax, ay);

  switch (profile) {
    case 'dome': {
      // Rounded pillow
      const factor = Math.sin(Math.min(1, d * 2) * (Math.PI / 2));
      return maxDepth * factor;
    }
    case 'pyramid':
      return maxDepth * d;
    case 'beveled': {
      const bevelWidth = 0.25;
      const t = Math.min(1, d / bevelWidth);
      return maxDepth * (t * t * (3 - 2 * t));
    }
    case 'flat':
    default:
      return maxDepth;
  }
}

/**
 * Calculates depth for an upward-pointing triangle
 */
function getTriangleDepth(nx: number, ny: number, profile: DepthProfileType, maxDepth: number): number {
  // Vertices of triangle: Top (0, -1), Bottom-Left (-1, 0.8), Bottom-Right (1, 0.8)
  const yBottom = 0.8;
  const yTop = -1.0;
  if (ny > yBottom || ny < yTop) return 0;

  // Normalized height from top
  const hFraction = (ny - yTop) / (yBottom - yTop);
  // Half-width at this y
  const halfW = hFraction;
  if (Math.abs(nx) > halfW) return 0;

  // Distance from 3 edges:
  const dBottom = (yBottom - ny) / (yBottom - yTop);
  const dLeft = (halfW - nx) / 2;
  const dRight = (halfW + nx) / 2;
  const edgeDist = Math.max(0, Math.min(dBottom, dLeft, dRight));

  switch (profile) {
    case 'dome':
      return maxDepth * Math.sin(Math.min(1, edgeDist * 3) * (Math.PI / 2));
    case 'pyramid':
      return maxDepth * Math.min(1, edgeDist * 2.5);
    case 'beveled': {
      const t = Math.min(1, edgeDist * 3.5);
      return maxDepth * (t * t * (3 - 2 * t));
    }
    case 'flat':
    default:
      return maxDepth;
  }
}

/**
 * Calculates depth for an N-pointed star
 */
function getStarDepth(
  nx: number,
  ny: number,
  profile: DepthProfileType,
  maxDepth: number,
  points: number = 5,
  innerRatio: number = 0.45
): number {
  const r = Math.sqrt(nx * nx + ny * ny);
  if (r > 1.0) return 0;
  if (r === 0) return maxDepth;

  // Angle from -PI to PI, offset so tip is pointing up
  let angle = Math.atan2(ny, nx) + Math.PI / 2;
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;

  const step = Math.PI / points;
  const piece = angle % (step * 2);
  const relAngle = piece > step ? 2 * step - piece : piece;
  const t = relAngle / step; // 0 at tip (r=1.0), 1 at inner valley (r=innerRatio)
  const maxR = 1.0 - t * (1.0 - innerRatio);

  if (r > maxR) return 0;

  const radialFraction = r / maxR;
  const edgeDist = 1.0 - radialFraction;

  switch (profile) {
    case 'dome':
      return maxDepth * Math.cos(radialFraction * (Math.PI / 2));
    case 'pyramid':
      return maxDepth * edgeDist;
    case 'beveled': {
      const b = Math.min(1, edgeDist * 3.0);
      return maxDepth * (b * b * (3 - 2 * b));
    }
    case 'flat':
    default:
      return maxDepth;
  }
}

/**
 * Evaluates the depth contribution of a single shape at canvas pixel (x, y)
 */
export function evaluateShapeAtPixel(shape: ShapeObject, x: number, y: number): number {
  const dx = x - shape.x;
  const dy = y - shape.y;

  // Rotate point backwards
  const rad = (-shape.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  // Normalized to [-1, 1] relative to half-dimensions
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;
  if (halfW <= 0 || halfH <= 0) return 0;

  const nx = rx / halfW;
  const ny = ry / halfH;

  switch (shape.type) {
    case 'circle':
      return getCircleDepth(nx, ny, shape.profile, shape.depth);
    case 'square':
      return getSquareDepth(nx, ny, shape.profile, shape.depth);
    case 'triangle':
      return getTriangleDepth(nx, ny, shape.profile, shape.depth);
    case 'star':
      return getStarDepth(
        nx,
        ny,
        shape.profile,
        shape.depth,
        shape.starPoints ?? 5,
        shape.innerRadiusRatio ?? 0.45
      );
    default:
      return 0;
  }
}

/**
 * Smooths depth buffer with a separable 1D Gaussian kernel to prevent
 * steep occlusion tears in the autostereogram
 */
export function smoothDepthMap(
  buffer: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  if (radius <= 0) return buffer;

  const temp = new Float32Array(width * height);
  const result = new Float32Array(width * height);

  // Kernel weights for radius 1, 2, or 3
  const kernel: number[] = [];
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) / (2 * (radius * 0.6) * (radius * 0.6)));
    kernel.push(w);
    sum += w;
  }
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(width - 1, Math.max(0, x + k));
        val += buffer[rowOffset + sx] * kernel[k + radius];
      }
      temp[rowOffset + x] = val;
    }
  }

  // Vertical pass - cache-friendly row-major traversal
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(height - 1, Math.max(0, y + k));
        val += temp[sy * width + x] * kernel[k + radius];
      }
      result[rowOffset + x] = val;
    }
  }

  return result;
}

/**
 * Renders full depth map for a collection of shapes
 */
export function renderDepthMap(
  shapes: ShapeObject[],
  width: number,
  height: number,
  smoothingRadius: number = 1
): Float32Array {
  const depthBuffer = new Float32Array(width * height);

  if (shapes.length === 0) {
    return depthBuffer;
  }

  // Compute bounding boxes for each shape to optimize rendering
  const shapeBoxes = shapes.map((shape) => {
    const maxDim = Math.max(shape.width, shape.height) * 1.45;
    return {
      shape,
      minX: Math.max(0, Math.floor(shape.x - maxDim)),
      maxX: Math.min(width - 1, Math.ceil(shape.x + maxDim)),
      minY: Math.max(0, Math.floor(shape.y - maxDim)),
      maxY: Math.min(height - 1, Math.ceil(shape.y + maxDim)),
    };
  });

  for (const { shape, minX, maxX, minY, maxY } of shapeBoxes) {
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * width;
      for (let x = minX; x <= maxX; x++) {
        const d = evaluateShapeAtPixel(shape, x, y);
        if (d > 0) {
          const idx = rowOffset + x;
          depthBuffer[idx] = Math.max(depthBuffer[idx], d);
        }
      }
    }
  }

  if (smoothingRadius > 0) {
    return smoothDepthMap(depthBuffer, width, height, smoothingRadius);
  }

  return depthBuffer;
}
