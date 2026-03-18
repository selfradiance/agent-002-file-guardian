import fs from "node:fs";
import path from "node:path";

const snapshots = new Map<string, Buffer>();

export function takeSnapshot(filePath: string): void {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${absolute}`);
  }
  snapshots.set(absolute, fs.readFileSync(absolute));
}

export function restoreSnapshot(filePath: string): void {
  const absolute = path.resolve(filePath);
  const data = snapshots.get(absolute);
  if (!data) {
    throw new Error(`No snapshot exists for: ${absolute}`);
  }
  fs.writeFileSync(absolute, data);
}

export function hasSnapshot(filePath: string): boolean {
  return snapshots.has(path.resolve(filePath));
}

export function getSnapshotSize(filePath: string): number {
  const absolute = path.resolve(filePath);
  const data = snapshots.get(absolute);
  if (!data) {
    throw new Error(`No snapshot exists for: ${absolute}`);
  }
  return data.length;
}

export function snapshotAll(directory: string): void {
  const absolute = path.resolve(directory);
  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      takeSnapshot(path.join(absolute, entry.name));
    }
  }
}

export function clearSnapshots(): void {
  snapshots.clear();
}
