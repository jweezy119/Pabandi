-- Migration: add_ai_models
-- Created: 2026-09-18
-- Purpose: Add AI conversation memory, analysis tracking, and embedding storage

-- 1. AIConversation
CREATE TABLE IF NOT EXISTS "AIConversation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT,
  "sessionId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'dashscope',
  "model" TEXT,
  "messages" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "summary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AIConversation_sessionId_key" UNIQUE ("sessionId")
);
CREATE INDEX IF NOT EXISTS "AIConversation_userId_idx" ON "AIConversation"("userId");
CREATE INDEX IF NOT EXISTS "AIConversation_sessionId_idx" ON "AIConversation"("sessionId");
CREATE INDEX IF NOT EXISTS "AIConversation_createdAt_idx" ON "AIConversation"("createdAt");

-- 2. AIAnalysis
CREATE TABLE IF NOT EXISTS "AIAnalysis" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT,
  "managerId" TEXT,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'dashscope',
  "model" TEXT,
  "input" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "output" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "confidence" DOUBLE PRECISION,
  "tokensUsed" INTEGER,
  "costCents" DOUBLE PRECISION,
  "latencyMs" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AIAnalysis_userId_idx" ON "AIAnalysis"("userId");
CREATE INDEX IF NOT EXISTS "AIAnalysis_managerId_idx" ON "AIAnalysis"("managerId");
CREATE INDEX IF NOT EXISTS "AIAnalysis_type_idx" ON "AIAnalysis"("type");
CREATE INDEX IF NOT EXISTS "AIAnalysis_createdAt_idx" ON "AIAnalysis"("createdAt");

-- 3. AIEmbedding
CREATE TABLE IF NOT EXISTS "AIEmbedding" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'dashscope',
  "model" TEXT,
  "embedding" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "text" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIEmbedding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AIEmbedding_entityType_entityId_provider_key" ON "AIEmbedding"("entityType", "entityId", "provider");
CREATE INDEX IF NOT EXISTS "AIEmbedding_entityType_entityId_idx" ON "AIEmbedding"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AIEmbedding_createdAt_idx" ON "AIEmbedding"("createdAt");
