import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrlSafe } from "@/lib/cos";
import { buildAutoLayout, getLook } from "@/lib/looks";
import { CanvasEditor } from "@/components/canvas/canvas-editor";
import type { CanvasItemMeta } from "@/components/canvas/canvas-board";

export const metadata = { title: "搭配排版 · OutfitHub" };
export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function LookEditPage({ params }: Props) {
  const session = await requireUser("/looks");
  const { id } = await params;
  const look = await getLook(session.user.id, id);
  if (!look) notFound();

  const autoElements = await buildAutoLayout(
    session.user.id,
    look.items.map((item) => item.id),
  );

  const metaEntries = await Promise.all(
    look.items.map(async (item) => {
      const url = await getSignedUrlSafe(item.whiteKey);
      let aspectRatio = 0.8;
      if (url) {
        // 宽高比用不到真实尺寸也能画，先按 4:5 估；有 DB 尺寸时可替换
        aspectRatio = 0.8;
      }
      const entry: [string, CanvasItemMeta] = [
        item.id,
        {
          itemId: item.id,
          name: item.name,
          category: item.category,
          url,
          aspectRatio,
        },
      ];
      return entry;
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 space-y-2">
        <Link
          href={`/looks/${look.id}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← 返回搭配
        </Link>
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          CANVAS
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {look.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          拖动单品摆到想要的位置，保存后会生成白底拼合图。
        </p>
      </div>

      <CanvasEditor
        lookId={look.id}
        initialElements={look.canvas ?? autoElements}
        autoElements={autoElements}
        hasCollage={Boolean(look.collageKey)}
        meta={Object.fromEntries(metaEntries)}
      />
    </div>
  );
}
