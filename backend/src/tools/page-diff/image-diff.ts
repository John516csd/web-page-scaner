import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface ImageDiffResult {
  diffImage: Buffer;
  diffPercentage: number;
  width: number;
  height: number;
}

export function compareImages(imgA: Buffer, imgB: Buffer): ImageDiffResult {
  const pngA = PNG.sync.read(imgA);
  const pngB = PNG.sync.read(imgB);

  const width = Math.max(pngA.width, pngB.width);
  const height = Math.max(pngA.height, pngB.height);

  const normalizedA = normalizeSize(pngA, width, height);
  const normalizedB = normalizeSize(pngB, width, height);

  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(
    normalizedA.data,
    normalizedB.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  const totalPixels = width * height;
  const diffPercentage = (mismatchedPixels / totalPixels) * 100;

  return {
    diffImage: PNG.sync.write(diff),
    diffPercentage: Math.round(diffPercentage * 100) / 100,
    width,
    height,
  };
}

function normalizeSize(png: PNG, targetWidth: number, targetHeight: number): PNG {
  if (png.width === targetWidth && png.height === targetHeight) {
    return png;
  }

  const result = new PNG({ width: targetWidth, height: targetHeight, fill: true });

  // Fill with white background
  for (let i = 0; i < result.data.length; i += 4) {
    result.data[i] = 255;
    result.data[i + 1] = 255;
    result.data[i + 2] = 255;
    result.data[i + 3] = 255;
  }

  // Copy original image data
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const srcIdx = (y * png.width + x) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      result.data[dstIdx] = png.data[srcIdx];
      result.data[dstIdx + 1] = png.data[srcIdx + 1];
      result.data[dstIdx + 2] = png.data[srcIdx + 2];
      result.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }

  return result;
}
