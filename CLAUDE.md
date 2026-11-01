# CLAUDE.md — outfitexpert-shop 开发规范

> 本文件是开发规范；需求唯一依据是 `memory-bank/prd.md`（v0.1），实施计划是 `memory-bank/plan.md`。
> 开工前先读这三份；与它们冲突时停下提问，不要自行发挥。

## 1. 项目

服装店线上店铺 Demo（作品集用）：商品浏览/搜索、登录、个人中心、购物车、Mock 支付、购物车勾选 1~4 件 AI 试穿、Dify 导购助手、简单后台。只做到「收钱前一步」。

- 新项目目录：`C:\Users\罗敦宝\Projects\outfitexpert-shop`
- 旧项目：`C:\Users\罗敦宝\Projects\outfitexpert` —— **只读**，不修改；可参考/复用 `src/lib/tryon/`、`src/app/api/tryon/`、`src/lib/size-engine/`。
- 技术栈：Next.js 16 App Router + TypeScript strict + Tailwind + shadcn/ui + Prisma + Postgres。
- 登录：Auth.js v5 Credentials + JWT。
- AI：腾讯云 MPS（试穿）、Dify Chatflow（导购）。
- 存储：商品图本地 `public/products/`；用户照片/试穿结果 COS 私有桶。

## 2. 硬性规则

### 2.1 需求与范围

- PRD 是唯一需求依据；标「已定」的决策不得改。
- 重大改动先问；不擅自扩大范围、不提前做后续里程碑。
- 只做 Demo：不接真实支付/短信/物流/发票。
- 每次功能改动同步更新 PRD 对应章节与 §11 变更记录。

### 2.2 密钥与安全

- **前端代码不得出现任何 API Key/Secret**（腾讯云 AK/SK、Dify Key、数据库密码）。
- 第三方调用一律走 Next.js Route Handler；密钥放 `.env.local`（不入库），部署放环境变量。
- `.env.example` 列全变量、不含真实值。
- 密码 bcrypt（cost ≥ 10）；会话 HttpOnly + Secure + SameSite=Lax。
- 受保护 API 校验会话；后台校验 `role=ADMIN`；订单/试穿/地址强制 `userId = session.user.id`。
- 上传：类型白名单、≤8MB、服务端解码校验、文件名随机化。
- 用户只看到友好错误；原始错误只进服务端日志。

### 2.3 数据与库存

- Postgres + Prisma；金额整数分 `priceCents`；时间 UTC。
- 不做 SKU 表；颜色/尺码/成衣尺寸是商品属性。
- 孤品库存固定 1；加购不锁库存；下单用事务 + 条件更新：
  `updateMany({ where: { id, status: 'ON_SALE' }, data: { status: 'SOLD', stock: 0 } })`，`count=0` 视为被买走。
- 订单项/地址/试穿项存快照；商品改价不影响历史订单。
- 上架商品必须填：名称、描述、价格、分类、颜色、材质/护理、标签、版型、成衣胸围、衣长、3 图；肩宽/尺码标签可选。

### 2.4 登录

- Auth.js v5 Credentials + JWT（7 天）；邮箱+密码、手机号+演示码 `123456`。
- 邮箱注册不做真实验证；手机号未注册自动建号。
- 页面必须明示「演示环境，验证码固定为 123456」。
- 管理员 seed：`admin@outfitexpert.demo` / `Admin123456`（仅演示）。

### 2.5 购物车与支付

- 游客购物车 localStorage；登录后合并去重。
- 孤品数量固定 1；购物车显示总件数。
- 售罄商品不可勾选、不计入合计。
- Mock 支付：二次确认「不会真实扣款」；订单状态 `PAID_DEMO`（展示「已支付（演示）」）；不接支付网关。
- 支付幂等：重复点击不重复下单；并发买同一件只有一个成功。

### 2.6 AI 试穿

- 必须登录 + 已上传本人照片；购物车勾选 1~4 件。
- 复用旧项目 MPS 能力：`tryon-1.0-lite` + 1K + identity 参考图；原图上传不压缩。
- 结果存 COS 私有桶；DB 存 key；签名 URL 访问；删除记录同步删 COS。
- 合身判断是纯函数（`src/lib/size-engine/`），前后端共用；只用用户胸围 + 成衣胸围 + 版型，输出合身/偏紧/偏松 + 放量 + 建议方向 + 长度提示。
- **不输出具体尺码（S/M/L）**；缺数据只出图并标注「无尺码数据，请以实物为准」。
- 结果图必须带「AI 生成」标识。
- 额度：每账号每日 5 次（`TRYON_DAILY_LIMIT`，默认 5）。
- 错误文案友好；不暴露 MPS 原始报错。

### 2.7 Dify 导购

- Dify Key 只在服务端；`/api/chat` 代理 `/v1/chat-messages`，`response_mode=streaming`。
- 商品不进向量库；知识库只放政策/FAQ/尺码指南；商品用 HTTP 工具查 `/api/assistant/products`。
- LLM 输出 `[[PRODUCTS:id1,id2]]`；前端解析成卡片并从正文移除标记；无效 ID 忽略。
- Dify 云端访问不到 localhost：本地用 Docker Dify 或 cloudflared/ngrok，写进 README。

### 2.8 UI 与演示标识

- 全站页脚：「演示环境 · 仅用于作品集展示，不产生真实交易」。
- 支付/物流/退款/后台均有演示标识。
- 移动端优先（375px 起），桌面 ≥1280px 完整布局。
- 中文界面；金额 ¥ 两位小数。
- 试穿图带「AI 生成」水印。

### 2.9 工程

- 默认 Server Component；只在需要交互时用 `"use client"`。
- 输入校验用 zod（服务端为准，客户端辅助）。
- 每个里程碑结束跑：`npx tsc --noEmit`、`npx eslint src`、`npm run build`，全过。
- 提交信息中文：`feat/fix/docs: 描述`。
- 不提交 `.env.local`、`node_modules`、`.next`、用户照片/试穿结果。

## 3. 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16 App Router |
| 语言 | TypeScript strict |
| UI | Tailwind CSS 4 + shadcn/ui |
| 数据库 | Postgres 16（本地 Docker）+ Prisma；部署 Neon |
| 登录 | Auth.js v5（Credentials + JWT）+ bcryptjs |
| 校验 | zod |
| 试穿 | 腾讯云 MPS `tryon-1.0-lite` + 1K；COS 中转/存储 |
| 导购 | Dify Chatflow；LLM DeepSeek |
| 部署 | Vercel + Neon |

## 4. 目录结构（计划）

```
src/
  app/
    (shop)/                # 前台页面
    admin/                 # 后台
    api/
      auth/[...nextauth]/  # Auth.js
      tryon/               # 试穿
      chat/                # Dify 代理
      assistant/products/  # Dify HTTP 工具
    layout.tsx
  components/
    ui/                    # shadcn
    product/ cart/ tryon/ assistant/ admin/
  lib/
    db.ts auth.ts cos.ts
    tryon/                 # 复用旧项目并改造
    size-engine/           # 复用旧项目
    validations/ utils/
  types/
prisma/
  schema.prisma seed.ts
public/products/
memory-bank/
```

## 5. 环境变量（`.env.example`）

| 变量 | 用途 | 来源 |
| --- | --- | --- |
| `DATABASE_URL` | Postgres 连接串 | 本地 Docker / Neon |
| `AUTH_SECRET` | Auth.js 签名 | `npx auth secret` |
| `AUTH_URL` | 站点 URL | 本地/部署 |
| `NEXT_PUBLIC_APP_URL` | 前端绝对地址 | 本地/部署 |
| `TENCENT_SECRET_ID` | 腾讯云密钥 | 旧项目 `.env.local`（不提交） |
| `TENCENT_SECRET_KEY` | 腾讯云密钥 | 同上 |
| `TENCENT_COS_BUCKET` | COS 桶 | 同上 |
| `TENCENT_COS_REGION` | COS 地域 | 同上（默认 ap-guangzhou） |
| `TENCENT_MPS_REGION` | MPS 地域 | 同上（默认 ap-guangzhou） |
| `DIFY_API_BASE_URL` | Dify API 地址 | 默认 `https://api.dify.ai/v1` |
| `DIFY_API_KEY` | Dify 应用 Key | Dify 后台（仅服务端） |
| `TRYON_DAILY_LIMIT` | 每日试穿次数 | 默认 5 |

## 6. 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地开发 |
| `npm run build` | 构建 |
| `npx tsc --noEmit` | 类型检查 |
| `npx eslint src` | 代码检查 |
| `npx prisma migrate dev` | 迁移 |
| `npx prisma db seed` | 种子数据 |

## 7. 当前阶段

- 第 1 步：PRD v0.1 已完成（2026-11-01）。
- 第 2 步：本文件 + `memory-bank/plan.md` 已完成，**等待用户确认**。
- 第 3 步：M0 未开始。**未确认 plan 前不初始化项目、不装依赖、不写代码。**
