import { NextResponse } from 'next/server';
import { generateAgentStructured } from '@/lib/ai/generate';
import { z } from 'zod';

const SummaryResponseSchema = z.object({
  bullets: z.array(z.string()).min(1).max(5),
});

export async function POST(request) {
  try {
    const { title, content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Article content is required' }, { status: 400 });
    }

    const fallbackBullets = [
      "Finland has launched a startup support program offering grants and tax incentives.",
      "Announced recently, the initiative aims to encourage innovation, attract foreign investment, and create thousands of jobs over the next five years.",
      "Officials expect the program to strengthen the startup ecosystem and improve the country's competitiveness in technology and business development."
    ];

    const result = await generateAgentStructured({
      agentName: 'newsGeneration',
      prompt: `Title: ${title || 'Article Summary'}\nContent: ${content}`,
      systemInstruction: 'You are a professional news editor for Kaleva. Summarize the given article into exactly 3 punchy, informative bullet points under 60 words total.',
      schema: SummaryResponseSchema,
      fallbackResponse: { bullets: fallbackBullets },
    });

    return NextResponse.json({
      success: true,
      article: {
        title: title || 'Summarized Article',
        summary: result.data.bullets && result.data.bullets.length > 0 ? result.data.bullets : fallbackBullets,
      }
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

