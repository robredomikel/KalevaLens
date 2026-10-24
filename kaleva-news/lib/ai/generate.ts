import "server-only";
import { z } from "zod";
import { getGeminiClient, isGeminiConfigured } from "./gemini";
import { getAgentModel, getWorkflowConfig, AgentName } from "./models";

export interface GenerateOptions<T> {
  agentName: AgentName;
  prompt: string;
  systemInstruction?: string;
  schema?: z.ZodType<T>;
  responseJsonSchema?: Record<string, unknown>;
  fallbackResponse?: T;
}

export interface GenerateResult<T> {
  data: T;
  rawText: string;
  model: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  durationMs: number;
}

export async function generateAgentStructured<T>(
  options: GenerateOptions<T>
): Promise<GenerateResult<T>> {
  const startTime = Date.now();
  const modelName = getAgentModel(options.agentName);
  const config = getWorkflowConfig();
  const inferredJsonSchema = options.schema ? z.toJSONSchema(options.schema) as Record<string, unknown> : undefined;
  // Gemini accepts standard JSON Schema but does not need the dialect marker
  // emitted by Zod. Supplying the schema prevents agents from returning the
  // shape of a different workflow step.
  if (inferredJsonSchema) delete inferredJsonSchema.$schema;

  // If Gemini API is not configured and a fallback response was supplied, use it
  if (!isGeminiConfigured()) {
    if (options.fallbackResponse !== undefined) {
      console.warn(`[GEMINI WARNING] GEMINI_API_KEY not configured. Using fallback response for agent ${options.agentName}.`);
      return {
        data: options.fallbackResponse,
        rawText: JSON.stringify(options.fallbackResponse),
        model: `${modelName}-fallback`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  const ai = getGeminiClient();

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < config.maxRetries) {
    attempt++;
    try {
      const responsePromise = ai.models.generateContent({
        model: modelName,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          responseMimeType: options.schema ? "application/json" : "text/plain",
          responseJsonSchema: options.responseJsonSchema || inferredJsonSchema,
        },
      });

      // Handle timeout
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Agent ${options.agentName} request timed out after ${config.timeoutMs}ms`));
        }, config.timeoutMs);
      });

      const response = await Promise.race([responsePromise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
      });

      const rawText = response.text || "";
      let parsedData: unknown = rawText;

      if (options.schema) {
        let jsonObject: unknown;
        try {
          jsonObject = JSON.parse(rawText);
        } catch {
          // Attempt to extract JSON code block if returned with markdown
          const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonObject = JSON.parse(jsonMatch[1]);
          } else {
            throw new Error(`Failed to parse structured JSON response from ${options.agentName}: ${rawText}`);
          }
        }
        parsedData = options.schema.parse(jsonObject);
      }

      const durationMs = Date.now() - startTime;
      const usage = response.usageMetadata;

      return {
        data: parsedData as T,
        rawText,
        model: modelName,
        tokenUsage: usage
          ? {
              promptTokens: usage.promptTokenCount,
              completionTokens: usage.candidatesTokenCount,
              totalTokens: usage.totalTokenCount,
            }
          : undefined,
        durationMs,
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      console.error(`[GEMINI RETRY] Agent ${options.agentName} attempt ${attempt} failed: ${error.message}`);
      
      // Exponential backoff
      if (attempt < config.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }

  // If retries exhausted and fallback response available, return fallback
  if (options.fallbackResponse !== undefined) {
    console.warn(`[GEMINI FALLBACK] Agent ${options.agentName} retries exhausted (${lastError?.message}). Returning fallback data.`);
    return {
      data: options.fallbackResponse,
      rawText: JSON.stringify(options.fallbackResponse),
      model: `${modelName}-fallback`,
      durationMs: Date.now() - startTime,
    };
  }

  throw lastError || new Error(`Failed to generate content for agent ${options.agentName}`);
}
