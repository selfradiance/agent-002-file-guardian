import fs from "node:fs";
import path from "node:path";

export type VerificationResult = {
  passed: boolean;
  reason: string;
};

export function verifyChange(
  filePath: string,
  snapshotSize: number,
  sizeChangeThreshold: number,
): VerificationResult {
  const absolute = path.resolve(filePath);

  // a. File still exists
  if (!fs.existsSync(absolute)) {
    return { passed: false, reason: "File was deleted" };
  }

  const currentSize = fs.statSync(absolute).size;

  // b. File is not empty
  if (currentSize === 0) {
    return { passed: false, reason: "File was emptied" };
  }

  // c. Size change within threshold (skip if snapshot was 0 bytes — can't compute ratio)
  if (snapshotSize > 0) {
    const ratio = Math.abs(currentSize - snapshotSize) / snapshotSize;
    if (ratio > sizeChangeThreshold) {
      const actualPct = Math.round(ratio * 100);
      const thresholdPct = Math.round(sizeChangeThreshold * 100);
      return {
        passed: false,
        reason: `File size changed by ${actualPct}% (threshold: ${thresholdPct}%)`,
      };
    }
  }

  return { passed: true, reason: "All checks passed" };
}
