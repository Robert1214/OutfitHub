"use client";

import { useState } from "react";
import { Ban, MapPin, Truck } from "lucide-react";

const REGIONS = [
  "北京市",
  "上海市",
  "浙江省 杭州市",
  "江苏省 苏州市",
  "广东省 广州市",
  "四川省 成都市",
];

export function ShippingInfo() {
  const [region, setRegion] = useState(REGIONS[1]);

  return (
    <section className="rounded-xl border bg-muted/20 p-4 text-sm">
      <div className="flex items-start gap-3 border-b pb-3">
        <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">发货时间</span>
          <span>付款后 48 小时内（演示）</span>
        </div>
      </div>

      <div className="flex items-start gap-3 border-b py-3">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">发货地址</span>
          <span className="flex items-center gap-1.5">
            <span>浙江杭州</span>
            <span className="text-muted-foreground">至</span>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              aria-label="选择收货地区（演示）"
              className="h-8 max-w-[9.5rem] rounded-md border border-input bg-background px-2 text-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {REGIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3 pt-3">
        <Ban className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">不退换</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            本店商品均为孤品，售出后不支持退换；演示环境不产生真实交易。
          </p>
        </div>
      </div>
    </section>
  );
}
