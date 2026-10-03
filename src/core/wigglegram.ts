import { createImageDataHelper } from './stereogramEngine.ts';

/**
 * Synthesizes a perspective-shifted image (for wiggle stereoscopy)
 * from an existing image buffer and its corresponding depth map.
 * @param srcData Original source image (e.g. stereogram or colored depth)
 * @param depthMap Float32Array depth values [0, 1]
 * @param width Canvas width
 * @param height Canvas height
 * @param shiftAmount Parallax pixel shift (positive for right-eye, negative for left-eye)
 */
export function generateParallaxView(
  srcData: ImageData,
  depthMap: Float32Array,
  width: number,
  height: number,
  shiftAmount: number
): ImageData {
  const result = createImageDataHelper(width, height);
  const src = srcData.data;
  const dst = result.data;

  // Initialize with background copy
  dst.set(src);

  // Depth-buffered projection
  const zBuffer = new Float32Array(width * height).fill(-1.0);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      const z = depthMap[idx];
      const pIdx = idx * 4;

      // Displacement proportional to depth
      const dx = Math.round(z * shiftAmount);
      const targetX = x + dx;

      if (targetX >= 0 && targetX < width) {
        const targetIdx = rowOffset + targetX;
        if (z >= zBuffer[targetIdx]) {
          zBuffer[targetIdx] = z;
          const targetPIdx = targetIdx * 4;
          dst[targetPIdx] = src[pIdx];
          dst[targetPIdx + 1] = src[pIdx + 1];
          dst[targetPIdx + 2] = src[pIdx + 2];
          dst[targetPIdx + 3] = src[pIdx + 3];
        }
      }
    }
  }

  return result;
}
