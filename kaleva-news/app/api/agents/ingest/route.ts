import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/server-session'
import { ingestConfiguredSources } from '@/lib/agents/ingestion'

export async function POST() {
  try { await requireRole(['MODERATOR', 'ADMIN']); return NextResponse.json(await ingestConfiguredSources()) }
  catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : 'Ingestion failed' }, { status: 500 }) }
}
