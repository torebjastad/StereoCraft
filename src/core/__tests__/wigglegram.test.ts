import { describe, it, expect } from 'vitest';
import { generateParallaxView } from '../wigglegram.ts';
import { createImageDataHelper } from '../stereogramEngine.ts';

describe('wigglegram', () => {
  it('shifts foreground pixels proportionally to depth', () => {
    const width = 100;
    const height = 50;
    const src = createImageDataHelper(width, height);
    // Fill background with black (0, 0, 0)
    for (let i = 0; i < src.data.length; i += 4) {
      src.data[i + 3] = 255;
    }
    // Set a red dot at (50, 25)
    const centerIdx = (25 * width + 50) * 4;
    src.data[centerIdx] = 255;

    const depthMap = new Float32Array(width * height);
    depthMap[25 * width + 50] = 1.0; // Foreground object

    // Shift right by 10px
    const shifted = generateParallaxView(src, depthMap, width, height, 10);

    // The red pixel should now be at x = 60
    const targetIdx = (25 * width + 60) * 4;
    expect(shifted.data[targetIdx]).toBe(255);
  });
});
