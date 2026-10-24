import "server-only";
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "YOUR_GOOGLE_GEMINI_API_KEY_HERE") {
      // In development / demo mode when key is missing, throw informative error or allow graceful fallback
      throw new Error(
        "Missing or default GEMINI_API_KEY environment variable. Please set GEMINI_API_KEY in .env.local."
      );
    }

    client = new GoogleGenAI({ apiKey });
  }

  return client;
}

export function isGeminiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey && apiKey !== "YOUR_GOOGLE_GEMINI_API_KEY_HERE");
}
