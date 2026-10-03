import { describe, it, expect } from 'vitest';
import { generateStereogram, renderStereogramRows, samplePatternColor } from '../stereogramEngine.ts';
import { renderDepthMap } from '../depthRenderer.ts';
import { StereogramConfig, ShapeObject } from '../../types/index.ts';

describe('stereogramEngine', () => {
  const defaultConfig: StereogramConfig = {
    patternType: 'color-noise',
    patternPeriod: 100,
    maxDisparity: 20,
    viewingMode: 'parallel',
    enableOcclusionRemoval: true,
    smoothingRadius: 1,
    grainSize: 2,
    showGuideDots: false,
    guideDotColor: '#6366f1',
  };

  it('generates an ImageData buffer with correct size and RGBA values', () => {
    const width = 300;
    const height = 200;
    const depthMap = new Float32Array(width * height);

    const img = generateStereogram(depthMap, width, height, defaultConfig);
    expect(img.width).toBe(width);
    expect(img.height).toBe(height);
    expect(img.data.length).toBe(width * height * 4);

    // Alpha channel must be 255 for all pixels
    for (let i = 3; i < img.data.length; i += 400) {
      expect(img.data[i]).toBe(255);
    }
  });

  it('links background pixels separated by patternPeriod', () => {
    const width = 400;
    const height = 50;
    const period = 80;
    // Flat background (z = 0)
    const depthMap = new Float32Array(width * height);

    const config: StereogramConfig = {
      ...defaultConfig,
      patternPeriod: period,
      grainSize: 1,
    };

    const img = generateStereogram(depthMap, width, height, config);

    // For any row y, pixel x and pixel x + period must have identical RGB
    for (let y = 10; y < 20; y++) {
      for (let x = 0; x < width - period; x += 15) {
        const idx1 = (y * width + x) * 4;
        const idx2 = (y * width + (x + period)) * 4;
        expect(img.data[idx1]).toBe(img.data[idx2]);
        expect(img.data[idx1 + 1]).toBe(img.data[idx2 + 1]);
        expect(img.data[idx1 + 2]).toBe(img.data[idx2 + 2]);
      }
    }
  });

  it('shifts pixel correspondence when depth is non-zero', () => {
    const width = 400;
    const height = 50;
    const period = 80;
    const disp = 20;
    // Full depth foreground (z = 1.0)
    const depthMap = new Float32Array(width * height).fill(1.0);

    const configParallel: StereogramConfig = {
      ...defaultConfig,
      patternPeriod: period,
      maxDisparity: disp,
      viewingMode: 'parallel',
      grainSize: 1,
    };

    const imgParallel = generateStereogram(depthMap, width, height, configParallel);
    // In parallel mode at z = 1.0, separation is period - disp = 60
    const expectedSepParallel = period - disp;
    const y = 15;
    const x = 50;
    const idx1 = (y * width + x) * 4;
    const idx2 = (y * width + (x + expectedSepParallel)) * 4;
    expect(imgParallel.data[idx1]).toBe(imgParallel.data[idx2]);
    expect(imgParallel.data[idx1 + 1]).toBe(imgParallel.data[idx2 + 1]);
    expect(imgParallel.data[idx1 + 2]).toBe(imgParallel.data[idx2 + 2]);

    // In cross-eyed mode at z = 1.0, separation is period + disp = 100
    const configCross: StereogramConfig = {
      ...defaultConfig,
      patternPeriod: period,
      maxDisparity: disp,
      viewingMode: 'cross-eyed',
      grainSize: 1,
    };
    const imgCross = generateStereogram(depthMap, width, height, configCross);
    const expectedSepCross = period + disp;
    const idxCross1 = (y * width + x) * 4;
    const idxCross2 = (y * width + (x + expectedSepCross)) * 4;
    expect(imgCross.data[idxCross1]).toBe(imgCross.data[idxCross2]);
    expect(imgCross.data[idxCross1 + 1]).toBe(imgCross.data[idxCross2 + 1]);
    expect(imgCross.data[idxCross1 + 2]).toBe(imgCross.data[idxCross2 + 2]);
  });

  it('draws guide dots correctly when enabled', () => {
    const width = 300;
    const height = 100;
    const period = 100;
    const depthMap = new Float32Array(width * height);

    const config: StereogramConfig = {
      ...defaultConfig,
      patternPeriod: period,
      showGuideDots: true,
      guideDotColor: '#6366f1',
    };

    const img = generateStereogram(depthMap, width, height, config);

    // Left dot center: (150 - 50, 24) = (100, 24)
    // Right dot center: (150 + 50, 24) = (200, 24)
    const leftDotIdx = (24 * width + 100) * 4;
    const rightDotIdx = (24 * width + 200) * 4;

    // #6366f1 is rgb(99, 102, 241)
    expect(img.data[leftDotIdx]).toBe(99);
    expect(img.data[leftDotIdx + 1]).toBe(102);
    expect(img.data[leftDotIdx + 2]).toBe(241);

    expect(img.data[rightDotIdx]).toBe(99);
    expect(img.data[rightDotIdx + 1]).toBe(102);
    expect(img.data[rightDotIdx + 2]).toBe(241);
  });

  it('samples valid RGB for all procedural patterns', () => {
    const patterns = ['color-noise', 'retro-90s', 'cosmic', 'organic-flow', 'sand'] as const;

    for (const pat of patterns) {
      const [r, g, b] = samplePatternColor(pat, 42, 84, 100, 2);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });

  it('renders only specified row slice with renderStereogramRows', () => {
    const width = 200;
    const height = 50;
    const depthMap = new Float32Array(width * height);
    const fullImg = generateStereogram(depthMap, width, height, defaultConfig);

    const partialData = new Uint8ClampedArray(width * height * 4);
    // Render only rows 10 to 15
    renderStereogramRows(depthMap, width, height, defaultConfig, 10, 15, partialData);

    // Rows 0-9 should be empty (all zeros)
    for (let i = 0; i < 10 * width * 4; i++) {
      expect(partialData[i]).toBe(0);
    }

    // Rows 10-15 should match the fullImg exactly
    for (let y = 10; y <= 15; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        expect(partialData[idx]).toBe(fullImg.data[idx]);
        expect(partialData[idx + 1]).toBe(fullImg.data[idx + 1]);
        expect(partialData[idx + 2]).toBe(fullImg.data[idx + 2]);
        expect(partialData[idx + 3]).toBe(fullImg.data[idx + 3]);
      }
    }

    // Rows 16-49 should be empty (all zeros)
    for (let i = 16 * width * 4; i < partialData.length; i++) {
      expect(partialData[i]).toBe(0);
    }
  });

  it('guarantees periodic horizontal color sampling for seamless background continuity', () => {
    const period = 120;
    const grain = 2;
    const patterns = ['color-noise', 'retro-90s', 'cosmic', 'organic-flow', 'sand'] as const;

    for (const pat of patterns) {
      for (let x = 10; x < 50; x += 10) {
        const y = 25;
        const [r1, g1, b1] = samplePatternColor(pat, x, y, period, grain);
        const [r2, g2, b2] = samplePatternColor(pat, x + period, y, period, grain);
        const [r3, g3, b3] = samplePatternColor(pat, x + 2 * period, y, period, grain);

        expect(r1).toBe(r2);
        expect(g1).toBe(g2);
        expect(b1).toBe(b2);

        expect(r1).toBe(r3);
        expect(g1).toBe(g3);
        expect(b1).toBe(b3);
      }
    }
  });

  it('prevents horizontal streak propagation when an elevated object is present', () => {
    const width = 600;
    const height = 10;
    const period = 100;
    const grain = 2;

    // Depth map with a single elevated spike/cone at x = 200 (width = 20, z = 0.95)
    // and flat floor elsewhere (z = 0.08)
    const depthMap = new Float32Array(width * height).fill(0.08);
    for (let y = 0; y < height; y++) {
      for (let dx = -10; dx <= 10; dx++) {
        const z = 0.08 + (0.95 - 0.08) * (1.0 - Math.abs(dx) / 10);
        depthMap[y * width + (200 + dx)] = z;
      }
    }

    const config: StereogramConfig = {
      ...defaultConfig,
      patternPeriod: period,
      grainSize: grain,
      enableOcclusionRemoval: true,
    };

    const img = generateStereogram(depthMap, width, height, config);

    const dispFloor = Math.round(0.08 * config.maxDisparity);
    const sepFloor = period - dispFloor;

    // Pixels sufficiently far to the right of the object (e.g. x = 380)
    // should still be linked across sepFloor (380 and 380 + sepFloor)
    for (let y = 0; y < height; y++) {
      const idx1 = (y * width + 380) * 4;
      const idx2 = (y * width + (380 + sepFloor)) * 4;
      expect(img.data[idx1]).toBe(img.data[idx2]);
      expect(img.data[idx1 + 1]).toBe(img.data[idx2 + 1]);
      expect(img.data[idx1 + 2]).toBe(img.data[idx2 + 2]);
    }
  });

  it('prevents false occlusion of sloping 3D shapes like stars', () => {
    const width = 600;
    const height = 400;
    const period = 100;

    const starShape: ShapeObject = {
      id: 'star-test',
      type: 'star',
      x: 300,
      y: 200,
      width: 200,
      height: 200,
      rotation: 0,
      depth: 0.9,
      profile: 'dome',
      starPoints: 5,
      innerRadiusRatio: 0.45,
    };

    const depthMap = renderDepthMap([starShape], width, height, 1);

    const config: StereogramConfig = {
      ...defaultConfig,
      patternPeriod: period,
      maxDisparity: 18,
      enableOcclusionRemoval: true,
    };

    const img = generateStereogram(depthMap, width, height, config);

    // At the center of the star (300, 200), depth is high (~0.9)
    const zCenter = depthMap[200 * width + 300];
    expect(zCenter).toBeGreaterThan(0.7);

    // In parallel mode, separation at center is:
    const disp = Math.round(zCenter * config.maxDisparity);
    const sep = period - disp;
    const left = 300 - Math.floor(sep / 2);
    const right = left + sep;

    // The left and right projected pixels of the star center must be linked (identical color)
    const leftIdx = (200 * width + left) * 4;
    const rightIdx = (200 * width + right) * 4;
    expect(img.data[leftIdx]).toBe(img.data[rightIdx]);
    expect(img.data[leftIdx + 1]).toBe(img.data[rightIdx + 1]);
    expect(img.data[leftIdx + 2]).toBe(img.data[rightIdx + 2]);
  });

  it('eliminates contour step echoes on smooth circular domes', () => {
    const width = 800;
    const height = 400;
    const period = 100;

    const domeShape: ShapeObject = {
      id: 'dome-test',
      type: 'circle',
      x: 300,
      y: 200,
      width: 200,
      height: 200,
      rotation: 0,
      depth: 0.9,
      profile: 'dome',
    };

    const depthMap = renderDepthMap([domeShape], width, height, 1);
    const config: StereogramConfig = {
      ...defaultConfig,
      patternType: 'organic-flow',
      patternPeriod: period,
      maxDisparity: 20,
    };

    const img = generateStereogram(depthMap, width, height, config);

    // On row 200, test across the right slope (x = 350 to 450) and its echoes (x = 450 to 750)
    // There should be no isolated 1-pixel color spikes (> 80) across the smooth gradient
    const row200Offset = 200 * width * 4;
    for (let x = 350; x < 750; x++) {
      const idx = row200Offset + x * 4;
      const prevIdx = row200Offset + (x - 1) * 4;
      const diffR = Math.abs(img.data[idx] - img.data[prevIdx]);
      // With gap-filling, step differences between adjacent pixels in smooth texture are small (< 60)
      expect(diffR).toBeLessThan(75);
    }
  });
});


