# CLAUDE.md — OutfitHub 开发规范

> **需求唯一依据**：`memory-bank/prd-outfithub-mvp.md`（v1.0）
> **开工说明**：`memory-bank/outfithub-kickoff.md`
> **试穿迁移**：`memory-bank/tryon-migration-notes.md`
>
> 与本文件冲突时以 PRD 为准；PRD 没写的先问，不要自行扩大范围。

## 1. 项目

**OutfitHub — AI 电子衣橱**，由网店 Demo 转型而来。以「单品—搭配—新单据」三区组织数据：

- **Wardrobe**（衣橱）管理已有单品，四分类：上装 / 下装 / 鞋子 / 配饰
- **Look**（搭配）记录成套穿搭，核心是**打通式画布**（勾选 2~8 件 → 自动排版 → 拖动/缩放/旋转/层级 → 保存坐标 → 服务端 sharp 渲染 PNG）
- **New**（新单据）承接待定单品与试穿记录，购入后回流至前两区

- 项目目录：`C:\Users\罗敦宝\Projects\outfitexpert-shop`
- 旧项目：`C:\Users\罗敦宝\Projects\outfitexpert` —— **只读**，不修改；可参考 `src/lib/tryon/`、`src/lib/size-engine/`
- 当前工作分支：`outfithub-mvp`（基于 `m5-context-p0`）；`main` 原样保留作为旧版本

### 1.1 历史文件（**不要作为需求依据**）

`memory-bank/prd.md`、`plan.md`、`CURRENT.yml`、`m5-*.md`、`ai-pm-*.md` —— 旧网店 / M5 导购的历史记录，仅供查证；`prd-wardrobe-closet-mvp.md` 已作废。

## 2. 界面沿用（PRD §1.4）

M5 导购功能已放弃，但**现有前端视觉风格与组件作为基础沿用**：

- **`/products` 商品页是衣橱页与搭配列表页的结构模板**：页头（小字母 + 大标题 + 说明）、左侧 240px 筛选栏、搜索 + 排序行、共 N 件、4:5 卡片网格（手机 2 / 平板 3 / 桌面 4 列）、空状态、骨架屏 —— 结构照搬，只换数据源与文案
- **首页**保留现有版式骨架（Bodoni 大标题 + Hero 大图 + 分区区块 + 搜索框），内容从「商品」换为「搭配」
- **组件映射**：`HeroCarousel` → Look 轮播；`ExpandableProductGrid` / `ProductCard` → 单品卡 / Look 卡；`ProductFilters` → 分类 + 标签筛选
- **旧页面不删**：`/products`、`/products/[slug]`、`/cart`、`/orders`、`/assistant` 及其实现在代码中保留，仅从导航移除，直接访问仍可用

## 3. 硬性规则

### 3.1 需求与范围

- PRD 是唯一需求依据；标「已定」的决策不得改。
- 重大改动先问；不擅自扩大范围、不提前做后续步骤。
- **共存规则**：新增表 / 接口 / 页面用新命名空间，不改旧模块文件；`Product`（旧商品）与 `WardrobeItem`（新单品）是两套数据，互不写入。
- 全站导航在**第 12 步**才改；在那之前新增页面通过直接路径访问验证。
- 每步跑通 `npm run typecheck` 后提交，commit 中文 `feat: 简短说明`。

### 3.2 密钥与安全

- **前端不得出现任何 Secret**（腾讯云 AK/SK、数据库密码）。第三方调用一律走 Route Handler。
- `.env.local` 已配置好，**不要改动**；部署用环境变量。
- 数据隔离：所有新 API 校验 `session.user.id === 记录.userId`，越权返回 **404**（不是 403，避免暴露存在性）。
- 图片全走 **COS 私有桶 + 签名 URL（30 分钟）**；DB 只存 key。
- 上传校验（单品图 / 人像图通用）：MIME 白名单 JPG/PNG/WebP、单张 ≤8MB、≥200×200、`sharp` 服务端解码校验、文件名随机化。
- 用户只看到友好错误；原始错误只进服务端日志。

### 3.3 数据

- Postgres + Prisma 7；金额整数分 `priceCents`；时间 UTC。
- 新表 9 张：`WardrobeItem`、`WardrobeItemImage`、`Tag`、`ItemTag`、`Outfit`、`OutfitItem`、`OutfitTag`、`TryonRecord`、`TryonRecordItem`（见 PRD §5.2）。
- 画布坐标存归一化 **0~1**，`Outfit.canvas` JSON：`[{ itemId, imageKey, x, y, scale, rotation, zIndex }]`。
- 标签按用户隔离（`@@unique([userId, name])`），带 `useCount` 用于自动补全排序。
- 删除单品 / 搭配 / 试穿记录时**同步删 COS 对象**。

### 3.3.1 测试数据规则（**最高优先级，已违规 3 次**）

> **违反记录**：2026-11-17 两次、2026-11-18 一次，共 3 次误删用户数据/用错账号。
> 每次开始测试前**必须**按本节第 0 步自检。

#### 第 0 步：测试前必答三问

1. 这次测试要操作哪个账号？→ **只用 demo**（`demo@outfitexpert.demo`）
2. 数据清理的 SQL 带 `where "userId"` 了吗？→ **必须带**
3. COS 清理的前缀是 `wardrobe/{demoId}/` 吗？→ **不能是 `wardrobe/`**

#### 两个账号

| 账号 | 登录 | userId | 用途 |
| --- | --- | --- | --- |
| 演示用户 | `demo@outfitexpert.demo` / `Demo123456` | `cmvy255si0001aotqvztah9bo` | **测试专用**，可随意增删 |
| 用户8910 | 手机号 `12345678910` / 验证码 `123456` | `cmvz335it00007otqov7sfzod` | **用户本人**，只读，不写测试数据 |

#### 统一入口（优先用脚本，不要手写 SQL）

```bash
node scripts/dev-fixtures.mjs seed     # demo 账号造 3 件单品 + 1 套搭配
node scripts/dev-fixtures.mjs clean    # 只清 demo 账号（DB + COS）
node scripts/dev-fixtures.mjs status   # 查看 demo 账号现状
```

#### 手工清库模板（复制粘贴，不要改写 where 条件）

```sql
-- ✅ 正确：demo 账号
delete from tryon_records  where "userId" = 'cmvy255si0001aotqvztah9bo';
delete from outfits        where "userId" = 'cmvy255si0001aotqvztah9bo';
delete from wardrobe_items where "userId" = 'cmvy255si0001aotqvztah9bo';
delete from tags           where "userId" = 'cmvy255si0001aotqvztah9bo';

-- ❌ 禁止：不带 where 的 delete（会删掉用户数据）
-- delete from wardrobe_items;
```

#### COS 清理

```js
// ✅ 正确
for (const p of [`wardrobe/${DEMO_ID}/`, `outfits/${DEMO_ID}/`, `tryon-results/${DEMO_ID}/`]) { ... }

// ❌ 禁止
// for (const p of ["wardrobe/", "outfits/", "tryon-results/"]) { ... }
```

#### 浏览器测试登录哪个账号

- 自动化测试脚本一律登录 **demo 账号**（邮箱 + 密码）
- 需要验证「用户视角」时才用手机号账号，且**只在本地造临时数据、测完立即清理该账号**
- 需要看用户自己的真实数据时，**先问用户**是否可清空

#### 其他约束

- 标签按用户隔离，清理时同样带 `userId`。
- 人像照片：demo 账号的 `photoKey` 可随测试覆盖；用户账号的 `photoKey` 不要动。

### 3.4 登录

- Auth.js v5 Credentials + JWT（7 天）；邮箱 + 密码、手机号 + 演示码 `123456`（沿用，不改）。
- 服务端页面用 `requireUser()`（`src/lib/auth-guards.ts`）；API 用 `auth()` 判断会话。

### 3.5 画布（核心，PRD §3.5.2）

- 画布 2000×2000 白底；前端 DOM + CSS transform 实时预览；保存时服务端 `sharp` 渲染 PNG 存 COS。
- 初始自动排版：2 件一行横排；3~4 件 2×2；5~6 件上 2 下 3；7~8 件上 3 下 4；排序「上装 → 下装 → 鞋子 → 配饰」。
- 交互：单击选中 / 拖动松手吸附 8px / 四角缩放 / 滚轮 + 双指 / 上移下移一层 / 旋转手柄 -180°~180° / Ctrl+Z 撤销 / 恢复自动排版。
- 单品初始宽度：画布宽 × 0.4（上装）、0.35（下装）、0.18（鞋 / 配饰），等比高。
- 键盘微调：方向键 1px，Shift+方向键 10px。
- 服务端渲染尺寸与前端预览必须一致。

### 3.6 悬停双视角

- 默认实穿照，悬停切白底拼合图，`opacity` 交叉淡入 250ms，不位移。
- 移动端右上角切换按钮。
- 缺图只显示存在的那张，不报错。
- 组件 `HoverSwapImage({ front, back, alt })`，用于 Look 卡片、首页搭配流、Look 详情、单品详情「所属搭配」。

### 3.7 AI 试穿

- 必须登录 + 已上传本人照片（`User.photoKey`）；单品 1~4 件。
- 参数**不得自行调整**：MPS `tryon-1.0-lite` + `1K` + `identity` 参考图；原图不压缩不重编码。
- **异步**：`POST /api/tryon` 建记录并发任务 → 立即返回 `recordId`；`GET /api/tryon/[id]` 每次查一次状态；前端 2 秒轮询；刷新后继续。
- 分类映射：上装 `garment`、下装 `garment`（单独下装需 Prompt 分支）、鞋子 `shoes`、配饰 `accessories`（「佩戴」）。
- 结果图落 COS 私有桶；超 3 分钟标 `FAILED`（超时）；错误存友好文案不存 MPS 原文。
- 结果图带「AI 生成」标识；付费不限额（`TRYON_DAILY_LIMIT` 保留但默认不限）。
- 迁移细节与踩坑见 `memory-bank/tryon-migration-notes.md`。

### 3.8 UI

- 移动端优先（375px 起），桌面 ≥1280px 完整布局；触摸目标 ≥44×44px；hover 必须有触屏替代。
- 中文界面；金额 ¥ 两位小数；图片有 `alt`；键盘可达、焦点环可见。
- 品牌名全站 `OutfitHub`（第 12 步统一改）；页脚「OutfitHub · 个人穿搭衣橱」。
- 演示环境标识沿用现有 `DemoBadge`。

### 3.9 工程

- 默认 Server Component；只在需要交互时 `"use client"`。
- 输入校验用 zod（服务端为准，客户端辅助）。
- 每步结束跑 `npm run typecheck`；里程碑结束加跑 `npx eslint src`、`npm run build`。
- 不提交 `.env.local`、`node_modules`、`.next`、`src/generated/`、用户照片 / 试穿结果。

## 4. 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16 App Router（Turbopack） |
| 语言 | TypeScript strict |
| UI | Tailwind CSS 4 + shadcn/ui + lucide-react |
| 数据库 | Postgres 16（本地 Docker `outfitexpert-db`）+ Prisma 7 |
| 登录 | Auth.js v5（Credentials + JWT）+ bcryptjs |
| 校验 | zod |
| 存储 | 腾讯云 COS 私有桶 |
| 去背景 | 腾讯云 MPS（备选 `@imgly/background-removal-node`） |
| 试穿 | 腾讯云 MPS `tryon-1.0-lite` + 1K |
| 图片处理 | sharp |

## 5. 目录结构

```
src/
  app/
    page.tsx               # 首页（第 12 步改造）
    wardrobe/              # 衣橱（新增）
    looks/                 # 搭配（新增）
    new/                   # 新单据（新增）
    items/                 # 单品录入/编辑/详情（新增）
    tryon/                 # 试穿
    search/                # 全局搜索（新增）
    account/               # 个人中心（沿用）
    products/ cart/ orders/ assistant/   # 旧模块（保留，导航移除）
    api/
      wardrobe/            # 上传 / 去背景（新增）
      items/               # 单品 CRUD（新增）
      looks/               # 搭配 CRUD + 画布（新增）
      tags/ search/        # 标签与搜索（新增）
      tryon/               # 试穿（新增）
      account/ auth/ products/ ...
  components/
    ui/                    # shadcn
    wardrobe/ looks/ canvas/ tryon/   # 新增
    home/ product/ cart/ assistant/   # 沿用
  lib/
    db.ts auth.ts auth-guards.ts cos.ts
    cutout/                # MPS 去背景（新增）
    canvas/                # 自动排版 + 服务端渲染（新增）
    tryon/                 # 试穿（迁移）
    validations/
prisma/  schema.prisma  migrations/
memory-bank/
```

## 6. 环境变量（`.env.example`）

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | Postgres 连接串 |
| `AUTH_SECRET` / `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Auth.js 与站点地址 |
| `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` | 腾讯云密钥（仅服务端） |
| `TENCENT_COS_BUCKET` / `TENCENT_COS_REGION` | COS 桶与地域 |
| `TENCENT_MPS_REGION` | MPS 地域（默认 `ap-guangzhou`） |
| `TRYON_DAILY_LIMIT` | 试穿次数（默认不限） |
| `DIFY_API_BASE_URL` / `DIFY_API_KEY` / `ASSISTANT_TOOL_TOKEN` | 旧导购，保留不动 |

## 7. 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地开发 |
| `npm run typecheck` | 类型检查 |
| `npm run build` | 构建 |
| `npx eslint src` | 代码检查 |
| `npx prisma migrate dev` | 迁移 |
| `npx prisma generate` | 生成 Client |

> **注意**：本机 `localhost:5432` 可能因 IPv6 解析连不上数据库，可用
> `DATABASE_URL="$(grep -o 'postgresql://[^"]*' .env.local | sed 's/localhost/127.0.0.1/')" npx prisma migrate dev`
> 临时指定，不要改 `.env.local`。

## 7.1 Git 与部署（单分支 main）

**Vercel 的 Production 分支是 `main`。所有改动直接推 `main`，push 即自动部署。**

```bash
git checkout main          # 开发就在 main 上
git add -A && git commit -m "feat: xxx"
git push origin main       # Vercel 自动部署
```

| 分支 | 用途 |
| --- | --- |
| **`main`** | **唯一开发 + 生产分支**，所有提交推这里 |
| `outfithub-mvp` | 历史遗留，与 main 内容一致，**不再使用**，可删 |
| `m5-context-p0` | 旧网店版本存档，只读，不要动 |

**历史教训（2026-11-19）**：曾同时维护 `main` 和 `outfithub-mvp`，但 Vercel 只监听其中一个，导致「改了代码线上不更新」。单分支后不会再出现。若线上没自动部署新提交，去 **Vercel → Settings → Git → Production Branch** 确认是 `main`。

**其他部署注意**：

- `postinstall: prisma generate` 必须保留——`src/generated/prisma` 被 gitignore，Vercel 构建时需要现场生成。
- 不要配 `AUTH_URL` / `NEXT_PUBLIC_APP_URL`：代码用 `trustHost: true` 自动识别域名，且未读取这两个变量。Vercel Redeploy 会换域名，写死反而出错。
- COS 桶隔离：本地 `outfitexpert-temp-1521078213`，线上 `outfithub-prod-1521078213`。

## 8. 付费接口测试规则（重要）

试穿 `1.00 元/张`、去背景约 `0.01 元/张`，**不要重复付费测试**。

| 情况 | 做法 | 花费 |
| --- | --- | --- |
| 改了 `src/lib/tryon/**` / `api/tryon/**` | 跑 **1 次** 1 件验证链路 | 1 元 |
| 只改 UI、其他模块、数据库无关清理 | **不跑真实生成**，用已有历史记录验证展示 | 0 元 |
| 需要验证多件（3 件）效果 | **攒到最后一次性跑**，不要每步都测 | 1 元 |
| 改了去背景（`lib/cutout/**`） | 跑 1 张图验证 | 约 0.01 元 |

**判断依据**：代码没动的地方不重复测。第 12 步删表、删模块后试穿代码未改，第 13 步只需验证「能打开历史记录」即可，不必重新生成。

**花费记录**：截至 2026-11-18 累计 6 元（6 次试穿），其中约 2 元属重复测试。

## 9. 手机/局域网访问

服务默认监听 `0.0.0.0:3000`，同一 Wi-Fi 下手机可直接访问：

```
http://<电脑局域网IP>:3000
```

查 IP（Windows）：`ipconfig`，看无线网卡的「IPv4 地址」。

若手机打不开：
1. Windows 防火墙可能拦截 Node.js → 允许「专用网络」访问
2. 手机与电脑必须在**同一 Wi-Fi**
3. 手机流量/访客网络隔离时不通

> `.env.local` 的 `AUTH_URL` / `NEXT_PUBLIC_APP_URL` 仍是 `localhost:3000`，
> 用 IP 访问时登录跳转可能出现怪异行为；本地演示一般不影响页面浏览。

**必须配置 `allowedDevOrigins`**（`next.config.ts`）：否则 dev 资源被跨源拦截，
页面看着正常但按钮点不动（hydration 不生效）。已配置
`172.20.10.4`（当前电脑 IP）与 `192.168.*.*`、`10.*.*.*`。换网络后 IP 变了要补一条。

## 10. 当前阶段

**MVP 13 步已全部完成**（2026-11-18）：

| 步 | 内容 |
| --- | --- |
| 1 | 数据层 9 张表 + 枚举 |
| 2 | COS 通用方法 + 上传接口 |
| 3 | MPS 去背景（cutout-1.0-lite） |
| 4 | 单品 CRUD + 标签服务 |
| 5 | 录入/编辑/详情页 |
| 6 | 衣橱页（分类/标签/多选） |
| 7 | 搭配画布（自动排版 + 拖动缩放旋转 + 服务端渲染） |
| 8 | 搭配列表/详情 + 悬停双视角 |
| 9 | 页内搜索（三个页面关键词 + 标签） |
| 10 | 新单据区 + 最近试穿 |
| 11 | AI 试穿（异步轮询 + 每日 5 次） |
| 12 | 首页改造 + 清理旧网店/导购模块 + 删 11 张旧表 |
| 13 | 联调测试（52 项，见 `memory-bank/qa-20261118.md`） |

后续可做：Next.js 安全升级、搭配/单品的拖拽排序、批量操作、试穿结果分享。

