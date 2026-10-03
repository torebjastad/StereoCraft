import { describe, it, expect } from 'vitest';
import { evaluateShapeAtPixel, renderDepthMap, smoothDepthMap } from '../depthRenderer.ts';
import { ShapeObject } from '../../types/index.ts';

describe('depthRenderer', () => {
  it('correctly evaluates a circle at center and outside bounds', () => {
    const circle: ShapeObject = {
      id: 'c1',
      type: 'circle',
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      rotation: 0,
      depth: 0.8,
      profile: 'flat',
    };

    // Center
    expect(evaluateShapeAtPixel(circle, 100, 100)).toBeCloseTo(0.8);
    // Well inside
    expect(evaluateShapeAtPixel(circle, 110, 100)).toBeCloseTo(0.8);
    // Just outside radius (25px)
    expect(evaluateShapeAtPixel(circle, 130, 100)).toBe(0);
  });

  it('generates spherical dome profile with higher depth at apex', () => {
    const domeCircle: ShapeObject = {
      id: 'c2',
      type: 'circle',
      x: 100,
      y: 100,
      width: 60,
      height: 60,
      rotation: 0,
      depth: 1.0,
      profile: 'dome',
    };

    const center = evaluateShapeAtPixel(domeCircle, 100, 100);
    const mid = evaluateShapeAtPixel(domeCircle, 115, 100);
    const nearEdge = evaluateShapeAtPixel(domeCircle, 128, 100);

    expect(center).toBeCloseTo(1.0);
    expect(mid).toBeGreaterThan(nearEdge);
    expect(mid).toBeLessThan(center);
  });

  it('correctly rotates a square shape', () => {
    const square: ShapeObject = {
      id: 's1',
      type: 'square',
      x: 100,
      y: 100,
      width: 40,
      height: 40,
      rotation: 45, // diamond orientation
      depth: 0.7,
      profile: 'flat',
    };

    // At (100, 100) inside
    expect(evaluateShapeAtPixel(square, 100, 100)).toBeCloseTo(0.7);
    // Along rotated axis: (100 + 20*sqrt(2), 100) = ~128.28 is the tip of diamond
    expect(evaluateShapeAtPixel(square, 125, 100)).toBeCloseTo(0.7);
    // Outside the diamond tip
    expect(evaluateShapeAtPixel(square, 135, 100)).toBe(0);
  });

  it('renders star shape with 5 points', () => {
    const star: ShapeObject = {
      id: 'st1',
      type: 'star',
      x: 200,
      y: 200,
      width: 80,
      height: 80,
      rotation: 0,
      depth: 0.9,
      profile: 'flat',
      starPoints: 5,
      innerRadiusRatio: 0.45,
    };

    // Center is inside
    expect(evaluateShapeAtPixel(star, 200, 200)).toBeCloseTo(0.9);
    // Top point tip is at y = 200 - 40 = 160
    expect(evaluateShapeAtPixel(star, 200, 165)).toBeCloseTo(0.9);
    // Above top tip is outside
    expect(evaluateShapeAtPixel(star, 200, 150)).toBe(0);
  });

  it('renders depth map buffer and applies smoothing correctly', () => {
    const shapes: ShapeObject[] = [
      {
        id: '1',
        type: 'circle',
        x: 50,
        y: 50,
        width: 40,
        height: 40,
        rotation: 0,
        depth: 0.8,
        profile: 'flat',
      },
    ];

    const w = 100;
    const h = 100;
    const buffer = renderDepthMap(shapes, w, h, 0);
    expect(buffer.length).toBe(w * h);
    expect(buffer[50 * w + 50]).toBeCloseTo(0.8);
    expect(buffer[0]).toBe(0);

    const smoothed = smoothDepthMap(buffer, w, h, 2);
    expect(smoothed.length).toBe(w * h);
    expect(Number.isFinite(smoothed[50 * w + 50])).toBe(true);
    // The edge between 50 and 75 should be smoothed (non-zero)
    expect(smoothed[50 * w + 71]).toBeGreaterThan(0);
  });
});
