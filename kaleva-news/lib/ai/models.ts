export type AgentName =
  | "classification"
  | "sourceVerification"
  | "storySelection"
  | "newsGeneration"
  | "contentVerification"
  | "translation"
  | "contextualization"
  | "personalization"
  | "communityIntelligence";

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
};

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
