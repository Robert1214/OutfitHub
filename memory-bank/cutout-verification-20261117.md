# MPS 去背景验证记录（2026-11-17）

对应 PRD 风险 **R1**：「MPS 去背景的具体 Action 与参数需查文档验证」。

## 结论

**MPS 去背景可用，参数已跑通，比 PRD 预估快。** 不需要启用备选方案 `@imgly/background-removal-node`。

## 接口参数

```js
// tencentcloud-sdk-nodejs → mps.v20190612.Client
const res = await client.ProcessImage({
  InputInfo: { Type: "URL", UrlInputInfo: { Url: imageUrl } },
  OutputStorage: { Type: "RMS" },              // 结果走 1 小时有效链接，不落我们的存储
  OutputDir: "/outfithub/cutout/",
  ImageTask: {
    AiCutoutConfig: {
      Switch: "ON",
      Type: "foreground",                      // 前景抠图（默认）
      Model: "cutout-1.0-flash",               // 或 cutout-1.0-lite（更快、边缘更粗）
    },
    EncodeConfig: { Format: "PNG", Quality: 100 },  // ← 关键：不指定会按原图格式输出，JPG 无透明通道
  },
});
const taskId = res.TaskId;
// 轮询：DescribeImageTaskDetail({ TaskId })
//   Status === "FINISH" 且 ErrMsg 为空 → ImageProcessTaskResultSet[0].Output.SignedUrl
//   Status === "FINISH" 且 ErrMsg 非空 → 实际失败（与试穿一致，这个判断必须保留）
```

## 实测结果

| 测试图 | 尺寸 | 耗时 | 输出 | 四角 alpha | 效果 |
| --- | --- | --- | --- | --- | --- |
| Polo 衬衫（白底商品图） | 1200×1600 | 4.2s | PNG 676KB | 3, 0, 3, 0 | 背景全透明，衣服完整 ✅ |
| 肤色测试海报（水墨画背景 + 白卡片） | 1206×1467 | 4.3s | PNG 2.2MB | 3, 1, 2, 1 | 外侧水墨画去掉，白色卡片保留 ⚠️ |
| 裤子（模特穿着，白墙 + 地面 + 鞋） | 1200×1546 | 4.5s | PNG 697KB | 3, 0, 3, 0 | 墙地去掉；**裤子 + 外套下摆 + 鞋都保留** ⚠️ |

- PRD 预估 5~15 秒，**实测 4~5 秒**
- 输出带透明通道（`hasAlpha: true`, `channels: 4`）
- 输出链接是 `http://`，与试穿一致，必须升级为 `https://` 才能下载
- 主色提取有效：黑色裤子 → `#191919`

## 已知限制（产品层面，需在录入页提示）

MPS 抠的是「**前景主体**」，不是「只有这件衣服」：

- 传**平铺的白底/纯色底商品图** → 效果最好
- 传**模特穿着该单品** → 会把模特、其他衣物、鞋子一起保留
- 传**海报/带边框的图** → 边框卡片会被当成主体保留

**应对**：录入页文案提示「请拍只有这件单品的照片，平铺或悬挂最佳」，并保留「不满意就改传白底图 / 重试」路径（PRD §4.4 已有此要求）。

## 接口实现

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| POST | `/api/wardrobe/cutout` | body `{ originalKey }` → `{ taskId }`；key 越权返回 404 |
| GET | `/api/wardrobe/cutout?taskId=&originalKey=` | 单次查询 → `RUNNING` / `SUCCEEDED{whiteKey,url,color}` / `FAILED{error}` |

- 不建任务表：`taskId` 由前端暂存，轮询时回传；`originalKey` 路径带 userId，服务端校验归属
- 成功结果进程内缓存 10 分钟，避免刷新/并发重复写 COS（单实例 Demo 足够）
- 结果 PNG 落 COS 私有桶 `wardrobe/{userId}/{uuid}.png`，签名 URL 30 分钟

## 代码位置

- `src/lib/cutout/mps.ts` —— MPS 调用与轮询
- `src/lib/cutout/run.ts` —— 流水线（签名 URL → 发起 → 下载 → 存 COS → 提主色）
- `src/lib/cutout/errors.ts` —— 错误与用户文案
- `src/app/api/wardrobe/cutout/route.ts` —— 接口
