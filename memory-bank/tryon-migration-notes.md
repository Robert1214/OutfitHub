# 试穿功能迁移说明（旧项目 → 新项目）：让新 AI 快速接手

| 项 | 内容 |
| --- | --- |
| 日期 | 2026-11-17 |
| 配套 PRD | `memory-bank/prd-wardrobe-closet-mvp.md` §3.9 |
| 旧项目（源） | `C:\Users\罗敦宝\Projects\outfitexpert` |
| 新项目（目标） | `C:\Users\罗敦宝\Projects\outfitexpert-shop` |
| 结论 | **能直接复用**：`src/lib/tryon/` 7 个文件依赖只有腾讯云 SDK + Node 内置，不绑旧项目业务表。搬过来 + 改 6 处即可 |
| 用户已拍板 | **异步**（POST 立即返回 recordId，GET 轮询）；**用个人中心照片**；**付费不限额** |

---

## 1. 直接复制就能用的文件

旧项目 `C:\Users\罗敦宝\Projects\outfitexpert\src\lib\tryon\`：

| 文件 | 复用度 | 说明 |
|---|---|---|
| `mps.ts` | **100%** | 发起任务 + 轮询 + `buildTryonPrompt`（按类型生成替换服装/佩戴配饰/替换鞋） |
| `run.ts` | **95%** | 流水线：上传中转 → 发起 → 轮询 → 清理 |
| `errors.ts` | **100%** | `TryonError` + `USER_MESSAGES` 友好文案 + `httpStatus` |
| `image.ts` | **100%** | `dataUrlToBuffer` / `dimsOf`（新项目可选，见困难点 4） |
| `config.ts` | **90%** | 读 `TENCENT_*` 环境变量 |
| `cos.ts` | **合并** | 新项目已有 `src/lib/cos.ts`；旧 tryon 的 `uploadsImageTemp/deleteImageTemp/toTryonError` 要并进去或保留独立 |
| `rate-limit.ts` | **不带** | 用户已确认付费，不限额 |

拷贝命令（在源项目里用）：

```bash
mkdir -p C:/Users/罗敦宝/Projects/outfitexpert-shop/src/lib/tryon
cp -r C:/Users/罗敦宝/Projects/outfitexpert/src/lib/tryon/*.ts C:/Users/罗敦宝/Projects/outfitexpert-shop/src/lib/tryon/
```

**不需要拷**：旧项目的 `src/app/**`（普通画布 UI，样式与新项目不符，按新 PRD 重写）、`src/components/*`（旧上传组件，新项目用 `sharp` 校验）、`src/lib/types.ts`（只为一个类型）。

---

## 2. 六个改动点（按影响从大到小）

### 困难点 1（最大）：改成异步 —— 拆开 `run.ts` 的等待

**旧逻辑（同步）**：`POST /api/tryon` 在一个请求里跑完 50~90 秒，返回 `imageUrl`。旧项目注释写明 `maxDuration = 120`（面向 Vercel Pro）。

**新逻辑（异步，用户已定）**：

```
POST /api/tryon
  → 创建 TryonRecord(status=PENDING)
  → 人像 + 单品白底图 → 给 MPS 的 URL（见困难点 2）
  → startTryonTask() 拿到 mpsTaskId
  → 写入 record.mpsTaskId, status=RUNNING
  → 立刻返回 { recordId }（约 1~2 秒）

GET /api/tryon/[id]
  → 读 record
  → 若 PENDING/RUNNING：调一次 DescribeImageTaskDetail
       FINISH + 有 SignedUrl → 下载结果图 → 存 COS 私有桶 → resultKey → status=SUCCEEDED
       FINISH + 有 ErrMsg    → status=FAILED, errorMessage（存友好文案，不存 MPS 原文）
       超过 3 分钟            → status=FAILED, "生成超时"
       否则                   → 仍返回 RUNNING
  → 返回 { status, resultUrl?（签名 URL）, error? }
```

**改哪里**：

| 旧代码 | 新做法 |
|---|---|
| `run.ts` 的 `runTryon()` 内部调 `startTryonTask` 再 `waitForTryonTask` | 拆成 `startTryon()`（只发任务，返回 taskId）和 `pollTryon(taskId)`（查一次，返回状态机结果） |
| `mps.ts` 的 `waitForTryonTask()` 的 for 循环 | 循环体挪到 `pollTryon` 里只跑一次；`FINISH` 但 `ErrMsg` 非空 = 失败（旧代码已有这个判断，必须保留） |
| 清理中转图（`finally { cleanup() }`） | 旧代码在 finally 清理临时图；异步后，发起任务成功就可以立即清理（MPS 已经开始跑了），把 cleanup 挪到 `startTryon` 末尾 |

**注意**：`waitForTryonTask` 里有一处关键处理——MPS 返回的签名链接是 `http://`，旧项目统一升级成 `https://`（否则下载代理会拒）。异步版下载结果图时**必须保留这一步**。

---

### 困难点 2：图片链路反转 —— 不用再把图塞进 JSON

**旧链路**：前端读 File → dataURL → JSON body → 服务端 `dataUrlToBuffer` → COS 临时目录 → 签名 URL → MPS。

**新链路**（单品图已经在 COS 里了）：

| 输入 | 来源 | 怎么给 MPS |
|---|---|---|
| 人像 | `User.photoKey`（个人中心照片） | `getSignedPhotoUrl(photoKey)` → MPS URL |
| 单品 1~4 件 | `WardrobeItemImage.whiteKey`（白底图） | `getSignedPhotoUrl(whiteKey)` → MPS URL |

**已验证（2026-11-17）**：`src/app/api/account/photo/route.ts` 上传人像时**只做校验不压缩**（`sharp().metadata()` 仅读尺寸，`putUserPhoto(buffer, ...)` 传原 buffer）→ 符合 PRD §6.8「原图上传不压缩」。**不用改**。

**但要注意**：COS 签名 URL 有效期当前是 30 分钟（`src/lib/cos.ts` 的 `SIGNED_URL_EXPIRES_SECONDS = 1800`）。MPS 拉图在发起任务时就完成，30 分钟够用。若以后改成更短，这里要确认。

**要不要保留 `run.ts` 的中转上传**：可以保留，但没必要（多一次 COS 复制 + 多一次清理）。更简单：直接给签名 URL。建议新写 `startTryon()` 时不走中转，旧的中转逻辑只在需要临时处理（如裁剪）时用。

---

### 困难点 3：**下装 Prompt 缺分支**（唯一有真实产品风险的点）

**现状**：旧项目 `GarmentRefType` 只有三种：

```ts
// 旧项目 src/lib/types.ts
export const GARMENT_REF_TYPES = ["garment", "accessories", "shoes"] as const;
```

`buildTryonPrompt()` 对 `garment` 生成的是：

> 将[图片1]中模特的**服装**替换为[图片N]中的服装单品…每件都要完整替换所有部位…

**问题**：新衣橱分类是「上装 / 下装 / 鞋子 / 配饰」。如果用户**只选了一条裤子**试穿，MPS 拿到的是 `garment` 类型 + "把模特的服装替换成这条裤子"，结果可能是：
- 只替换了上衣（因为 Prompt 说"服装"，模型可能选离"服装"更近的上半身）
- 或者替换了整套（上衣也被换掉）

**两种解法**：

| 方案 | 做法 | 代价 |
|---|---|---|
| **A（推荐）** | 扩一个 `pants` 参考类型（MPS 官方 ImageSet 是否支持需查文档）；若不支持，就在 Prompt 里加分支：下装单独时写「将[图片1]中模特**下半身的裤子/裙子**替换为[图片N]」 | 改 `buildTryonPrompt` 约 10 行 |
| B | 保持原样，只上传时把下装也当 `garment` | 不改代码，但有上面说的风险 |

**验证方法**（迁移后第一件事）：拿一条纯色阔腿裤的白底图 + 一张站姿人像，跑一次，看结果图是否只换了裤子。记录在 `memory-bank/` 下。

**映射规则**（新项目分类 → MPS 类型）：

| 衣橱分类 | MPS ImageSet type | Prompt 分支 |
|---|---|---|
| 上装（TOP） | `garment` | 替换服装 |
| 下装（BOTTOM） | `garment`（暂） | **新增**：替换下半身裤子/裙子 |
| 鞋子（SHOES） | `shoes` | 替换鞋 |
| 配饰（ACCESSORY） | `accessories` | 佩戴，只参考款式颜色，不复制参考图里的人脸手背景 |

---

### 困难点 4：图片校验重复 —— 用新项目的 `sharp`，不用旧 `image.ts`

旧项目没有 `sharp`（依赖只有 `cos-nodejs-sdk-v5`、`next`、`react`、`react-dom`、`tencentcloud-sdk-nodejs`），所以 `image.ts` 手写 dataURL 解码 + 读 PNG/JPEG 头拿尺寸。

新项目已有 `sharp`（`src/app/api/account/photo/route.ts` 在用），校验规则（JPG/PNG/WebP、≤8MB、≥200×200）已经实现。

**建议**：试穿接口不再接收图片字节，只接收 `itemIds`，直接从 DB 读 key → 图片校验在上传单品图时已做过。`image.ts` 只在需要读尺寸日志时用，可以保留但不接主流程。

---

### 困难点 5：MPS 结果图要落 COS 私有桶（旧项目没有这一步）

旧项目用 MPS 的 **RMS** 链接（1 小时有效），前端直接 `<img src>`。新 PRD 要求结果**长期可回看**（`/account/tryons`），所以：

```ts
// 新写，约 20 行
const res = await fetch(resultUrl);                 // resultUrl 已 http→https 转换
const buffer = Buffer.from(await res.arrayBuffer());
const key = await putTryonResult(userId, buffer);   // 新增到 src/lib/cos.ts，前缀 tryon-results/{userId}/
await prisma.tryonRecord.update({ where: { id }, data: { resultKey: key, status: "SUCCEEDED" } });
```

`src/lib/cos.ts` 需新增：`putTryonResult()`、`putWardrobeImage()`（抠图结果/白底图）、`deleteObject(key)` 通用删除。

**注意旧项目踩过的坑**（git 提交 `f1b6fc5 fix: 修复结果图保存失败（MPS 链接为 http 被代理误拒）`）：下载 MPS 链接前先把 `http://` 换成 `https://`。

---

### 困难点 6：环境变量与其他小改

| 项 | 处理 |
|---|---|
| `TENCENT_MPS_REGION` | 新项目 `.env.local` 补上（旧项目有，默认 `ap-guangzhou`）。`config.ts` 里已有默认值，不补也能跑 |
| `import type { GarmentRefType } from "../types"` | 旧项目 `src/lib/types.ts` 只为一个类型；改成在新项目 `src/lib/tryon/types.ts` 里定义，或从 `tryon/mps.ts` 导出 |
| `TRYON_DAILY_LIMIT` | 用户已确认付费；PRD 里保留但默认不限 |
| `export const maxDuration` | 异步后不需要（每个请求都短），可删 |

---

## 3. 迁移步骤（建议顺序）

1. **复制** `src/lib/tryon/*.ts` → 新项目同路径
2. **改类型**：新建 `src/lib/tryon/types.ts`，定义 `RefImageType = "garment" | "accessories" | "shoes"`（+ 若方案 A 采取，加 `pants`）；改 `mps.ts` 的 import
3. **拆 `run.ts`**：`startTryon()` / `pollTryon()`
4. **加 COS 方法**：`src/lib/cos.ts` 加 `putTryonResult / putWardrobeImage / deleteObject`
5. **建表**：`prisma/schema.prisma` 加 `TryonRecord` / `TryonRecordItem`（见 PRD §5.2），`npx prisma migrate dev`
6. **写接口**：`POST /api/tryon`、`GET /api/tryon/[id]`、`GET /api/tryon`、`DELETE /api/tryon/[id]`
7. **验证下装 Prompt**（困难点 3）：单独一条裤子试穿 1 次，看是否需要加分支
8. **写页面**：`/tryon`（选 1~4 件 + 人像预览 + 2 秒轮询 + 进度条）、`/account/tryons`
9. **真实跑通**：1 件、3 件各 1 次，记录耗时（每张约 1 元）

---

## 4. 验收清单（试穿部分）

- [ ] 未登录 / 无人像 / 0 件 / 超 4 件都有提示
- [ ] MPS 输入是**原图**（`photoKey` 原图，`whiteKey` 白底原尺寸）
- [ ] 参数：`tryon-1.0-lite` + `1K` + `identity`（不自行改）
- [ ] 1 件、3 件真实生成成功
- [ ] 单独一件下装试穿，结果正确替换下半身（困难点 3）
- [ ] 刷新页面后进度不丢（异步的核心价值）
- [ ] 3 分钟超时友好失败
- [ ] 结果图带「AI 生成」标识
- [ ] 结果图存 COS 私有桶，删除记录同步删 COS
- [ ] 浏览器网络响应无 `TENCENT_SECRET_*`

---

## 5. 旧项目里踩过的坑（迁移时别重犯）

| 坑 | 旧项目修复 |
|---|---|
| 结果图保存失败 | MPS 链接是 `http`，被代理拒 → 统一换 `https`（`f1b6fc5`） |
| 衣服只换了一半 | Prompt 强化「每件都要完整替换所有部位（肩部/袖子/袖口/领口/门襟/下摆），不要保留原服装任何部分，不要把两件衣服拼接在一起」（`bdf9b96`） |
| 900px 压缩导致五官变形 | 结论：**原图 + identity + Prompt** 约 85% 可用，不要压缩（PRD §6.8） |
| 面部被重绘 | `FACE_PRESERVE_CLAUSE` 统一追加，且 `identity` 参考图固定放最后 |
| 配饰图带脸/手时模型把脸手画进结果 | 配饰白底图必须不带模特脸/手（抠图时注意） |
