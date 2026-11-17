# OutfitHub MVP — 开工说明（新窗口直接读这个文件）

我在开发 **OutfitHub**（AI 电子衣橱），项目在 `C:\Users\罗敦宝\Projects\outfitexpert-shop`。这是一个已有项目，正在从「网店 Demo」转向「个人穿搭衣橱」。

## 开工前必读

1. `memory-bank/prd-outfithub-mvp.md` —— **唯一需求来源**，功能、页面、接口、数据模型以它为准
2. `memory-bank/tryon-migration-notes.md` —— 试穿功能从旧项目迁移的说明（旧项目在 `C:\Users\罗敦宝\Projects\outfitexpert`）
3. `memory-bank/prd-wardrobe-closet-mvp.md` —— **已作废**，仅作历史，不要参考

## 当前状态

- 技术栈：Next.js 16（Turbopack）+ React 19 + Prisma 7 + PostgreSQL + 腾讯云 COS/MPS
- 已可用：登录注册（next-auth）、图片上传到 COS（`src/lib/cos.ts`）、尺码合身引擎（`src/lib/size-engine/`）、UI 骨架（顶部导航 + 页脚 + Tailwind）
- 已有但本期不用的旧模块：网店（商品/购物车/订单）与 M5 导购助手（Dify）
- **先不要删旧模块**：用户要求保留现有代码，只做新增。新增功能与旧模块互不影响
- `.env.local` 已配置好数据库、Auth、腾讯云 COS/MPS 密钥，不要改动

## 第一步做什么

**开分支**（保留 `main` 作为旧版本）：

```bash
git checkout m5-context-p0   # 若当前不在 main，先回 main
git checkout main
git checkout -b outfithub-mvp
```

> **⚠️ 实际执行修正（2026-11-17）**：以上是原计划，但实测**不能从 `main` 开**。`main` 落后 `m5-context-p0` 186 个文件——尺码引擎、M5 导购、后 3 个数据库迁移文件都只在 `m5-context-p0` 上。从 `main` 开会导致迁移文件与数据库记录对不上，`prisma migrate dev` 要求**清空数据库**（丢 1384 条导购日志等数据）。
>
> 正确做法：
>
> ```bash
> git checkout m5-context-p0
> git checkout -b outfithub-mvp
> ```
>
> `main` 分支原样保留，作为旧版本。

已新建分支 `outfithub-mvp`（基于 `m5-context-p0`，commit `0a1c15d` 已完成第 1 步）。

然后按 `prd-outfithub-mvp.md` §6 的任务拆分，从第 1 步（数据层）开始做。

## 界面沿用（PRD §1.4）

M5 导购功能放弃，但**现有前端视觉风格与组件作为基础沿用**：

- `/products` 商品页是**衣橱页和搭配列表页的结构模板**（页头 + 左侧筛选栏 + 搜索排序行 + 4:5 卡片网格 + 空状态 + 骨架屏），换数据源与文案即可
- 首页保留现有版式骨架，内容从「商品」换成「搭配」
- 旧页面（`/products`、`/cart`、`/orders`、`/assistant`）不删，只从导航移除


## 任务拆分

| 步 | 任务 | 依赖 |
| --- | --- | --- |
| 1 | 数据层：Prisma 新增 9 张表 + 枚举 + migrate | — |
| 2 | COS 通用方法（put/delete/signed）+ 上传接口 | 1 |
| 3 | MPS 去背景（`src/lib/cutout/`）→ **先用脚本验证返回白底 PNG** | 2 |
| 4 | 单品 CRUD + 标签 CRUD | 1-3 |
| 5 | 单品录入 / 编辑 / 详情页 | 4 |
| 6 | 衣橱页（分类 + 标签筛选 + 多选） | 4 |
| 7 | Look CRUD + **画布**（组件 + 自动排版 + 保存 + 服务端渲染） | 4 |
| 8 | Look 列表 / 详情 / 编辑页 + `HoverSwapImage` | 7 |
| 9 | 标签检索 + 全局搜索 | 4,7 |
| 10 | New 区 + zone 切换 + 最近试穿 | 4 |
| 11 | 试穿迁移（见 `tryon-migration-notes.md`）+ 页面 | 1,2 |
| 12 | 首页改造 + 导航改名 OutfitHub | 8 |
| 13 | 联调测试 | 全部 |

每完成一步：`npm run typecheck` 通过后提交一次，commit 用中文，格式 `feat: 简短说明`。

## 与旧模块的共存规则

- 新增表、接口、页面用**新的命名空间**，不要改旧模块文件
- `Product`（旧商品）与 `WardrobeItem`（新单品）是两套数据，互不写入
- 全站导航在**第 12 步**才改；在那之前保持现有导航不动，新增页面通过直接访问路径验证
- 旧模块里的 `AssistantLog`、`Cart` 等关系不用动，`User` 上加新关系即可

## 关键约定

- **品牌名**：全站统一 `OutfitHub`（第 12 步统一改）
- **试穿**：异步（`POST /api/tryon` 立即返回 `recordId`，`GET /api/tryon/[id]` 轮询），1~4 件，参数 `tryon-1.0-lite` + 1K + identity，原图不压缩
- **画布**：单品坐标存归一化 0~1，前端 pointer 事件 + CSS transform 实时预览，保存时服务端 `sharp` 渲染 PNG 存 COS
- **悬停切换**：默认实穿照，悬停切白底拼合图，淡入 250ms；手机端加切换按钮
- **标签**：`Tag` 表按用户隔离，带 `useCount` 用于自动补全
- **数据隔离**：所有新 API 校验 `session.user.id === userId`，越权返回 404
- **图片**：全走 COS 私有桶 + 签名 URL（30 分钟），浏览器不暴露 Secret

## 不要参考的文件

`memory-bank/m5-*.md`、`memory-bank/CURRENT.yml`、`memory-bank/plan.md`、`memory-bank/prd.md` —— 都是旧网店/导购的历史，已被新 PRD 取代。

## 沟通方式

- 中文
- 每次改完说明改了什么、为什么
- 需要拍板的设计问题（画布交互细节、去背景接口选型）先问再改
- PRD 没写的先问，不要自行扩大范围

## 节奏

**只做第 1 步**，完成后汇报（新增了哪些表、migrate 是否成功、typecheck 是否通过），然后停下等用户确认再继续。

## 测试数据规则（2026-11-17 补充，曾误删用户数据）

**测试数据只在 demo 账号下创建，绝不用用户手机号账号。**

```bash
node scripts/dev-fixtures.mjs seed     # 造测试数据（demo 账号）
node scripts/dev-fixtures.mjs clean    # 只清 demo 账号
node scripts/dev-fixtures.mjs status   # 查看
```

- 测试账号：`demo@outfitexpert.demo` / `Demo123456`，userId `cmvy255si0001aotqvztah9bo`
- 用户账号：手机号 `12345678910`，userId `cmvz335it00007otqov7sfzod` —— 只读
- 手工 SQL 必须带 `where "userId" = ...`；COS 清理必须带 `wardrobe/{userId}/` 前缀
- 历史上的失误：`delete from wardrobe_items;` 未带条件、删除整个 `wardrobe/` 前缀，导致用户上传的单品与图片被删除
