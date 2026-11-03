# 实施计划 — outfitexpert-shop

> **依据**：`memory-bank/prd.md` v0.8
> **状态**：M5 评测集/契约冻结 v0、本地 Dify 连通、商品数据与商品工具已完成（2026-11-03）；下一步 Dify Chatflow baseline（待用户配置应用/API Key），M4 试穿后置
> **规则**：每个里程碑结束必须能运行、能演示、能提交；未通过验收不得进入下一阶段。

---

## 1. 总体策略

1. **先闭环，再加 AI**：M0~M3 打通「商品 → 登录 → 购物车 → 下单 → 订单」，再接入 AI。
2. **M5 优先**：目标岗位是 AI 产品经理，导购助手是主案例；先做 M5，M4 试穿后置为第二 AI 案例。
3. **复用旧项目已验证代码**：MPS 试穿（`src/lib/tryon/`）、合身引擎（`src/lib/size-engine/`）直接参考/改造，不重新踩坑。
4. **外部依赖后置**：Neon/Vercel（M6）放到后期，避免早期被网络/账号卡住。
5. **每阶段先写验收清单，再写代码**；验收以 PRD 对应章节为准。
6. **不做超出 PRD 的功能**；有歧义先问。

---

## 2. 阶段依赖与顺序

```
M0 项目初始化 + DB + 商品模型
 └─ M1 商品浏览/搜索/详情
     ├─ M2 登录 + 个人中心
     └─ M3 购物车 + 下单 + Mock 支付 + 订单
         ├─ M5 Dify 导购助手（优先；AI PM 主案例）
         └─ M4 AI 试穿（M5 后执行；依赖 M2 照片 + M3 购物车）
             └─ M6 后台 + 看板 + 部署
```

- **M5 先于 M4**：求职方向是 AI PM，导购助手是主案例；M4 试穿作为第二 AI 案例。
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
| 商品 | 13 | 含 `refType`（GARMENT / ACCESSORIES / SHOES）、3 图；上装/连衣裙/外套含胸围/衣长/版型，下装含腰围/臀围/裤长/版型；12 件在售 + 1 件 `SOLD` |
| 占位图 | 39 | `public/products/`，先用纯色/文字占位，后替换真图 |

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
- [x] 0.8 Seed：管理员 + 测试用户 + 6 分类 + 13 件占位商品（12 在售 + 1 已售）。
- [x] 0.9 商品 CSV 模板（含 `ref_type`、`waist_cm`、`hip_cm`、`pants_length_cm`）+ `prisma/import-products.ts` 导入脚本（按品类条件校验）。
- [x] 0.10 全局布局：Header/Footer + 演示标识；首页占位。
- [x] 0.11 Auth.js 最小配置（`src/lib/auth.ts` + 路由骨架），完整登录留到 M2。
- [x] 0.12 README：环境要求、启动、Docker、迁移、seed、演示账号、目录说明。
- [x] 0.13 跑 `npx tsc --noEmit`、`npx eslint src`、`npm run build`。
- [x] 0.14（2026-11-02 追加）下装尺寸：`Product` 增加 `waistCm` / `hipCm` / `pantsLengthCm`，迁移 `bottom_measurements`；seed/CSV 增加下装样例。

### 验收

- [x] `docker compose up -d` 后 Postgres 可连。
- [x] `npx prisma migrate dev` 成功；`npx prisma db seed` 成功。
- [x] 数据库能查到 13 件商品；上装/连衣裙/外套含胸围/衣长，下装含腰围/臀围/裤长，ACCESSORIES / SHOES 尺寸为空。
- [x] `npm run dev` 首页可打开，页脚有演示标识。
- [x] `npm run build` 通过。
- [x] `.env.local` 未被提交；`.env.example` 完整。

### 提交

`feat: M0 项目初始化与商品模型`

---

## 8. M1：商品浏览 / 搜索 / 筛选（1~2 周）

### 任务

- [x] 1.1 商品查询函数：`q`、分类、颜色、版型（仅 GARMENT）、价格区间、排序、默认 8 件 + 展开（无页码分页）、是否含已售。
- [x] 1.2 首页：`Wardrobe` 页头、Bodoni 标题、搜索右上、5 件主推大屏轮播（6 秒左滑 + 箭头）、默认 8 件 + 下箭头展开、分类入口。
- [x] 1.3 列表页：筛选侧栏（移动端抽屉）、排序、默认 8 件 + 下箭头展开（无页码分页）、URL query 同步、空结果。
- [x] 1.4 详情页：3 图轮播、描述、材质/护理、标签、库存状态；成衣尺寸表按品类展示：上装/连衣裙/外套胸围/衣长/肩宽/版型，下装腰围/臀围/裤长/版型。
- [x] 1.5 加入购物车（M1 先 localStorage）：重复加购提示、角标更新。
- [x] 1.6 售罄状态：按钮置灰、列表默认隐藏、可切换显示。
- [x] 1.7 响应式：375px / 768px / 1280px 检查。
  - 已用 headless Chrome 实测 375 / 768 / 1280，无横向滚动；移动端筛选抽屉可开关。
- [x] 1.8 验收 + 提交。
  - 已验证：搜索「针织」、组合筛选、价格排序、售罄切换、3 图切换、重复加购去重、刷新后购物车保留。
  - 2026-11-02 结构改版：主推轮播 6 秒左滑/箭头、首页与列表默认 8 件 + 下箭头展开 8 件。

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
- [x] 2.3 登录/登出 UI + 错误文案 + 简单限流；登录后回来源页，页头登录态显示「个人」。
- [x] 2.4 受保护路由：`/account`、`/checkout`、`/orders`、`/tryon`、`/account/tryons`、`/admin`；未登录跳 `/login?next=...`。
- [x] 2.5 个人中心：昵称、身材数据（选填）、照片上传/替换/删除；卡片两列同排等高对齐。
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
- [x] 登录后回来源页，页头显示「个人」。
- [x] 个人中心桌面两列卡片同排等高。
- [x] 隐私政策/用户协议可访问。

### 提交

`feat: M2 登录与个人中心`

---

## 10. M3：购物车 + 地址 + 下单 + Mock 支付 + 订单（1~2 周）

### 任务

- [x] 10.1 购物车：游客 localStorage + 登录 DB + 登录合并去重。
- [x] 10.2 购物车页：勾选、全选、合计、删除、售罄标灰、件数。
- [x] 10.3 地址 CRUD + 默认地址。
- [x] 10.4 结算页：地址选择、订单确认、包邮、演示支付二次确认。
- [x] 10.5 下单 API：zod 校验、事务、条件更新库存、幂等键、订单号。
- [x] 10.6 支付成功页 + 订单列表/详情 + 状态筛选。
- [x] 10.7 取消/退款（演示）+ 库存恢复。
- [x] 10.8 并发测试：两请求抢同一件，只成功 1 个。
- [x] 10.9 验收 + 提交。

### 验收

- 对应 PRD §7.6~§7.8 全部勾选。
- 重复点击支付只创建 1 单；售罄商品不可结算。
- 订单快照不受商品改价影响。

### 提交

`feat: M3 购物车下单与演示支付`

---

## 11. M4：AI 试穿（1 周，M5 后执行）

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

## 12. M5：Dify 导购助手（优先；1~2 周）

> **定位**：AI PM 面试主案例。目标不是“接一个聊天框”，而是展示意图路由、RAG/工具分工、评测、护栏和迭代闭环。
> **已确认（2026-11-03）**：本地 Dify；v1 只读工具；Router + 复杂分支 Agent；评测集由我起草、用户确认标签。

### 目标

- 用户能用自然语言完成：找商品、问搭配、问尺码、问政策、转人工。
- 关键链路可观测：意图、工具调用、商品 ID、引用、转人工、延迟、成本都能记录。
- 形成两版对比材料：Chatflow 路由 baseline vs 复杂分支 Agent。
- 面试能讲清楚：为什么这样分工、怎么评测、失败怎么迭代。

### 架构

```text
用户输入
  ↓
意图路由（Dify LLM 节点，JSON：intent + confidence + slots）
  ↓
置信度 / 槽位检查
  ├─ 不足 → 只追问一个关键问题
  └─ 足够 → 分流
        ├─ 商品搜索/推荐 → GET /api/assistant/products（Postgres）
        ├─ 尺码建议 → size-engine 工具（确定性）
        ├─ 政策/FAQ → Dify 知识库 RAG
        ├─ 订单物流 → v1 引导到订单页（v2 再接登录态工具）
        ├─ 转人工 → handoff 记录
        └─ 复杂搭配/多约束 → Agent 分支（工具白名单 + 最大 4 步）
  ↓
回答组装（自然语言 + 商品 ID + 引用 + handoff）
  ↓
/api/chat 流式代理：剥离 [[META]]、校验商品 ID、写日志
  ↓
前端：消息流 + 商品卡片 + 引用 + 反馈 + 转人工提示
```

### 关键决策

- 商品是结构化事实数据，走 Postgres 工具；知识库只放政策/FAQ/尺码指南，不把商品塞进向量库。
- 意图识别单独做，不交给 Agent 隐式完成；低置信度先澄清。
- v1 工具只读：不自动加购、下单、改订单；动作工具需要用户确认，放到 v2。
- 复杂请求才进 Agent；简单请求走确定性分支，控成本、延迟和可评测性。
- 输出统一契约：`[[PRODUCTS:id1,id2]]`、引用、`[[META]]` 追踪块；前端按 ID 从数据库取卡片，不信任 LLM 生成的价格/标题。
- 如果本地 Dify 版本没有 Agent 节点，就在 Next 服务端实现受限 Agent 循环，由 Chatflow 通过 HTTP 调用。

### 任务

- [x] 12.0 **评测集与契约冻结（第一步）**
  - 评审说明：`memory-bank/m5-eval.md`（42 条，含用户 10 条 gold cases）。
  - 机器可读评测集：`memory-bank/m5-eval.csv`（v0 已冻结）。
  - 契约：`memory-bank/m5-contract.md`（意图、槽位、商品工具、输出、校验、话术）。
  - 已确认：退换按商品（5 件不可退测试数据）、不承诺当天发货/加急走 handoff、商品上下文、相似款不考虑预算、肤色建议边界、模糊需求先问品类+可选预算、正品话术 B。
  - 风险记录：正品话术 B 与 PRD「禁止误导性正品保障」存在张力；实现时必须始终带演示限定语，PRD 待同步。
- [x] 12.1 本地 Dify 连通性检查
  - 本地 Dify `http://localhost`，版本 `1.16.0`；API `http://localhost/v1` 可达。
  - Dify 容器访问 `http://host.docker.internal:3000` 已通。
  - 本地 Dify SSRF 白名单已加 `host.docker.internal` 并重启 `ssrf_proxy`；代理测试 200。
  - 配置说明：`memory-bank/m5-dify-setup.md`。
  - Dify API Key 待用户在 Dify 应用创建后写入 `.env.local`。
- [x] 12.2 商品查询工具 `/api/assistant/products`
  - 商品数据补全清单：`memory-bank/m5-product-data.md`（已确认 2026-11-03；13 件；新增 `returnPolicy` / `styleTags` / `occasionTags`）。
  - 支持 `q` / `category` / `color` / `refType` / `styleTags` / `occasionTags` / `minPriceCents` / `maxPriceCents` / `limit` / `ids` / `similarTo`。
  - 只返回 `ON_SALE`；字段精简；商品 ID 为唯一下单依据。
  - 返回 `returnPolicy`（可退/不可退）与商品级退换说明；商品模型/商品页同步补该字段。
  - `ASSISTANT_TOOL_TOKEN` 校验 + 限流；Dify 配置说明。
  - 实测：无 token 401；带 token 200；`q` / `similarTo` / `ids` / `returnPolicy` 正常；Dify 容器可访问。
- [ ] 12.3 Dify Chatflow baseline
  - 搭建稿：`memory-bank/m5-dify-chatflow.md`（当前最小测试流 → 商品分支 baseline）。
  - 意图路由 JSON + 置信度/槽位检查 + 一次澄清。
  - 知识库检索节点（topK、阈值、引用输出）。
  - 商品 HTTP 工具、尺码工具、政策分支、转人工分支。
  - 退换按商品 `returnPolicy` 回答；无商品上下文先问是哪件；通用知识库只解释规则。
  - 回答组装节点：只允许引用工具结果中的商品 ID；输出 `[[PRODUCTS:...]]` + `[[META]]`。
- [ ] 12.4 `/api/chat` 服务端代理
  - 基础链路已完成（2026-11-03）：Dify streaming → NDJSON、剥离 `<think>`、限流与错误兜底。
  - `assistant_logs` 已接入（2026-11-03）：query/answer、商品 ID 有效/无效、延迟、首 token、token usage、错误；实测写入成功。
  - 代理 Dify `/v1/chat-messages`，`response_mode=streaming`。
  - 剥离 `[[META]]`，解析商品标记，校验/去重/丢弃无效 ID。
  - 记录 `assistant_logs`：输入、intent、工具、商品 ID、引用、延迟、token、成本、错误、handoff、prompt 版本。
  - 限流、超时、流式中断兜底；Dify Key 只在服务端。
- [ ] 12.5 前端聊天 UI
  - 基础链路已完成（2026-11-03）：流式消息、快捷问题、商品标记解析、商品卡片、引用展示、错误兜底；反馈与转人工待补。
  - 流式消息、快捷问题、商品卡片、引用来源、转人工提示、👍/👎/没解决反馈。
  - 商品卡片按 ID 从数据库渲染；无图/售罄状态兜底。
- [ ] 12.6 评测脚本与 baseline
  - 评测脚本已建立（2026-11-03）：`scripts/eval-assistant.mjs`，可读 `m5-eval.csv`、跑 `/api/chat`、输出商品命中/无效 ID/延迟；`--limit=2` 冒烟通过。
  - 商品上下文 Next 侧已完成（2026-11-03）：商品页「问导购」→ `/assistant?product=slug` → `/api/chat` 将 `product_context` 随 Dify 请求发送；评测脚本按 `context_product` 发送 `productSlug`。
  - 已知缺口：Dify Start 节点尚未声明 `product_context` 输入变量，当前回答仍忽略上下文；需在 Dify 加可选文本输入并在回答 Prompt 引用后，才能跑依赖“这件”的用例。
  - blocking 模式跑评测集，输出 CSV：意图准确率、任务成功率、商品相关性、无效 ID 率、引用准确率、澄清率、转人工率、P50/P95 延迟、token/成本、幻觉率。
  - 人工抽检 + 可选的 LLM-as-judge；保留 baseline 结果。
- [ ] 12.7 Agent 分支与对比
  - 只接复杂搭配/多约束/多意图；工具白名单、最大 4 步、20s 超时、失败回退。
  - 同一评测集对比 baseline vs Agent 的成功率、成本、延迟。
- [ ] 12.8 护栏、日志、人工兜底
  - 前置：限流、输入长度、越界拦截。
  - 中置：工具白名单、只读、超时、最大步数。
  - 后置：商品 ID allowlist、引用校验、禁用承诺、空结果兜底、一键关闭。
  - 日志脱敏；转人工生成 handoff 记录，明确演示环境不真实联系客服。
  - 加急/售后备注走 handoff 记录；v1 不直接写订单或仓库，写操作需二次确认并另立 v2。
- [ ] 12.9 案例材料
  - 失败分类表、Prompt/流程版本记录、指标前后对比、Dify 流程截图、README 案例、面试讲稿。
- [ ] 12.10 验收 + 提交。

### 评测指标

| 指标 | 定义 | 测量 |
| --- | --- | --- |
| 意图准确率 | 路由意图与标注一致 | META/日志对比 |
| 任务成功率 | 满足需求且无违规 | rubric 人工 + 抽检 |
| 商品相关性 | 推荐是否符合需求 | Precision@3 人工标注 |
| 无效商品 ID 率 | 无效 ID / 总 ID | 数据库自动校验 |
| 引用准确率 | 引用是否支持回答 | 人工/LLM judge 抽检 |
| 澄清率 | 模糊问题正确追问比例 | 自动 + 人工判断 |
| 转人工率 | handoff / 总请求 | 日志自动统计 |
| P50/P95 延迟 | 首 token / 总响应 | `/api/chat` 时间戳 |
| 单次成本 | token × 单价 + 工具成本 | Dify usage + 价格 |
| 幻觉率 | 无依据陈述 / 回答数 | 人工抽检 |

### 失败分类与迭代

- 分类：意图错、槽位漏/错、该澄清没澄清/过度澄清、工具选错、参数错、空结果硬编、商品 ID 编造、推荐不相关、引用不支持、合规违规、格式失败、超时/成本高、多轮丢上下文、该转人工没转。
- 每条失败记录：原话、期望、实际、分类、根因、修复动作、回归结果。
- 迭代顺序按“频率 × 严重程度”排序；一次只改一个变量（Prompt、few-shot、工具 schema、topK、阈值、模型）。
- 每次改动保留版本号并重跑同一评测集，维护回归集。

### 分工

- **我做**：契约与评测集草案、商品工具、`/api/chat`、日志/反馈、聊天 UI、Dify 配置文档、Prompt 模板、评测脚本、案例文档。
- **你做**：本地 Dify 应用/模型配置、知识库内容确认、评测标签最终确认、Dify API Key 写入本地环境、最终面试讲述与演示。
- 我无法代替你操作 Dify UI 或使用你的账号；需要你按步骤配置，我提供逐项说明。

### 验收

- 对应 PRD §7.10 全部勾选（实施前同步更新 PRD 的 M5 架构与验收）。
- 问「约会穿什么」返回 ≥2 张有效商品卡片；问政策带引用；模糊问题会澄清；越界/投诉可转人工。
- 评测集可一键跑出指标；baseline 与 Agent 有对比数据。
- 前端源码、网络响应、日志中无 Dify Key / 腾讯云 Secret。
- 无效商品 ID 被丢弃并计数；无结果不硬推。

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
| 商品样例 | 当前 13 件占位（12 在售 + 1 已售）；真实图/文案在 M6 演示前替换 | 已完成占位 |
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
| 商品数据未就绪 | 当前 13 件占位；M6 演示前替换真图与文案 |
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

- [x] 第 1 步：PRD v0.8（2026-11-02 个人中心与商品互动增强记录；v0.1 初版 2026-11-01）
- [x] 第 2 步：`CLAUDE.md` + `memory-bank/plan.md`
- [x] 用户确认 plan
- [x] M0 完成（2026-11-02）
- [x] 2026-11-02 追加下装尺寸：`waistCm` / `hipCm` / `pantsLengthCm`
- [x] M1 完成（2026-11-02）
- [x] 2026-11-02 图片与 MPS 标准沿用旧项目（PRD v0.4）
- [x] 2026-11-02 PRD §10.2 的 12 条默认方案已确认
- [x] M2 完成（2026-11-02）：登录/注册/个人中心/身材/照片上传/隐私页
- [x] M2 照片链路验收：COS 上传/签名 URL/替换删旧/删除/私有桶 403
- [x] 2026-11-02 前端结构改版：Wardrobe / 主推大屏 / 8+N 展开 / 登录回跳 / 个人中心对齐
- [x] M3 完成（2026-11-02）：购物车/地址/结算/演示支付/订单/退款
- [x] M3 验收：游客合并、地址 CRUD、无地址拦截、下单事务、幂等、刷新恢复、并发抢孤品、快照、退款恢复库存、越权 403、移动端无横向溢出
- [x] 2026-11-02 前端细节调整（PRD v0.7）：首页文案、商品详情右侧发货/地址/不退换、四个标签与左右滚动态、购物车已选小图
- [x] 2026-11-02 个人中心与商品互动增强（PRD v0.8）：头像/订单统计/收藏/足迹、收藏星标、足迹记录、尺码建议与身材快捷填写
- [x] 2026-11-03 M5 方案确定：本地 Dify / 只读工具 / Router + 复杂分支 Agent / 评测闭环
- [x] 2026-11-03 M5 评测集与契约冻结 v0：`m5-eval.md` / `m5-eval.csv`（42 条）/ `m5-contract.md`
- [x] 2026-11-03 商品数据补全清单：`m5-product-data.md`（已确认，13 件，P0 字段与建议 tags/退换）
- [x] 2026-11-03 M5 本地 Dify 连通性：Dify 1.16.0，容器可访问 Next
- [x] 2026-11-03 商品数据与商品查询工具 `/api/assistant/products` 完成并通过 token 测试
- [x] 2026-11-03 聊天基础链路：`/api/chat` 流式代理 + `/assistant` UI + think 过滤 + 商品标记解析
- [x] 2026-11-03 商品卡片实测通过：Dify 返回 `[[PRODUCTS:...]]`，前端解析并渲染卡片；桌面/375px 无横向溢出
- [x] 2026-11-03 知识库文档起草：`memory-bank/m5-knowledge/`（发货/退换/正品/支付/尺码/FAQ）
- [x] 2026-11-03 索引方案：先用经济/关键词索引（内存不足，暂不装 Ollama embedding）；混合检索待办
- [x] 2026-11-03 政策咨询 RAG 分支测试通过（经济/关键词索引）
- [x] 2026-11-03 `assistant_logs` 实测写入成功（商品 ID、有效/无效、延迟、token）
- [x] 2026-11-03 评测脚本 `scripts/eval-assistant.mjs` 冒烟通过；已支持按 `context_product` 发送 `productSlug`
- [x] 2026-11-03 商品上下文 Next 侧完成：商品页「问导购」→ `/assistant?product=slug` → `/api/chat` 发送 `product_context` + 评测脚本注入
- [ ] Dify Start 节点添加 `product_context` 输入变量并在回答 Prompt 引用（当前阻塞上下文验收）
- [ ] M5 全量 baseline（下一步）
- [ ] M5 意图分类与分支（避免所有问题都查商品）
- [ ] M5 assistant_logs / 评测脚本
- [ ] M5 实现
- [ ] M4 试穿（M5 后）
- [ ] GitHub 远程仓库（本地 Git 已初始化；远程连接暂缓）
