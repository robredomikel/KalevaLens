-- LangGraph owns its checkpoint tables, but the schema must exist before
-- PostgresSaver.setup() can create them.
CREATE SCHEMA IF NOT EXISTS "langgraph";

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('RSS', 'OFFICIAL', 'EXTERNAL', 'CITIZEN');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('INGESTED', 'CLASSIFIED', 'NEEDS_REVIEW', 'VERIFIED', 'SELECTED', 'DRAFTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HumanCheckpoint" AS ENUM ('SOURCE_REVIEW', 'FINAL_APPROVAL', 'CORRECTION_REVIEW');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "EditorialAction" AS ENUM ('APPROVE', 'REQUEST_CHANGES', 'REJECT', 'ESCALATE', 'REQUEST_EVIDENCE');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('RUNNING', 'WAITING_HUMAN', 'COMPLETED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "LocalizationMode" AS ENUM ('STANDARD', 'SIMPLIFIED', 'TRANSLATION_ASSISTED');

-- CreateEnum
CREATE TYPE "LocalizationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContextLevel" AS ENUM ('BRIEF', 'BALANCED', 'DETAILED', 'ADAPTIVE');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferences" JSONB NOT NULL,
    "communityId" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "currentQuestion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "attribution" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsCandidate" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "submissionId" TEXT,
    "communityId" TEXT,
    "externalId" TEXT,
    "originalUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "language" TEXT,
    "publishedAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'INGESTED',
    "classification" JSONB,
    "ingestionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "publisher" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "excerpt" TEXT,
    "claims" JSONB,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalArticle" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "communityId" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "lead" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "categories" TEXT[],
    "sourceReferences" JSONB NOT NULL,
    "claimEvidence" JSONB NOT NULL,
    "verification" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialTask" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT,
    "checkpoint" "HumanCheckpoint" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "candidateId" TEXT,
    "articleId" TEXT,
    "articleVersionId" TEXT,
    "assignedEditorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialDecision" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "articleVersionId" TEXT,
    "moderatorId" TEXT NOT NULL,
    "decision" "EditorialAction" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'RUNNING',
    "currentAgent" TEXT,
    "waitingFor" "HumanCheckpoint",
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "agentIdentifier" TEXT NOT NULL,
    "model" TEXT,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "inputRefs" JSONB,
    "outputRefs" JSONB,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCost" DECIMAL(12,8),
    "errorDetails" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "actorId" TEXT,

    CONSTRAINT "AgentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalizedArticle" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "articleVersionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "mode" "LocalizationMode" NOT NULL DEFAULT 'STANDARD',
    "headline" TEXT NOT NULL,
    "lead" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "consistencyCheck" JSONB,
    "status" "LocalizationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalizedArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextualExplanation" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "articleVersionId" TEXT NOT NULL,
    "level" "ContextLevel" NOT NULL,
    "familiarityBand" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "referenceSources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextualExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "communityId" TEXT,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "classification" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionRequest" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "disputedClaim" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "editorialTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_communityId_idx" ON "UserProfile"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Community_name_key" ON "Community"("name");

-- CreateIndex
CREATE UNIQUE INDEX "NewsSource_url_key" ON "NewsSource"("url");

-- CreateIndex
CREATE UNIQUE INDEX "NewsCandidate_submissionId_key" ON "NewsCandidate"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsCandidate_contentHash_key" ON "NewsCandidate"("contentHash");

-- CreateIndex
CREATE INDEX "NewsCandidate_sourceId_publishedAt_idx" ON "NewsCandidate"("sourceId", "publishedAt");

-- CreateIndex
CREATE INDEX "NewsCandidate_status_createdAt_idx" ON "NewsCandidate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NewsCandidate_communityId_idx" ON "NewsCandidate"("communityId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_candidateId_idx" ON "EvidenceRecord"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRecord_candidateId_url_key" ON "EvidenceRecord"("candidateId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalArticle_candidateId_key" ON "CanonicalArticle"("candidateId");

-- CreateIndex
CREATE INDEX "CanonicalArticle_status_publishedAt_idx" ON "CanonicalArticle"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "CanonicalArticle_communityId_status_idx" ON "CanonicalArticle"("communityId", "status");

-- CreateIndex
CREATE INDEX "ArticleVersion_articleId_createdAt_idx" ON "ArticleVersion"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleVersion_articleId_version_key" ON "ArticleVersion"("articleId", "version");

-- CreateIndex
CREATE INDEX "EditorialTask_status_checkpoint_createdAt_idx" ON "EditorialTask"("status", "checkpoint", "createdAt");

-- CreateIndex
CREATE INDEX "EditorialTask_workflowId_idx" ON "EditorialTask"("workflowId");

-- CreateIndex
CREATE INDEX "EditorialDecision_taskId_createdAt_idx" ON "EditorialDecision"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "EditorialDecision_articleVersionId_idx" ON "EditorialDecision"("articleVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_candidateId_key" ON "WorkflowRun"("candidateId");

-- CreateIndex
CREATE INDEX "AgentExecution_workflowId_startedAt_idx" ON "AgentExecution"("workflowId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentExecution_agentIdentifier_status_idx" ON "AgentExecution"("agentIdentifier", "status");

-- CreateIndex
CREATE INDEX "LocalizedArticle_articleId_language_status_idx" ON "LocalizedArticle"("articleId", "language", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LocalizedArticle_articleVersionId_language_mode_key" ON "LocalizedArticle"("articleVersionId", "language", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "ContextualExplanation_articleVersionId_level_familiarityBan_key" ON "ContextualExplanation"("articleVersionId", "level", "familiarityBand", "language");

-- CreateIndex
CREATE INDEX "Comment_articleId_createdAt_idx" ON "Comment"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "Comment_communityId_createdAt_idx" ON "Comment"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "CorrectionRequest_articleId_status_idx" ON "CorrectionRequest"("articleId", "status");

-- CreateIndex
CREATE INDEX "CorrectionRequest_requesterId_createdAt_idx" ON "CorrectionRequest"("requesterId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsCandidate" ADD CONSTRAINT "NewsCandidate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsCandidate" ADD CONSTRAINT "NewsCandidate_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "StorySubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsCandidate" ADD CONSTRAINT "NewsCandidate_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "NewsCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalArticle" ADD CONSTRAINT "CanonicalArticle_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "NewsCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalArticle" ADD CONSTRAINT "CanonicalArticle_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVersion" ADD CONSTRAINT "ArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "CanonicalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialTask" ADD CONSTRAINT "EditorialTask_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "NewsCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialTask" ADD CONSTRAINT "EditorialTask_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "CanonicalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialTask" ADD CONSTRAINT "EditorialTask_articleVersionId_fkey" FOREIGN KEY ("articleVersionId") REFERENCES "ArticleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialTask" ADD CONSTRAINT "EditorialTask_assignedEditorId_fkey" FOREIGN KEY ("assignedEditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialDecision" ADD CONSTRAINT "EditorialDecision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EditorialTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialDecision" ADD CONSTRAINT "EditorialDecision_articleVersionId_fkey" FOREIGN KEY ("articleVersionId") REFERENCES "ArticleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialDecision" ADD CONSTRAINT "EditorialDecision_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "NewsCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecution" ADD CONSTRAINT "AgentExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecution" ADD CONSTRAINT "AgentExecution_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalizedArticle" ADD CONSTRAINT "LocalizedArticle_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "CanonicalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalizedArticle" ADD CONSTRAINT "LocalizedArticle_articleVersionId_fkey" FOREIGN KEY ("articleVersionId") REFERENCES "ArticleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextualExplanation" ADD CONSTRAINT "ContextualExplanation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "CanonicalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextualExplanation" ADD CONSTRAINT "ContextualExplanation_articleVersionId_fkey" FOREIGN KEY ("articleVersionId") REFERENCES "ArticleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "CanonicalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionRequest" ADD CONSTRAINT "CorrectionRequest_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "CanonicalArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionRequest" ADD CONSTRAINT "CorrectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Promote the communities already present in the application fixture into
-- persistent records. No new/illustrative communities are introduced here.
INSERT INTO "Community" ("id", "slug", "name", "description", "createdAt", "updatedAt") VALUES
  ('oulu-tech-hub', 'oulu-tech-hub', 'Oulu Tech Hub', 'Local updates and conversations from Oulu Tech Hub.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('northern-photographers', 'northern-photographers', 'Northern Photographers', 'Local updates and conversations from Northern Photographers.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('oulu-food-culture', 'oulu-food-culture', 'Oulu Food & Culture', 'Local updates and conversations from Oulu Food & Culture.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
