import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/server-session'

export async function GET() {
  try {
    await requireRole(['MODERATOR', 'ADMIN'])
    const tasks = await db.editorialTask.findMany({
      include: { candidate: true, articleVersion: true, decisions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tasks)
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: 'Unable to load editorial tasks' }, { status: 500 }) }
}
