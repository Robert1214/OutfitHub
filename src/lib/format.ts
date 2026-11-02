export function formatPrice(priceCents: number): string {
  return `¥${(priceCents / 100).toFixed(2)}`;
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
