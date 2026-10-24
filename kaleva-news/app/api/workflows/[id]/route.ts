import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/server-session'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(['MODERATOR', 'ADMIN'])
    const { id } = await params
    const workflow = await db.workflowRun.findUnique({ where: { id }, include: { executions: { orderBy: { startedAt: 'asc' } }, candidate: true } })
    return workflow ? NextResponse.json(workflow) : NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: 'Unable to load workflow' }, { status: 500 }) }
}
