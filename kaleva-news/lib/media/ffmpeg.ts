import "server-only";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, readFile, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

function getFfmpegExecutable() {
  if (ffmpegPath && existsSync(ffmpegPath)) return ffmpegPath;
  const localBinary = path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  if (existsSync(localBinary)) return localBinary;
  throw new Error("ffmpeg-static executable is unavailable");
}

async function withTemp<T>(fn: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), "kaleva-media-"));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

export async function pcmToMp3(pcm: Buffer, sampleRate = 24000, maxDurationSeconds = 30) {
  const executable = getFfmpegExecutable();
  return withTemp(async (dir) => {
    const input = path.join(dir, "input.pcm");
    const output = path.join(dir, "output.mp3");
    await writeFile(input, pcm);
    await execFileAsync(executable, ["-y", "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", input, "-t", String(maxDurationSeconds), "-codec:a", "libmp3lame", "-b:a", "128k", output]);
    return readFile(output);
  });
}

export async function trimMp3(inputData: Buffer, maxDurationSeconds = 30) {
  const executable = getFfmpegExecutable();
  return withTemp(async (dir) => {
    const input = path.join(dir, "input.mp3");
    const output = path.join(dir, "output.mp3");
    await writeFile(input, inputData);
    await execFileAsync(executable, ["-y", "-i", input, "-t", String(maxDurationSeconds), "-codec:a", "libmp3lame", "-b:a", "128k", output]);
    return readFile(output);
  });
}

export async function inspectMedia(data: Buffer, extension: string) {
  const executable = getFfmpegExecutable();
  return withTemp(async (dir) => {
    const input = path.join(dir, `input.${extension.replace(/[^a-z0-9]/gi, "")}`);
    await writeFile(input, data);
    let stderr = "";
    try {
      const result = await execFileAsync(executable, ["-v", "info", "-i", input, "-f", "null", "-"], { maxBuffer: 10 * 1024 * 1024 });
      stderr = String(result.stderr);
    } catch (error) {
      const failure = error as { stderr?: string | Buffer };
      stderr = String(failure.stderr || "");
      if (!stderr.includes("Duration:")) throw new Error("FFmpeg could not decode the media file");
    }
    const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const durationSeconds = durationMatch ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]) : 0;
    return { durationSeconds, hasAudio: /Audio:\s*\w+/i.test(stderr), details: stderr };
  });
}
