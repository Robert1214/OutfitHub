# MPS 去背景验证记录（2026-11-17）

对应 PRD 风险 **R1**：「MPS 去背景的具体 Action 与参数需查文档验证」。

## 结论

**MPS 去背景可用，参数已跑通，比 PRD 预估快。** 不需要启用备选方案 `@imgly/background-removal-node`。

**模型用 `cutout-1.0-lite`，不用 `cutout-1.0-flash`**（2026-11-17 用户真实图验证后改定，见下方「模型对比」）。

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
      Model: "cutout-1.0-lite",                // 见下方模型对比
    },
    EncodeConfig: { Format: "PNG", Quality: 100 },  // ← 关键：不指定会按原图格式输出，JPG 无透明通道
  },
});
const taskId = res.TaskId;
// 轮询：DescribeImageTaskDetail({ TaskId })
//   Status === "FINISH" 且 ErrMsg 为空 → ImageProcessTaskResultSet[0].Output.SignedUrl
//   Status === "FINISH" 且 ErrMsg 非空 → 实际失败（与试穿一致，这个判断必须保留）
```

## 模型对比（2026-11-17，5 张图实测）

背景：用户反馈「红色衣服 + 红黑色背景」的图，衣服被整件抠掉。

| 图片 | lite 保留% | flash 保留% | lite 耗时 | flash 耗时 |
| --- | --- | --- | --- | --- |
| **用户红衣服**（红色主体 + 红色文字背景） | **72.5%** | **4.3%** ❌ | 2.2s | 3.8s |
| Polo 白底衬衫 | 34.7% | 34.9% | 1.8s | 3.2s |
| 米色阔腿裤 | 32.4% | 32.4% | 1.8s | 5.5s |
| 米白运动外套 | 21.3% | 21.3% | 2.4s | 3.5s |
| 裤子（模特穿着） | 30.0% | 30.0% | 2.4s | 3.5s |

**结论**：其他 4 张图两模型结果一致，但 red-on-red 场景 **flash 会把整件衣服当背景抠掉**（只剩黑色图案），lite 完整保留。且 lite 普遍快一倍。→ **改用 lite**。

**`Type: "pattern"` 不适用**：那是「提取图案」用的，背景会变成马赛克块，测试红衣服时 13s 且效果差。

## 透明底 + 白底双版本（用户确认方案 C）

用户反馈「要白底图，不要格子背景」（格子是前端表示透明的视觉图案）。最终方案：

| 版本 | key 字段 | 用途 |
| --- | --- | --- |
| 透明 PNG | `whiteKey` | 搭配画布叠图、AI 试穿（背景不能有白块） |
| 白底 PNG | `flatKey` | 衣橱列表、单品详情、编辑页展示 |

- 生成时机：去背景成功后，用 sharp 把透明图垫白（`flatten({background:white})`），两个都存 COS
- 封面 `coverKey` 优先取 `flatKey`，没有则回落 `whiteKey`
- 旧数据 `flatKey` 为空时，展示层回落 `whiteKey`（会显示透明，需重新去背景）

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
