import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateStructured } from '@/lib/ai/gemini'
import { requireServerSession } from '@/lib/auth/server-session'

const inputSchema = z.object({ title: z.string().trim().max(300).optional().default(''), content: z.string().trim().min(1).max(50_000) })
const outputSchema = z.object({ summary: z.array(z.string()).length(3) })

export async function POST(request: Request) {
  try {
    await requireServerSession()
    const input = inputSchema.parse(await request.json())
    const result = await generateStructured({
      agent: 'newsGeneration', schema: outputSchema,
      systemInstruction: 'Summarize the supplied article into exactly three factual, concise bullet points under 60 words total. Do not add unsupported information.',
      prompt: `Title: ${input.title}\n\nContent: ${input.content}`, temperature: 0.2,
    })
    return NextResponse.json({ success: true, article: { title: input.title, summary: result.data.summary } })
  } catch (error) {
    if (error instanceof Response) return error
    const message = error instanceof Error ? error.message : 'Unable to generate summary.'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
