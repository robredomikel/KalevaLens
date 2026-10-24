import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { ensureDatabaseSchema } from '@/lib/db/init';
import { getGeminiClient } from '@/lib/ai/gemini';
import { getAgentModel } from '@/lib/ai/models';

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const { articleId, message } = await request.json();

    if (!articleId || !message) {
      return NextResponse.json({ error: 'articleId and message are required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, title, summary, content, community, category, "authorId", "sourceUrl", "contentAccessLevel", "licensingRules"
      FROM "StorySubmission"
      WHERE id = ${articleId} OR "canonicalId" = ${articleId}
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const article = rows[0];
    const publisher = article.authorId || 'Kaleva / News Partner';
    const sourceUrl = article.sourceUrl || '';
    const accessLevel = article.contentAccessLevel || 'SUMMARY_ONLY';
    const availableText = article.content || article.summary || article.title;

    const systemInstruction = `You are KalevaLens AI News Assistant.
Answer user questions about the following news story using grounded facts only.

Article Metadata:
- Title: ${article.title}
- Publisher: ${publisher}
- Category: ${article.category || 'News'}
- Source URL: ${sourceUrl}
- Content Access Level: ${accessLevel}

Available Article Text:
"${availableText}"

Rules:
1. Provide helpful, polite, grounded answers based strictly on the available article text above.
2. If Content Access Level is 'SUMMARY_ONLY' and the user asks for specific details not mentioned in the summary, explain clearly that only the RSS summary preview is available, and invite them to read the full article at the publisher's site (${sourceUrl}). Do NOT hallucinate full-text details.
3. You can explain Finnish cultural, societal, or historical terms mentioned in the summary when asked.`;

    const model = getAgentModel('contextualization') || 'gemini-2.5-flash';
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model,
      contents: message,
      config: {
        systemInstruction,
      },
    });

    const reply = response.text || 'I could not generate a response based on the available article text.';

    return NextResponse.json({
      success: true,
      reply,
      articleContext: {
        title: article.title,
        publisher,
        sourceUrl,
        contentAccessLevel: accessLevel,
      },
    });
  } catch (error: unknown) {
    console.error('Article Chat API Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
