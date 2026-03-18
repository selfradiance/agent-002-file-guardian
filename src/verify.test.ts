import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyChange } from "./verify";

describe("verifyChange", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-verify-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes when file exists and is within threshold", () => {
    const file = path.join(tmpDir, "ok.txt");
    fs.writeFileSync(file, "hello world"); // 11 bytes
    const result = verifyChange(file, 10, 0.5); // 10% change, threshold 50%
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("All checks passed");
  });

  it("fails when file was deleted", () => {
    const file = path.join(tmpDir, "gone.txt");
    // File doesn't exist on disk
    const result = verifyChange(file, 100, 0.5);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("File was deleted");
  });

  it("fails when file was emptied", () => {
    const file = path.join(tmpDir, "empty.txt");
    fs.writeFileSync(file, ""); // 0 bytes
    const result = verifyChange(file, 100, 0.5);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("File was emptied");
  });

  it("fails when file size grew beyond threshold", () => {
    const file = path.join(tmpDir, "big.txt");
    fs.writeFileSync(file, "x".repeat(200)); // 200 bytes
    const result = verifyChange(file, 100, 0.5); // 100% growth, threshold 50%
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/File size changed by 100% \(threshold: 50%\)/);
  });

  it("fails when file size shrunk beyond threshold", () => {
    const file = path.join(tmpDir, "small.txt");
    fs.writeFileSync(file, "x".repeat(10)); // 10 bytes
    const result = verifyChange(file, 100, 0.5); // 90% shrink, threshold 50%
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/File size changed by 90% \(threshold: 50%\)/);
  });

  it("passes when file size changed but within threshold", () => {
    const file = path.join(tmpDir, "within.txt");
    fs.writeFileSync(file, "x".repeat(120)); // 120 bytes
    const result = verifyChange(file, 100, 0.5); // 20% growth, threshold 50%
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("All checks passed");
  });

  it("passes when original was 0 bytes and new file has content (no divide-by-zero)", () => {
    const file = path.join(tmpDir, "was-empty.txt");
    fs.writeFileSync(file, "now has content");
    const result = verifyChange(file, 0, 0.5);
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("All checks passed");
  });

  it("passes when file is unchanged (identical size)", () => {
    const file = path.join(tmpDir, "same.txt");
    fs.writeFileSync(file, "exact content"); // 13 bytes
    const result = verifyChange(file, 13, 0.5);
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("All checks passed");
  });
});
