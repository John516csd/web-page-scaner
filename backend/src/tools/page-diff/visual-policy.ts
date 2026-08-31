export type VisualDiffStatus = 'pass' | 'warn' | 'fail';

export const DEFAULT_VISUAL_WARN_THRESHOLD = 2;
export const DEFAULT_VISUAL_FAIL_THRESHOLD = 5;

function normalizeFailThreshold(failThreshold?: number): number {
  if (
    typeof failThreshold !== 'number' ||
    !Number.isFinite(failThreshold) ||
    failThreshold < 0 ||
    failThreshold > 100
  ) {
    return DEFAULT_VISUAL_FAIL_THRESHOLD;
  }

  return failThreshold;
}

export function getVisualDiffStatus(
  diffPercentage: number,
  failThreshold?: number
): VisualDiffStatus {
  if (!Number.isFinite(diffPercentage) || diffPercentage < 0) {
    return 'fail';
  }

  const normalizedFailThreshold = normalizeFailThreshold(failThreshold);
  const warnThreshold = Math.min(
    DEFAULT_VISUAL_WARN_THRESHOLD,
    normalizedFailThreshold
  );

  if (diffPercentage > normalizedFailThreshold) {
    return 'fail';
  }
  if (diffPercentage > warnThreshold) {
    return 'warn';
  }
  return 'pass';
}
