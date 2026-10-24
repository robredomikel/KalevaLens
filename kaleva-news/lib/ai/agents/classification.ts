import { generateAgentStructured } from "../generate";
import { ClassifiedNews, ClassifiedNewsSchema, NewsCandidate } from "../schemas/article";

const SYSTEM_INSTRUCTION = `
You are an expert news editor and classifier for Kaleva, a news publisher in Northern Finland.
Classify the given news article into appropriate topic, community, location, urgency, and reader needs.
The six reader needs are:
1. Information - factual updates
2. Understanding - deep background, context
3. Usefulness - practical, actionable advice for daily life
4. Emotion - human interest, inspiring or empathetic stories
5. Break - lighthearted, intriguing, entertaining news
6. Community - local activities, hyper-local announcements

Return structured JSON adhering strictly to the schema.
`;

export async function runClassificationAgent(
  candidate: NewsCandidate
): Promise<ClassifiedNews> {
  const prompt = `
Analyze and classify this news article candidate:
Title: ${candidate.title}
Summary/Content: ${candidate.summary} ${candidate.content || ""}
Source: ${candidate.sourceName}

Available Communities in Oulu/Northern Finland:
- Oulu Tech Hub
- Northern Photographers
- Oulu Food & Culture
- Oulu Startup Founders
- University Students Oulu
- Northern Finland Real Estate
- Oulu Cycling & Outdoors
- Local Musicians & Artists
- Oulu Gaming & Esports
- Ostrobothnia Weather Watchers
- Oulu Volunteer Network
- Finnish Tech News

Classify topic category, target community, location, urgency (low, medium, high, breaking), reader needs array, and sensitivity score (0-100).
`;

  const fallbackResponse: ClassifiedNews = {
    candidateId: candidate.id,
    category: "Local News",
    community: "Oulu Tech Hub",
    primaryLocation: "Oulu",
    language: "fi",
    urgency: "medium",
    readerNeeds: ["Information", "Understanding"],
    sensitivityScore: 20,
    isSensitive: false,
  };

  const result = await generateAgentStructured({
    agentName: "classification",
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    schema: ClassifiedNewsSchema,
    fallbackResponse,
  });

  return result.data;
}
