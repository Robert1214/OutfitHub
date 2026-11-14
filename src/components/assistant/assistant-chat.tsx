"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type AssistantProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  status: "DRAFT" | "ON_SALE" | "SOLD" | "ARCHIVED";
  stock: number;
  color: string;
  sizeLabel: string | null;
  refType: "GARMENT" | "ACCESSORIES" | "SHOES";
  imageUrl: string | null;
  categoryName: string;
};

export type AssistantProductContext = {
  id: string;
  name: string;
  slug: string;
  color: string;
  imageUrl: string | null;
  categoryName: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: AssistantProduct[];
  citations?: string[];
  error?: boolean;
  pending?: boolean;
};

const QUICK_PROMPTS = [
  "通勤上班穿什么？",
  "预算 500 推荐一条裙子",
  "有适合婚礼的搭配吗？",
  "这件可以退换吗？",
];

const ANON_KEY = "wardrobe.assistant.anon";

function getAnonId(): string {
  const existing = window.localStorage.getItem(ANON_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(ANON_KEY, next);
  return next;
}

function extractAnswer(text: string): {
  cleanText: string;
  productIds: string[];
  citations: string[];
} {
  const productIds: string[] = [];
  const citations: string[] = [];
  let clean = text;

  clean = clean.replace(/\[\[PRODUCTS:([^\]]+)\]\]/gi, (_match, ids: string) => {
    productIds.push(
      ...ids
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    );
    return "";
  });

  clean = clean.replace(/\[\[CITATIONS:([^\]]+)\]\]/gi, (_match, refs: string) => {
    citations.push(
      ...refs
        .split(",")
        .map((ref) => ref.trim())
        .filter(Boolean),
    );
    return "";
  });

  clean = clean.replace(
    /\[\[META\]\][\s\S]*?(?:\[\[\/META\]\]|$)/gi,
    "",
  );
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "");
  clean = clean.replace(/<!--[\s\S]*?-->/g, "");
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();

  return {
    cleanText: clean,
    productIds: [...new Set(productIds)].slice(0, 4),
    citations: [...new Set(citations)],
  };
}

function AssistantProductCard({ product }: { product: AssistantProduct }) {
  const sold = product.status === "SOLD" || product.stock <= 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex gap-3 rounded-xl border bg-background p-2.5 transition-colors hover:bg-muted/50"
    >
      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="64px"
            className="object-contain"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[11px] text-muted-foreground">
          {product.categoryName}
        </p>
        <p className="line-clamp-2 text-sm font-medium group-hover:underline">
          {product.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {product.color}
          {product.sizeLabel ? ` · ${product.sizeLabel}` : ""}
        </p>
        <p className="mt-1 text-sm font-medium">
          {sold ? "已售出" : formatPrice(product.priceCents)}
        </p>
      </div>
    </Link>
  );
}

export function AssistantChat({
  initialProduct = null,
}: {
  initialProduct?: AssistantProductContext | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: initialProduct
        ? `你好，我在看「${initialProduct.name}」。可以问我这件商品的材质、搭配、尺码或退换政策。`
        : "你好，我是 Wardrobe 的 AI 导购。可以帮你找商品、看搭配、问尺码或退换政策。你想先看什么？",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [contextProduct, setContextProduct] =
    useState<AssistantProductContext | null>(initialProduct);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function updateAssistant(
    id: string,
    updater: (message: ChatMessage) => ChatMessage,
  ) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? updater(message) : message,
      ),
    );
  }

  async function sendQuery(rawQuery: string) {
    const query = rawQuery.trim();
    if (!query || busy) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: query,
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
      pending: true,
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setBusy(true);

    let fullText = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          conversationId: conversationId || undefined,
          anonId: getAnonId(),
          productSlug: contextProduct?.slug,
        }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (data.code === "conversation_expired") setConversationId("");
        updateAssistant(assistantId, (message) => ({
          ...message,
          pending: false,
          error: true,
          text:
            data.code === "conversation_expired"
              ? "对话已过期，我会重新开始一轮对话。请把问题再发一次。"
              : (data.error ?? "导购助手暂时不可用，请稍后重试。"),
        }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamFinished = false;
      let streamError = "";

      while (!streamFinished) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
          if (!line) continue;

          let event: {
            type?: string;
            text?: string;
            message?: string;
            conversationId?: string;
            code?: string;
          };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "delta" && event.text) {
            fullText += event.text;
            updateAssistant(assistantId, (message) => ({
              ...message,
              text: fullText,
            }));
          } else if (event.type === "done") {
            if (event.conversationId) setConversationId(event.conversationId);
            streamFinished = true;
          } else if (event.type === "error") {
            streamError = event.message ?? "回答中断了，请稍后重试。";
            if (event.code === "conversation_expired") {
              // 会话已失效：下一条消息自动开新会话。
              setConversationId("");
              streamError =
                "对话已过期，我会重新开始一轮对话。请把问题再发一次。";
            }
            streamFinished = true;
          }
        }
      }

      const extracted = extractAnswer(fullText);
      let products: AssistantProduct[] = [];

      if (extracted.productIds.length > 0) {
        try {
          const productResponse = await fetch(
            `/api/products?ids=${encodeURIComponent(extracted.productIds.join(","))}`,
          );
          if (productResponse.ok) {
            const data = (await productResponse.json()) as {
              products?: AssistantProduct[];
            };
            const validIds = new Set(extracted.productIds);
            products = (data.products ?? []).filter((product) =>
              validIds.has(product.id),
            );
          }
        } catch {
          // 商品卡片失败不阻断回答展示。
        }
      }

      updateAssistant(assistantId, (message) => ({
        ...message,
        pending: false,
        error: Boolean(streamError),
        text:
          streamError ||
          extracted.cleanText ||
          "我暂时没有组织好回答，请换个说法再试一次。",
        products,
        citations: extracted.citations,
      }));
    } catch {
      updateAssistant(assistantId, (message) => ({
        ...message,
        pending: false,
        error: true,
        text: "网络异常，请稍后重试。",
      }));
    } finally {
      setBusy(false);
    }
  }

  function resetChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "新对话开始了。想看什么？",
      },
    ]);
    setConversationId("");
    setInput("");
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[540px] flex-col rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-medium">Wardrobe 导购</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI 回答仅供演示，不构成真实商品承诺
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={resetChat}>
          新对话
        </Button>
      </div>

      {contextProduct ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2 text-xs sm:px-5">
          <span className="text-muted-foreground">
            正在咨询：
            <Link
              href={`/products/${contextProduct.slug}`}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {contextProduct.name}
            </Link>
          </span>
          <button
            type="button"
            onClick={() => setContextProduct(null)}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            清除上下文
          </button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-2.5",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {message.role === "assistant" ? (
              <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Sparkles className="size-3.5" />
              </span>
            ) : null}

            <div
              className={cn(
                "max-w-[85%] text-sm",
                message.role === "user"
                  ? "rounded-2xl rounded-tr-sm bg-foreground px-3.5 py-2.5 text-background"
                  : "min-w-0",
              )}
            >
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap leading-6">{message.text}</p>
              ) : (
                <div className="space-y-3">
                  {message.pending && !message.text ? (
                    <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
                      <span className="size-1.5 animate-pulse rounded-full bg-current" />
                      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                      <span className="ml-1 text-xs">正在整理建议…</span>
                    </div>
                  ) : message.error ? (
                    <p className="whitespace-pre-wrap leading-7 text-destructive">
                      {message.text}
                    </p>
                  ) : (
                    <div className="space-y-2 leading-7 [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:whitespace-pre-wrap [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    </div>
                  )}

                  {message.citations && message.citations.length > 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      参考知识库：{message.citations.join("、")}
                    </p>
                  ) : null}

                  {message.products && message.products.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {message.products.map((product) => (
                        <AssistantProductCard
                          key={product.id}
                          product={product}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy}
              onClick={() => void sendQuery(prompt)}
              className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendQuery(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendQuery(input);
              }
            }}
            rows={1}
            maxLength={500}
            disabled={busy}
            placeholder="问搭配、尺码、发货或退换…"
            className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon-lg"
            disabled={busy || !input.trim()}
            aria-label="发送"
          >
            <SendHorizontal className="size-4" />
          </Button>
        </form>
        <p className="mt-2 text-[11px] text-muted-foreground">
          演示环境 · 不产生真实交易；回答可能不准确，请以商品页为准
        </p>
      </div>
    </div>
  );
}
