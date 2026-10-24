import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import type { UserRole } from '@prisma/client'

const COOKIE_NAME = 'kalevalens_session'
export interface ServerSession { userId: string; email: string; role: UserRole; expiresAt: number }

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value === 'REPLACE_WITH_A_RANDOM_SECRET') throw new Error('SESSION_SECRET is not configured.')
  return value
}
const encode = (value: string) => Buffer.from(value).toString('base64url')
const sign = (value: string) => crypto.createHmac('sha256', secret()).update(value).digest('base64url')

export async function createServerSession(input: Omit<ServerSession, 'expiresAt'>) {
  const payload = encode(JSON.stringify({ ...input, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }))
  const store = await cookies()
  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 24 * 60 * 60 })
}

export async function deleteServerSession() { (await cookies()).delete(COOKIE_NAME) }

export async function getServerSession(): Promise<ServerSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = sign(payload)
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ServerSession
    return session.expiresAt > Date.now() ? session : null
  } catch { return null }
}

export async function requireServerSession() {
  const session = await getServerSession()
  if (!session) throw new Response('Authentication required', { status: 401 })
  return session
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireServerSession()
  if (!roles.includes(session.role)) throw new Response('Insufficient permissions', { status: 403 })
  return session
}
