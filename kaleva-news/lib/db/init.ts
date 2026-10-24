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

    // 2. Ensure StorySubmission table & columns
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

    // Alter existing StorySubmission table if new columns are missing
    await sql`ALTER TABLE "StorySubmission" ADD COLUMN IF NOT EXISTS "aiScore" INT DEFAULT 50;`;
    await sql`ALTER TABLE "StorySubmission" ADD COLUMN IF NOT EXISTS "verificationReport" JSONB;`;
    await sql`ALTER TABLE "StorySubmission" ADD COLUMN IF NOT EXISTS "evidenceReferences" JSONB;`;
    await sql`ALTER TABLE "StorySubmission" ADD COLUMN IF NOT EXISTS "workflowId" TEXT;`;
    await sql`ALTER TABLE "StorySubmission" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;`;
    await sql`ALTER TABLE "StorySubmission" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;`;
    await sql`ALTER TABLE "StorySubmission" ADD COLUMN IF NOT EXISTS "sourceGuid" TEXT;`;
    await sql`ALTER TABLE "StorySubmission" ADD COLUMN IF NOT EXISTS "canonicalId" TEXT;`;
    await sql`ALTER TABLE "StorySubmission" ADD COLUMN IF NOT EXISTS "articleVersion" TEXT;`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "StorySubmission_canonicalId_key" ON "StorySubmission" ("canonicalId") WHERE "canonicalId" IS NOT NULL;`;

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

    await sql`
      CREATE TABLE IF NOT EXISTS "NarrationScript" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL,
        "articleVersion" TEXT NOT NULL,
        "language" TEXT NOT NULL,
        "scriptVersion" TEXT NOT NULL,
        "script" JSONB NOT NULL,
        "model" TEXT NOT NULL,
        "approvedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("articleId", "articleVersion", "language", "scriptVersion")
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "ArticleMedia" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL,
        "articleVersion" TEXT NOT NULL,
        "language" TEXT NOT NULL,
        "mediaType" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "storageKey" TEXT,
        "mediaUrl" TEXT,
        "captionsUrl" TEXT,
        "mimeType" TEXT,
        "durationSeconds" DOUBLE PRECISION,
        "fileSize" BIGINT,
        "voice" TEXT,
        "resolution" TEXT,
        "generationModel" TEXT,
        "generationMethod" TEXT,
        "scriptVersion" TEXT NOT NULL,
        "errorMessage" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("articleId", "articleVersion", "language", "mediaType", "scriptVersion")
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "MediaJob" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL,
        "articleVersion" TEXT NOT NULL,
        "language" TEXT NOT NULL,
        "mediaType" TEXT NOT NULL,
        "scriptVersion" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "priority" INT NOT NULL DEFAULT 0,
        "attempts" INT NOT NULL DEFAULT 0,
        "maxAttempts" INT NOT NULL DEFAULT 3,
        "runAfter" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "lockedAt" TIMESTAMP WITH TIME ZONE,
        "lockedBy" TEXT,
        "lastError" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("articleId", "articleVersion", "language", "mediaType", "scriptVersion")
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "MediaJob_claim_idx" ON "MediaJob" (status, "runAfter", priority DESC);`;

    isInitialized = true;
  } catch (err) {
    console.error("Error initializing database tables:", err);
  }
}
