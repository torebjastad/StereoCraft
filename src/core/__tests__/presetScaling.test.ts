import { describe, it, expect } from 'vitest';
import { scalePresetShape } from '../../App.tsx';
import { ShapeObject } from '../../types/index.ts';

describe('Preset and Resolution Scaling', () => {
  const refShape: ShapeObject = {
    id: 'test-circle',
    type: 'circle',
    x: 400,
    y: 300,
    width: 200,
    height: 200,
    rotation: 0,
    depth: 0.8,
    profile: 'dome',
  };

  it('preserves exact 1:1 aspect ratio when scaling to 1080p widescreen (1920x1080)', () => {
    // 800x600 -> 1920x1080 (16:9)
    const scaled = scalePresetShape(refShape, 1920, 1080);

    // Height ratio is 1080 / 600 = 1.8
    // Width and height should both be 200 * 1.8 = 360
    expect(scaled.width).toBe(360);
    expect(scaled.height).toBe(360);
    // Aspect ratio must be exactly 1:1, NOT stretched to 1.33:1 or 16:9
    expect(scaled.width / scaled.height).toBe(1.0);

    // Center must be at the center of the 1080p canvas (960, 540)
    expect(scaled.x).toBe(960);
    expect(scaled.y).toBe(540);
  });

  it('scales shapes proportionally to 4K UHD (3840x2160) without becoming tiny', () => {
    // 800x600 -> 3840x2160
    const scaled = scalePresetShape(refShape, 3840, 2160);

    // Height ratio is 2160 / 600 = 3.6
    expect(scaled.width).toBe(720);
    expect(scaled.height).toBe(720);
    expect(scaled.x).toBe(1920);
    expect(scaled.y).toBe(1080);
  });

  it('preserves relative offsets of multiple shapes', () => {
    const satellite: ShapeObject = {
      id: 'sat',
      type: 'circle',
      x: 200, // 200px to the left of center (400 - 200)
      y: 190, // 110px above center (300 - 110)
      width: 80,
      height: 80,
      rotation: 0,
      depth: 0.5,
      profile: 'dome',
    };

    const scaled = scalePresetShape(satellite, 1920, 1080);
    // Center of 1920x1080 is (960, 540)
    // Scaled dx = -200 * 1.8 = -360 -> x = 960 - 360 = 600
    // Scaled dy = -110 * 1.8 = -198 -> y = 540 - 198 = 342
    expect(scaled.x).toBe(600);
    expect(scaled.y).toBe(342);
    expect(scaled.width).toBe(144);
    expect(scaled.height).toBe(144);
  });
});
