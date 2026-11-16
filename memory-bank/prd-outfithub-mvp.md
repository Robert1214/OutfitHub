# OutfitHub：AI 电子衣橱 PRD — MVP v1

| 项 | 内容 |
| --- | --- |
| 文档版本 | v1.0 |
| 日期 | 2026-11-17 |
| 项目路径 | `C:\Users\罗敦宝\Projects\outfitexpert-shop` |
| 前身 | 由网店 Demo 转向个人穿搭衣橱；复用其登录、COS 存储、尺码引擎与试穿代码 |
| 配套 | `tryon-migration-notes.md`（试穿迁移说明） |
| 执行方式 | 新开窗口开发；本文件是该窗口的唯一需求来源 |

---

## 1. 产品概述

面向个人衣橱管理的穿搭记录工具，覆盖单品录入、成套搭配、新单据试穿与归位全流程。以「单品—搭配—新单据」三区结构组织数据：**Wardrobe** 管理已有单品，**Look** 记录成套穿搭，**New** 承接待定单品与试穿记录，购入后回流至前两区。基于 Next.js + PostgreSQL 构建，AI 能力接入腾讯云 MPS。

### 1.1 名称与定位

- 产品名：**OutfitHub**（页面品牌名、导航标题、页脚统一使用）
- 副标题：你的私人穿搭衣橱

### 1.2 目标

| # | 目标 | 衡量 |
| --- | --- | --- |
| G1 | 单品快速入库 | 拍照上传后 ≤ 3 步完成保存（含 AI 抠图） |
| G2 | 搭配可自由排版 | 从勾选单品到生成满意排版 ≤ 60 秒 |
| G3 | 搭配与单品双向可查 | Look 详情 1 次点击看到全部单品；单品详情可反查所属 Look |
| G4 | 检索不翻箱 | 关键词/标签检索 ≤ 1 秒返回单品与搭配 |
| G5 | 买前可试 | AI 试穿成功生成，历史可回看 |

### 1.3 本次范围

**做**：登录、三区数据结构、单品录入（多图 + AI 去背景/直传白底）、**打通式搭配画布**、标签体系与检索、悬停双视角、New 区与归位、AI 试穿及历史、全局搜索。

**不做**：消费统计、购物车下单、订单、导购助手（代码保留，导航移除）、社交分享、多用户协作。

### 1.4 界面沿用原则（2026-11-17 用户确认）

**M5 导购功能放弃，但现有前端的视觉风格与组件作为基础沿用，不重新设计。**

| 项 | 处理 |
| --- | --- |
| 顶栏 / 页脚 | 样式沿用（`h-14 sm:h-16`、sticky、白底 90% 模糊）；仅改品牌名与导航项，见 3.11 |
| `/products` 页面 | **作为衣橱页与搭配列表页的结构模板**：页头（小字母 + 大标题 + 说明）、左侧 240px 筛选栏、搜索+排序行、共 N 件、4:5 卡片网格（手机 2 / 平板 3 / 桌面 4）、空状态、加载骨架屏，均照搬结构，仅换数据源与文案 |
| 首页 | 保留现有版式骨架（Bodoni 大标题 + Hero 大图 + 分区区块 + 搜索框），内容从「商品」换为「搭配」：Hero 轮播 = 最新搭配，分类区块 = Look 场景标签，商品网格 = 搭配流 |
| 组件复用 | `HeroCarousel` → Look 大图轮播；`ExpandableProductGrid` / `ProductCard` 的卡片与网格 → 单品卡片、Look 卡片；`ProductFilters` 的筛选栏结构 → 分类 + 标签筛选 |
| 已保留的旧页面 | `/products`、`/products/[slug]`、`/cart`、`/orders`、`/assistant` 页面与接口**不删**，仅从导航移除；直接访问路径仍可用 |

**不沿用**：购物车按钮、下单流程、导购悬浮按钮、`Product` 数据模型（新功能只读写 `WardrobeItem` / `Outfit`）。

---

## 2. 目标用户

**主要用户（P0，单用户）**：衣服 50~300 件、有「没衣服穿」困扰、习惯拍照记录穿搭的用户。

| 场景 | 行为 |
| --- | --- |
| 周末整理 | 拍一遍新买的衣服，录入衣橱 |
| 出门前 | 按标签/场合翻历史搭配 |
| 网购前 | 新单品进 New 区，AI 试穿上身判断 |
| 购入后 | New 区一键移入衣橱或加入搭配 |

**次要用户（P1）**：作品集观众/面试官，关注产品完整度与 AI 能力落地。

**权限边界**：所有数据按 `userId` 隔离；MVP 为单账号，结构支持扩展多用户。

---

## 3. 功能需求

### 3.0 页面地图

```
导航（沿用现有骨架）：OutfitHub | 首页 | 衣橱 | 搭配 | 新单据 | [搜索框] | 头像
首页 /             → Hero 搭配 + 搭配流
衣橱 /wardrobe     → 四分类单品 + 标签筛选 + 搜索
搭配 /looks        → 搭配网格 + 标签/场合筛选
搭配详情 /looks/[id] → 实穿照 ⇄ 白底拼图（悬停）+ 单品清单
搭配编辑 /looks/[id]/edit → 画布排版
新单据 /new        → New 区 + 最近试穿
单品详情 /items/[id] → 大图 + 信息 + 所属搭配
单品录入 /items/new  → 多图上传 + 去背景 + 信息表单
试穿 /tryon        → 选 1~4 件 + 人像 → 异步生成
试穿历史 /account/tryons
搜索页 /search?q=  → 单品/搭配分栏结果
```

---

### 3.1 认证与账号（P0）

**功能**
- 沿用现有邮箱+密码登录（`src/lib/auth.ts`、`/login`）
- 个人中心保留身材数据（身高/胸围/腰围/臀围）与本人照片（`User.photoKey`）

**页面组件**
- `/login`：复用
- `/account`：复用，展示「我的身材」「本人照片」入口

**验收**
- [ ] 未登录访问 `/wardrobe`、`/looks`、`/new` 跳转登录
- [ ] 刷新不丢会话

---

### 3.2 单品录入 / 编辑（P0）

**功能**
1. 入口：衣橱「+ 添加单品」、New「+ 新单据」、单品详情「编辑」
2. 多图上传：一次可选多张（JPG/PNG/WebP；≤8MB/张；≥200×200）
3. 出图两条路径：
   - **AI 去背景**：上传带背景实物照 → 腾讯云 MPS 抠图 → 白底图（PNG，透明或白底），可选自动返回主色供预填
   - **直接上传白底大图**：跳过抠图
4. 每件单品 ≥1 张白底图，可多张（多角度），指定主图
5. 信息表单：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 名称 | ✅ | |
| 分类 | ✅ | 上装 / 下装 / 鞋子 / 配饰 |
| 所属区 | ✅ | Wardrobe / New（默认按入口预填） |
| 品牌 / 颜色 / 材质 / 尺码 | ❌ | |
| 价格 | ❌ | 存分 |
| 购买日期 | ❌ | |
| 备注 | ❌ | |
| **标签** | ❌ | 多选+自定义，用于检索（见 3.7） |

**页面组件**

| 组件 | 说明 |
| --- | --- |
| 多文件上传区 | 拖拽/选择；逐图卡片：预览 + 删除 + 「去背景」；**上传区下方一行小字提示：「一张图只包含一件单品效果会更好哦」** |
| 抠图状态 | 上传中 / 去背景中（约 4~5 秒）/ 完成 / 失败（可重试或改传白底） |
| 信息表单 | 分类四 tab；AI 结果预填可改 |
| 标签选择器 | 预设标签 + 自定义输入，chip 展示 |
| 保存 | 未完成抠图时提示"还有 N 张图处理中" |

#### 去背景的能力边界（2026-11-17 实测确认）

MPS 抠的是「**前景主体**」，不是「只有这件衣服」。实测：模特穿着的裤子会连同外套下摆、鞋子一起保留；带边框的海报会保留卡片。**处理方式（用户已选 A）**：

1. 上传区固定一行提示：**「一张图只包含一件单品效果会更好哦」**
2. 一张图对应一件单品：多图 = 同一单品多角度，不是多件单品放一张图
3. 结果不满意可重试或改传白底图（不阻塞保存）
4. 不在上传后加手动框选，不接入其他抠图服务

详见 `cutout-verification-20261117.md`。


**后端**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/wardrobe/upload` | 多图上传 → COS → key 列表 |
| POST | `/api/wardrobe/cutout` | 发起去背景 → taskId |
| GET | `/api/wardrobe/cutout?taskId=` | 轮询 → 白底图 key |
| POST | `/api/items` | 创建（图 key + 信息 + 标签） |
| PATCH | `/api/items/[id]` | 编辑 |
| DELETE | `/api/items/[id]` | 删除（同步删 COS） |

**验收**
- [ ] 上传 3 张，均可去背景成功或改传白底
- [ ] 完成后保存，出现在对应分类
- [ ] 可替换主图
- [ ] 删除后 COS 对象不存在

---

### 3.3 Wardrobe：衣橱（P0）

**功能**
- 四分类：全部 / 上装 / 下装 / 鞋子 / 配饰
- 标签筛选：多选标签 → 取交集
- 排序：最近添加（默认）/ 名称
- 多选模式：勾选 2~8 件 → 「生成搭配」
- 单品卡片：白底图 + 名称 + 分类 + 标签 chips

**页面组件**：分类 Tab、标签筛选条、单品网格（手机 2 列 / 平板 3 列 / 桌面 4 列）、空状态、分页（24/页）

**验收**
- [ ] 分类 + 标签组合筛选正确
- [ ] 勾选 3 件后出现「生成搭配」
- [ ] 空状态文案正确

---

### 3.4 单品详情（P0）

**功能**
- 主图多图切换；信息完整展示；标签 chips
- **出现在这些搭配里**：反查所属 Look（缩略图横排，点击跳转）
- 操作：编辑 / 删除 / 加入搭配 / 试穿这件

**验收**
- [ ] 被 Look 引用后显示该 Look
- [ ] 「试穿这件」直达 `/tryon?itemId=`

---

### 3.5 Look：成套搭配 + 打通式画布（P0，核心）

#### 3.5.1 数据与流程

1. **Look 列表 `/looks`**：网格展示，封面默认实穿照，悬停切白底拼图（见 3.6）；可按**场景标签**筛选、可搜索
2. **新建 Look**：填名称、场景标签（多选）、日期、备注 → 上传实穿照 → 选单品（2~8 件）→ 进入**画布**排版 → 保存
3. **画布编辑 `/looks/[id]/edit`**：随时重新打开调整
4. **Look 详情 `/looks/[id]`**：顶部大图（悬停切换），下方单品清单（缩略图 + 名称，点击进单品详情）、标签、编辑/删除

#### 3.5.2 打通式画布（用户确认的需求形态）

> 需求原意：多件衣物抠图后先自动生成一张集成图，图中每件单品都可以**点选、拖动**到自己想放的位置。

**初始状态（自动排版）**：勾选单品后服务端按规则生成初始画布：

| 单品数 | 默认布局 |
| --- | --- |
| 2 | 一行横排 |
| 3~4 | 2×2 网格 |
| 5~6 | 上 2 下 3 |
| 7~8 | 上 3 下 4 |

排序按「上装 → 下装 → 鞋子 → 配饰」，同品类内按勾选顺序。

**编辑能力（MVP 必做）**

| 能力 | 交互 |
| --- | --- |
| 点选 | 单击选中（边框高亮），点击空白取消 |
| 拖动 | 按住移动，实时跟手；松手吸附 8px 网格 |
| 缩放 | 选中后四角手柄拖拽；或滚轮 + 双指 |
| 层级 | 选中后「上移一层 / 下移一层」按钮 |
| 旋转 | 选中后旋转手柄（-180°~180°） |
| 撤销 | Ctrl/Cmd+Z 撤销上一步 |
| 重置 | 「恢复自动排版」按钮 |
| 保存 | 坐标写入 DB；服务端用 sharp 渲染最终 PNG 存 COS |

**画布规格**

| 项 | 值 |
| --- | --- |
| 画布尺寸 | 2000×2000，白底 |
| 坐标系 | 归一化 0~1（与分辨率解耦，便于响应式与重新渲染） |
| 元素数据 | `{ itemId, imageKey, x, y, scale, rotation, zIndex }` |
| 渲染 | 前端 DOM + CSS transform 实时预览；服务端 sharp 输出 PNG（缩略图/分享/试穿封面） |
| 单品初始尺寸 | 宽度 = 画布宽 × 0.4（上装/外套）、0.35（下装）、0.18（鞋/配饰），等比高度 |
| 触控 | 移动端支持单指拖动、双指缩放旋转 |

#### 3.5.3 后端接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/looks` | 创建 Look（名称、标签、实穿照 key、itemIds） |
| PATCH | `/api/looks/[id]` | 编辑信息/标签 |
| PUT | `/api/looks/[id]/canvas` | 保存画布元素数组 → 服务端渲染拼图 → 返回 collageKey |
| POST | `/api/looks/[id]/reset-canvas` | 恢复自动排版 |
| DELETE | `/api/looks/[id]` | 删除（删实穿照、拼合图 COS） |

**验收**
- [ ] 选 3 件进入画布，初始为 2×2 布局（第 4 格空）
- [ ] 拖动/缩放/旋转/层级调整即时生效
- [ ] 保存后重新打开，位置与保存时一致
- [ ] 「恢复自动排版」可用
- [ ] 服务端渲染的 PNG 与画布预览一致
- [ ] 手机端可拖动与双指缩放

---

### 3.6 悬停双视角（P0）

**规则**

| 状态 | 显示 |
| --- | --- |
| 默认 | 实穿照（用户上传） |
| 悬停 | 白底拼合图（画布渲染结果） |
| 切换 | `opacity` 交叉淡入 250ms，不位移不跳动 |
| 移动端 | 无 hover → 右上角切换按钮（点击切换） |
| 缺图 | 只显示存在的那一张，不报错 |

**适用**：Look 列表卡片、首页搭配流、Look 详情大图、单品详情「所属搭配」缩略图。

**组件**：`HoverSwapImage({ front, back, alt })`，内聚悬停/点击切换逻辑。

**验收**
- [ ] 鼠标进出平滑切换，图片尺寸不跳
- [ ] 手机可切换
- [ ] 缺图不报错

---

### 3.7 标签体系与检索（P0）

**标签来源**

| 类型 | 示例 |
| --- | --- |
| 预设风格标签 | 通勤、休闲、约会、运动、度假、复古 |
| 自定义标签 | 用户自由输入（如「显瘦」「黑色」「羊毛」） |
| 场景标签（Look 专属） | 上班、约会、运动、旅行、聚会 |

**规则**
- 单品可挂多个标签；Look 可挂多个场景标签
- 标签自动补全（输入时提示已用过的标签）
- 标签库按用户隔离

**检索能力**

| 位置 | 能力 |
| --- | --- |
| 衣橱页 | 标签多选筛（交集），可与分类叠加 |
| 搭配页 | 场景标签多选筛 |
| 顶部搜索 | 关键词搜单品（名称/品牌/颜色/材质/标签/备注）与搭配（名称/场景/备注） |
| 搜索页 `/search?q=` | 分栏结果：单品（按分类分组）/ 搭配；支持标签 chip 继续点选 |

**后端**
- `GET /api/tags`：当前用户标签列表（含使用次数，用于排序）
- `GET /api/search?q=&tag=`：返回 `{ items, looks }`

**验收**
- [ ] 衣橱勾选 2 个标签，结果为同时含两标签的单品
- [ ] 搜索「通勤」能搜到带该标签的单品与搭配
- [ ] 标签自动补全有效
- [ ] 标签按用户隔离

---

### 3.8 New：新单据区（P0）

**功能**
- 承载未确定购入/未搭配的单品与试穿记录
- 卡片状态：待试穿 / 已试穿 / 待决定
- 卡片操作：**移入衣橱**（zone→WARDROBE）/ **加入搭配**（选已有 Look 或新建）/ **试穿**
- 顶部「最近试穿」横滑条（最近 6 次）

**后端**：`PATCH /api/items/[id]/zone` `{ zone: "WARDROBE" | "LOOK" | "NEW" }`

**验收**
- [ ] 移入衣橱后从 New 消失、Wardrobe 出现
- [ ] 试穿完成后该单品状态变「已试穿」

---

### 3.9 AI 虚拟试穿（P0）

**参数（沿用旧项目实测，不得自行调整）**

| 项 | 值 |
| --- | --- |
| 模型 | 腾讯云 MPS `tryon-1.0-lite` |
| 分辨率 | `1K` |
| 人像 | 个人中心本人照片（`User.photoKey`），原图不压缩 |
| 单品 | **1~4 件**（MPS ImageSet 与实测上限） |
| 参考图 | 单品白底图（按分类映射 `garment`/`accessories`/`shoes`）+ `identity` 人像 |
| 耗时 | 约 50~90 秒，超时 3 分钟 |
| 费用 | 1.00 元/张，不设限额 |

**异步流程**

```
POST /api/tryon      → 建记录(PENDING) → 发起 MPS → 存 mpsTaskId → 返回 recordId
GET  /api/tryon/[id] → 查一次任务状态 → 成功则下载图 → 存 COS → SUCCEEDED
                       失败→FAILED(友好文案)；超 3 分钟→FAILED(超时)
前端每 2 秒轮询，刷新页面后继续轮询（进度不丢）
```

**页面**
- `/tryon`：选 1~4 件（默认带入 New 区单品）→ 人像预览 → 生成 → 步骤进度（准备素材/生成中/保存结果）+ 已等待秒数 → 结果大图 + 单品清单 + 保存/重新生成/返回
- `/account/tryons`：历史网格（结果图、时间、单品数），点开大图 + 删除

**验收**
- [ ] 未登录 / 无人像 / 0 件 / >4 件 均有提示
- [ ] 输入走原图（`photoKey`、`whiteKey` 原尺寸）
- [ ] 1 件、3 件各真实成功 1 次
- [ ] 单独一件下装试穿，只替换下半身（见 `tryon-migration-notes.md` 困难点 3）
- [ ] 刷新页面进度不丢
- [ ] 3 分钟超时友好失败
- [ ] 结果图带「AI 生成」标识
- [ ] 网络响应无腾讯云 Secret

---

### 3.10 首页（P0）

- Hero：最新一套搭配大图（悬停切换）
- 搭配流：时间倒序 Look 卡片，每次加载 12 个
- 快捷入口：最近 4 件 New 单品横滑
- 空状态引导添加单品

---

### 3.11 导航与布局（P1，骨架不变）

| 项 | 要求 |
| --- | --- |
| 顶栏 | `h-14 sm:h-16`、sticky、白底 90% + 模糊（沿用现有） |
| 品牌名 | 左侧 **OutfitHub**（Bodoni Moda） |
| 导航项 | 首页 / 衣橱 / 搭配 / 新单据 + 中段搜索框 + 用户头像 |
| 页脚 | 「OutfitHub · 个人穿搭衣橱」 |
| 主体宽度 | `max-w-6xl`，`px-4` |
| 移动端 | 导航收成图标 + 汉堡 |
| 导购按钮 | 移除悬浮助手与「导购」导航项（代码保留） |
| 购物车 | 从导航移除（`/cart` 页面保留可访问） |
| 页面结构模板 | 衣橱页、搭配列表页的结构按 `/products` 照搬，见 1.4 |

**导航改动对照**（当前 → 目标）：

| 位置 | 当前 | 目标 |
| --- | --- | --- |
| 品牌名 | `Wardrobe` | `OutfitHub` |
| 导航 1 | 首页 `/` | 首页 `/` |
| 导航 2 | 商品 `/products` | 衣橱 `/wardrobe` |
| 导航 3 | 导购 `/assistant` | 搭配 `/looks` |
| 导航 4 | 购物车 `/cart` | 新单据 `/new` |
| 中部 | — | 搜索框（桌面可见） |
| 右侧 | 头像 | 头像（不变） |

---

## 4. 非功能性需求

### 4.1 响应式设计

| 断点 | 布局 |
| --- | --- |
| < 640px | 网格 2 列；导航图标化；搜索全屏；表单单列；画布全宽、支持双指手势 |
| 640–1024px | 网格 3 列；导航主要项；搜索框可见 |
| ≥ 1024px | 网格 4 列；导航完整；搜索框居中段；主体 `max-w-6xl` |

- 图片走 `next/image` + `sizes`；比例：单品 4:5、拼合图 1:1、实穿照 4:5
- 触摸目标 ≥ 44×44px
- 所有 hover 交互必须有触屏替代

### 4.2 性能

- 首屏 LCP ≤ 2.5s（本地放宽）
- 列表每页 ≤ 24 条，图片懒加载
- 搜索防抖 300ms，结果 ≤ 500ms
- 画布渲染：元素 ≤ 8，前端直接 DOM transform，不做额外优化
- 拼合图服务端渲染结果按内容 hash 缓存到 COS

### 4.3 安全与隐私

- 数据仅本人可见：API 校验 `session.user.id === userId`，否则 404
- 图片存 COS 私有桶，签名 URL 30 分钟有效；不暴露 SecretId/Key
- 上传校验：MIME + sharp 解析 + ≥200×200 + ≤8MB
- 标签等用户输入做长度与数量限制

### 4.4 可靠性与容错

- 去背景失败：单张可重试/改传白底，不阻塞保存
- 试穿失败/超时：友好文案 + 重试，记录标 FAILED 可重试
- 画布编辑：未保存离开时提示；支持撤销
- 删除二次确认
- 空态/加载态/错误态齐全

### 4.5 兼容性

- Chrome / Edge / Safari 最近 2 个版本；iOS Safari、Android Chrome
- 图片格式 JPG / PNG / WebP

### 4.6 可用性与可访问性

- 键盘可达、焦点环可见；图片有 `alt`
- 对比度符合 WCAG AA
- 画布支持键盘微调（方向键移动 1px，Shift+方向键 10px）

### 4.7 成本

| 项 | 单价 | 说明 |
| --- | --- | --- |
| 试穿 `tryon-1.0-lite` 1K | 1.00 元/张 | 用户自付，不限 |
| MPS 去背景 | 约 0.01 元/张 | |
| COS 存储/流量 | 标准价 | |

---

## 5. 数据模型

### 5.1 现有表（保留）

`User`（heightCm/weightKg/bustCm/waistCm/hipCm/photoKey）、`Product`、`ProductImage`、`Category`、`Cart`、`CartItem`、`Order`、`OrderItem`、`Favorite`、`Footprint`、`AssistantLog`

### 5.2 新增表

```prisma
enum ItemCategory { TOP BOTTOM SHOES ACCESSORY }
enum ItemZone     { WARDROBE LOOK NEW }
enum TryonStatus  { PENDING RUNNING SUCCEEDED FAILED }

model WardrobeItem {
  id          String       @id @default(cuid())
  userId      String
  zone        ItemZone     @default(WARDROBE)
  category    ItemCategory
  name        String
  brand       String?
  color       String?
  material    String?
  sizeLabel   String?
  priceCents  Int?
  purchasedAt DateTime?
  note        String?
  coverKey    String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  user        User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  images      WardrobeItemImage[]
  tags        ItemTag[]
  outfitItems OutfitItem[]
  tryonItems  TryonRecordItem[]

  @@index([userId, zone, category])
  @@index([userId, name])
  @@map("wardrobe_items")
}

model WardrobeItemImage {
  id          String @id @default(cuid())
  itemId      String
  originalKey String?
  whiteKey    String
  sortOrder   Int    @default(0)
  item WardrobeItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  @@index([itemId])
  @@map("wardrobe_item_images")
}

// 标签库（按用户隔离，带使用计数用于自动补全排序）
model Tag {
  id       String @id @default(cuid())
  userId   String
  name     String
  useCount Int    @default(0)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  items    ItemTag[]
  outfits  OutfitTag[]
  @@unique([userId, name])
  @@map("tags")
}

model ItemTag {
  itemId String
  tagId  String
  item WardrobeItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  tag  Tag          @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([itemId, tagId])
  @@map("item_tags")
}

model Outfit {
  id         String   @id @default(cuid())
  userId     String
  name       String
  occasion   String?
  wornAt     DateTime?
  note       String?
  photoKey   String?
  collageKey String?
  canvas     Json?    // [{ itemId, imageKey, x, y, scale, rotation, zIndex }]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user  User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  items OutfitItem[]
  tags  OutfitTag[]

  @@index([userId, createdAt])
  @@map("outfits")
}

model OutfitItem {
  outfitId  String
  itemId    String
  sortOrder Int    @default(0)
  outfit Outfit       @relation(fields: [outfitId], references: [id], onDelete: Cascade)
  item   WardrobeItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  @@id([outfitId, itemId])
  @@map("outfit_items")
}

model OutfitTag {
  outfitId String
  tagId    String
  outfit Outfit @relation(fields: [outfitId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([outfitId, tagId])
  @@map("outfit_tags")
}

model TryonRecord {
  id           String      @id @default(cuid())
  userId       String
  status       TryonStatus @default(PENDING)
  mpsTaskId    String?
  resultKey    String?
  errorMessage String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  user  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  items TryonRecordItem[]

  @@index([userId, createdAt])
  @@map("tryon_records")
}

model TryonRecordItem {
  recordId  String
  itemId    String
  sortOrder Int    @default(0)
  record TryonRecord  @relation(fields: [recordId], references: [id], onDelete: Cascade)
  item   WardrobeItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  @@id([recordId, itemId])
  @@map("tryon_record_items")
}
```

`User` 需补反向关系：`wardrobeItems`、`outfits`、`tryonRecords`、`tags`。

---

## 6. 任务拆分

| 步 | 任务 | 依赖 |
| --- | --- | --- |
| 1 | 数据层：新增 9 张表 + 枚举 + migrate | — |
| 2 | COS 通用方法（`put/delete/signed`）+ 上传接口 | 1 |
| 3 | MPS 去背景（`src/lib/cutout/`）→ 验证返回白底 PNG | 2 |
| 4 | 单品 CRUD + 标签 CRUD | 1-3 |
| 5 | 单品录入/编辑/详情页 | 4 |
| 6 | 衣橱页（分类 + 标签筛选 + 多选） | 4 |
| 7 | Look CRUD + **画布**（组件 + 自动排版 + 保存 + 服务端渲染） | 4 |
| 8 | Look 列表/详情/编辑页 + `HoverSwapImage` | 7 |
| 9 | 标签检索 + 全局搜索 | 4,7 |
| 10 | New 区 + zone 切换 + 最近试穿栏 | 4 |
| 11 | 试穿迁移（见 `tryon-migration-notes.md`）+ 页面 | 1,2 |
| 12 | 首页改造 + 导航改名 OutfitHub + 页脚 | 8 |
| 13 | 联调测试：去背景 1 次、试穿 1 件/3 件、画布保存回显、手机端 | 全部 |

---

## 7. 验收清单

- [ ] 登录后可录入单品：多图 + AI 去背景/直传白底 + 标签 + 信息保存
- [ ] 衣橱四分类 + 标签筛选正确
- [ ] 多选 → 画布自动排版 → 拖动/缩放/旋转/层级 → 保存回显一致
- [ ] 「恢复自动排版」可用；服务端 PNG 与预览一致
- [ ] Look 详情列出全部单品；单品详情可反查 Look
- [ ] 悬停切换：桌面平滑、手机可点
- [ ] 标签自动补全、按标签检索单品与搭配
- [ ] 全局搜索同时出单品与搭配
- [ ] New 区可移入衣橱、加入搭配
- [ ] 试穿（1 件、3 件）成功，刷新进度不丢，历史可见
- [ ] 手机/平板/桌面三档布局正确
- [ ] 无 Secret 泄漏；越权返回 404；删除后 COS 清理
- [ ] 全站品牌名与文案为 OutfitHub

---

## 8. 风险与待定

| # | 事项 | 处理 |
| --- | --- | --- |
| R1 | MPS 去背景的具体 Action 与参数需查文档验证 | **已解决（2026-11-17）**：`AiCutoutConfig{Type:foreground, Model:cutout-1.0-flash}` + `EncodeConfig{Format:PNG}`，实测 4~5 秒；详见 `cutout-verification-20261117.md`。备选 `@imgly/background-removal-node` 未启用 |
| R2 | AI 是否返回颜色/款式标签 | 只返回主色（`#RRGGBB`，由结果图像素统计得出），款式标签不返回，靠手填 |
| R1-1 | 抠图会保留「所有前景」而非单件衣物 | 上传区提示「一张图只包含一件单品效果会更好哦」+ 可重试/改传白底，见 §3.2 |
| R3 | 单独下装的试穿 Prompt 可能需要分支 | 见 `tryon-migration-notes.md` 困难点 3，迁移后优先验证 |
| R4 | 画布移动端手势复杂度 | 先实现单指拖动 + 双指缩放，旋转走手柄按钮；若预算紧，旋转可降为「旋转 90°」按钮 |
| R5 | 旧导购模块 | 代码保留，仅导航移除 |
| R6 | 旧 `Product` 种子数据 | 与衣橱是两套，互不写入 |
