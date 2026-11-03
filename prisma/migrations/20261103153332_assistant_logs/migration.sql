-- CreateTable
CREATE TABLE "assistant_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT,
    "conversationId" TEXT,
    "query" TEXT NOT NULL,
    "answer" TEXT,
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invalidProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "citations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "handoff" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER,
    "firstTokenMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "costCents" INTEGER,
    "model" TEXT,
    "promptVersion" TEXT,
    "error" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_logs_userId_createdAt_idx" ON "assistant_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "assistant_logs_createdAt_idx" ON "assistant_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "assistant_logs" ADD CONSTRAINT "assistant_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
