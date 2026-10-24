type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function enforceRateLimit(request: Request, scope: string, limit = 120, windowMs = 60_000) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const client = forwarded || request.headers.get('x-real-ip') || 'local'
  const key = `${scope}:${client}`
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  current.count += 1
  if (current.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    throw new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(retryAfter) } })
  }

  // Keep this best-effort server-process limiter bounded. Production systems
  // with multiple instances should replace it with a shared Redis/API gateway limiter.
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey)
  }
}
