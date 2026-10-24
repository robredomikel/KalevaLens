import { sql } from '@/lib/neon';

let isInitialized = false;

export async function ensureDatabaseSchema() {
  if (isInitialized) return;

  try {
    // 1. Ensure User table
    await sql`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'READER',
        "community" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Ensure StorySubmission table
    await sql`
      CREATE TABLE IF NOT EXISTS "StorySubmission" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "summary" TEXT NOT NULL,
        "content" TEXT,
        "community" TEXT NOT NULL,
        "category" TEXT DEFAULT 'Citizen Scoop',
        "authorId" TEXT NOT NULL,
        "stage" TEXT NOT NULL DEFAULT 'INCOMING',
        "priority" INT DEFAULT 0,
        "aiScore" INT DEFAULT 50,
        "verificationReport" JSONB,
        "evidenceReferences" JSONB,
        "workflowId" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 3. Ensure AgentExecutionLog table
    await sql`
      CREATE TABLE IF NOT EXISTS "AgentExecutionLog" (
        "id" TEXT PRIMARY KEY,
        "workflowId" TEXT NOT NULL,
        "agentName" TEXT NOT NULL,
        "model" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "durationMs" INT,
        "tokenUsage" JSONB,
        "inputReferences" JSONB,
        "outputReferences" JSONB,
        "error" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 4. Ensure EditorialTask table
    await sql`
      CREATE TABLE IF NOT EXISTS "EditorialTask" (
        "id" TEXT PRIMARY KEY,
        "workflowId" TEXT NOT NULL,
        "storyId" TEXT NOT NULL,
        "taskType" TEXT NOT NULL, -- 'HITL_SOURCE_INVESTIGATION' | 'HITL_FINAL_APPROVAL'
        "status" TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
        "details" JSONB,
        "moderatorId" TEXT,
        "decisionNotes" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 5. Ensure ArticleTranslation table
    await sql`
      CREATE TABLE IF NOT EXISTS "ArticleTranslation" (
        "id" TEXT PRIMARY KEY,
        "storyId" TEXT NOT NULL,
        "language" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "summary" JSONB NOT NULL,
        "content" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("storyId", "language")
      );
    `;

    // 6. Ensure ArticleContext table
    await sql`
      CREATE TABLE IF NOT EXISTS "ArticleContext" (
        "id" TEXT PRIMARY KEY,
        "storyId" TEXT NOT NULL,
        "explanationType" TEXT NOT NULL,
        "explanation" TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 7. Ensure UserReadHistory table
    await sql`
      CREATE TABLE IF NOT EXISTS "UserReadHistory" (
        "userId" TEXT NOT NULL,
        "storyId" TEXT NOT NULL,
        "readAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("userId", "storyId")
      );
    `;

    isInitialized = true;
  } catch (err) {
    console.error("Error initializing database tables:", err);
  }
}
