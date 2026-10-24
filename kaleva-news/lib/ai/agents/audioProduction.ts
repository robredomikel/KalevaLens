import "server-only";
import { Modality } from "@google/genai";
import { getGeminiClient } from "../gemini";
import { getMediaConfig, getMediaModels } from "../models";
import { pcmToMp3, trimMp3 } from "@/lib/media/ffmpeg";
import { NarrationScript, ProducedMedia } from "@/lib/media/types";
import { narrationText } from "./newsNarration";

export async function runAudioProductionAgent(script: NarrationScript): Promise<ProducedMedia> {
  const model = getMediaModels().audio;
  const maxDuration = getMediaConfig().maxAudioDurationSeconds;
  const voice = process.env.MEDIA_TTS_VOICE || "Kore";
  const maxWords = Math.max(20, Math.floor(maxDuration * 2));
  const spokenText = narrationText(script).trim().split(/\s+/).slice(0, maxWords).join(" ");
  const response = await getGeminiClient().models.generateContent({
    model,
    contents: `Read the following grounded news explanation in ${script.language} exactly as written, using a calm professional news voice. Do not add commentary or extra facts.\n\n${spokenText}`,
    config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  });
  const part = response.candidates?.[0]?.content?.parts?.find((value) => value.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("Gemini speech response did not contain audio bytes");
  const raw = Buffer.from(part.inlineData.data, "base64");
  const sourceMime = part.inlineData.mimeType || "audio/L16;rate=24000";
  const match = sourceMime.match(/rate=(\d+)/i);
  const mp3 = sourceMime.includes("mpeg") || sourceMime.includes("mp3")
    ? await trimMp3(raw, maxDuration)
    : await pcmToMp3(raw, Number(match?.[1] || 24000), maxDuration);
  return { buffer: mp3, mimeType: "audio/mpeg", extension: "mp3", durationSeconds: Math.min(maxDuration, script.estimatedDurationSeconds), model, method: "gemini-tts-grounded", voice };
}
