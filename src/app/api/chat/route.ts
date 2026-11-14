import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { persistAssistantLog } from "@/lib/assistant-logs";
import { prisma } from "@/lib/db";
import { allowRateLimit } from "@/lib/rate-limit";
import {
  getSizeAdvice,
  type BodyMetrics,
  type SizeProduct,
} from "@/lib/size-engine";

const bodySchema = z.object({
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  bustCm: z.number().int().min(40).max(200).nullable().optional(),
  waistCm: z.number().int().min(30).max(200).nullable().optional(),
  hipCm: z.number().int().min(40).max(200).nullable().optional(),
});

const chatSchema = z.object({
  query: z.string().trim().min(1, "请输入问题").max(500, "问题太长"),
  conversationId: z.string().trim().max(100).optional().nullable(),
  anonId: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/, "匿名标识不正确")
    .optional(),
  productSlug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9-]+$/, "商品标识不正确")
    .optional(),
  body: bodySchema.optional(),
});

const EMPTY_BODY: BodyMetrics = {
  heightCm: null,
  bustCm: null,
  waistCm: null,
  hipCm: null,
};

const BODY_FIELD_LABEL: Record<keyof BodyMetrics, string> = {
  heightCm: "身高",
  bustCm: "胸围",
  waistCm: "腰围",
  hipCm: "臀围",
};

type SizeContextProduct = Omit<SizeProduct, "categorySlug"> & {
  id: string;
  name: string;
  category: { slug: string };
};

function buildSizeAdviceText(
  product: SizeContextProduct | null,
  body: BodyMetrics | null,
): string {
  if (!product) {
    return "请告诉我是哪一件商品，以及你的身高/胸围（上装）或腰围/臀围（下装）。";
  }

  const advice = getSizeAdvice(body ?? EMPTY_BODY, {
    refType: product.refType,
    categorySlug: product.category.slug,
    fitType: product.fitType,
    chestCm: product.chestCm,
    lengthCm: product.lengthCm,
    waistCm: product.waistCm,
    hipCm: product.hipCm,
    pantsLengthCm: product.pantsLengthCm,
  });
  const marker = `\n\n[[PRODUCTS:${product.id}]]`;

  if (advice.kind === "missing-body") {
    return `${product.name}：请先补充${advice.requiredFields
      .map((field) => BODY_FIELD_LABEL[field])
      .join("、")}，我才能判断合身程度。${marker}`;
  }

  if (advice.kind === "missing-product") {
    return `${product.name}：${advice.detail}${marker}`;
  }

  if (advice.kind === "not-applicable") {
    return `${product.name}：${advice.detail}${marker}`;
  }

  return `${product.name}：${advice.summary}。${advice.detail}${marker}`;
}

type DifyUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type DifyEvent = {
  event?: string;
  answer?: string;
  conversation_id?: string;
  message?: string;
  data?: { error?: string; status?: string | number };
  status?: string | number;
  usage?: DifyUsage;
  metadata?: { usage?: DifyUsage; model_name?: string };
};

function cleanReasoning() {
  let buffer = "";
  let inThink = false;

  return {
    push(chunk: string): string {
      buffer += chunk;
      let out = "";

      while (buffer.length > 0) {
        if (inThink) {
          const end = buffer.indexOf("</think>");
          if (end === -1) {
            // 保留结尾，防止 </think> 被拆到两个 chunk。
            buffer = buffer.slice(-8);
            break;
          }
          buffer = buffer.slice(end + 8);
          inThink = false;
          continue;
        }

        const start = buffer.indexOf("<think>");
        if (start === -1) {
          if (buffer.length > 7) {
            out += buffer.slice(0, -7);
            buffer = buffer.slice(-7);
          }
          break;
        }

        out += buffer.slice(0, start);
        buffer = buffer.slice(start + 7);
        inThink = true;
      }

      return out;
    },
    flush(): string {
      if (inThink) {
        buffer = "";
        return "";
      }
      const out = buffer;
      buffer = "";
      return out;
    },
  };
}

function sseData(line: string): DifyEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload) as DifyEvent;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const apiBase = (process.env.DIFY_API_BASE_URL ?? "").replace(/\/+$/, "");
  const apiKey = process.env.DIFY_API_KEY?.trim();
  if (!apiBase || !apiKey) {
    return NextResponse.json(
      { error: "导购助手暂未配置" },
      { status: 503 },
    );
  }

  const session = await auth();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "问题格式不正确" },
      { status: 400 },
    );
  }

  const requestStartedAt = Date.now();
  const contextProduct = parsed.data.productSlug
    ? await prisma.product.findUnique({
        where: { slug: parsed.data.productSlug },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          priceCents: true,
          color: true,
          sizeLabel: true,
          refType: true,
          material: true,
          careInstructions: true,
          tags: true,
          styleTags: true,
          occasionTags: true,
          returnPolicy: true,
          fitType: true,
          chestCm: true,
          lengthCm: true,
          waistCm: true,
          hipCm: true,
          pantsLengthCm: true,
          status: true,
          category: { select: { name: true, slug: true } },
        },
      })
    : null;
  const user = session?.user?.id
    ? `user:${session.user.id}`
    : `anon:${parsed.data.anonId ?? randomUUID()}`;
  if (!allowRateLimit(`assistant-chat:${user}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "问得太频繁了，稍等一下再试" },
      { status: 429 },
    );
  }

  const savedBody =
    session?.user?.id && contextProduct
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            heightCm: true,
            bustCm: true,
            waistCm: true,
            hipCm: true,
          },
        })
      : null;
  const hasSavedBody =
    savedBody !== null &&
    Object.values(savedBody).some((value) => value !== null);
  const requestBody: BodyMetrics | null = parsed.data.body
    ? {
        heightCm: parsed.data.body.heightCm ?? null,
        bustCm: parsed.data.body.bustCm ?? null,
        waistCm: parsed.data.body.waistCm ?? null,
        hipCm: parsed.data.body.hipCm ?? null,
      }
    : null;
  const measurements = hasSavedBody ? savedBody : requestBody;
  const sizeAdvice = buildSizeAdviceText(contextProduct, measurements);

  let difyResponse: Response;
  try {
    difyResponse = await fetch(`${apiBase}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        inputs: {
          // 即使没有商品上下文也显式传空字符串：
          // Dify 的 product_id 可能被设为必填，缺字段会导致整个工作流失败。
          product_id: contextProduct?.id ?? "",
          product_name: contextProduct?.name ?? "",
          product_slug: contextProduct?.slug ?? "",
          product_context: contextProduct
            ? JSON.stringify(contextProduct)
            : "",
          size_advice: sizeAdvice,
        },
        query: parsed.data.query,
        response_mode: "streaming",
        conversation_id: parsed.data.conversationId ?? "",
        user,
      }),
      signal: request.signal,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown";
    console.error("导购助手连接失败：", message);
    void persistAssistantLog({
      userId: session?.user?.id,
      anonId: parsed.data.anonId,
      query: parsed.data.query,
      answer: "",
      error: message,
      latencyMs: Date.now() - requestStartedAt,
      promptVersion: process.env.ASSISTANT_PROMPT_VERSION ?? "dify-v0",
    });
    return NextResponse.json(
      { error: "导购助手暂时连接不上，请稍后重试" },
      { status: 502 },
    );
  }

  if (!difyResponse.ok || !difyResponse.body) {
    const detail = await difyResponse.text().catch(() => "");
    console.error("导购助手返回错误：", difyResponse.status, detail.slice(0, 500));
    void persistAssistantLog({
      userId: session?.user?.id,
      anonId: parsed.data.anonId,
      query: parsed.data.query,
      answer: "",
      error: `dify_${difyResponse.status}`,
      latencyMs: Date.now() - requestStartedAt,
      promptVersion: process.env.ASSISTANT_PROMPT_VERSION ?? "dify-v0",
    });
    return NextResponse.json(
      {
        error: "导购助手暂时不可用，请稍后重试",
        // 会话不存在（过期/换了用户）：前端应丢弃旧 conversationId 重新开始。
        ...(difyResponse.status === 404 ? { code: "conversation_expired" } : {}),
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reasoning = cleanReasoning();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let conversationId = parsed.data.conversationId ?? "";
      let fullAnswer = "";
      let firstTokenAt: number | null = null;
      let streamError = "";
      let usage: DifyUsage | undefined;
      let model: string | undefined;

      const send = (value: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      };

      // Preserve the workflow's recommendation decision. A missing marker must
      // not trigger a second, unfiltered catalog search or an unrelated page card.
      try {
        const reader = difyResponse.body!.getReader();
        let finished = false;

        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let lineEnd = buffer.indexOf("\n");
          while (lineEnd !== -1) {
            const line = buffer.slice(0, lineEnd).replace(/\r$/, "");
            buffer = buffer.slice(lineEnd + 1);
            lineEnd = buffer.indexOf("\n");

            const event = sseData(line);
            if (!event) continue;
            if (event.conversation_id) conversationId = event.conversation_id;
            usage = event.usage ?? event.metadata?.usage ?? usage;
            model = event.metadata?.model_name ?? model;

            if (
              event.event === "message" ||
              event.event === "agent_message"
            ) {
              const text = reasoning.push(event.answer ?? "");
              if (text) {
                if (!firstTokenAt) firstTokenAt = Date.now();
                fullAnswer += text;
                send({ type: "delta", text });
              }
            }

            if (
              event.event === "workflow_finished" &&
              event.data?.status === "failed"
            ) {
              streamError = event.data.error ?? "workflow_failed";
              console.error("导购助手工作流失败：", streamError);
              send({
                type: "error",
                message: "导购助手暂时不可用，请稍后重试",
              });
              finished = true;
              break;
            }

            if (event.event === "message_end") {
              const tail = reasoning.flush();
              if (tail) {
                if (!firstTokenAt) firstTokenAt = Date.now();
                fullAnswer += tail;
                send({ type: "delta", text: tail });
              }
              send({ type: "done", conversationId });
              finished = true;
              break;
            }

            if (event.event === "error") {
              streamError =
                event.message ??
                event.data?.error ??
                "导购助手暂时不可用，请稍后重试";
              send({
                type: "error",
                message: streamError,
                // 会话不存在（过期/换了用户）：前端应丢弃旧 conversationId 重新开始。
                ...(event.status === 404 || /Conversation Not Exists/i.test(streamError)
                  ? { code: "conversation_expired" } : {}),
              });
              finished = true;
              break;
            }
          }
        }

        if (!finished) {
          const tail = reasoning.flush();
          if (tail) {
            if (!firstTokenAt) firstTokenAt = Date.now();
            fullAnswer += tail;
            send({ type: "delta", text: tail });
          }
          send({ type: "done", conversationId });
        }
      } catch (error) {
        streamError =
          error instanceof Error ? error.message : "stream_error";
        console.error("导购助手流式响应失败：", streamError);
        send({
          type: "error",
          message: "回答中断了，请稍后重试",
        });
      } finally {
        controller.close();
        void persistAssistantLog({
          userId: session?.user?.id,
          anonId: parsed.data.anonId,
          conversationId,
          query: parsed.data.query,
          answer: fullAnswer,
          error: streamError || undefined,
          latencyMs: Date.now() - requestStartedAt,
          firstTokenMs: firstTokenAt
            ? firstTokenAt - requestStartedAt
            : undefined,
          usage: {
            promptTokens: usage?.prompt_tokens,
            completionTokens: usage?.completion_tokens,
          },
          model,
          promptVersion: process.env.ASSISTANT_PROMPT_VERSION ?? "dify-v0",
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
