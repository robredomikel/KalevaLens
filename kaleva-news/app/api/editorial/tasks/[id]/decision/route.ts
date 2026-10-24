import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/server-session'
import { humanDecisionSchema } from '@/lib/ai/schemas'
import { resumeEditorialWorkflow } from '@/lib/agents/workflow'

const actionMap = { approve: 'APPROVE', request_changes: 'REQUEST_CHANGES', reject: 'REJECT', escalate: 'ESCALATE', request_evidence: 'REQUEST_EVIDENCE' } as const
const statusMap = { approve: 'APPROVED', request_changes: 'CHANGES_REQUESTED', reject: 'REJECTED', escalate: 'ESCALATED', request_evidence: 'CHANGES_REQUESTED' } as const

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const moderator = await requireRole(['MODERATOR', 'ADMIN'])
    const decision = humanDecisionSchema.parse(await request.json())
    const { id } = await params
    const task = await db.editorialTask.findUniqueOrThrow({ where: { id } })
    if (task.status !== 'PENDING') return NextResponse.json({ error: 'This task has already been decided.' }, { status: 409 })
    await db.$transaction(async (tx) => {
      await tx.editorialDecision.create({ data: { taskId: task.id, articleVersionId: task.articleVersionId, moderatorId: moderator.userId, decision: actionMap[decision.action], notes: decision.notes } })
      await tx.editorialTask.update({ where: { id: task.id }, data: { status: statusMap[decision.action], assignedEditorId: moderator.userId } })
      if (decision.action === 'reject' && task.checkpoint === 'FINAL_APPROVAL' && task.articleId) {
        await tx.canonicalArticle.update({ where: { id: task.articleId }, data: { status: 'REJECTED' } })
      }
    })
    if (task.checkpoint === 'CORRECTION_REVIEW') {
      await db.correctionRequest.updateMany({
        where: { editorialTaskId: task.id },
        data: { status: decision.action === 'reject' ? 'REJECTED' : decision.action === 'approve' ? 'RESOLVED' : 'UNDER_REVIEW' },
      })
      return NextResponse.json(await db.editorialTask.findUniqueOrThrow({ where: { id: task.id }, include: { decisions: true } }))
    }
    if (decision.action === 'escalate' || decision.action === 'request_evidence') {
      await db.editorialTask.create({
        data: {
          workflowId: task.workflowId, checkpoint: task.checkpoint, candidateId: task.candidateId,
          articleId: task.articleId, articleVersionId: task.articleVersionId,
          reason: decision.notes || (decision.action === 'request_evidence' ? 'Additional evidence requested.' : 'Escalated for further editorial investigation.'),
          metadata: { followUpToTaskId: task.id },
        },
      })
      return NextResponse.json(await db.workflowRun.findUniqueOrThrow({ where: { id: task.workflowId } }))
    }
    return NextResponse.json(await resumeEditorialWorkflow(task.workflowId, decision))
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : 'Decision failed' }, { status: 400 }) }
}
