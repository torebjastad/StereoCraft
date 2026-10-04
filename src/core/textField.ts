import { ShapeObject } from '../types/index.ts';

/**
 * Pure (DOM-free) support for text shapes.
 *
 * Glyph rasterization needs a font engine, which only exists in the browser, so the
 * core never draws text itself. Instead callers inject a {@link TextMaskRasterizer}
 * that returns an 8-bit coverage mask of the text stretched to fill the shape's box.
 * The core then converts that mask into a {@link TextDepthField} (coverage plus a
 * normalized distance-to-edge channel) that depth profiles can sample.
 */

export interface TextGlyphMask {
  width: number;
  height: number;
  /** Row-major glyph coverage, 0 (empty) to 255 (solid). Length = width * height. */
  alpha: Uint8ClampedArray | Uint8Array;
}

/** Rasterizes `shape.text` so the ink fills the full `maskWidth` x `maskHeight` box. */
export type TextMaskRasterizer = (
  shape: ShapeObject,
  maskWidth: number,
  maskHeight: number
) => TextGlyphMask | null;

export interface TextDepthField {
  width: number;
  height: number;
  /** Anti-aliased glyph coverage in [0, 1]. */
  coverage: Float32Array;
  /** Distance to the nearest glyph edge, normalized so the thickest stroke centre is 1. */
  edge: Float32Array;
}

const SQRT2 = Math.SQRT2;
const MAX_MASK_DIM = 2048;
const MAX_MASK_PIXELS = 1_500_000;
const MAX_CACHE_ENTRIES = 24;

/**
 * Converts a glyph coverage mask into a depth field using a two-pass chamfer
 * distance transform. Pixels on the mask border count as touching the outside, so
 * ink that reaches the edge of the (tight) text box still gets a proper edge ramp.
 */
export function buildTextDepthField(mask: TextGlyphMask): TextDepthField {
  const { width: w, height: h, alpha } = mask;
  const n = w * h;
  const coverage = new Float32Array(n);
  const dist = new Float32Array(n);
  const INF = 1e9;

  for (let i = 0; i < n; i++) {
    coverage[i] = alpha[i] / 255;
    dist[i] = alpha[i] >= 128 ? INF : 0;
  }

  // Treat everything beyond the image as empty space.
  for (let x = 0; x < w; x++) {
    if (dist[x] > 1) dist[x] = 1;
    const b = (h - 1) * w + x;
    if (dist[b] > 1) dist[b] = 1;
  }
  for (let y = 0; y < h; y++) {
    const l = y * w;
    if (dist[l] > 1) dist[l] = 1;
    const r = l + w - 1;
    if (dist[r] > 1) dist[r] = 1;
  }

  // Forward pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let d = dist[i];
      if (d === 0) continue;
      if (x > 0) d = Math.min(d, dist[i - 1] + 1);
      if (y > 0) {
        d = Math.min(d, dist[i - w] + 1);
        if (x > 0) d = Math.min(d, dist[i - w - 1] + SQRT2);
        if (x < w - 1) d = Math.min(d, dist[i - w + 1] + SQRT2);
      }
      dist[i] = d;
    }
  }

  // Backward pass
  let maxDist = 1;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let d = dist[i];
      if (d === 0) continue;
      if (x < w - 1) d = Math.min(d, dist[i + 1] + 1);
      if (y < h - 1) {
        d = Math.min(d, dist[i + w] + 1);
        if (x < w - 1) d = Math.min(d, dist[i + w + 1] + SQRT2);
        if (x > 0) d = Math.min(d, dist[i + w - 1] + SQRT2);
      }
      dist[i] = d;
      if (d > maxDist) maxDist = d;
    }
  }

  const edge = new Float32Array(n);
  const inv = 1 / maxDist;
  for (let i = 0; i < n; i++) {
    edge[i] = Math.min(1, dist[i] * inv);
  }

  return { width: w, height: h, coverage, edge };
}

const fieldCaches = new WeakMap<TextMaskRasterizer, Map<string, TextDepthField | null>>();

/**
 * Mask resolution for a shape: roughly 1 mask pixel per canvas pixel, capped so a
 * very large text box cannot blow up memory.
 */
function getMaskSize(shape: ShapeObject): { w: number; h: number } {
  let w = Math.max(4, Math.round(shape.width));
  let h = Math.max(4, Math.round(shape.height));
  const down = Math.min(1, MAX_MASK_DIM / w, MAX_MASK_DIM / h, Math.sqrt(MAX_MASK_PIXELS / (w * h)));
  if (down < 1) {
    w = Math.max(4, Math.round(w * down));
    h = Math.max(4, Math.round(h * down));
  }
  return { w, h };
}

/**
 * Returns the (cached) depth field for a text shape, or null for empty text or when
 * the rasterizer cannot produce a mask. Cache keys cover everything that affects the
 * glyph image (text, font, weight, style, mask size) but not position, rotation or
 * depth, so moving or re-elevating text never re-rasterizes it.
 */
export function getTextDepthField(
  shape: ShapeObject,
  rasterizer: TextMaskRasterizer
): TextDepthField | null {
  const text = shape.text ?? '';
  if (!text.trim()) return null;

  const { w, h } = getMaskSize(shape);
  const key = [text, shape.fontFamily ?? 'sans', Boolean(shape.fontBold) ? 1 : 0, shape.fontItalic ? 1 : 0, w, h].join('|');

  let cache = fieldCaches.get(rasterizer);
  if (!cache) {
    cache = new Map();
    fieldCaches.set(rasterizer, cache);
  }

  if (cache.has(key)) {
    const hit = cache.get(key)!;
    // refresh LRU order
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const mask = rasterizer(shape, w, h);
  const field = mask ? buildTextDepthField(mask) : null;
  cache.set(key, field);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return field;
}

/** Bilinear sample of a row-major channel at continuous pixel coordinates. */
function sampleBilinear(data: Float32Array, w: number, h: number, fx: number, fy: number): number {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const xa = x0 < 0 ? 0 : x0 >= w ? w - 1 : x0;
  const xb = x0 + 1 < 0 ? 0 : x0 + 1 >= w ? w - 1 : x0 + 1;
  const ya = y0 < 0 ? 0 : y0 >= h ? h - 1 : y0;
  const yb = y0 + 1 < 0 ? 0 : y0 + 1 >= h ? h - 1 : y0 + 1;
  const top = data[ya * w + xa] * (1 - tx) + data[ya * w + xb] * tx;
  const bottom = data[yb * w + xa] * (1 - tx) + data[yb * w + xb] * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * Samples glyph coverage and edge distance at normalized box coordinates
 * (nx, ny in [-1, 1]). Returns false when the point is outside the box.
 */
export function sampleTextField(
  field: TextDepthField,
  nx: number,
  ny: number,
  out: { coverage: number; edge: number }
): boolean {
  if (nx < -1 || nx > 1 || ny < -1 || ny > 1) return false;
  const fx = (nx + 1) * 0.5 * field.width - 0.5;
  const fy = (ny + 1) * 0.5 * field.height - 0.5;
  out.coverage = sampleBilinear(field.coverage, field.width, field.height, fx, fy);
  out.edge = sampleBilinear(field.edge, field.width, field.height, fx, fy);
  return true;
}
