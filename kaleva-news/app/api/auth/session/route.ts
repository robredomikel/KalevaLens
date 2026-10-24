import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createServerSession, deleteServerSession, getServerSession } from '@/lib/auth/server-session'

const schema = z.object({ email: z.email(), name: z.string().trim().max(120).optional() })

export async function GET() { return NextResponse.json({ session: await getServerSession() }) }

export async function POST(request: Request) {
  const input = schema.parse(await request.json())
  const user = await db.user.upsert({
    where: { email: input.email.toLowerCase() }, update: { name: input.name || undefined },
    create: { email: input.email.toLowerCase(), name: input.name || input.email.split('@')[0], passwordHash: 'managed-by-prototype-auth-provider', role: 'READER' },
  })
  await createServerSession({ userId: user.id, email: user.email, role: user.role })
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
}

export async function DELETE() { await deleteServerSession(); return NextResponse.json({ success: true }) }
