// 5x7 Bitmap glyph definitions for digits and uppercase alphanumeric characters
const GLYPHS: Record<string, number[]> = {
  '0': [
    0b11110,
    0b10001,
    0b10011,
    0b10101,
    0b11001,
    0b10001,
    0b01110,
  ],
  '1': [
    0b00100,
    0b01100,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b01110,
  ],
  '2': [
    0b01110,
    0b10001,
    0b00001,
    0b00010,
    0b00100,
    0b01000,
    0b11111,
  ],
  '3': [
    0b11110,
    0b00001,
    0b00001,
    0b01110,
    0b00001,
    0b00001,
    0b11110,
  ],
  '4': [
    0b00010,
    0b00110,
    0b01010,
    0b10010,
    0b11111,
    0b00010,
    0b00010,
  ],
  '5': [
    0b11111,
    0b10000,
    0b11110,
    0b00001,
    0b00001,
    0b10001,
    0b01110,
  ],
  '6': [
    0b01110,
    0b10000,
    0b11110,
    0b10001,
    0b10001,
    0b10001,
    0b01110,
  ],
  '7': [
    0b11111,
    0b00001,
    0b00010,
    0b00100,
    0b01000,
    0b01000,
    0b01000,
  ],
  '8': [
    0b01110,
    0b10001,
    0b10001,
    0b01110,
    0b10001,
    0b10001,
    0b01110,
  ],
  '9': [
    0b01110,
    0b10001,
    0b10001,
    0b01111,
    0b00001,
    0b00001,
    0b01110,
  ],
  ':': [
    0b00000,
    0b00100,
    0b00100,
    0b00000,
    0b00100,
    0b00100,
    0b00000,
  ],
  '.': [
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00110,
    0b00110,
  ],
  ' ': [
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
  ],
  'T': [
    0b11111,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
  ],
  'I': [
    0b01110,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b01110,
  ],
  'M': [
    0b10001,
    0b11011,
    0b10101,
    0b10101,
    0b10001,
    0b10001,
    0b10001,
  ],
  'E': [
    0b11111,
    0b10000,
    0b10000,
    0b11110,
    0b10000,
    0b10000,
    0b11111,
  ],
  'S': [
    0b01111,
    0b10000,
    0b10000,
    0b01110,
    0b00001,
    0b00001,
    0b11110,
  ],
  'G': [
    0b01110,
    0b10001,
    0b10000,
    0b10111,
    0b10001,
    0b10001,
    0b01110,
  ],
  'O': [
    0b01110,
    0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b01110,
  ],
  'A': [
    0b01110,
    0b10001,
    0b10001,
    0b11111,
    0b10001,
    0b10001,
    0b10001,
  ],
  'L': [
    0b10000,
    0b10000,
    0b10000,
    0b10000,
    0b10000,
    0b10000,
    0b11111,
  ],
  'W': [
    0b10001,
    0b10001,
    0b10001,
    0b10101,
    0b10101,
    0b11011,
    0b10001,
  ],
  'N': [
    0b10001,
    0b11001,
    0b10101,
    0b10011,
    0b10001,
    0b10001,
    0b10001,
  ],
  '!': [
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b00000,
    0b00100,
  ],
  'B': [
    0b11110,
    0b10001,
    0b10001,
    0b11110,
    0b10001,
    0b10001,
    0b11110,
  ],
  'R': [
    0b11110,
    0b10001,
    0b10001,
    0b11110,
    0b10100,
    0b10010,
    0b10001,
  ],
};

/**
 * Calculates rendered pixel width of a string with given scale
 */
export function measureTextWidth(text: string, scale: number = 3, letterSpacing: number = 1): number {
  const charW = (5 + letterSpacing) * scale;
  return text.length * charW;
}

/**
 * Renders 3D embossed alphanumeric text directly into a depth map buffer
 * @param buffer Float32Array depth buffer
 * @param width Canvas width
 * @param height Canvas height
 * @param text The string to render
 * @param startX Top-left X coordinate
 * @param startY Top-left Y coordinate
 * @param scale Pixel scaling factor (e.g. 2, 3, 4)
 * @param textDepth Depth elevation value [0.0, 1.0] (default 0.95)
 */
export function renderTextDepth(
  buffer: Float32Array,
  width: number,
  height: number,
  text: string,
  startX: number,
  startY: number,
  scale: number = 3,
  textDepth: number = 0.95
): void {
  const upper = text.toUpperCase();
  const letterSpacing = 2;

  let curX = startX;

  for (let i = 0; i < upper.length; i++) {
    const char = upper[i];
    const glyph = GLYPHS[char] || GLYPHS[' '];

    // Render 5x7 glyph scaled
    for (let gy = 0; gy < 7; gy++) {
      const rowBits = glyph[gy];
      for (let gx = 0; gx < 5; gx++) {
        const isSet = (rowBits & (1 << (4 - gx))) !== 0;
        if (isSet) {
          // Fill scaled block
          for (let sy = 0; sy < scale; sy++) {
            const py = startY + gy * scale + sy;
            if (py < 0 || py >= height) continue;
            const rowOffset = py * width;

            for (let sx = 0; sx < scale; sx++) {
              const px = curX + gx * scale + sx;
              if (px < 0 || px >= width) continue;

              const idx = rowOffset + px;
              // Embossed profile: center of block is slightly higher than edge
              const isBlockEdge = sx === 0 || sx === scale - 1 || sy === 0 || sy === scale - 1;
              const depthVal = isBlockEdge && scale >= 3 ? textDepth * 0.9 : textDepth;
              buffer[idx] = Math.max(buffer[idx], depthVal);
            }
          }
        }
      }
    }

    curX += (5 + letterSpacing) * scale;
  }
}
