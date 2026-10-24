import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireServerSession } from '@/lib/auth/server-session'

const profileSchema = z.object({
  preferences: z.record(z.string(), z.unknown()), communityId: z.string().max(100).nullable().default(null),
  onboardingCompleted: z.boolean(), onboardingCompletedAt: z.iso.datetime().nullable(), currentQuestion: z.number().int().min(0).max(11),
})

export async function GET() {
  try { const session = await requireServerSession(); return NextResponse.json(await db.userProfile.findUnique({ where: { userId: session.userId }, include: { selectedCommunity: true } })) }
  catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: 'Unable to load profile' }, { status: 500 }) }
}

export async function PUT(request: Request) {
  try {
    const session = await requireServerSession()
    const input = profileSchema.parse(await request.json())
    const community = input.communityId ? await db.community.findFirst({ where: { OR: [{ id: input.communityId }, { slug: input.communityId }] } }) : null
    if (input.communityId && !community) return NextResponse.json({ error: 'Community does not exist.' }, { status: 400 })
    const normalized = { ...input, communityId: community?.id || null }
    const profile = await db.userProfile.upsert({
      where: { userId: session.userId }, update: { ...normalized, preferences: input.preferences as Prisma.InputJsonValue, onboardingCompletedAt: input.onboardingCompletedAt ? new Date(input.onboardingCompletedAt) : null },
      create: { userId: session.userId, ...normalized, preferences: input.preferences as Prisma.InputJsonValue, onboardingCompletedAt: input.onboardingCompletedAt ? new Date(input.onboardingCompletedAt) : null },
    })
    return NextResponse.json(profile)
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save profile' }, { status: 400 }) }
}
