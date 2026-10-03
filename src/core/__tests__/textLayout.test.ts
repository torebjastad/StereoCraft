import { describe, it, expect } from 'vitest';
import { layoutText, LineMetrics } from '../textLayout.ts';

// Fake font: every character is 10 wide, 8 tall above baseline, 2 below. Ink fills the advance.
const measure = (line: string): LineMetrics => ({
  width: line.length * 10,
  left: 0,
  right: line.length * 10,
  ascent: 8,
  descent: 2,
});

describe('layoutText', () => {
  it('measures a single line tightly and centres it on x = 0', () => {
    const l = layoutText('ABC', measure, 1.2, 100);
    expect(l.lines).toHaveLength(1);
    expect(l.lines[0].x).toBe(-15);
    expect(l.minX).toBe(-15);
    expect(l.maxX).toBe(15);
    expect(l.minY).toBe(-8);
    expect(l.maxY).toBe(2);
    expect(l.width).toBe(30);
    expect(l.height).toBe(10);
    expect(l.aspect).toBeCloseTo(3, 5);
  });

  it('stacks lines with the given line height and centres each independently', () => {
    const l = layoutText('AB\nABCD', measure, 1.2, 100);
    expect(l.lines).toHaveLength(2);
    expect(l.lines[0].x).toBe(-10);
    expect(l.lines[1].x).toBe(-20);
    expect(l.lines[1].y).toBeCloseTo(120, 5);
    expect(l.minX).toBe(-20);
    expect(l.maxX).toBe(20);
    expect(l.minY).toBe(-8);
    expect(l.maxY).toBeCloseTo(122, 5);
  });

  it('keeps blank lines as vertical spacing but ignores them for ink bounds', () => {
    const l = layoutText('A\n\nB', measure, 1.0, 100);
    expect(l.lines).toHaveLength(3);
    expect(l.lines[2].y).toBeCloseTo(200, 5);
    expect(l.maxY).toBeCloseTo(202, 5);
    expect(l.width).toBe(10);
  });

  it('falls back to a 1:1 aspect for empty text', () => {
    const l = layoutText('   \n ', (s) => (s.trim() ? measure(s) : { width: 0, left: 0, right: 0, ascent: 0, descent: 0 }));
    expect(l.aspect).toBe(1);
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
  });
});
