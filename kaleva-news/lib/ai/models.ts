export type AgentName =
  | "classification"
  | "sourceVerification"
  | "storySelection"
  | "newsGeneration"
  | "contentVerification"
  | "translation"
  | "contextualization"
  | "personalization"
  | "communityIntelligence"
  | "newsNarration"
  | "mediaQuality";

const AGENT_MODEL_ENV_MAP: Record<AgentName, string> = {
  classification: "GEMINI_MODEL_CLASSIFICATION",
  sourceVerification: "GEMINI_MODEL_SOURCE_VERIFICATION",
  storySelection: "GEMINI_MODEL_STORY_SELECTION",
  newsGeneration: "GEMINI_MODEL_NEWS_GENERATION",
  contentVerification: "GEMINI_MODEL_CONTENT_VERIFICATION",
  translation: "GEMINI_MODEL_TRANSLATION",
  contextualization: "GEMINI_MODEL_CONTEXTUALIZATION",
  personalization: "GEMINI_MODEL_PERSONALIZATION",
  communityIntelligence: "GEMINI_MODEL_COMMUNITY_INTELLIGENCE",
  newsNarration: "GEMINI_MODEL_NARRATION",
  mediaQuality: "GEMINI_MODEL_MEDIA_QA",
};

export function getMediaModels() {
  return {
    narration: process.env.GEMINI_MODEL_NARRATION || "gemini-2.5-flash",
    audio: process.env.GEMINI_MODEL_AUDIO || "gemini-3.1-flash-tts-preview",
    quality: process.env.GEMINI_MODEL_MEDIA_QA || "gemini-2.5-flash",
  };
}

export function getMediaConfig() {
  return {
    audioEnabled: process.env.MEDIA_AUDIO_ENABLED !== "false",
    audioDurationSeconds: Number(process.env.MEDIA_DEFAULT_AUDIO_DURATION_SECONDS || 90),
    maxAudioDurationSeconds: Math.min(30, Number(process.env.MEDIA_MAX_AUDIO_DURATION_SECONDS || 30)),
    maxRetries: Number(process.env.MEDIA_MAX_RETRIES || 3),
    maxConcurrentJobs: Number(process.env.MEDIA_MAX_CONCURRENT_JOBS || 2),
    jobTimeoutMs: Number(process.env.MEDIA_JOB_TIMEOUT_MS || 300000),
    demoArticleLimit: Math.max(1, Number(process.env.MEDIA_DEMO_ARTICLE_LIMIT || 3)),
  };
}

export function getAgentModel(agentName: AgentName): string {
  const envVarName = AGENT_MODEL_ENV_MAP[agentName];
  const configuredModel = envVarName ? process.env[envVarName] : undefined;
  const defaultModel = process.env.GEMINI_MODEL_DEFAULT || "gemini-2.5-flash";

  return configuredModel || defaultModel;
}

export function getWorkflowConfig() {
  return {
    maxRetries: Number(process.env.AGENT_MAX_RETRIES || 3),
    maxRevisionCycles: Number(process.env.AGENT_MAX_REVISION_CYCLES || 2),
    timeoutMs: Number(process.env.AGENT_TIMEOUT_MS || 60000),
  };
}
