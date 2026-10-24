import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireServerSession } from '@/lib/auth/server-session'
import { enforceRateLimit } from '@/lib/auth/rate-limit'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request, 'correction-requests', 10)
    const session = await requireServerSession()
    const { id: articleId } = await params
    const input = z.object({ disputedClaim: z.string().trim().min(3).max(4000), explanation: z.string().trim().min(3).max(8000) }).parse(await request.json())
    const article = await db.canonicalArticle.findFirstOrThrow({ where: { id: articleId, status: 'PUBLISHED' }, include: { versions: { orderBy: { version: 'desc' }, take: 1 }, candidate: { include: { workflow: true } } } })
    const requestRecord = await db.$transaction(async (tx) => {
      const correction = await tx.correctionRequest.create({ data: { articleId, requesterId: session.userId, ...input } })
      if (article.candidate.workflow) {
        const task = await tx.editorialTask.create({ data: { workflowId: article.candidate.workflow.id, checkpoint: 'CORRECTION_REVIEW', articleId, articleVersionId: article.versions[0]?.id, reason: `Disputed claim: ${input.disputedClaim}`, metadata: { correctionRequestId: correction.id } } })
        return tx.correctionRequest.update({ where: { id: correction.id }, data: { editorialTaskId: task.id, status: 'UNDER_REVIEW' } })
      }
      return correction
    })
    return NextResponse.json(requestRecord, { status: 201 })
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to submit correction' }, { status: 400 }) }
}
