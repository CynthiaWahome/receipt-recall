import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface OcrResult {
  text: string;
  lines: string[];
}

export async function runOcr(imagePath: string): Promise<OcrResult> {
  try {
    const { stdout } = await execFileAsync(
      "tesseract",
      [imagePath, "stdout", "-l", "eng", "--psm", "6"],
      { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 }
    );

    const text = stdout.trim();
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return { text, lines };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error("Tesseract not installed");
    }
    throw error;
  }
}

export function numberLines(lines: string[]): Array<{ id: string; text: string }> {
  return lines.map((text, index) => ({ id: `L${index + 1}`, text }));
}