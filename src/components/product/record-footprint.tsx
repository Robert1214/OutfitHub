"use client";

import { useEffect } from "react";

export function RecordFootprint({
  productId,
  enabled,
}: {
  productId: string;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    void fetch("/api/footprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
      keepalive: true,
    }).catch(() => undefined);
  }, [enabled, productId]);

  return null;
}
