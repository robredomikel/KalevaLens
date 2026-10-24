import 'server-only'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { generateStructured, type StructuredGenerationOptions } from '@/lib/ai/gemini'
import type { z } from 'zod'

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue

export async function runLoggedAgent<T extends z.ZodType>(
  workflowId: string,
  identifier: string,
  inputRefs: unknown,
  options: StructuredGenerationOptions<T>,
) {
  const execution = await db.agentExecution.create({
    data: { workflowId, agentIdentifier: identifier, inputRefs: json(inputRefs) },
  })
  try {
    const result = await generateStructured(options)
    await db.agentExecution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETED', model: result.model, promptTokens: result.usage.promptTokens,
        outputTokens: result.usage.outputTokens, outputRefs: json(result.data), completedAt: new Date(),
      },
    })
    return result.data
  } catch (error) {
    await db.agentExecution.update({
      where: { id: execution.id },
      data: { status: 'FAILED', errorDetails: error instanceof Error ? error.message : 'Unknown agent failure', completedAt: new Date() },
    })
    throw error
  }
}

export async function logDeterministicAgent<T>(workflowId: string | null, identifier: string, inputRefs: unknown, operation: () => Promise<T>) {
  const execution = await db.agentExecution.create({ data: { workflowId, agentIdentifier: identifier, inputRefs: json(inputRefs) } })
  try {
    const output = await operation()
    await db.agentExecution.update({ where: { id: execution.id }, data: { status: 'COMPLETED', outputRefs: json(output), completedAt: new Date() } })
    return output
  } catch (error) {
    await db.agentExecution.update({ where: { id: execution.id }, data: { status: 'FAILED', errorDetails: error instanceof Error ? error.message : 'Unknown agent failure', completedAt: new Date() } })
    throw error
  }
}
