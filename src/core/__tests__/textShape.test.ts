import { describe, it, expect, vi } from 'vitest';
import {
  buildTextDepthField,
  getTextDepthField,
  TextMaskRasterizer,
  TextGlyphMask,
} from '../textField.ts';
import {
  evaluateShapeAtPixel,
  renderDepthMap,
  smoothDepthMap,
} from '../depthRenderer.ts';
import { ShapeObject } from '../../types/index.ts';

/** Solid rectangular "glyph" with a 1px-clear margin: simulates a fat letter block. */
function solidBlockMask(w: number, h: number): TextGlyphMask {
  const alpha = new Uint8ClampedArray(w * h).fill(255);
  return { width: w, height: h, alpha };
}

const blockRasterizer: TextMaskRasterizer = (_shape, w, h) => solidBlockMask(w, h);

function makeText(partial: Partial<ShapeObject> = {}): ShapeObject {
  return {
    id: 't1',
    type: 'text',
    x: 100,
    y: 100,
    width: 60,
    height: 20,
    rotation: 0,
    depth: 0.8,
    profile: 'flat',
    text: 'HI',
    ...partial,
  };
}

describe('buildTextDepthField', () => {
  it('computes coverage and normalized edge distance (0 at border, 1 at stroke centre)', () => {
    const field = buildTextDepthField(solidBlockMask(21, 9));
    expect(field.width).toBe(21);
    expect(field.height).toBe(9);
    // border pixels touch the outside of the glyph
    expect(field.edge[0]).toBeLessThan(0.3);
    // centre of the block is the furthest from any edge
    const centre = 4 * 21 + 10;
    expect(field.edge[centre]).toBeCloseTo(1, 5);
    expect(field.coverage[centre]).toBe(1);
  });

  it('keeps empty pixels at zero coverage and zero edge distance', () => {
    const alpha = new Uint8ClampedArray(5 * 5);
    alpha[12] = 255; // single dot in the centre
    const field = buildTextDepthField({ width: 5, height: 5, alpha });
    expect(field.coverage[0]).toBe(0);
    expect(field.edge[0]).toBe(0);
    expect(field.coverage[12]).toBe(1);
    expect(field.edge[12]).toBeGreaterThan(0);
  });
});

describe('getTextDepthField', () => {
  it('returns null for empty text without calling the rasterizer', () => {
    const spy = vi.fn(blockRasterizer);
    expect(getTextDepthField(makeText({ text: '   ' }), spy)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('caches by text, font and size so repeated renders do not re-rasterize', () => {
    const spy = vi.fn(blockRasterizer);
    const shape = makeText();
    const a = getTextDepthField(shape, spy);
    const b = getTextDepthField({ ...shape, x: 400, rotation: 30, depth: 0.2 }, spy);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(spy).toHaveBeenCalledTimes(1);

    getTextDepthField({ ...shape, text: 'BYE' }, spy);
    expect(spy).toHaveBeenCalledTimes(2);
    getTextDepthField({ ...shape, width: 120 }, spy);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('returns null when the rasterizer cannot produce a mask', () => {
    expect(getTextDepthField(makeText(), () => null)).toBeNull();
  });
});

describe('text shape depth evaluation', () => {
  it('contributes nothing without a text field', () => {
    expect(evaluateShapeAtPixel(makeText(), 100, 100)).toBe(0);
  });

  it('flat profile gives constant depth inside the glyph and zero outside the box', () => {
    const shape = makeText();
    const field = getTextDepthField(shape, blockRasterizer)!;
    expect(evaluateShapeAtPixel(shape, 100, 100, field)).toBeCloseTo(0.8, 2);
    expect(evaluateShapeAtPixel(shape, 120, 105, field)).toBeCloseTo(0.8, 2);
    expect(evaluateShapeAtPixel(shape, 100, 130, field)).toBe(0);
    expect(evaluateShapeAtPixel(shape, 200, 100, field)).toBe(0);
  });

  it('dome profile peaks at the stroke centre and falls towards the edges', () => {
    const shape = makeText({ profile: 'dome', width: 80, height: 40 });
    const field = getTextDepthField(shape, blockRasterizer)!;
    const centre = evaluateShapeAtPixel(shape, 100, 100, field);
    const mid = evaluateShapeAtPixel(shape, 100, 112, field);
    const edge = evaluateShapeAtPixel(shape, 100, 118.5, field);
    expect(centre).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(edge);
    expect(centre).toBeCloseTo(0.8, 1);
  });

  it('follows rotation of the text box', () => {
    const shape = makeText({ rotation: 90 }); // 60x20 box becomes 20 wide, 60 tall
    const field = getTextDepthField(shape, blockRasterizer)!;
    expect(evaluateShapeAtPixel(shape, 100, 125, field)).toBeCloseTo(0.8, 2);
    expect(evaluateShapeAtPixel(shape, 125, 100, field)).toBe(0);
  });
});

describe('renderDepthMap with text', () => {
  it('renders text through the injected rasterizer and ignores it without one', () => {
    const shape = makeText({ x: 50, y: 30, width: 40, height: 16 });
    const withText = renderDepthMap([shape], 100, 60, 0, { textRasterizer: blockRasterizer });
    expect(withText[30 * 100 + 50]).toBeCloseTo(0.8, 2);
    expect(withText[2 * 100 + 2]).toBe(0);

    const without = renderDepthMap([shape], 100, 60, 0);
    expect(Math.max(...without)).toBe(0);
  });
});

describe('optimized depth rendering equivalence', () => {
  const shapes: ShapeObject[] = [
    { id: 'a', type: 'star', x: 70, y: 60, width: 90, height: 70, rotation: 25, depth: 0.9, profile: 'dome', starPoints: 6, innerRadiusRatio: 0.5 },
    { id: 'b', type: 'square', x: 130, y: 90, width: 50, height: 30, rotation: -40, depth: 0.6, profile: 'beveled' },
    { id: 'c', type: 'triangle', x: 40, y: 100, width: 60, height: 50, rotation: 160, depth: 0.7, profile: 'pyramid' },
    { id: 'd', type: 'circle', x: 150, y: 40, width: 70, height: 30, rotation: 10, depth: 0.5, profile: 'flat' },
  ];
  const W = 190;
  const H = 130;

  it('bounding-box rendering matches a brute-force full-canvas evaluation', () => {
    const fast = renderDepthMap(shapes, W, H, 0);
    const brute = new Float32Array(W * H);
    for (const s of shapes) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = evaluateShapeAtPixel(s, x, y);
          if (d > brute[y * W + x]) brute[y * W + x] = d;
        }
      }
    }
    let maxDiff = 0;
    for (let i = 0; i < brute.length; i++) maxDiff = Math.max(maxDiff, Math.abs(brute[i] - fast[i]));
    expect(maxDiff).toBeLessThan(1e-6);
  });

  it('region-limited smoothing is identical to full-canvas smoothing', () => {
    const raw = renderDepthMap(shapes, W, H, 0);
    const full = smoothDepthMap(raw, W, H, 2);
    const viaRender = renderDepthMap(shapes, W, H, 2);
    let maxDiff = 0;
    for (let i = 0; i < full.length; i++) maxDiff = Math.max(maxDiff, Math.abs(full[i] - viaRender[i]));
    expect(maxDiff).toBeLessThan(1e-6);
  });

  it('handles shapes entirely off-canvas without throwing', () => {
    const off: ShapeObject = { ...shapes[0], x: -500, y: -500 };
    const out = renderDepthMap([off], W, H, 1);
    expect(Math.max(...out)).toBe(0);
  });
});
