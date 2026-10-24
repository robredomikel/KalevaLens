import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { title, content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Article content is required' }, { status: 400 });
    }

    // Call OpenAI API for InShorts-style summarization

    
    // const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    //   },
    //   body: JSON.stringify({
    //     model: 'gpt-4o-mini',
    //     messages: [
    //       {
    //         role: 'system',
    //         content: 'You are a professional news editor for Kaleva. Summarize the given article into exactly 3 punchy, informative bullet points under 60 words total. Return them as a JavaScript array of strings or newline-separated sentences.'
    //       },
    //       {
    //         role: 'user',
    //         content: `Title: ${title}\n\nContent: ${content}`
    //       }
    //     ],
    //     temperature: 0.5
    //   })
    // });

    // const data = await response.json();
    // const rawSummary = data.choices[0]?.message?.content || '';
    
    // // Clean up bullet points into a clean array structure
    // const bullets = rawSummary
    //   .split('\n')
    //   .filter((line) => line.trim().length > 0)
    //   .map((line) => line.replace(/^[•\-\*]\s*/, ''));

    return NextResponse.json({
      success: true,
      article: {
        title,
        summary: bullets.length > 0 ? ["Finland has launched a startup support program offering grants and tax incentives.",'Announced on Thursday, the initiative aims to encourage innovation, attract foreign investment, and create thousands of jobs over the next five years.',"Officials expect the program to strengthen the startup ecosystem and improve the country's competitiveness in technology and business development."]
          // bullets : [rawSummary],
      }
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
