import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BROWSER_FILL_RATIO,
  computeCenteredFitPlacement,
  createCenteredDepthmapShape,
  formatDepthmapTitle,
  isSupportedImageFilename,
  rgbaToGrayscaleDepth,
  sortDepthmapEntries,
  stepSlideshowIndex,
} from '../depthmapBrowser.ts';
import { renderDepthMap } from '../depthRenderer.ts';
import { DepthmapEntry } from '../../types/index.ts';

describe('depthmapBrowser core utilities', () => {
  describe('computeCenteredFitPlacement', () => {
    it('defaults to 3/4 (0.75) screen fill ratio', () => {
      expect(DEFAULT_BROWSER_FILL_RATIO).toBe(0.75);
    });

    it('centers and scales a square depthmap to 3/4 of a landscape screen height', () => {
      const p = computeCenteredFitPlacement(512, 512, 1200, 900);
      expect(p.x).toBe(600);
      expect(p.y).toBe(450);
      // 75% of 900 = 675; aspect ratio 1:1 preserved
      expect(p.width).toBe(675);
      expect(p.height).toBe(675);
    });

    it('centers and scales a wide depthmap to 3/4 of screen width without stretching', () => {
      const p = computeCenteredFitPlacement(1600, 800, 1200, 900);
      expect(p.x).toBe(600);
      expect(p.y).toBe(450);
      // 75% of 1200 = 900 wide -> 450 tall (preserves 2:1 aspect)
      expect(p.width).toBe(900);
      expect(p.height).toBe(450);
      expect(p.width / p.height).toBeCloseTo(2.0, 5);
    });

    it('centers and scales a portrait depthmap to 3/4 of 1080p height', () => {
      const p = computeCenteredFitPlacement(600, 1000, 1920, 1080);
      expect(p.x).toBe(960);
      expect(p.y).toBe(540);
      // 75% of 1080 = 810 tall -> 486 wide
      expect(p.height).toBe(810);
      expect(p.width).toBe(486);
    });

    it('supports custom fill ratios and clamps out-of-range values', () => {
      const custom = computeCenteredFitPlacement(100, 100, 1000, 1000, 0.5);
      expect(custom.width).toBe(500);
      expect(custom.height).toBe(500);

      const clampedHigh = computeCenteredFitPlacement(100, 100, 1000, 1000, 1.5);
      expect(clampedHigh.width).toBe(1000);

      const clampedLow = computeCenteredFitPlacement(100, 100, 1000, 1000, 0.01);
      expect(clampedLow.width).toBe(100);
    });
  });

  describe('isSupportedImageFilename', () => {
    it('accepts common raster image formats case-insensitively', () => {
      expect(isSupportedImageFilename('dragon.jpg')).toBe(true);
      expect(isSupportedImageFilename('depthmap_001.PNG')).toBe(true);
      expect(isSupportedImageFilename('portrait.JPEG')).toBe(true);
      expect(isSupportedImageFilename('relief.webp')).toBe(true);
      expect(isSupportedImageFilename('scan.bmp')).toBe(true);
    });

    it('rejects non-image files', () => {
      expect(isSupportedImageFilename('README.md')).toBe(false);
      expect(isSupportedImageFilename('metadata.json')).toBe(false);
      expect(isSupportedImageFilename('.DS_Store')).toBe(false);
    });
  });

  describe('formatDepthmapTitle', () => {
    it('formats hyphenated and underscored filenames nicely', () => {
      expect(formatDepthmapTitle('bearded-man-face.jpg')).toBe('Bearded Man Face');
      expect(formatDepthmapTitle('crocodile_open_jaws.png')).toBe('Crocodile Open Jaws');
      expect(formatDepthmapTitle('folder/sub/t-rex.jpg')).toBe('T Rex');
    });
  });

  describe('sortDepthmapEntries', () => {
    it('sorts filenames naturally so numeric sequences stay in order', () => {
      const sorted = sortDepthmapEntries([
        { fileName: 'depthmap_10.png', relativePath: 'depthmap_10.png' },
        { fileName: 'depthmap_2.png', relativePath: 'depthmap_2.png' },
        { fileName: 'depthmap_1.png', relativePath: 'depthmap_1.png' },
        { fileName: 'bearded-man-face.jpg', relativePath: 'bearded-man-face.jpg' },
      ]);
      expect(sorted.map((s) => s.fileName)).toEqual([
        'bearded-man-face.jpg',
        'depthmap_1.png',
        'depthmap_2.png',
        'depthmap_10.png',
      ]);
    });
  });

  describe('rgbaToGrayscaleDepth', () => {
    it('converts RGBA pixels using Rec.709 luminance scaled by alpha', () => {
      const rgba = new Uint8ClampedArray([
        255, 255, 255, 255, // pure white, opaque -> 255
        0, 0, 0, 255,       // black, opaque -> 0
        255, 255, 255, 0,   // white, transparent -> 0
        255, 255, 255, 128, // white, ~50% alpha -> ~128
      ]);
      const gray = rgbaToGrayscaleDepth(rgba, 4);
      expect(gray[0]).toBe(255);
      expect(gray[1]).toBe(0);
      expect(gray[2]).toBe(0);
      expect(gray[3]).toBeGreaterThanOrEqual(127);
      expect(gray[3]).toBeLessThanOrEqual(129);
    });
  });

  describe('createCenteredDepthmapShape & depth rendering integration', () => {
    it('renders a centered 3/4 depthmap leaving zero-depth borders around it', () => {
      const entry: DepthmapEntry = {
        id: 'test-1',
        name: 'Test Square',
        fileName: 'test-square.png',
        relativePath: 'test-square.png',
        url: 'blob:test',
        source: 'project',
      };
      const whiteData = new Uint8ClampedArray(16).fill(255);
      const shape = createCenteredDepthmapShape(
        entry,
        { data: whiteData, width: 4, height: 4 },
        200,
        200
      );

      expect(shape.x).toBe(100);
      expect(shape.y).toBe(100);
      expect(shape.width).toBe(150); // 75% of 200
      expect(shape.height).toBe(150);

      const depthMap = renderDepthMap([shape], 200, 200, 0);
      // Center pixel should be elevated
      expect(depthMap[100 * 200 + 100]).toBeCloseTo(0.98, 2);
      // Corner pixel (0, 0) outside the 3/4 region must remain background (0)
      expect(depthMap[0]).toBe(0);
      // Outer margin at x=10, y=100 (outside [25, 175]) must be 0
      expect(depthMap[100 * 200 + 10]).toBe(0);
    });
  });

  describe('stepSlideshowIndex', () => {
    it('wraps forward and backward seamlessly', () => {
      expect(stepSlideshowIndex(0, 1, 5)).toBe(1);
      expect(stepSlideshowIndex(4, 1, 5)).toBe(0);
      expect(stepSlideshowIndex(0, -1, 5)).toBe(4);
      expect(stepSlideshowIndex(2, -1, 5)).toBe(1);
      expect(stepSlideshowIndex(0, 1, 0)).toBe(-1);
    });
  });
});
