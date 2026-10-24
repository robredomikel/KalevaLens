import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireServerSession } from '@/lib/auth/server-session'
import { analyzeCommunityContribution } from '@/lib/agents/nodes'
import { enforceRateLimit } from '@/lib/auth/rate-limit'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { enforceRateLimit(request, 'comments-read') } catch (error) { if (error instanceof Response) return error }
  const { id } = await params
  const article = await db.canonicalArticle.findFirst({ where: { id, status: 'PUBLISHED' }, select: { id: true } })
  if (!article) return NextResponse.json({ error: 'Published article not found.' }, { status: 404 })
  return NextResponse.json(await db.comment.findMany({ where: { articleId: id, parentId: null }, include: { author: { select: { id: true, name: true } }, replies: { include: { author: { select: { id: true, name: true } } } } }, orderBy: { createdAt: 'desc' } }))
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request, 'comments-write', 20)
    const session = await requireServerSession()
    const { id: articleId } = await params
    const input = z.object({ body: z.string().trim().min(1).max(4000), parentId: z.uuid().nullable().optional() }).parse(await request.json())
    const article = await db.canonicalArticle.findFirst({
      where: { id: articleId, status: 'PUBLISHED' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    })
    if (!article) return NextResponse.json({ error: 'Published article not found.' }, { status: 404 })
    const comment = await db.comment.create({ data: { articleId, authorId: session.userId, body: input.body, parentId: input.parentId || null, communityId: article.communityId } })
    const workflow = await db.workflowRun.findUnique({ where: { candidateId: article.candidateId } })
    if (workflow) {
      const classification = await analyzeCommunityContribution(workflow.id, comment.id, comment.body)
      await db.$transaction(async (tx) => {
        await tx.comment.update({ where: { id: comment.id }, data: { classification } })
        if (['correction_request', 'potential_misinformation', 'moderation_concern', 'story_suggestion'].includes(classification.classification)) {
          await tx.editorialTask.create({
            data: {
              workflowId: workflow.id, checkpoint: 'CORRECTION_REVIEW', candidateId: article.candidateId,
              articleId, articleVersionId: article.versions[0]?.id,
              reason: `Community ${classification.classification}: ${classification.rationale}`,
              metadata: { commentId: comment.id, recommendedAction: classification.recommendedEditorialAction },
            },
          })
        }
      })
    }
    return NextResponse.json(comment, { status: 201 })
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to post comment' }, { status: 400 }) }
}
