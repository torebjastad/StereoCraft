import { ShapeObject, DepthProfileType } from '../types/index.ts';
import {
  TextDepthField,
  TextMaskRasterizer,
  getTextDepthField,
  sampleTextField,
} from './textField.ts';

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
 * Calculates depth for a text shape by sampling its glyph depth field.
 * `edge` is the normalized distance to the nearest glyph edge (1 = stroke centre).
 */
function getTextDepth(
  field: TextDepthField,
  nx: number,
  ny: number,
  profile: DepthProfileType,
  maxDepth: number,
  sample: { coverage: number; edge: number }
): number {
  if (!sampleTextField(field, nx, ny, sample)) return 0;
  const { coverage, edge } = sample;
  if (coverage <= 0.002) return 0;

  switch (profile) {
    case 'dome':
      return maxDepth * Math.sin(edge * (Math.PI / 2)) * Math.min(1, coverage * 2);
    case 'pyramid':
      return maxDepth * edge * Math.min(1, coverage * 2);
    case 'beveled': {
      const t = Math.min(1, edge / 0.4);
      return maxDepth * (t * t * (3 - 2 * t)) * Math.min(1, coverage * 2);
    }
    case 'flat':
    default:
      return maxDepth * coverage;
  }
}

/**
 * Builds a per-pixel depth evaluator for a shape. All trigonometry and divisions are
 * hoisted out of the returned closure, which matters because it runs once per pixel.
 */
export function createShapeEvaluator(
  shape: ShapeObject,
  textField?: TextDepthField | null
): (x: number, y: number) => number {
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;
  if (halfW <= 0 || halfH <= 0) return () => 0;

  const { profile, depth } = shape;
  let shapeFn: (nx: number, ny: number) => number;

  switch (shape.type) {
    case 'circle':
      shapeFn = (nx, ny) => getCircleDepth(nx, ny, profile, depth);
      break;
    case 'square':
      shapeFn = (nx, ny) => getSquareDepth(nx, ny, profile, depth);
      break;
    case 'triangle':
      shapeFn = (nx, ny) => getTriangleDepth(nx, ny, profile, depth);
      break;
    case 'star': {
      const points = shape.starPoints ?? 5;
      const inner = shape.innerRadiusRatio ?? 0.45;
      shapeFn = (nx, ny) => getStarDepth(nx, ny, profile, depth, points, inner);
      break;
    }
    case 'text': {
      if (!textField) return () => 0;
      const sample = { coverage: 0, edge: 0 };
      shapeFn = (nx, ny) => getTextDepth(textField, nx, ny, profile, depth, sample);
      break;
    }
    default:
      return () => 0;
  }

  const rad = (-shape.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = shape.x;
  const cy = shape.y;
  const invHalfW = 1 / halfW;
  const invHalfH = 1 / halfH;

  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return shapeFn(rx * invHalfW, ry * invHalfH);
  };
}

/**
 * Evaluates the depth contribution of a single shape at canvas pixel (x, y).
 * Text shapes need their glyph field (see getTextDepthField) and contribute nothing without it.
 */
export function evaluateShapeAtPixel(
  shape: ShapeObject,
  x: number,
  y: number,
  textField?: TextDepthField | null
): number {
  return createShapeEvaluator(shape, textField)(x, y);
}

export interface PixelRegion {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Smooths depth buffer with a separable 1D Gaussian kernel to prevent
 * steep occlusion tears in the autostereogram.
 *
 * When `region` is given, only that (inclusive) pixel window is filtered; everything
 * outside is left at zero. Callers pass the padded bounding box of their non-zero
 * content, which gives identical output at a fraction of the cost.
 */
export function smoothDepthMap(
  buffer: Float32Array,
  width: number,
  height: number,
  radius: number,
  region?: PixelRegion
): Float32Array {
  if (radius <= 0) return buffer;

  const minX = region ? Math.max(0, region.minX) : 0;
  const maxX = region ? Math.min(width - 1, region.maxX) : width - 1;
  const minY = region ? Math.max(0, region.minY) : 0;
  const maxY = region ? Math.min(height - 1, region.maxY) : height - 1;

  const temp = new Float32Array(width * height);
  const result = new Float32Array(width * height);
  if (minX > maxX || minY > maxY) return result;

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

  // Horizontal pass. Rows above/below the window feed the vertical pass, so extend by radius.
  const hMinY = Math.max(0, minY - radius);
  const hMaxY = Math.min(height - 1, maxY + radius);
  for (let y = hMinY; y <= hMaxY; y++) {
    const rowOffset = y * width;
    for (let x = minX; x <= maxX; x++) {
      let val = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(width - 1, Math.max(0, x + k));
        val += buffer[rowOffset + sx] * kernel[k + radius];
      }
      temp[rowOffset + x] = val;
    }
  }

  // Vertical pass - cache-friendly row-major traversal
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * width;
    for (let x = minX; x <= maxX; x++) {
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

export interface RenderDepthOptions {
  /** Browser-provided glyph rasterizer; without it, text shapes are skipped. */
  textRasterizer?: TextMaskRasterizer;
}

/**
 * Renders full depth map for a collection of shapes
 */
export function renderDepthMap(
  shapes: ShapeObject[],
  width: number,
  height: number,
  smoothingRadius: number = 1,
  options: RenderDepthOptions = {}
): Float32Array {
  const depthBuffer = new Float32Array(width * height);

  if (shapes.length === 0) {
    return depthBuffer;
  }

  let regionMinX = Infinity;
  let regionMaxX = -Infinity;
  let regionMinY = Infinity;
  let regionMaxY = -Infinity;

  for (const shape of shapes) {
    const textField =
      shape.type === 'text' && options.textRasterizer
        ? getTextDepthField(shape, options.textRasterizer)
        : null;
    if (shape.type === 'text' && !textField) continue;

    // A box rotated about its centre always fits in a circle of radius hypot(w, h) / 2.
    const reach = Math.hypot(shape.width, shape.height) / 2 + 2;
    const minX = Math.max(0, Math.floor(shape.x - reach));
    const maxX = Math.min(width - 1, Math.ceil(shape.x + reach));
    const minY = Math.max(0, Math.floor(shape.y - reach));
    const maxY = Math.min(height - 1, Math.ceil(shape.y + reach));
    if (minX > maxX || minY > maxY) continue;

    if (minX < regionMinX) regionMinX = minX;
    if (maxX > regionMaxX) regionMaxX = maxX;
    if (minY < regionMinY) regionMinY = minY;
    if (maxY > regionMaxY) regionMaxY = maxY;

    const evaluate = createShapeEvaluator(shape, textField);
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * width;
      for (let x = minX; x <= maxX; x++) {
        const d = evaluate(x, y);
        if (d > 0) {
          const idx = rowOffset + x;
          if (d > depthBuffer[idx]) depthBuffer[idx] = d;
        }
      }
    }
  }

  if (smoothingRadius > 0) {
    if (regionMinX > regionMaxX) return depthBuffer; // nothing drawn on canvas
    return smoothDepthMap(depthBuffer, width, height, smoothingRadius, {
      minX: regionMinX - smoothingRadius,
      maxX: regionMaxX + smoothingRadius,
      minY: regionMinY - smoothingRadius,
      maxY: regionMaxY + smoothingRadius,
    });
  }

  return depthBuffer;
}
