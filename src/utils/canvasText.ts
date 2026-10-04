import { ShapeObject, TextFontId } from '../types/index.ts';
import { layoutText, LineMetrics, TextLayout } from '../core/textLayout.ts';
import { TextGlyphMask, TextMaskRasterizer } from '../core/textField.ts';

/**
 * Browser-only text helpers (2D canvas font engine). Everything pure lives in
 * src/core; this file only adapts canvas measurement/drawing to those interfaces.
 */

export const TEXT_FONTS: { id: TextFontId; label: string; css: string }[] = [
  { id: 'sans', label: 'Sans', css: '"Plus Jakarta Sans", "Segoe UI", Arial, sans-serif' },
  { id: 'impact', label: 'Impact', css: 'Impact, Haettenschweiler, "Arial Black", sans-serif' },
  { id: 'serif', label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono', css: '"JetBrains Mono", Consolas, "Courier New", monospace' },
  { id: 'rounded', label: 'Rounded', css: '"Arial Rounded MT Bold", "Trebuchet MS", Verdana, sans-serif' },
];

/** Reference size glyphs are measured/drawn at; the result is scaled to the shape box. */
const REF_FONT_SIZE = 100;
const LINE_HEIGHT = 1.15;

function fontCss(id: TextFontId | undefined): string {
  return (TEXT_FONTS.find((f) => f.id === (id ?? 'sans')) ?? TEXT_FONTS[0]).css;
}

function fontString(shape: ShapeObject): string {
  const style = shape.fontItalic ? 'italic ' : '';
  const weight = Boolean(shape.fontBold) ? '700 ' : '400 ';
  return `${style}${weight}${REF_FONT_SIZE}px ${fontCss(shape.fontFamily)}`;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

const layoutCache = new Map<string, TextLayout>();
const MAX_LAYOUT_CACHE = 64;

/** Call after web fonts finish loading so cached measurements are recomputed. */
export function clearTextLayoutCache(): void {
  layoutCache.clear();
}

/** Tight ink layout of a text shape's content at the reference font size (cached). */
export function getShapeTextLayout(shape: ShapeObject): TextLayout {
  const text = shape.text ?? '';
  const key = `${text}|${shape.fontFamily ?? 'sans'}|${Boolean(shape.fontBold) ? 1 : 0}|${shape.fontItalic ? 1 : 0}`;
  const cached = layoutCache.get(key);
  if (cached) return cached;

  const ctx = getMeasureCtx();
  const layout = layoutText(
    text,
    (line): LineMetrics => {
      if (!ctx) {
        const w = line.length * REF_FONT_SIZE * 0.6;
        return { width: w, left: 0, right: w, ascent: REF_FONT_SIZE * 0.75, descent: REF_FONT_SIZE * 0.2 };
      }
      ctx.font = fontString(shape);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const m = ctx.measureText(line);
      return {
        width: m.width,
        left: m.actualBoundingBoxLeft,
        right: m.actualBoundingBoxRight,
        ascent: m.actualBoundingBoxAscent,
        descent: m.actualBoundingBoxDescent,
      };
    },
    LINE_HEIGHT,
    REF_FONT_SIZE
  );

  layoutCache.set(key, layout);
  if (layoutCache.size > MAX_LAYOUT_CACHE) {
    const oldest = layoutCache.keys().next().value;
    if (oldest !== undefined) layoutCache.delete(oldest);
  }
  return layout;
}

/** Width / height of the text's ink, used to size a text box without distorting it. */
export function measureTextAspect(shape: ShapeObject): number {
  return getShapeTextLayout(shape).aspect;
}

/**
 * Draws a text shape's content stretched to fill the box (0, 0) - (boxW, boxH) of the
 * current transform. The stage preview and the depth rasterizer share this, so what you
 * see on the stage is exactly what gets embossed.
 */
export function drawFittedText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: ShapeObject,
  boxW: number,
  boxH: number,
  fillStyle: string
): void {
  const layout = getShapeTextLayout(shape);
  ctx.save();
  ctx.font = fontString(shape);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = fillStyle;
  ctx.scale(boxW / layout.width, boxH / layout.height);
  ctx.translate(-layout.minX, -layout.minY);
  for (const line of layout.lines) {
    if (line.text.trim()) ctx.fillText(line.text, line.x, line.y);
  }
  ctx.restore();
}

/**
 * Creates a rasterizer for the core depth renderer. A fresh instance has an empty
 * field cache in the core, so create a new one whenever fonts finish loading.
 */
export function createCanvasTextRasterizer(): TextMaskRasterizer {
  let canvas: HTMLCanvasElement | null = null;

  return (shape: ShapeObject, w: number, h: number): TextGlyphMask | null => {
    if (typeof document === 'undefined') return null;
    if (!canvas) canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, w, h);
    drawFittedText(ctx, shape, w, h, '#ffffff');
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const alpha = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 3; i < alpha.length; i++, p += 4) {
      alpha[i] = rgba[p];
    }
    return { width: w, height: h, alpha };
  };
}
