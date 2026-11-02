# 实施计划 — outfitexpert-shop

> **依据**：`memory-bank/prd.md` v0.4
> **状态**：M2 已完成（2026-11-02），下一步 M3
> **规则**：每个里程碑结束必须能运行、能演示、能提交；未通过验收不得进入下一阶段。

---

## 1. 总体策略

1. **先闭环，再加 AI**：M0~M3 打通「商品 → 登录 → 购物车 → 下单 → 订单」，M4~M5 再接试穿和导购。
2. **复用旧项目已验证代码**：MPS 试穿（`src/lib/tryon/`）、合身引擎（`src/lib/size-engine/`）直接参考/改造，不重新踩坑。
3. **外部依赖后置**：Dify（M5）、Neon/Vercel（M6）放到后期，避免早期被网络/账号卡住。
4. **每阶段先写验收清单，再写代码**；验收以 PRD 对应章节为准。
5. **不做超出 PRD 的功能**；有歧义先问。

---

## 2. 阶段依赖与顺序

```
M0 项目初始化 + DB + 商品模型
 └─ M1 商品浏览/搜索/详情
     ├─ M2 登录 + 个人中心
     └─ M3 购物车 + 下单 + Mock 支付 + 订单
         └─ M4 AI 试穿（依赖 M2 照片 + M3 购物车）
             └─ M5 Dify 导购（依赖 M1 商品查询）
                 └─ M6 后台 + 看板 + 部署
```

- M2 与 M3 可部分并行，但建议按顺序做，减少联调成本。
- M6 的后台可在 M3 后提前做商品管理，但整体放最后。
- 每个阶段结束打一个 Git tag（可选）：`m0`、`m1`……

---

## 3. 技术栈与依赖包（计划）

| 类别 | 包 | 用途 | 安装阶段 |
| --- | --- | --- | --- |
| 框架 | `next@16`、`react@19`、`react-dom@19` | App Router 全栈 | M0 |
| 语言 | `typescript`、`@types/node`、`@types/react`、`@types/react-dom` | 类型 | M0 |
| 样式 | `tailwindcss@4`、`@tailwindcss/postcss` | 样式 | M0 |
| UI | `shadcn`（CLI，按需生成组件） | 按钮/表单/弹层 | M0 |
| 数据库 | `prisma`、`@prisma/client` | ORM | M0 |
| 登录 | `next-auth@beta`（Auth.js v5）、`bcryptjs`、`@types/bcryptjs` | 登录 | M0 |
| 校验 | `zod` | 输入校验 | M0 |
| 腾讯云 | `cos-nodejs-sdk-v5`、`tencentcloud-sdk-nodejs` | COS/MPS | M2/M4 |
| 工具 | `tsx`（dev） | seed / 导入脚本 | M0 |
| 部署 | Vercel、Neon | 上线 | M6 |

> 具体版本在 M0 安装时锁定到当时的最新稳定版，写进 `package.json`；不在此处猜版本号。

**不引入**：图表库（看板用数字卡片）、状态管理库（优先 Server Component + URL 参数）、UI 框架（除 shadcn）、ORM 之外的数据库工具。

---

## 4. 目录结构（计划）

```
outfitexpert-shop/
├── CLAUDE.md
├── START_HERE.md
├── memory-bank/
│   ├── prd.md
│   └── plan.md
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── import-products.ts
├── data/
│   └── products-template.csv
├── public/
│   └── products/           # 商品图 {slug}-1.jpg ~ -3.jpg
├── src/
│   ├── app/
│   │   ├── (shop)/
│   │   │   ├── page.tsx                 # 首页
│   │   │   ├── products/
│   │   │   │   ├── page.tsx             # 列表
│   │   │   │   └── [slug]/page.tsx      # 详情
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/
│   │   │   │   ├── page.tsx
│   │   │   │   └── success/page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── tryon/page.tsx
│   │   │   ├── assistant/page.tsx
│   │   │   ├── account/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── tryons/page.tsx
│   │   │   │   └── orders/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── terms/page.tsx
│   │   ├── admin/
│   │   │   ├── page.tsx                 # 看板
│   │   │   ├── products/page.tsx
│   │   │   └── orders/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── products/route.ts        # 列表/按 ids 查
│   │   │   ├── assistant/products/route.ts
│   │   │   ├── chat/route.ts            # Dify 代理
│   │   │   ├── orders/route.ts
│   │   │   ├── tryon/route.ts
│   │   │   └── tryon/[id]/route.ts      # 轮询
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                          # shadcn
│   │   ├── layout/                      # Header/Footer/DemoBadge
│   │   ├── product/ cart/ checkout/ orders/ tryon/ assistant/ admin/
│   ├── lib/
│   │   ├── db.ts                        # PrismaClient 单例
│   │   ├── auth.ts                      # Auth.js 配置
│   │   ├── cos.ts                       # 上传/签名/删除
│   │   ├── tryon/                       # 复用旧项目
│   │   ├── size-engine/                 # 复用旧项目
│   │   ├── validations/                 # zod schema
│   │   └── utils.ts
│   └── types/
├── .env.example
├── .env.local                           # 不入库
├── docker-compose.yml
└── README.md
```

---

## 5. 环境变量

| 变量 | 必填 | 用途 | 获取方式 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | Postgres 连接串 | M0 Docker：`postgresql://postgres:postgres@localhost:5432/outfitexpert`；部署用 Neon |
| `AUTH_SECRET` | 是 | Auth.js 签名 | `npx auth secret` |
| `AUTH_URL` | 是 | 站点 URL | 本地 `http://localhost:3000`；部署填 Vercel 域名 |
| `NEXT_PUBLIC_APP_URL` | 是 | 前端绝对地址 | 同上 |
| `TENCENT_SECRET_ID` | M2 | 腾讯云密钥 | 旧项目 `.env.local` |
| `TENCENT_SECRET_KEY` | M2 | 腾讯云密钥 | 同上 |
| `TENCENT_COS_BUCKET` | M2 | COS 桶 | 同上 |
| `TENCENT_COS_REGION` | M2 | COS 地域 | 默认 `ap-guangzhou` |
| `TENCENT_MPS_REGION` | M4 | MPS 地域 | 默认 `ap-guangzhou` |
| `DIFY_API_BASE_URL` | M5 | Dify API | 默认 `https://api.dify.ai/v1` |
| `DIFY_API_KEY` | M5 | Dify 应用 Key | Dify 后台 |
| `TRYON_DAILY_LIMIT` | 否 | 每日试穿次数 | 默认 5 |

> `.env.local` 不入库；`.env.example` 只写变量名和示例占位。

---

## 6. 数据模型落地

### 6.1 Prisma 模型顺序

1. `User`（Auth.js 字段 + 资料 + 身材 + `photoKey`）
2. `Category`、`Product`（含 `refType`、上装/下装尺寸）、`ProductImage`
3. `Cart`、`CartItem`
4. `Address`、`Order`、`OrderItem`
5. `TryonRecord`、`TryonRecordItem`
6. `ChatSession`、`ChatMessage`（M5 再启用）

### 6.2 Seed 数据

| 数据 | 数量 | 说明 |
| --- | --- | --- |
| 管理员 | 1 | `admin@outfitexpert.demo` / `Admin123456` |
| 测试用户 | 1 | `demo@outfitexpert.demo` / `Demo123456` |
| 分类 | 6 | 上装 / 下装 / 连衣裙 / 外套 / 配饰 / 鞋履 |
| 商品 | 6~9 | 含 `refType`（GARMENT / ACCESSORIES / SHOES 各至少 1 件）、3 图；上装/连衣裙/外套含胸围/衣长/版型，下装含腰围/臀围/裤长/版型，ACCESSORIES/SHOES 尺寸可空；其中 1 件 `SOLD` 用于验收 |
| 占位图 | 18~27 | `public/products/`，先用纯色/文字占位，后替换真图 |

### 6.3 商品 CSV 导入模板

文件：`data/products-template.csv`

| 列 | 必填 | 说明 |
| --- | --- | --- |
| `slug` | 是 | 唯一，URL 用；小写英文/数字/- |
| `name` | 是 | 商品名 |
| `ref_type` | 是 | `GARMENT` / `ACCESSORIES` / `SHOES` |
| `description` | 是 | 描述 |
| `price_yuan` | 是 | 元，导入时转分 |
| `category` | 是 | 分类名，不存在则创建 |
| `color` | 是 | 颜色 |
| `size_label` | 否 | 如「均码」「M」 |
| `material` | 是 | 材质 |
| `care` | 是 | 护理 |
| `tags` | 否 | 逗号分隔 |
| `fit_type` | 否* | `SLIM` / `REGULAR` / `LOOSE`；`ref_type=GARMENT` 时必填 |
| `chest_cm` | 否* | 成衣胸围（平铺×2）；上装/连衣裙/外套必填 |
| `length_cm` | 否* | 衣长；上装/连衣裙/外套必填 |
| `shoulder_cm` | 否 | 肩宽（上装/连衣裙/外套可选） |
| `waist_cm` | 否* | 成衣腰围（平铺×2）；下装必填 |
| `hip_cm` | 否* | 成衣臀围（平铺×2）；下装必填 |
| `pants_length_cm` | 否* | 裤长/裙长；下装必填 |
| `image1` / `image2` / `image3` | 是 | `public/products/` 下的文件名 |

> *`ref_type=GARMENT` 时 `fit_type` 必填；分类为「下装」时 `waist_cm` / `hip_cm` / `pants_length_cm` 必填，其余 GARMENT 填 `chest_cm` / `length_cm`；`ACCESSORIES` / `SHOES` 尺寸留空即可。

导入脚本 `prisma/import-products.ts`：校验必填与按 `ref_type` / 分类条件必填、去重 slug、创建分类/商品/图片，`stock=1`、`status=ON_SALE`；失败逐行报告，不中断整批。

---

## 7. M0：项目初始化 + DB + 商品模型 + 导入模板（3~5 天）

### 任务

- [x] 0.1 初始化 Next.js 16 + TS + Tailwind + App Router + `src/`。
  - 已在临时子目录初始化后合并到根目录；旧 `START_HERE.md` 已删除。
- [x] 0.2 安装依赖：Prisma、Auth.js v5、bcryptjs、zod、腾讯云 SDK、tsx。
- [x] 0.3 `npx shadcn@latest init`，按需添加：button、card、input、label、select、dialog、sheet、tabs、table、badge、sonner。
  - base-nova 预设未提供 `form` 组件；M2 表单用 Base UI + zod 实现，不阻塞 M0。
- [x] 0.4 `docker-compose.yml`：Postgres 16，端口 5432，库 `outfitexpert`，命名卷持久化。
- [x] 0.5 `.env.example` + `.env.local`（腾讯云密钥从旧项目复制，**不提交**）。
- [x] 0.6 Prisma schema：M0 先建 `User`、`Category`、`Product`（含 `refType`、上装/下装尺寸）、`ProductImage`；其余表 M3/M4 前补。
  - Prisma 7 使用 `prisma7.config.ts` + `@prisma/adapter-pg`，Client 生成到 `src/generated/prisma/`（不入库）。
- [x] 0.7 `npx prisma migrate dev --name init`。
- [x] 0.8 Seed：管理员 + 测试用户 + 6 分类 + 6~9 商品（覆盖上装/下装/配饰/鞋履，含 1 件已售）。
- [x] 0.9 商品 CSV 模板（含 `ref_type`、`waist_cm`、`hip_cm`、`pants_length_cm`）+ `prisma/import-products.ts` 导入脚本（按品类条件校验）。
- [x] 0.10 全局布局：Header/Footer + 演示标识；首页占位。
- [x] 0.11 Auth.js 最小配置（`src/lib/auth.ts` + 路由骨架），完整登录留到 M2。
- [x] 0.12 README：环境要求、启动、Docker、迁移、seed、演示账号、目录说明。
- [x] 0.13 跑 `npx tsc --noEmit`、`npx eslint src`、`npm run build`。
- [x] 0.14（2026-11-02 追加）下装尺寸：`Product` 增加 `waistCm` / `hipCm` / `pantsLengthCm`，迁移 `bottom_measurements`；seed/CSV 增加下装样例。

### 验收

- [x] `docker compose up -d` 后 Postgres 可连。
- [x] `npx prisma migrate dev` 成功；`npx prisma db seed` 成功。
- [x] 数据库能查到 6~9 件商品；上装/连衣裙/外套含胸围/衣长，下装含腰围/臀围/裤长，ACCESSORIES / SHOES 尺寸为空。
- [x] `npm run dev` 首页可打开，页脚有演示标识。
- [x] `npm run build` 通过。
- [x] `.env.local` 未被提交；`.env.example` 完整。

### 提交

`feat: M0 项目初始化与商品模型`

---

## 8. M1：商品浏览 / 搜索 / 筛选（1~2 周）

### 任务

- [x] 1.1 商品查询函数：`q`、分类、颜色、版型（仅 GARMENT）、价格区间、排序、分页（12/页）、是否含已售。
- [x] 1.2 首页：品牌区、8 件推荐（`ON_SALE`）、分类入口、搜索框。
- [x] 1.3 列表页：筛选侧栏（移动端抽屉）、排序、分页、URL query 同步、空结果。
- [x] 1.4 详情页：3 图轮播、描述、材质/护理、标签、库存状态；成衣尺寸表按品类展示：上装/连衣裙/外套胸围/衣长/肩宽/版型，下装腰围/臀围/裤长/版型。
- [x] 1.5 加入购物车（M1 先 localStorage）：重复加购提示、角标更新。
- [x] 1.6 售罄状态：按钮置灰、列表默认隐藏、可切换显示。
- [x] 1.7 响应式：375px / 768px / 1280px 检查。
  - 已用 headless Chrome 实测 375 / 768 / 1280，无横向滚动；移动端筛选抽屉可开关。
- [x] 1.8 验收 + 提交。
  - 已验证：搜索「针织」、组合筛选、价格排序、售罄切换、3 图切换、重复加购去重、刷新后购物车保留。

### 验收

- 对应 PRD §7.1~§7.3 全部勾选。
- 搜索「针织」能命中名称/描述/标签；组合筛选正确。
- 刷新 URL 后筛选条件保持。

### 提交

`feat: M1 商品列表详情与搜索筛选`

---

## 9. M2：登录 + 个人中心 + 身材 + 照片（1 周）

### 任务

- [x] 2.1 Auth.js v5：Credentials Provider（邮箱+密码 / 手机号+演示码），JWT 7 天。
- [x] 2.2 注册：邮箱唯一、密码 ≥8、bcrypt；手机号自动建号。
- [x] 2.3 登录/登出 UI + 错误文案 + 简单限流。
- [x] 2.4 受保护路由：`/account`、`/checkout`、`/orders`、`/tryon`、`/account/tryons`、`/admin`；未登录跳 `/login?next=...`。
- [x] 2.5 个人中心：昵称、身材数据（选填）、照片上传/替换/删除。
- [x] 2.6 COS 封装：`putObject`、`getSignedUrl`、`deleteObject`；上传校验（类型/大小/解码）。
  - 2026-11-02 充值后复测：上传、签名 URL 预览、替换删旧对象、删除清空、私有桶未签名 403 全部通过。
- [x] 2.7 隐私政策 / 用户协议页面；注册页链接。
- [x] 2.8 Seed 管理员角色 + 后台路由守卫（M6 完整后台）。
- [x] 2.9 验收 + 提交。

### 验收

- [x] 邮箱注册/登录、手机号 `123456` 登录、退出登录。
- [x] JWT 7 天；Cookie HttpOnly + SameSite=Lax（本地 HTTP 下 Secure=false，HTTPS 由 Auth.js 自动开启）。
- [x] 未登录访问受保护页跳 `/login?next=...`；普通用户进 `/admin` 跳转。
- [x] 个人资料/身材保存后写入数据库。
- [x] 上传类型/大小/尺寸校验；COS 异常时显示友好错误。
- [x] 照片上传成功、签名 URL 预览、替换/删除同步 COS —— 2026-11-02 复测通过。
- [x] 未签名 URL 访问返回 403（私有桶）。
- [x] 隐私政策/用户协议可访问。

### 提交

`feat: M2 登录与个人中心`

---

## 10. M3：购物车 + 地址 + 下单 + Mock 支付 + 订单（1~2 周）

### 任务

- [ ] 10.1 购物车：游客 localStorage + 登录 DB + 登录合并去重。
- [ ] 10.2 购物车页：勾选、全选、合计、删除、售罄标灰、件数。
- [ ] 10.3 地址 CRUD + 默认地址。
- [ ] 10.4 结算页：地址选择、订单确认、包邮、演示支付二次确认。
- [ ] 10.5 下单 API：zod 校验、事务、条件更新库存、幂等键、订单号。
- [ ] 10.6 支付成功页 + 订单列表/详情 + 状态筛选。
- [ ] 10.7 取消/退款（演示）+ 库存恢复。
- [ ] 10.8 并发测试：两请求抢同一件，只成功 1 个。
- [ ] 10.9 验收 + 提交。

### 验收

- 对应 PRD §7.6~§7.8 全部勾选。
- 重复点击支付只创建 1 单；售罄商品不可结算。
- 订单快照不受商品改价影响。

### 提交

`feat: M3 购物车下单与演示支付`

---

## 11. M4：AI 试穿（1 周）

### 任务

- [ ] 11.0 图片与 MPS 标准严格沿用旧项目（PRD §6.8）：
  - 人像 1 张、单品 1~4 张；JPG/PNG/WebP；单张 ≤8MB；≥200×200；不要求固定比例；人像全身/半身/大头均可。
  - 原图上传，不压缩、不重编码；900px / quality 0.85 只用于预览/localStorage，不得作为 MPS 输入。
  - `tryon-1.0-lite` + 1K + `identity`；类型 `garment` / `accessories` / `shoes`；配饰 Prompt 用「佩戴」；配饰图不带模特脸/手。
  - Prompt 保留五官/脸型/肤色/发型；不得自行改模型、分辨率或 Prompt 结构。
- [ ] 11.1 复用旧项目 `src/lib/tryon/`：`config`、`cos`、`errors`、`image`、`mps`、`run`，按新项目改造。
- [ ] 11.2 `POST /api/tryon`：登录、照片、1~4 件、`ON_SALE` 校验；校验格式/≤8MB/≥200×200；创建 `PENDING` 记录，写入 `tryon_record_items` 时快照 `refType`、`fitBasis` 与商品尺寸；商品图/人像**原图**上传 COS 临时目录；发起 MPS。
- [ ] 11.3 `GET /api/tryon/[id]`：轮询 MPS；成功后下载结果 → COS 私有桶 → 更新记录 `SUCCEEDED`。
- [ ] 11.4 `/tryon` 页面：选中商品、照片预览、进度（准备素材/生成中/保存结果）、结果页；上传提示写明 JPG/PNG/WebP、≤8MB、全身/半身/大头均可。
- [ ] 11.5 合身判断：复用 `size-engine` 的 `canJudgeFit` / `judgeFit` / `lengthPositionHint` 纯函数，按 `fitBasis` 分支：
  - `UPPER`（上装/连衣裙/外套）：用户身高 + 胸围、商品成衣胸围 + 版型齐全时生效；衣长存在时附长度提示。
  - `LOWER`（下装）：用户腰围 + 臀围、商品成衣腰围 + 臀围 + 版型齐全时生效；腰围/臀围分别算放量，任一低于区间 → 偏紧，任一高于区间 → 偏松，否则合身；裤长/裙长仅展示，不判断。
  - `NONE`（ACCESSORIES/SHOES）不判断；对应最低数据缺失标注「无尺码数据，请以实物为准」。
  - 覆盖上装/下装的有数据、缺数据、全空用例；不输出 S/M/L。
  - 下装放量建议值：腰围 紧身 0~2 / 合身 2~4 / 宽松 4~8cm；臀围 紧身 2~4 / 合身 4~8 / 宽松 8~12cm，M4 联调可调。
  - 旧引擎字段映射：
    - `fitType`：`SLIM` / `REGULAR` / `LOOSE` ↔ 「紧身」 / 「合身」 / 「宽松」，集中映射，DB 不存中文；新项目 GARMENT 必填 `fitType`，不使用旧引擎「缺省合身」。
    - `refType`：`GARMENT` / `ACCESSORIES` / `SHOES` → MPS ImageSet `garment` / `accessories` / `shoes`（旧项目 `GARMENT_REF_TYPES` 为小写）。
    - `fitBasis`：由分类派生——上装/连衣裙/外套 → `UPPER`，下装 → `LOWER`，ACCESSORIES/SHOES → `NONE`；写入试穿项快照。
- [ ] 11.6 我的试穿：列表、详情、删除（同步删 COS）。
- [ ] 11.7 每日额度 `TRYON_DAILY_LIMIT`；超限提示。
- [ ] 11.8 真实 API 测试：1 件、3 件各 1 次；记录耗时/费用。
- [ ] 11.9 验收 + 提交。

### 验收

- 对应 PRD §7.9 全部勾选。
- 试穿输入为原图，未走 900px 压缩；MPS 参数与旧项目一致（`tryon-1.0-lite` / 1K / identity）。
- 图片校验：JPG/PNG/WebP、≤8MB、≥200×200；人像全身/半身/大头均可；配饰图不带脸/手。
- UPPER 身高/胸围 + 成衣胸围/版型齐全才出判断；LOWER 腰围/臀围 + 成衣腰围/臀围/版型齐全才出判断；NONE 不出判断；缺最低数据有「无尺码数据」标注。
- 上装长度提示仅在合身判断成立且用户身高 + 商品衣长齐全时出现；下装展示裤长/裙长，但不输出长度结论。
- 结果图带「AI 生成」；失败文案不暴露 MPS 原始错误。
- 浏览器源码/网络响应无腾讯云 Secret。
- 删除记录后 COS 对象不存在。

### 提交

`feat: M4 购物车 AI 试穿`

---

## 12. M5：Dify 导购助手（1~2 周）

### 任务

- [ ] 12.1 Dify 搭建（用户不会，需一步步指导）：
  - 注册/登录 Dify（Cloud 或本地 Docker）。
  - 创建知识库：政策/FAQ/尺码指南。
  - 创建 Chatflow：问题分类 → 推荐/政策/商品咨询/售后/其他 五分支。
  - 配置 HTTP 工具：`GET /api/assistant/products`。
  - 发布应用，拿 API Key。
  - 本地联调：Dify 云端访问不到 localhost → Docker Dify 或 cloudflared/ngrok。
- [ ] 12.2 `/api/assistant/products`：按分类/颜色/预算/关键词查询，返回精简商品 JSON。
- [ ] 12.3 `/api/chat`：服务端代理 Dify `/v1/chat-messages`，流式透传，Key 只在服务端。
- [ ] 12.4 前端聊天 UI：消息流、输入、快捷问题、商品卡片、引用来源、转人工。
- [ ] 12.5 解析 `[[PRODUCTS:id,id]]`：从正文移除标记，查库渲染卡片，无效 ID 忽略。
- [ ] 12.6 异常：未配置/超时/限流/流式中断。
- [ ] 12.7 验收 + 提交。

### 验收

- 对应 PRD §7.10 全部勾选。
- 问「约会穿什么」返回 ≥2 张卡片；问政策带引用；转人工有提示。
- 前端源码无 Dify Key。

### 提交

`feat: M5 Dify 导购助手`

---

## 13. M6：后台 + 看板 + 打磨 + 部署（1~2 周）

### 任务

- [ ] 13.1 后台布局 + `role=ADMIN` 守卫。
- [ ] 13.2 商品管理：列表/搜索/状态筛选、新建/编辑、上下架、软删除；表单含 `refType`，按分类条件必填：上装/连衣裙/外套版型/胸围/衣长，下装版型/腰围/臀围/裤长，ACCESSORIES/SHOES 尺寸可空；图片路径 + 预览。
- [ ] 13.3 订单管理：列表/详情、发货（假单号）、完成、退款（恢复库存）、备注。
- [ ] 13.4 看板：商品总数/在售/已售、订单数、演示成交额、最近 5 单、试穿次数。
- [ ] 13.5 全站打磨：loading/empty/error、移动端、键盘可达、图片 alt。
- [ ] 13.6 部署：Vercel + Neon；环境变量；`prisma migrate deploy`；商品图随仓库；Dify 公网地址。
- [ ] 13.7 README + 截图/演示说明。
- [ ] 13.8 全站验收 + 提交。

### 验收

- 对应 PRD §7.11 + §8 全部勾选。
- 部署后可完成一次「逛 → 登录 → 下单 → 支付 → 试穿 → 导购」全流程。

### 提交

`feat: M6 后台看板与部署`

---

## 14. 每阶段 Definition of Done

每个里程碑结束必须全部满足：

- [ ] `npx tsc --noEmit` 无错误。
- [ ] `npx eslint src` 无 error。
- [ ] `npm run build` 成功。
- [ ] PRD 对应章节验收清单全部勾选。
- [ ] 演示路径可走通（本地）。
- [ ] 无密钥进入前端/仓库。
- [ ] PRD 变更记录已更新（如有改动）。
- [ ] Git 提交，信息中文 `feat/fix/docs: 描述`。

---

## 15. 需要用户提供 / 确认

| 事项 | 内容 | 截止 |
| --- | --- | --- |
| 商品样例 | 6~9 件：品类（GARMENT/ACCESSORIES/SHOES）/名称/描述/价格/分类/颜色/材质/3 图；上装填胸围/衣长/版型，下装填腰围/臀围/裤长/版型，其余尺寸可空 | M0 seed 前 |
| 商品全量 | 30~50 件（含真实图与文案） | M6 演示前 |
| 品牌资料 | 店名、Logo、主色、风格参考 | M1 前 |
| 规则文案 | 运费、退换货、隐私政策、用户协议 | M2/M3 前 |
| 腾讯云密钥 | 旧项目 `.env.local` 已有，确认可复用 | M2 前 |
| Dify | 账号 + API Key + 知识库资料 | M5 前 |
| Neon / Vercel | 账号 | M6 前 |
| 测试素材 | 本人照片（JPG/PNG/WebP、≤8MB、≥200×200，全身/半身/大头均可）+ 身材数据 | M4 前 |
| PRD §10.2 | 12 条默认方案已确认（2026-11-02） | 已完成 |

---

## 16. 风险与应对

| 风险 | 应对 |
| --- | --- |
| 商品数据未就绪 | 先用 6~9 件占位；M6 演示前替换真图与文案 |
| MPS 成本 | 每日额度 + 测试只跑 1/3 件 |
| Dify localhost 不可达 | Docker Dify 或 cloudflared/ngrok |
| Neon 国内不稳 | 本地 Docker 开发；部署前实测，必要时换 Supabase |
| 孤品并发 | 事务 + 条件更新；M3 做并发测试 |
| Vercel 不能写 `public/` | 商品图随仓库；后台只填路径 |
| Auth.js v5 变动 | 锁版本；先跑通最小登录 |
| 腾讯云账号欠费 | COS/MPS 不可用 | 保持余额；2026-11-02 充值后 M2 照片链路已复测通过 |
| 工期超预期 | 保 M0~M4，M5/M6 可后补 |

---

## 17. 当前进度

- [x] 第 1 步：PRD v0.4（2026-11-02 修订；v0.1 初版 2026-11-01）
- [x] 第 2 步：`CLAUDE.md` + `memory-bank/plan.md`
- [x] 用户确认 plan
- [x] M0 完成（2026-11-02）
- [x] 2026-11-02 追加下装尺寸：`waistCm` / `hipCm` / `pantsLengthCm`
- [x] M1 完成（2026-11-02）
- [x] 2026-11-02 图片与 MPS 标准沿用旧项目（PRD v0.4）
- [x] 2026-11-02 PRD §10.2 的 12 条默认方案已确认
- [x] M2 完成（2026-11-02）：登录/注册/个人中心/身材/照片上传/隐私页
- [x] M2 照片链路验收：COS 上传/签名 URL/替换删旧/删除/私有桶 403
- [ ] M3 开始
- [ ] GitHub 远程仓库（本地 Git 已初始化；远程连接暂缓）
