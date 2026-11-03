import { prisma } from "@/lib/db";

type AssistantUsage = {
  promptTokens?: number;
  completionTokens?: number;
};

type AssistantLogInput = {
  userId?: string;
  anonId?: string;
  conversationId?: string;
  query: string;
  answer: string;
  error?: string;
  latencyMs?: number;
  firstTokenMs?: number;
  usage?: AssistantUsage;
  model?: string;
  promptVersion?: string;
};

function extractIds(answer: string, marker: string): string[] {
  const regex = new RegExp(`\\[\\[${marker}:([^\\]]+)\\]\\]`, "gi");
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(answer)) !== null) {
    ids.push(
      ...match[1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }
  return [...new Set(ids)];
}

function extractMeta(answer: string): Record<string, unknown> | null {
  const match = answer.match(/\[\[META\]\]([\s\S]*?)\[\[\/META\]\]/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseAssistantMarkers(answer: string): {
  productIds: string[];
  citations: string[];
  intent: string | null;
  confidence: number | null;
  handoff: boolean;
} {
  const meta = extractMeta(answer);
  const intent =
    typeof meta?.intent === "string" ? (meta.intent as string) : null;
  const confidence =
    typeof meta?.confidence === "number" ? (meta.confidence as number) : null;

  return {
    productIds: extractIds(answer, "PRODUCTS"),
    citations: extractIds(answer, "CITATIONS"),
    intent,
    confidence,
    handoff:
      meta?.handoff === true ||
      answer.toLowerCase().includes("转人工") ||
      answer.includes("[[HANDOFF]]"),
  };
}

export async function persistAssistantLog(input: AssistantLogInput): Promise<void> {
  try {
    const parsed = parseAssistantMarkers(input.answer);
    const validProducts =
      parsed.productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: parsed.productIds } },
            select: { id: true },
          })
        : [];
    const validIds = new Set(validProducts.map((product) => product.id));
    const validProductIds = parsed.productIds.filter((id) => validIds.has(id));
    const invalidProductIds = parsed.productIds.filter(
      (id) => !validIds.has(id),
    );

    await prisma.assistantLog.create({
      data: {
        userId: input.userId ?? null,
        anonId: input.anonId ?? null,
        conversationId: input.conversationId ?? null,
        query: input.query,
        answer: input.answer || null,
        intent: parsed.intent,
        confidence: parsed.confidence,
        productIds: parsed.productIds,
        validProductIds,
        invalidProductIds,
        citations: parsed.citations,
        handoff: parsed.handoff,
        latencyMs: input.latencyMs ?? null,
        firstTokenMs: input.firstTokenMs ?? null,
        promptTokens: input.usage?.promptTokens ?? null,
        completionTokens: input.usage?.completionTokens ?? null,
        model: input.model ?? null,
        promptVersion: input.promptVersion ?? null,
        error: input.error ?? null,
      },
    });
  } catch (error) {
    console.error(
      "写入助手日志失败：",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
