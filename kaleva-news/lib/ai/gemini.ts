import 'server-only'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { agentRuntimeConfig, getAgentModel, type AgentModelKey } from './config'

let client: GoogleGenAI | null = null

export function setGeminiClientForTests(value: GoogleGenAI | null) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Gemini client injection is test-only.')
  client = value
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'YOUR_GOOGLE_GEMINI_API_KEY_HERE') {
    throw new Error('GEMINI_API_KEY is not configured. Add it to kaleva-news/.env.local.')
  }
  client ??= new GoogleGenAI({ apiKey })
  return client
}

export interface StructuredGenerationOptions<T extends z.ZodType> {
  agent: AgentModelKey
  schema: T
  systemInstruction: string
  prompt: string
  temperature?: number
}

export interface StructuredGenerationResult<T> {
  data: T
  model: string
  usage: { promptTokens?: number; outputTokens?: number }
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function generateStructured<T extends z.ZodType>(
  options: StructuredGenerationOptions<T>,
): Promise<StructuredGenerationResult<z.infer<T>>> {
  const model = getAgentModel(options.agent)
  let lastError: unknown

  for (let attempt = 0; attempt < agentRuntimeConfig.maxRetries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), agentRuntimeConfig.timeoutMs)
    try {
      const response = await getGeminiClient().models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.2,
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(options.schema),
          abortSignal: controller.signal,
        },
      })
      const parsed = options.schema.parse(JSON.parse(response.text || '{}'))
      return {
        data: parsed,
        model: response.modelVersion || model,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
        },
      }
    } catch (error) {
      lastError = error
      if (attempt + 1 < agentRuntimeConfig.maxRetries) await wait(250 * (2 ** attempt))
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(`Gemini ${options.agent} generation failed after ${agentRuntimeConfig.maxRetries} attempts`, { cause: lastError })
}
