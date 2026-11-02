import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { RefTypeValue } from "@/lib/products";

export type OrderStatusValue =
  | "PENDING_PAYMENT"
  | "PAID_DEMO"
  | "SHIPPED_DEMO"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDING_PAYMENT: "待支付（演示）",
  PAID_DEMO: "已支付（演示）",
  SHIPPED_DEMO: "已发货（演示）",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  REFUNDED: "已退款（演示）",
};

export const ORDER_STATUS_OPTIONS: {
  value: OrderStatusValue;
  label: string;
}[] = [
  { value: "PENDING_PAYMENT", label: "待支付" },
  { value: "PAID_DEMO", label: "已支付" },
  { value: "SHIPPED_DEMO", label: "已发货" },
  { value: "COMPLETED", label: "已完成" },
  { value: "CANCELLED", label: "已取消" },
  { value: "REFUNDED", label: "已退款" },
];

export const REFUNDABLE_STATUSES: OrderStatusValue[] = [
  "PAID_DEMO",
  "SHIPPED_DEMO",
  "COMPLETED",
];

export const CANCELLABLE_STATUSES: OrderStatusValue[] = ["PENDING_PAYMENT"];

export function isOrderStatus(value: unknown): value is OrderStatusValue {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ORDER_STATUS_LABELS, value)
  );
}

export type OrderAddressSnapshot = {
  recipient: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
};

export type OrderProductSnapshot = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  color: string;
  sizeLabel: string | null;
  refType: RefTypeValue;
  categoryName: string;
  imageUrl: string | null;
};

export function toAddressSnapshot(address: {
  recipient: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
}): OrderAddressSnapshot {
  return {
    recipient: address.recipient,
    phone: address.phone,
    province: address.province,
    city: address.city,
    district: address.district,
    detail: address.detail,
  };
}

export function toProductSnapshot(product: {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  color: string;
  sizeLabel: string | null;
  refType: RefTypeValue;
  images: { url: string }[];
  category: { name: string };
}): OrderProductSnapshot {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    color: product.color,
    sizeLabel: product.sizeLabel,
    refType: product.refType,
    categoryName: product.category.name,
    imageUrl: product.images[0]?.url ?? null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string {
  return typeof record[key] === "string" ? (record[key] as string) : "";
}

export function readAddressSnapshot(
  value: Prisma.JsonValue,
): OrderAddressSnapshot {
  const record = asRecord(value);
  if (!record) {
    return {
      recipient: "",
      phone: "",
      province: "",
      city: "",
      district: "",
      detail: "",
    };
  }
  return {
    recipient: readString(record, "recipient"),
    phone: readString(record, "phone"),
    province: readString(record, "province"),
    city: readString(record, "city"),
    district: readString(record, "district"),
    detail: readString(record, "detail"),
  };
}

const REF_TYPES: RefTypeValue[] = ["GARMENT", "ACCESSORIES", "SHOES"];

export function readProductSnapshot(
  value: Prisma.JsonValue,
): OrderProductSnapshot {
  const record = asRecord(value);
  if (!record) {
    return {
      id: "",
      name: "商品快照缺失",
      slug: "",
      priceCents: 0,
      color: "",
      sizeLabel: null,
      refType: "GARMENT",
      categoryName: "",
      imageUrl: null,
    };
  }

  const refType = readString(record, "refType");
  return {
    id: readString(record, "id"),
    name: readString(record, "name") || "商品快照缺失",
    slug: readString(record, "slug"),
    priceCents:
      typeof record.priceCents === "number" ? record.priceCents : 0,
    color: readString(record, "color"),
    sizeLabel:
      typeof record.sizeLabel === "string" ? record.sizeLabel : null,
    refType: REF_TYPES.includes(refType as RefTypeValue)
      ? (refType as RefTypeValue)
      : "GARMENT",
    categoryName: readString(record, "categoryName"),
    imageUrl:
      typeof record.imageUrl === "string" ? record.imageUrl : null,
  };
}

/** 订单号：OE{yyyyMMdd}{6 位随机}，日期按 UTC，避免服务器时区影响。 */
export function createOrderNo(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const random = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return `OE${year}${month}${day}${random}`;
}
