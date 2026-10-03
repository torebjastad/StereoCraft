import { describe, it, expect } from 'vitest';
import { scalePresetShape, scaleShapesForResolutionChange } from '../../App.tsx';
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

  it('accurately scales and centers the constellation preset from 800x600 to 1200x900 (HD 4:3)', () => {
    const constellation: ShapeObject[] = [
      { id: 'st-c', type: 'star', x: 400, y: 300, width: 220, height: 220, rotation: 0, depth: 0.95, profile: 'dome' },
      { id: 'st-1', type: 'circle', x: 200, y: 190, width: 80, height: 80, rotation: 0, depth: 0.6, profile: 'dome' },
      { id: 'st-2', type: 'square', x: 600, y: 190, width: 70, height: 70, rotation: 45, depth: 0.5, profile: 'beveled' },
      { id: 'st-3', type: 'triangle', x: 400, y: 480, width: 100, height: 90, rotation: 0, depth: 0.7, profile: 'pyramid' },
    ];

    const scaled = scaleShapesForResolutionChange(constellation, 800, 600, 1200, 900);

    // Center star must be exactly at canvas center (1200/2 = 600, 900/2 = 450)
    const star = scaled.find((s) => s.id === 'st-c')!;
    expect(star.x).toBe(600);
    expect(star.y).toBe(450);
    expect(star.width).toBe(330); // 220 * 1.5
    expect(star.height).toBe(330);

    // Circle at top-left
    const circle = scaled.find((s) => s.id === 'st-1')!;
    expect(circle.x).toBe(300); // 600 - 200 * 1.5
    expect(circle.y).toBe(285); // 450 - 110 * 1.5
    expect(circle.width).toBe(120); // 80 * 1.5
    expect(circle.height).toBe(120);

    // Square at top-right
    const square = scaled.find((s) => s.id === 'st-2')!;
    expect(square.x).toBe(900); // 600 + 200 * 1.5
    expect(square.y).toBe(285);
    expect(square.width).toBe(105);
    expect(square.height).toBe(105);

    // Triangle at bottom center
    const triangle = scaled.find((s) => s.id === 'st-3')!;
    expect(triangle.x).toBe(600);
    expect(triangle.y).toBe(720); // 450 + 180 * 1.5
    expect(triangle.width).toBe(150);
    expect(triangle.height).toBe(135);
  });

  it('performs clean round-trip resolution changes without drift', () => {
    const star: ShapeObject = {
      id: 'st-c',
      type: 'star',
      x: 400,
      y: 300,
      width: 220,
      height: 220,
      rotation: 0,
      depth: 0.95,
      profile: 'dome',
    };

    // 800x600 -> 1200x900 -> 800x600
    const to1200 = scaleShapesForResolutionChange([star], 800, 600, 1200, 900);
    const backTo800 = scaleShapesForResolutionChange(to1200, 1200, 900, 800, 600);

    expect(backTo800[0].x).toBe(400);
    expect(backTo800[0].y).toBe(300);
    expect(backTo800[0].width).toBe(220);
    expect(backTo800[0].height).toBe(220);
  });

  it('scales text shapes proportionally while preserving typography attributes', () => {
    const textShape: ShapeObject = {
      id: 'txt-1',
      type: 'text',
      text: 'HELLO',
      fontFamily: 'impact',
      fontBold: true,
      fontItalic: false,
      x: 400,
      y: 300,
      width: 200,
      height: 100,
      rotation: 0,
      depth: 0.85,
      profile: 'beveled',
    };

    const scaled = scalePresetShape(textShape, 1600, 1200);
    expect(scaled.text).toBe('HELLO');
    expect(scaled.fontFamily).toBe('impact');
    expect(scaled.fontBold).toBe(true);
    expect(scaled.profile).toBe('beveled');
    expect(scaled.width).toBe(400);
    expect(scaled.height).toBe(200);
    expect(scaled.x).toBe(800);
    expect(scaled.y).toBe(600);
  });
});
