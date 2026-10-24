import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireServerSession } from '@/lib/auth/server-session'
import { enforceRateLimit } from '@/lib/auth/rate-limit'

const submissionSchema = z.object({
  title: z.string().trim().min(3).max(300),
  summary: z.string().trim().min(3).max(2_000),
  content: z.string().trim().max(50_000).optional(),
  community: z.string().trim().min(1).max(120),
  category: z.string().trim().max(120).optional(),
})

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'story-submissions', 10)
    const session = await requireServerSession()
    const input = submissionSchema.parse(await request.json())
    const submission = await db.storySubmission.create({
      data: { ...input, authorId: session.userId, category: input.category || 'Citizen Scoop' },
    })
    return NextResponse.json(submission, { status: 201 })
  } catch (error) {
    if (error instanceof Response) return error
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to submit story.' }, { status: 400 })
  }
}
