import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/server-session'

const statuses = z.enum(['INGESTED', 'CLASSIFIED', 'NEEDS_REVIEW', 'VERIFIED', 'SELECTED', 'DRAFTED', 'REJECTED', 'FAILED'])

export async function GET(request: Request) {
  try {
    await requireRole(['MODERATOR', 'ADMIN'])
    const rawStatus = new URL(request.url).searchParams.get('status') || 'INGESTED'
    const status = statuses.parse(rawStatus)
    return NextResponse.json(await db.newsCandidate.findMany({
      where: { status }, include: { source: { select: { name: true, url: true } }, community: true },
      orderBy: { createdAt: 'asc' }, take: 100,
    }))
  } catch (error) {
    if (error instanceof Response) return error
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load candidates.' }, { status: 400 })
  }
}
