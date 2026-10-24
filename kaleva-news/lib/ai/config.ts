import 'server-only'

export type AgentModelKey =
  | 'classification' | 'sourceVerification' | 'storySelection' | 'newsGeneration'
  | 'contentVerification' | 'translation' | 'contextualization'
  | 'personalization' | 'communityIntelligence'

const fallback = () => process.env.GEMINI_MODEL_DEFAULT || 'gemini-2.5-flash'

export function getAgentModel(key: AgentModelKey): string {
  const variables: Record<AgentModelKey, string> = {
    classification: 'GEMINI_MODEL_CLASSIFICATION',
    sourceVerification: 'GEMINI_MODEL_SOURCE_VERIFICATION',
    storySelection: 'GEMINI_MODEL_STORY_SELECTION',
    newsGeneration: 'GEMINI_MODEL_NEWS_GENERATION',
    contentVerification: 'GEMINI_MODEL_CONTENT_VERIFICATION',
    translation: 'GEMINI_MODEL_TRANSLATION',
    contextualization: 'GEMINI_MODEL_CONTEXTUALIZATION',
    personalization: 'GEMINI_MODEL_PERSONALIZATION',
    communityIntelligence: 'GEMINI_MODEL_COMMUNITY_INTELLIGENCE',
  }
  return process.env[variables[key]] || fallback()
}

const asPositiveInt = (value: string | undefined, fallbackValue: number) => {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue
}

export const agentRuntimeConfig = {
  maxRetries: asPositiveInt(process.env.AGENT_MAX_RETRIES, 3),
  maxRevisionCycles: asPositiveInt(process.env.AGENT_MAX_REVISION_CYCLES, 2),
  timeoutMs: asPositiveInt(process.env.AGENT_TIMEOUT_MS, 60_000),
}
