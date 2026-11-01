# OUTFIT EXPERT — 线上店铺 Demo

服装店线上店铺 Demo（作品集用）：商品浏览、登录、购物车、Mock 支付、AI 试穿、Dify 导购与简单后台。只做到「收钱前一步」，不接真实支付、短信、物流。

> 演示环境 · 仅用于作品集展示，不产生真实交易。

## 当前进度

- [x] M0：项目初始化 + Postgres + 商品模型 + 种子数据 + CSV 导入模板
- [x] M1：首页推荐 / 分类 / 搜索 / 筛选排序 / 商品详情 / 本地加购
- [ ] M2 登录 + 个人中心
- [ ] M3 购物车 + 下单 + 演示支付
- [ ] M4 AI 试穿
- [ ] M5 Dify 导购
- [ ] M6 后台 + 部署

## 技术栈

- Next.js 16 App Router + TypeScript strict
- Tailwind CSS 4 + shadcn/ui（base-nova 预设）
- Postgres 16（本地 Docker）+ Prisma 7
- Auth.js v5 Credentials + JWT（M2 接入完整登录）
- zod 校验
- 腾讯云 COS / MPS（M2/M4 接入）
- Dify Chatflow（M5 接入）

## 环境要求

- Node.js **24+**（Prisma 7 要求 `^20.19 || ^22.12 || >=24.0`）
- npm 11+
- Docker Desktop（本地 Postgres）

## 本地启动

```bash
npm install

# 1. 环境变量
cp .env.example .env.local
# 填写 DATABASE_URL、AUTH_SECRET、腾讯云密钥（腾讯云密钥可从旧项目 .env.local 复制，不要提交）

# 2. 启动 Postgres 16
docker compose up -d --wait

# 3. 建表 + 种子数据
npm run db:migrate   # 创建/应用迁移，并自动执行 seed
npm run db:seed      # 也可单独重新 seed

# 4. 开发
npm run dev
```

打开 http://localhost:3000 。

> 若 3000 端口被其他项目占用，Next 会自动改用 3001；此时请同步修改 `.env.local` 的 `AUTH_URL` / `NEXT_PUBLIC_APP_URL`，或先停止占用 3000 的进程。

### 生成 AUTH_SECRET

```bash
npx auth secret
# 或
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 腾讯云密钥

旧项目 `C:\Users\罗敦宝\Projects\outfitexpert\.env.local` 已包含：

- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`
- `TENCENT_COS_BUCKET`
- `TENCENT_COS_REGION`
- `TENCENT_MPS_REGION`

复制到本项目 `.env.local` 即可。**不要提交 `.env.local`**。

## 演示账号

| 角色 | 邮箱 | 密码 | 说明 |
| --- | --- | --- | --- |
| 管理员 | `admin@outfitexpert.demo` | `Admin123456` | 仅演示；M6 后台使用 |
| 测试用户 | `demo@outfitexpert.demo` | `Demo123456` | 仅演示 |

手机号登录（M2 接入）验证码固定为 `123456`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | 重新写入种子数据 |
| `npm run db:import` | 导入 `data/products-template.csv` |
| `npm run db:import -- path/to.csv` | 导入指定 CSV |
| `npm run images:placeholders` | 重新生成 27 张商品占位图 |
| `docker compose up -d` | 启动 Postgres |
| `docker compose down` | 停止 Postgres（数据保留在卷中） |

## 商品数据

### 种子数据

- 6 个分类：上装 / 下装 / 连衣裙 / 外套 / 配饰 / 鞋履
- 9 件商品，覆盖上装 / 下装 / 连衣裙 / 外套 / 配饰 / 鞋履
- 每件 3 张占位图，共 27 张，位于 `public/products/`
- 其中 1 件 `SOLD`，用于验收「已售罄」状态

商品图是自动生成的纯色占位图，后续替换为真实商品图即可，路径规则：

```
public/products/{slug}-1.jpg
public/products/{slug}-2.jpg
public/products/{slug}-3.jpg
```

### 图片规格（沿用旧项目）

- 格式：JPG / PNG / WebP；单张 ≤8MB；最小 200×200；**不要求固定宽高比**（4:5 / 800×1000 不是要求）。
- 商品图要干净；配饰图不要带模特脸/手。
- 主图参与 AI 试穿；试穿链路必须原图上传，不压缩、不重编码。
- 900px / quality 0.85 只用于浏览器预览/localStorage，不得作为 MPS 输入。
- 人像照片：1 张，全身 / 半身 / 大头均可；格式和大小同上。
- MPS：`tryon-1.0-lite` + 1K + `identity` 参考图；详细标准见 PRD §6.8。

### CSV 导入

模板：`data/products-template.csv`

必填列：

- `slug`、`name`、`ref_type`、`description`、`price_yuan`、`category`、`color`、`material`、`care`、`image1`、`image2`、`image3`
- `ref_type=GARMENT` 时，`fit_type` 必填
- 上装 / 连衣裙 / 外套：`chest_cm`、`length_cm` 必填；`shoulder_cm` 可选
- 下装：`waist_cm`、`hip_cm`、`pants_length_cm` 必填
- `ACCESSORIES` / `SHOES` 的尺寸字段可全部留空

导入脚本会逐行校验并报告错误，单行失败不会中断整批；商品 `stock=1`、`status=ON_SALE`。

## 目录结构

```
src/
  app/
    (shop) 页面（M1 起逐步补齐）
    api/auth/[...nextauth]/   # Auth.js 路由骨架
    layout.tsx
  components/
    layout/                   # Header / Footer / DemoBadge
    ui/                       # shadcn 组件
  lib/
    auth.ts                   # Auth.js 骨架
    db.ts                     # PrismaClient 单例（Prisma 7 + pg adapter）
    utils.ts
  types/
prisma/
  schema.prisma
  seed-data.ts
  seed.ts
  import-products.ts
data/
  products-template.csv
public/products/              # 商品图（{slug}-1.jpg ~ -3.jpg）
docker-compose.yml
```

## 环境变量

见 `.env.example`。关键变量：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | Postgres 连接串 |
| `AUTH_SECRET` | Auth.js 签名 |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | 站点地址 |
| `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` | 腾讯云密钥（仅服务端） |
| `TENCENT_COS_BUCKET` / `TENCENT_COS_REGION` | COS |
| `TENCENT_MPS_REGION` | MPS |
| `DIFY_API_BASE_URL` / `DIFY_API_KEY` | Dify（M5） |
| `TRYON_DAILY_LIMIT` | 每日试穿次数（默认 5） |

## 演示边界

- 支付为 Mock：不接支付网关，不产生真实扣款。
- 短信验证码固定 `123456`；邮箱注册不做真实验证。
- 物流单号、退款均为演示数据。
- AI 试穿结果图会带「AI 生成」标识。
- 全站页脚显示演示环境提示。

## 备注

- Prisma 7 使用 `prisma7.config.ts` 读取 `.env.local`，生成的 Client 在 `src/generated/prisma/`（不入库）。
- Dify 云端无法访问 `localhost`；M5 联调时使用本地 Docker Dify 或 cloudflared/ngrok（见 PRD §5.3）。
- 商品详情、搜索、登录、购物车、试穿、导购、后台按 `memory-bank/plan.md` 的 M1~M6 逐步实现。
