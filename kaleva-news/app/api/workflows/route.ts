import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/server-session'
import { startEditorialWorkflow } from '@/lib/agents/workflow'

export async function POST(request: Request) {
  try {
    await requireRole(['MODERATOR', 'ADMIN'])
    const input = z.object({ candidateId: z.uuid(), targetLanguage: z.string().min(2).max(12).default('en') }).parse(await request.json())
    return NextResponse.json(await startEditorialWorkflow(input.candidateId, input.targetLanguage), { status: 202 })
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : 'Workflow failed' }, { status: 400 }) }
}
