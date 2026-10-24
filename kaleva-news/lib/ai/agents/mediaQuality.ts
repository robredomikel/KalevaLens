import "server-only";
import { ProducedMedia } from "@/lib/media/types";
import { inspectMedia } from "@/lib/media/ffmpeg";

export interface MediaQualityResult { passed: boolean; errors: string[] }

export async function runMediaQualityAgent(media: ProducedMedia, expected: "audio"): Promise<MediaQualityResult> {
  const errors: string[] = [];
  if (!media.buffer.length) errors.push("File is empty");
  if (!Number.isFinite(media.durationSeconds) || media.durationSeconds <= 0) errors.push("Duration is invalid");
  if (expected === "audio") {
    if (media.mimeType !== "audio/mpeg") errors.push("Audio MIME type is not browser-compatible MP3");
    if (media.buffer.subarray(0, 3).toString() !== "ID3" && media.buffer[0] !== 0xff) errors.push("Audio does not have an MP3 signature");
  }
  if (!errors.length) {
    try {
      const inspection = await inspectMedia(media.buffer, media.extension);
      if (!inspection.hasAudio) errors.push("A decodable audio track is missing");
      if (inspection.durationSeconds <= 0) errors.push("Container duration is not plausible");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Media decoding failed");
    }
  }
  return { passed: errors.length === 0, errors };
}
