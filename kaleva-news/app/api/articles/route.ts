import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from '@/lib/auth/server-session'
import { personalizeApprovedArticles } from '@/lib/agents/nodes'
import { enforceRateLimit } from '@/lib/auth/rate-limit'

export async function GET(request: Request) {
  try { enforceRateLimit(request, 'articles') } catch (error) { if (error instanceof Response) return error }
  const session = await getServerSession()
  const profile = session ? await db.userProfile.findUnique({ where: { userId: session.userId }, select: { preferences: true } }) : null
  const preferences = profile?.preferences as { preferredLanguage?: string } | null
  const preferredLanguage = preferences?.preferredLanguage || 'en'
  const communityKey = new URL(request.url).searchParams.get('community')
  const community = communityKey ? await db.community.findFirst({ where: { OR: [{ id: communityKey }, { slug: communityKey }, { name: communityKey }] }, select: { id: true } }) : null
  if (communityKey && !community) return NextResponse.json([])
  const ranking = session ? await personalizeApprovedArticles(session.userId) : []
  const rank = new Map(ranking.map((item) => [item.articleId, item]))
  const articles = await db.canonicalArticle.findMany({
    where: { status: 'PUBLISHED', ...(community ? { communityId: community.id } : {}) },
    include: { community: true, versions: { orderBy: { version: 'desc' }, take: 1 }, localizations: { where: { status: 'APPROVED', language: preferredLanguage } } },
    orderBy: { publishedAt: 'desc' }, take: 100,
  })
  const mapped = articles.map((article) => {
    const version = article.versions[0]
    const localized = article.localizations.find((item) => item.articleVersionId === version?.id)
    const summary = localized?.summary ?? version?.summary ?? []
    return {
      id: article.id, category: version?.categories[0] || 'Verified News', community: article.community?.name || 'KalevaLens',
      title: localized?.headline || version?.headline || '', summary: Array.isArray(summary) ? summary : [],
      readTime: `${Math.max(1, Math.round(((localized?.body || version?.body)?.length || 0) / 1000))} min read`, language: localized?.language || 'source',
      publishedAt: article.publishedAt, relevance: rank.get(article.id) || null,
    }
  })
  mapped.sort((a, b) => (b.relevance?.score || 0) - (a.relevance?.score || 0))
  return NextResponse.json(mapped)
}
