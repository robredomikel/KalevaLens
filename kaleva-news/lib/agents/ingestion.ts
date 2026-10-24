import 'server-only'
import crypto from 'node:crypto'
import Parser from 'rss-parser'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logDeterministicAgent } from './execution'

const parser = new Parser()
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex')

const ingestionResultSchema = z.object({
  sources: z.array(z.object({ sourceId: z.string(), inserted: z.number().int().nonnegative(), duplicates: z.number().int().nonnegative(), candidateIds: z.array(z.string()), error: z.string().nullable() })),
  citizenSubmissions: z.object({ inserted: z.number().int().nonnegative(), candidateIds: z.array(z.string()) }),
})

async function performIngestion() {
  const configuredUrls = (process.env.NEWS_RSS_FEEDS || '').split(',').map((url) => url.trim()).filter(Boolean)
  const configuredSources = await Promise.all(configuredUrls.map(async (url) => {
    const hostname = new URL(url).hostname
    return db.newsSource.upsert({ where: { url }, update: { enabled: true }, create: { url, name: hostname, type: 'RSS', attribution: hostname } })
  }))
  const databaseSources = await db.newsSource.findMany({ where: { enabled: true, type: 'RSS' } })
  const sources = [...new Map([...databaseSources, ...configuredSources].map((source) => [source.id, source])).values()]
  const results = []

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url)
      let inserted = 0
      let duplicates = 0
      const candidateIds: string[] = []
      for (const item of feed.items) {
        if (!item.title) continue
        const originalUrl = item.link || null
        const contentHash = hash(`${originalUrl || ''}|${item.title}|${item.isoDate || item.pubDate || ''}`)
        const existing = await db.newsCandidate.findUnique({ where: { contentHash } })
        const candidate = existing || await db.newsCandidate.create({
          data: {
            sourceId: source.id, externalId: item.guid || null, originalUrl, title: item.title,
            description: item.contentSnippet || item.content || null, content: item.content || null,
            publishedAt: item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate || '') : null,
            contentHash,
          },
        })
        if (existing) duplicates += 1
        else { inserted += 1; candidateIds.push(candidate.id) }
        if (originalUrl) {
          await db.evidenceRecord.upsert({
            where: { candidateId_url: { candidateId: candidate.id, url: originalUrl } },
            update: {}, create: { candidateId: candidate.id, url: originalUrl, title: item.title, publisher: source.name, excerpt: item.contentSnippet || null },
          })
        }
      }
      await db.newsSource.update({ where: { id: source.id }, data: { lastFetchedAt: new Date(), lastError: null } })
      results.push({ sourceId: source.id, inserted, duplicates, candidateIds, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'RSS ingestion failed'
      await db.newsSource.update({ where: { id: source.id }, data: { lastError: message } })
      results.push({ sourceId: source.id, inserted: 0, duplicates: 0, candidateIds: [], error: message })
    }
  }

  const submissions = await db.storySubmission.findMany({ where: { candidate: null } })
  const submissionCandidateIds: string[] = []
  for (const submission of submissions) {
    const candidate = await db.newsCandidate.create({
      data: {
        submissionId: submission.id, title: submission.title, description: submission.summary, content: submission.content,
        contentHash: hash(`submission:${submission.id}`), status: 'INGESTED',
      },
    })
    submissionCandidateIds.push(candidate.id)
  }
  return { sources: results, citizenSubmissions: { inserted: submissions.length, candidateIds: submissionCandidateIds } }
}

export async function ingestConfiguredSources() {
  const configuredSourceCount = (process.env.NEWS_RSS_FEEDS || '').split(',').map((url) => url.trim()).filter(Boolean).length
  return logDeterministicAgent(null, 'news_ingestion', { configuredSourceCount }, async () => ingestionResultSchema.parse(await performIngestion()))
}
