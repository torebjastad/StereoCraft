/**
 * Pure text layout: given a way to measure one line of text, computes where each line
 * sits (centred on x = 0, stacked downwards from baseline y = 0) and the tight ink
 * bounds of the whole block. The browser layer supplies `measure` from a 2D canvas
 * context; keeping the maths here makes it unit-testable without a DOM.
 */

export interface LineMetrics {
  /** Advance width of the line. */
  width: number;
  /** Ink extent to the left of the line origin (canvas actualBoundingBoxLeft). */
  left: number;
  /** Ink extent to the right of the line origin (canvas actualBoundingBoxRight). */
  right: number;
  /** Ink extent above the baseline (canvas actualBoundingBoxAscent). */
  ascent: number;
  /** Ink extent below the baseline (canvas actualBoundingBoxDescent). */
  descent: number;
}

export interface LaidOutLine {
  text: string;
  /** Left origin of the line so that the line is centred on x = 0. */
  x: number;
  /** Baseline y. */
  y: number;
}

export interface TextLayout {
  lines: LaidOutLine[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Ink bounds size. */
  width: number;
  height: number;
  /** width / height of the ink bounds (1 when there is no ink). */
  aspect: number;
}

export function layoutText(
  text: string,
  measure: (line: string) => LineMetrics,
  lineHeight: number = 1.15,
  fontSize: number = 100
): TextLayout {
  const rawLines = text.split('\n');
  const lines: LaidOutLine[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  rawLines.forEach((line, i) => {
    const y = i * fontSize * lineHeight;
    if (!line.trim()) {
      lines.push({ text: line, x: 0, y });
      return;
    }
    const m = measure(line);
    const x = -m.width / 2;
    lines.push({ text: line, x, y });
    minX = Math.min(minX, x - m.left);
    maxX = Math.max(maxX, x + m.right);
    minY = Math.min(minY, y - m.ascent);
    maxY = Math.max(maxY, y + m.descent);
  });

  if (!Number.isFinite(minX)) {
    // No ink at all: return a harmless unit box so callers never divide by zero.
    return { lines, minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5, width: 1, height: 1, aspect: 1 };
  }

  const width = Math.max(1e-6, maxX - minX);
  const height = Math.max(1e-6, maxY - minY);
  return { lines, minX, maxX, minY, maxY, width, height, aspect: width / height };
}
