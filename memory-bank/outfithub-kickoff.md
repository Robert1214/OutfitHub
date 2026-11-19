# OutfitHub — 接手说明（新窗口先读这个文件）

项目目录：`C:\Users\罗敦宝\Projects\outfitexpert-shop`
产品：**OutfitHub — AI 电子衣橱**（单品录入 / 成套搭配画布 / AI 试穿）

## 一、当前状态（2026-11-20）

**MVP 13 步已全部完成并上线 Vercel。** 不要从头开始做，先了解现状。

| 项 | 状态 |
| --- | --- |
| 代码分支 | `main` 和 `outfithub-mvp` 都指向 `95c7db4`（已同步到 GitHub）|
| 线上 | Vercel 部署中，Production 分支 = **main** |
| 线上数据库 | Neon（新加坡区）|
| 图片存储 | 腾讯云 COS 两个桶隔离：本地 `outfitexpert-temp-1521078213`，线上 `outfithub-prod-1521078213` |
| 登录 | 邮箱验证码登录（默认）+ 邮箱密码 + 手机号演示码 `123456` |

**核心功能都做好了**：单品 CRUD、衣橱、画布、搭配、New 区、AI 试穿（异步）、邮箱验证码登录、去背景。

## 二、必读文件（优先级从高到低）

1. `CLAUDE.md` —— 开发规范 + 测试数据规则 + 付费接口规则 + 局域网访问
2. `memory-bank/prd-outfithub-mvp.md` —— 需求唯一来源（§1.4 界面沿用、§6 任务拆分）
3. `memory-bank/qa-20261118.md` —— 52 项联调测试结果
4. `memory-bank/test-data-incidents.md` —— 三次误删事故，**必读，别重犯**
5. `memory-bank/cutout-verification-20261117.md` —— 去背景模型选型（lite 不是 flash）

**已作废/不要参考**：`memory-bank/prd.md`、`plan.md`、`CURRENT.yml`、`m5-*.md`、`ai-pm-*.md`、`prd-wardrobe-closet-mvp.md`（都是旧网店/导购历史）。

## 三、技术栈

- Next.js 16（Turbopack）+ React 19 + TypeScript strict + Tailwind 4 + shadcn/ui
- Prisma 7 + PostgreSQL（本地 Docker `outfitexpert-db`；线上 Neon）
- Auth.js v5（Credentials + JWT）
- 腾讯云 COS（存储）+ MPS（去背景 `cutout-1.0-lite`、试穿 `tryon-1.0-lite`）
- 邮件：nodemailer + SMTP（QQ 邮箱发验证码）

## 四、环境变量

见 `.env.example`（已列全）。**特别注意**：

- `DATABASE_URL`：本地 `localhost:5432`，线上 Neon 连接串（`?sslmode=require`）
- `TENCENT_COS_BUCKET`：本地 `outfitexpert-temp-1521078213`，线上 `outfithub-prod-1521078213`
- SMTP 五个变量：发邮箱验证码用
- `TRYON_DAILY_LIMIT`：默认 5（每人每天试穿次数）

**密钥**：腾讯云 AK/SK、SMTP 授权码都只在环境变量，绝不进前端代码或仓库。

## 五、数据库

Prisma schema 在 `prisma/schema.prisma`，表：

```
users / wardrobe_items / wardrobe_item_images / tags / item_tags /
outfits / outfit_items / outfit_tags / tryon_records / tryon_record_items /
email_codes
```

**迁移注意**：本地 `localhost` 可能连不上（IPv6），用：
```bash
DATABASE_URL="$(grep -o 'postgresql://[^"]*' .env.local | sed 's/localhost/127.0.0.1/')" npx prisma migrate dev
```

线上 Neon 跑迁移用 `npx prisma migrate deploy`（指定 Neon 连接串）。

**Prisma Client 是生成代码**（`src/generated/prisma`，被 gitignore）。改了 schema 要 `npx prisma generate`，部署靠 `postinstall: prisma generate` 自动生成。

## 六、测试数据规则（红线，已违规 3 次）

见 `CLAUDE.md` §3.3.1，核心：

1. **测试只用 demo 账号**：`demo@outfitexpert.demo` / `Demo123456`（userId `cmvy255si0001aotqvztah9bo`）
2. **用户账号只读勿动**：手机号 `12345678910`、邮箱 `1184945159@qq.com`
3. 手工 SQL **必须带 `where "userId" = ...`**，COS 清理必须带 `wardrobe/{userId}/` 前缀
4. 有工具：`npm run dev:seed` / `dev:clean` / `dev:status` / `dev:whoami`

**测试前后各跑一次 `npm run dev:whoami`，确认用户账号数据没变。**

## 七、付费接口（别乱花钱）

- 试穿 `1.00 元/张`，去背景 `0.01 元/张`。
- 规则见 CLAUDE.md §8：改了 tryon 代码才跑 1 次真实生成（1 元），只改 UI 就**不跑**，用历史记录验证展示即可。
- 累计已花约 6 元。

## 八、常见坑（踩过，别重犯）

1. **Vercel 生产分支是 main**，不是 outfithub-mvp。push 要推到 main。
2. Vercel Redeploy 可能换域名，`AUTH_URL` 别写死（代码里 `trustHost: true` 已自动处理，不用配 AUTH_URL）。
3. `NEXT_PUBLIC_APP_URL` 代码没用到，别配。
4. 本地 dev server 启动会被 Next.js 安全提示卡一次，再跑一次 `npm run dev` 即可。
5. 局域网访问按钮点不动 → 是 `allowedDevOrigins`（next.config.ts 已配 localhost + IP + 网段）。
6. 去背景模型用 `cutout-1.0-lite`，**不是 flash**（flash 对红底红字会整件抠掉）。
7. 表单「添加单品」重新进入要清空 → 已用 `key={randomUUID()}` 解决，别去掉。

## 九、常用命令

```bash
npm run dev          # 本地开发
npm run build        # 构建（会 postinstall 先 prisma generate）
npm run typecheck    # tsc --noEmit
npx eslint src       # 代码检查
npx prisma migrate dev   # 本地迁移（注意 127.0.0.1）
npx prisma generate      # 生成 client
npm run dev:whoami   # 看所有账号数据量（测试前后用）
```

## 十、沟通方式

- 中文，每次改完说明「改了什么、为什么」
- 设计问题先问，不擅自扩大范围
- PRD 没写的先问
- **删除数据前先确认**（用 dev:whoami 核对，带 userId 条件）

## 十一、可能的后续工作（用户之前提过，未做）

- 首页「AI 时尚速递」板块（每天 9 点推 IG/YouTube/小红书资讯）—— 用户说「先不做了，先上线」，后续可能要做
- ~~Next.js 安全升级~~ **已完成 2026-11-20**：`16.4.3 → 16.4.6`，`next.config.ts` 加 `experimental.agentUpgrade = "security"`，不会再卡构建
- 短信验证码登录（现在只有邮箱验证码，短信要腾讯云签名审核）
- **腾讯云 COS 欠费**（2026-11-20 发现）：本地上传报 `account is arrears`，需充值后才能上传图片
