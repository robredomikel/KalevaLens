import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createServerSession } from '@/lib/auth/server-session'

export async function POST(request: Request) {
  const { passcode } = z.object({ passcode: z.string().min(1) }).parse(await request.json())
  if (!process.env.MODERATOR_PASSCODE || passcode !== process.env.MODERATOR_PASSCODE) return NextResponse.json({ error: 'Invalid moderator credentials.' }, { status: 401 })
  const user = await db.user.upsert({
    where: { email: 'moderator@kalevalens.local' }, update: { role: 'MODERATOR' },
    create: { email: 'moderator@kalevalens.local', name: 'Kaleva Moderator', passwordHash: 'managed-by-moderator-passcode', role: 'MODERATOR' },
  })
  await createServerSession({ userId: user.id, email: user.email, role: user.role })
  return NextResponse.json({ success: true })
}
