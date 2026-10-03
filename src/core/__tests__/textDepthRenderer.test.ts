import { describe, it, expect } from 'vitest';
import { renderTextDepth, measureTextWidth } from '../textDepthRenderer.ts';

describe('textDepthRenderer', () => {
  it('measures text width proportionally to string length and scale', () => {
    const text = 'TIME: 05.2';
    const w1 = measureTextWidth(text, 2);
    const w2 = measureTextWidth(text, 4);
    expect(w2).toBe(w1 * 2);
    expect(w1).toBeGreaterThan(0);
  });

  it('renders numeric and character depth into buffer without out-of-bounds error', () => {
    const width = 200;
    const height = 50;
    const buffer = new Float32Array(width * height);

    renderTextDepth(buffer, width, height, '01:23.4', 20, 10, 3, 0.9);

    // Some pixels inside the text bounding area must be non-zero
    let nonZeroCount = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] > 0) nonZeroCount++;
    }

    expect(nonZeroCount).toBeGreaterThan(100);
    // Background pixels outside must remain 0
    expect(buffer[0]).toBe(0);
  });

  it('handles strings partially out of bounds gracefully', () => {
    const width = 100;
    const height = 30;
    const buffer = new Float32Array(width * height);

    // Negative coordinates and overflow
    expect(() => {
      renderTextDepth(buffer, width, height, 'TIME: 99.9', -20, -5, 4, 1.0);
    }).not.toThrow();
  });
});
