import { connection, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  await connection()
  try { return NextResponse.json(await db.community.findMany({ orderBy: { name: 'asc' } })) }
  catch { return NextResponse.json([], { headers: { 'X-KalevaLens-Fallback': 'database-unavailable' } }) }
}
