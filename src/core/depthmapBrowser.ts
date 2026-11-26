import { DecodedDepthmap, DepthmapEntry, ShapeObject } from '../types/index.ts';

/** Default fraction of the canvas/screen filled by a browsed depthmap (3/4 = 0.75). */
export const DEFAULT_BROWSER_FILL_RATIO = 0.75;

export const SUPPORTED_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.avif',
] as const;

export interface CenteredFitPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Checks whether a filename has a supported raster image extension.
 */
export function isSupportedImageFilename(filename: string): boolean {
  const lower = filename.trim().toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Converts a filename like "bearded-man-face.jpg" or "depthmap_001_seed123.png"
 * into a clean human-readable display label.
 */
export function formatDepthmapTitle(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const spaced = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return base;
  return spaced.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

/**
 * Naturally sorts depthmap entries (e.g., depthmap_002 before depthmap_010).
 */
export function sortDepthmapEntries<T extends { relativePath?: string; fileName: string }>(
  entries: readonly T[]
): T[] {
  return [...entries].sort((a, b) => {
    const aKey = a.relativePath || a.fileName;
    const bKey = b.relativePath || b.fileName;
    return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Computes centered, aspect-preserving dimensions so that an image fills `fillRatio`
 * (default 3/4 = 0.75) of the canvas along its constraining axis without stretching or cropping.
 */
export function computeCenteredFitPlacement(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  fillRatio: number = DEFAULT_BROWSER_FILL_RATIO
): CenteredFitPlacement {
  const safeImgW = Math.max(1, imageWidth);
  const safeImgH = Math.max(1, imageHeight);
  const safeCanvasW = Math.max(1, canvasWidth);
  const safeCanvasH = Math.max(1, canvasHeight);
  const clampedFill = Math.min(1.0, Math.max(0.1, fillRatio));

  const targetMaxW = safeCanvasW * clampedFill;
  const targetMaxH = safeCanvasH * clampedFill;
  const scale = Math.min(targetMaxW / safeImgW, targetMaxH / safeImgH);

  return {
    x: Math.round(safeCanvasW / 2),
    y: Math.round(safeCanvasH / 2),
    width: Math.max(1, Math.round(safeImgW * scale)),
    height: Math.max(1, Math.round(safeImgH * scale)),
    scale,
  };
}

/**
 * Converts an RGBA pixel buffer to a single-channel grayscale luminance buffer [0..255],
 * premultiplying by alpha so transparent margins map to zero depth (far background).
 */
export function rgbaToGrayscaleDepth(
  rgba: Uint8ClampedArray,
  pixelCount: number
): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    const lum = 0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2];
    const alpha = rgba[p + 3] / 255.0;
    gray[i] = Math.round(lum * alpha);
  }
  return gray;
}

/**
 * Creates a centered, 3/4-scaled image ShapeObject ready for StereoCraft's depthMap renderer.
 */
export function createCenteredDepthmapShape(
  entry: DepthmapEntry,
  decoded: DecodedDepthmap,
  canvasWidth: number,
  canvasHeight: number,
  options?: {
    fillRatio?: number;
    depth?: number;
    invertDepth?: boolean;
  }
): ShapeObject {
  const placement = computeCenteredFitPlacement(
    decoded.width,
    decoded.height,
    canvasWidth,
    canvasHeight,
    options?.fillRatio ?? DEFAULT_BROWSER_FILL_RATIO
  );

  return {
    id: `browser-${entry.id}`,
    type: 'image',
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    rotation: 0,
    depth: options?.depth ?? 0.98,
    profile: 'flat',
    imageData: decoded.data,
    imageWidth: decoded.width,
    imageHeight: decoded.height,
    imageUrl: entry.url,
    invertDepth: Boolean(options?.invertDepth),
  };
}

/**
 * Advances or rewinds a slideshow index with circular wrap-around.
 * Returns -1 when the collection is empty.
 */
export function stepSlideshowIndex(
  currentIndex: number,
  delta: number,
  total: number
): number {
  if (total <= 0) return -1;
  const safeCurrent = ((currentIndex % total) + total) % total;
  return (((safeCurrent + delta) % total) + total) % total;
}
