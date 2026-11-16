# 穿搭衣橱（Wardrobe Closet）PRD — MVP v1

| 项 | 内容 |
| --- | --- |
| 文档版本 | v1.0 |
| 日期 | 2026-11-16 |
| 项目路径 | `C:\Users\罗敦宝\Projects\outfitexpert-shop` |
| 前身 | 已完成 M0~M3（登录/商品/购物车/订单）与 M5 M5 导购助手；本 PRD 是一次**用途转向**：网店 → 个人穿搭衣橱 |
| 执行方式 | 新开窗口开发；本文件是该窗口的唯一需求来源 |

---

## 1. 产品概述

### 1.1 项目名称

**Wardrobe Closet**（页面品牌名继续沿用现有的 `Wardrobe`，副标题「你的私人穿搭衣橱」）。

### 1.2 一句话定位

一个只属于自己的电子衣橱：把衣服拍下来变成白底单品，把穿在身上的一整套搭配存下来，回头能翻、能搜、能试着搭新的。

### 1.3 目标

| # | 目标 | 衡量方式 |
| --- | --- | --- |
| G1 | 单品能快速录进衣橱 | 拍一张衣服照片上传后 ≤ 3 步完成保存（含 AI 抠图） |
| G2 | 一整套穿搭能记录并回看 | 一次搭配录入 ≤ 5 分钟；Look 详情 1 次点击看到这套的全部单品 |
| G3 | 新单据不会丢，买了能归位 | New 区单品可一键「移入衣橱」或「加入搭配」 |
| G4 | 找东西不用翻 | 顶部搜索框输入关键词，≤ 1 秒返回单品与搭配结果 |
| G5 | 未买的也能先看上身效果 | AI 试穿成功生成，历史可回看 |

### 1.4 核心价值

1. **知道自己有什么**——告别「感觉没衣服穿」（参考 Lookie 用户反馈：衣橱的最大价值是让你知道你有多少件）。
2. **成套记录、成套回看**——不是零散单品，而是「一身」的记录：实穿照 + 白底拼图两种视角。
3. **买前先试**——新单品先放 New 区、用 AI 试穿上身，确定要了再归位。
4. **白底化表达**——每件单品都有干净的抠图版，拼起来就是这套搭配的「规格图」，比杂乱实拍更清楚配了什么。

### 1.5 本次范围（MVP）

**做**：登录、Wardrobe 三分类存储与展示、Look 成套记录、New 区（含试穿）、单品录入（多图 + AI 抠图/直传白底）、拼合图生成、悬停切换交互、全局搜索、AI 试穿（含历史）。

**暂不做**：消费统计、购物车下单、订单、导购助手（代码保留但不在导航主入口）、社交分享、多用户协作。

---

## 2. 目标用户

### 2.1 主要用户（P0）

**本人 / 单用户使用**：一个 20~35 岁、衣服数量 50~300 件、习惯用手机拍照记录的女生（或男生）。她：

- 打开衣柜不知道穿什么，有「感觉没衣服穿」的挫败感
- 买过重复颜色的衣服，记不清自己有什么
- 喜欢把好看的一整套拍下来，但散在相册里找不回来
- 网购时想先看看穿上什么样

使用场景：
- **周末整理**：拍一遍最近买的衣服，录入衣橱
- **出门前**：点开 Look 列表，按场合（通勤/约会/运动）翻以前的搭配
- **网购前**：新盯上的衣服传进 New 区，上传自己的照片 AI 试穿，看合不合适
- **买了之后**：New 区一键移入衣橱、加入某套搭配

### 2.2 次要用户（P1）

**作品集观众/面试官**：看产品完整度与 AI 能力（抠图、试穿、搜索）。

### 2.3 用户画像使用边界

| 用户 | 是否需要登录 | 能做什么 |
| --- | --- | --- |
| 游客 | 否 | 只能看登录页 |
| 已登录用户 | 是 | 全部功能 |
| 管理员 | 是 | MVP 暂不需要；沿用现有 ADMIN 角色 |

> **MVP 采用单账号模式**：所有数据归属当前登录账号。数据结构仍按 `userId` 设计，方便以后支持多用户。

---

## 3. 功能需求

### 3.0 总览

```
顶部导航（沿用现有布局，内容替换）：
  Wardrobe（首页）| 衣橱（单品列表）| 搭配（Look 列表）| 新单据（New）| 搜索框 | 头像/退出

首页               → 穿搭记录流（Look 卡片，悬停切换）
衣橱 /wardrobe     → 四分类单品列表 + 搜索
搭配 /looks        → Look 网格
搭配详情 /looks/[id] → 实穿照 ⇄ 白底拼图（悬停切换）+ 单品清单
新单据 /new        → New 区 + 试穿入口
单品详情 /items/[id] → 大图 + 信息 + 出现在哪些搭配里
单品录入 /items/new  → 多图上传 + AI 抠图 / 直传白底 + 信息表单
试穿 /tryon        → 选单品 + 人像 → 生成 → 结果
我的试穿 /account/tryons → 试穿历史
```

---

### 3.1 认证与账号（P0）

**功能描述**
- 邮箱+密码注册/登录（**沿用现有 `src/lib/auth.ts`、`/login` 页面，不改**）
- 登录后所有页面可访问；未登录访问受保护页自动跳 `/login?next=...`
- 个人中心保留身材数据（身高/胸围/腰围/臀围）与本人照片（已有 `User.heightCm/bustCm/waistCm/hipCm/photoKey`）

**页面组件**
- `/login`：邮箱、密码、登录/注册切换（**复用现状**）
- `/account`：本人在用；需展示"我的身材"「本人照片」入口（**复用现状**）

**验收**
- [ ] 未登录访问 `/wardrobe`、`/looks`、`/new` 跳转登录
- [ ] 登录后刷新不丢会话

---

### 3.2 单品录入 / 编辑（P0）

**功能描述**

1. 入口：衣橱页「+ 添加单品」、New 区「+ 新单据」、单品详情「编辑」。
2. **多图上传**：一次可选多张（JPG/PNG/WebP；≤ 8MB/张；≥ 200×200）。
3. **两条出图路径**（用户可选）：
   - **A. AI 识别 + 抠图**：上传带背景的实物照 → 调用腾讯云 MPS 商品抠图 → 输出白底图；同时返回识别出的**主色**与**款式标签**（用于自动填表单，可改）。
   - **B. 直接上传白底大图**：用户已有干净白底图，跳过抠图。
4. 每件单品**至少 1 张白底图**；可有多张（不同角度）。
5. **自定义信息表单**：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 名称 | ✅ | 如「黑色宽松西装外套」 |
| 分类 | ✅ | 上装 / 下装 / 鞋子 / 配饰（四选一） |
| 所属区 | ✅ | Wardrobe / Look / New（默认按入口预填） |
| 品牌 | ❌ | 自由文本 |
| 颜色 | ❌ | 自由文本 + AI 预填 |
| 材质 | ❌ | 自由文本 |
| 尺码 | ❌ | 如 M / 均码 / 37 |
| 价格 | ❌ | 小数，存分 |
| 购买日期 | ❌ | 日期 |
| 备注 | ❌ | 长文本 |
| 标签 | ❌ | 多个关键词（用于搜索），如「通勤」「显瘦」「黑色」 |

6. 保存后回单品详情；编辑可改信息、增删图、换主图。

**页面组件**

| 组件 | 说明 |
| --- | --- |
| 上传区 | 多文件拖拽/选择；每张图卡片显示预览 + 删除 + 「抠图」按钮 |
| 抠图状态 | 每张图三态：上传中 / 抠图中（约 5~15 秒）/ 完成（显示白底图）/ 失败（可重试，也可手动改传白底图） |
| 信息表单 | 分类切换四 tab；自动预填 AI 识别结果（可改） |
| 保存按钮 | 校验通过后提交；未抠图完成时提示"还有 N 张图在抠图中" |

**后端接口**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/wardrobe/upload` | 多图上传 → COS → 返回 key 列表 |
| POST | `/api/wardrobe/cutout` | 传 key 发起 MPS 抠图 → 返回白底图 key + 主色/标签 |
| GET | `/api/wardrobe/cutout?taskId=` | 轮询抠图状态 |
| POST | `/api/items` | 创建单品（含图 key、信息） |
| PATCH | `/api/items/[id]` | 编辑 |
| DELETE | `/api/items/[id]` | 删除（同时删 COS 原图、白底图） |

**验收**
- [ ] 一次上传 3 张图，都能分别抠图成功或改传白底
- [ ] 抠图完成后再保存成功，单品出现在对应分类
- [ ] 编辑可替换主图
- [ ] 删除后 COS 对象不存在

---

### 3.3 Wardrobe：衣橱（P0）

**功能描述**
- 四分类平铺：**上装 / 下装 / 鞋子 / 配饰**，默认「全部」。
- 顶部搜索框（见 3.6）。
- 单品卡片：白底图 + 名称 + 分类 + 买入日期；点击进单品详情。
- 排序：最近添加（默认）/ 名称。
- 多选模式：勾选若干单品 → 顶部出现「生成搭配」按钮（见 3.5）。

**页面组件**
- 分类 Tab：全部 / 上装 / 下装 / 鞋子 / 配饰
- 单品网格：每卡右上角勾选框（进入多选）
- 空状态：「衣橱还是空的，点右上角添加第一件」
- 分页/无限滚动：每页 24 件（MVP 用分页按钮）

**验收**
- [ ] 四分类筛选正确
- [ ] 空状态文案出现
- [ ] 勾选 3 件后出现「生成搭配」按钮

---

### 3.4 单品详情（P0）

**功能描述**
- 主图区：白底大图，多图可左右切换
- 信息区：名称、分类、品牌、颜色、材质、尺码、价格、购买日期、备注、标签
- **出现在这些搭配里**：列出包含该单品的 Look（点击跳转）
- 操作：编辑、删除、加入搭配、试穿这件

**页面组件**
- Gallery（多图切换）
- 信息列表 + 标签 chips
- 「出现在 N 套搭配」缩略图横排

**验收**
- [ ] 单品被 Look 引用后，详情页能显示该 Look
- [ ] 从单品详情「试穿这件」直达 `/tryon?itemId=...`

---

### 3.5 Look：成套搭配（P0）

**功能描述**

1. **Look 列表 ` /looks`**：网格展示所有搭配封面。封面默认**实穿照**；悬停显示**白底拼合图**（见 3.7）。可按场合筛选、可搜索。
2. **新增 / 编辑 Look**：
   - 填 Look 信息：名称（必填）、场合（通勤/约会/休闲/运动/其他）、日期、备注
   - **上传实穿照**：一张自己穿这套的照片（普通 JPG/PNG，可不抠图）
   - **选单品**：从 Wardrobe 勾选 1~8 件组成这套
   - **生成拼合图**：把这套所选单品的白底图自动拼成一张（规则见下），作为「规格图」
   - 保存
3. **Look 详情 `/looks/[id]`**：顶部大图（默认实穿照，悬停切白底拼图），下方列这套所有单品缩略图 + 名称（点击进单品详情）、搭配信息、编辑/删除。
4. **从单品快速组 Look**：在衣橱多选 3 件 → 「生成搭配」→ 跳到新增 Look 页并预填已选单品。

**拼合图生成规则（服务端生成）**

| 项 | 规则 |
| --- | --- |
| 输入 | 所选各单品的**白底图**（每件取主图） |
| 画布 | 正方形 2000×2000，白底 |
| 布局 | 按单品数量自动：
  - 1~2 件：一行横排
  - 3~4 件：2×2 网格
  - 5~6 件：上 2 下 3
  - 7~8 件：上 3 下 4 |
| 单品摆放 | 每格等比缩放、留白 10%、底部对齐（像商品展示图） |
| 顺序 | 按「上装 → 下装 → 鞋子 → 配饰」固定顺序排列（不按勾选顺序） |
| 输出 | PNG，存 COS 私有桶，`Outfit.collageKey` |

**页面组件**

| 组件 | 说明 |
| --- | --- |
| Look 卡片 | 悬停切换图（见 3.7）、名称、场合标签、单品数 |
| Look 编辑表单 | 名称、场合 select、日期、备注、实穿照上传 |
| 单品选择器 | 抽屉式，按分类分组勾选，显示已选 N 件 |
| 拼合图预览 | 选完单品后服务端实时生成预览，不满意可「重新生成」 |

**后端接口**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/looks` | 创建 Look（含 itemIds、实穿照 key） |
| PATCH | `/api/looks/[id]` | 编辑 |
| DELETE | `/api/looks/[id]` | 删除（删实穿照、拼合图 COS） |
| POST | `/api/looks/collage` | 传 itemIds → 返回拼合图 key（可重复调用覆盖） |

**验收**
- [ ] 新建 Look 时勾选 3 件，生成 2×2 拼合图（第 4 格空或居中）
- [ ] Look 详情列出全部单品
- [ ] 单品详情能反查所属 Look

---

### 3.6 搜索（P0）

**功能描述**
- **位置**：顶部导航中部（桌面）、搜索图标（移动端，点开全屏搜索）
- **范围**：同时搜**单品**与**搭配**
- **匹配字段**：
  - 单品：名称、品牌、颜色、材质、标签、备注
  - 搭配：名称、场合、备注
- **交互**：输入即搜（防抖 300ms），结果分两组「单品」「搭配」，各显示前 10 条 + 「查看全部」
- **搜索页 `/search?q=`**：完整结果列表，单品按分类再分组

**页面组件**
- `SearchBox`：输入框 + 下拉结果面板
- 结果条目：缩略图 + 名称 + 分类/场合

**后端**
- `GET /api/search?q=`：返回 `{ items: [...], looks: [...] }`
- 实现：Postgres `ILIKE` 多字段联合 + 标签数组 `hasSome`（MVP 不建全文索引，数据量小）

**验收**
- [ ] 搜「黑色」能搜到名称/颜色/标签含黑色的单品
- [ ] 搜搭配名能搜到 Look
- [ ] 无结果显示「没有找到相关单品或搭配」

---

### 3.7 悬停切换交互（P0，Lookie 风格）

**需求原文**：*"Look 界面点入某套穿搭，进去可以看到单品都有哪些。用上之前做好的试穿功能鼠标不划到图片时，显示的是用户上传的整套搭配，划过图片就把白底的集成图展现。"*

**实现规则**

| 状态 | 显示 | 说明 |
| --- | --- | --- |
| 默认（未悬停） | **实穿照**（用户上传的那张） | 有人的、真实的 |
| 悬停（hover） | **白底拼合图** | 只有单品、干净的「规格图」 |
| 切换方式 | CSS `opacity` 交叉淡入（250ms），**不闪、不位移** | 鼠标移出恢复实穿照 |
| 移动端 | 无 hover → 显示实穿照 + 右上角小切换按钮（点一下切拼图） | 手机上也能看到两种 |
| 无实穿照时 | 只显示拼合图，不留空 | 容错 |
| 无拼合图时 | 只显示实穿照 | 容错 |

**适用位置**：Look 列表卡片、首页穿搭流卡片、Look 详情顶部大图、单品详情「出现在这些搭配里」的缩略图。

**页面组件**
- `HoverSwapImage`：通用组件，props `{ front, back, alt, className }`，内部用 `group` + `group-hover:opacity-*`

**验收**
- [ ] 鼠标进出图片，实穿照/拼合图平滑切换，图片尺寸不跳
- [ ] 手机上能看到切换按钮并生效
- [ ] 缺图时不报错

---

### 3.8 New：新单据区（P0）

**功能描述**
- 定位：**还没确定要不要买 / 还没想好怎么搭**的单品，和试穿记录。
- 列表：类似 Wardrobe，但卡片带状态标签：`待试穿` / `已试穿` / `待决定`
- 卡片操作（悬停显示）：
  - **移入衣橱** → 单品 `zone` 改为 `WARDROBE`，从 New 消失、进衣橱
  - **加入搭配** → 弹出选 Look（或新建），加入后仍可留在 New 或同时标记「已用它搭过」
  - **试穿** → 跳 `/tryon?itemId=`
- **试穿记录**：在 New 区顶部有一栏「最近试穿」，显示最近 6 次试穿结果缩略图，点击看大图

**页面组件**
- New 卡片（状态 chip + 悬浮操作按钮）
- 「最近试穿」横滑条
- 空状态：「还没有新单据，去添加吧」

**后端**
- `PATCH /api/items/[id]/zone`：`{ zone: "WARDROBE" | "LOOK" | "NEW" }`
- 试穿记录见 3.9

**验收**
- [ ] New 区单品点「移入衣橱」后，从 New 消失、Wardrobe 出现
- [ ] 试穿完成后 New 区出现该单品的试穿记录

---

### 3.9 AI 试穿（P0）

**功能描述**

依据旧项目实测参数（严格照搬，**不得自行调整**）：

| 项 | 参数 |
| --- | --- |
| 模型 | `tryon-1.0-lite`（腾讯云 MPS） |
| 输出分辨率 | `1K` |
| 人像 | 1 张，用**个人中心本人照片**（`User.photoKey`）；没有时提示先去上传 |
| 单品 | 1~4 件（来自 Wardrobe 或 New） |
| 参考图 | 各单品白底图（`garment` / `accessories` / `shoes` 按分类映射）+ `identity` 人像锚定 |
| Prompt | 按类型：替换服装 / 佩戴配饰 / 替换鞋 + 统一追加「保持五官脸型肤色发型不变」 |
| 耗时 | 约 50~90 秒，轮询到 3 分钟超时 |
| 费用 | 1.00 元/张（**用户已确认付费**） |

**流程**
1. `/tryon` 选 1~4 件（默认从 New 带入）→ 显示人像预览 → 点「生成」
2. 进度：准备素材 → 生成中（带已等待秒数）→ 保存结果
3. 成功：显示结果大图 + 本次所用单品清单 + 「保存」「重新生成」「返回」
4. 失败：友好文案 + 重试按钮（不暴露 MPS 原始错误）
5. 结果写入 `TryonRecord`，可在 New 区「最近试穿」与 `/account/tryons` 查看

**页面组件**
- 单品选择器（勾选 1~4）
- 人像预览 + 「去上传照片」链接
- 进度条/步骤指示
- 结果大图 + 单品标签 + 底部按钮

**后端接口**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/tryon` | 创建记录 → 上传素材到 COS → 发起 MPS → 返回 recordId |
| GET | `/api/tryon/[id]` | 轮询状态；成功时从 MPS 取图 → 存 COS → 返回签名 URL |
| DELETE | `/api/tryon/[id]` | 删除记录 + COS 对象 |
| GET | `/api/tryon` | 历史列表（分页） |

**验证标准**

- [ ] 未登录、无人像、选 0 件、超 4 件都有提示
- [ ] 输入用**原图上传**（不走 900px 压缩版）
- [ ] 1 件、3 件各真实生成 1 次成功
- [ ] 3 分钟超时友好失败
- [ ] 结果图带「AI 生成」标识
- [ ] 浏览器网络响应无腾讯云 Secret

---

### 3.10 首页（P0）

**功能描述**
- **Hero 区**：当日/最新的一套 Look 大图（悬停切拼图）
- **穿搭流**：按时间倒序的 Look 卡片（同 3.7 交互），每次加载 12 个，底部「再看更多」
- **快捷入口**：最近 4 件 New 单品（横向）
- 空状态：「还没有搭配，先添加几件衣服吧」

**页面组件**
- HeroLook（复用 HoverSwapImage）
- LookFeed 网格
- NewStrip 横滑条

**验收**
- [ ] 新增 Look 后首页显示
- [ ] 无数据时显示空状态而非报错

---

### 3.11 我的试穿历史（P1）

- `/account/tryons`：试穿记录网格（结果缩略图、时间、参与单品数）
- 点开大图 + 删除
- 分页 20 条

---

### 3.12 导航与布局（P1，**不变**）

**需求原文**：*"目前的前端页面布局不变"*。

| 项 | 保持 |
| --- | --- |
| 顶部导航条高度/样式 | `h-14 sm:h-16`，sticky、白底 90% 透明、背景模糊 |
| 品牌名位置 | 左侧，`Wardrobe`，Bodoni Moda 字体 |
| 导航项 | 换成：首页 / 衣橱 / 搭配 / 新单据 + **搜索框**（桌面中段）+ 用户头像 |
| 页脚 | 保留现有 `SiteFooter`，文案改成「个人穿搭衣橱 · 演示」 |
| 主体宽度 | `max-w-6xl`，左右 `px-4` |
| 移动端 | 导航项收进汉堡菜单或图标 |
| 悬浮助手按钮 | **移除**（导购不是本期内容）；如保留代码，导航中去掉「导购」 |

**验收**
- [ ] 导航项点击正确
- [ ] 页面宽度、字号、圆角、阴影与现有页面一致
- [ ] 品牌名、页脚文案更新

---

## 4. 非功能性需求

### 4.1 响应式设计

| 断点 | 宽度 | 布局规则 |
| --- | --- | --- |
| Mobile | < 640px | 单品/Look 网格 **2 列**；导航项收成图标 + 汉堡；搜索变图标（点开全屏）；表单单列；图片满宽 |
| Tablet | 640–1024px | 网格 **3 列**；导航显示主要项；搜索框显示 |
| Desktop | ≥ 1024px | 网格 **4 列**；导航完整；搜索框在导航中段；主体 `max-w-6xl` 居中 |

具体：
- 所有图片用 `next/image`（走现有远程图片配置），提供 `sizes`，首屏优先加载
- 单图比例统一 4:5（单品白底）、1:1（拼合图）、4:5（Look 实穿）
- 触摸目标 ≥ 44×44px
- 悬停类交互（3.7）在 `hover: none` 设备上必须有可点击替代

### 4.2 性能

- 首屏 LCP ≤ 2.5 秒（本地开发环境可放宽）
- 列表页每页 ≤ 24 条；图片懒加载
- 搜索防抖 300ms；结果 ≤ 500ms（本地 DB）
- 拼合图服务端生成，结果缓存到 COS，重复生成同组合时命中缓存（hash 键）

### 4.3 安全与隐私

- 所有衣橱数据（单品、Look、试穿）**仅本人可见**：所有 API 校验 `session.user.id === record.userId`，否则 404
- 图片存 COS **私有桶**，页面只拿签名 URL（30 分钟有效），浏览器不暴露 SecretId/SecretKey
- 上传校验：MIME + `sharp` 解析格式 + 尺寸（≥200×200）+ 大小（≤8MB）
- 腾讯云密钥只在服务端环境变量

### 4.4 可靠性与容错

- 抠图失败：单张可重试 / 可改传白底，不阻塞整体保存
- 试穿失败/超时：友好文案 + 重试，记录标 `FAILED` 可重试
- 删除操作二次确认
- 空状态、加载状态、错误态三态齐全
- 上传中断：已上传成功的图不丢，可续传剩余

### 4.5 兼容性

- 浏览器：Chrome / Edge / Safari 最近 2 个版本
- 移动端：iOS Safari、Android Chrome
- 图片格式：JPG / PNG / WebP

### 4.6 可用性与可访问性

- 键盘可达：所有按钮 `Tab` 可聚焦，焦点环可见
- 图片都有 `alt`（单品名）
- 颜色对比度符合 WCAG AA
- 中文字体沿用现状（Geist + 系统中文），标题 Bodoni Moda

### 4.7 成本

| 项 | 单价 | MVP 预估 |
| --- | --- | --- |
| 试穿 `tryon-1.0-lite` 1K | 1.00 元/张 | 按需，用户自行承担 |
| 抠图（MPS 商品抠图） | 约 0.01 元/张 | 按需 |
| COS 存储/流量 | 腾讯云标准价 | 小 |

> 用户已确认「花钱」：不设每日试穿额度（`TRYON_DAILY_LIMIT` 可保留但默认不限）。

---

## 5. 数据模型（现状 + 新增）

### 5.1 现状（保留不改）

`User`（含 heightCm / weightKg / bustCm / waistCm / hipCm / photoKey）、`Product`、`ProductImage`、`Category`、`Cart`、`CartItem`、`Order`、`OrderItem`、`Favorite`、`Footprint`、`AssistantLog`。

### 5.2 新增表

```prisma
enum ItemCategory { TOP BOTTOM SHOES ACCESSORY }   // 上装/下装/鞋子/配饰
enum ItemZone     { WARDROBE LOOK NEW }
enum TryonStatus  { PENDING RUNNING SUCCEEDED FAILED }

model WardrobeItem {
  id          String   @id @default(cuid())
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
  tags        String[] @default([])
  coverKey    String   // 主图（白底）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user     User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  images   WardrobeItemImage[]
  outfitItems OutfitItem[]
  tryonItems  TryonRecordItem[]

  @@index([userId, zone, category])
  @@index([userId, name])
  @@map("wardrobe_items")
}

model WardrobeItemImage {
  id          String @id @default(cuid())
  itemId      String
  originalKey String?  // 上传原图
  whiteKey    String   // 白底图（抠图结果或直传）
  sortOrder   Int      @default(0)
  item WardrobeItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  @@index([itemId])
  @@map("wardrobe_item_images")
}

model Outfit {
  id         String   @id @default(cuid())
  userId     String
  name       String
  occasion   String?
  wornAt     DateTime?
  note       String?
  photoKey   String?  // 实穿照
  collageKey String?  // 白底拼合图
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user  User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  items OutfitItem[]

  @@index([userId, createdAt])
  @@map("outfits")
}

model OutfitItem {
  id       String @id @default(cuid())
  outfitId String
  itemId   String
  sortOrder Int   @default(0)
  outfit Outfit       @relation(fields: [outfitId], references: [id], onDelete: Cascade)
  item   WardrobeItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  @@unique([outfitId, itemId])
  @@map("outfit_items")
}

model TryonRecord {
  id             String       @id @default(cuid())
  userId         String
  status         TryonStatus  @default(PENDING)
  mpsTaskId      String?
  resultKey      String?      // COS 结果图
  errorMessage   String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  user  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  items TryonRecordItem[]

  @@index([userId, createdAt])
  @@map("tryon_records")
}

model TryonRecordItem {
  id         String @id @default(cuid())
  recordId   String
  itemId     String
  sortOrder  Int    @default(0)
  record TryonRecord  @relation(fields: [recordId], references: [id], onDelete: Cascade)
  item   WardrobeItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  @@map("tryon_record_items")
}
```

`User` 需新增反向关系：`wardrobeItems`、`outfits`、`tryonRecords`。

---

## 6. 里程碑与任务拆分（建议新窗口按此执行）

| 步 | 任务 | 产出 | 依赖 |
| --- | --- | --- | --- |
| 1 | 数据层：新增 5 张表 + enum + `prisma migrate` | `prisma/schema.prisma` | — |
| 2 | 通用图片上传 + COS 封装（复用 `cos.ts`，加 `putObject/deleteObject` 通用方法） | `src/lib/storage.ts` | 1 |
| 3 | MPS 抠图：`src/lib/cutout/`（config / mps / run） | 抠图接口 | 2 |
| 4 | 单品 CRUD：`/api/items`、`/api/wardrobe/upload`、`/api/wardrobe/cutout` | API | 1-3 |
| 5 | 单品录入页 `/items/new` + 编辑 + 详情 `/items/[id]` | 页面 | 4 |
| 6 | 衣橱页 `/wardrobe`（四分类 + 多选）| 页面 | 4 |
| 7 | Look CRUD + 拼合图（`sharp`）`/api/looks`、`/api/looks/collage` | API | 4 |
| 8 | Look 列表/详情/编辑页 + `HoverSwapImage` 组件 | 页面 | 7 |
| 9 | 搜索：`/api/search` + `SearchBox` + `/search` | 功能 | 4,7 |
| 10 | New 区 `/new` + `zone` 切换 + 最近试穿栏 | 页面 | 4 |
| 11 | 试穿：搬 `src/lib/tryon/` + `/api/tryon` + `/tryon` 页 + `/account/tryons` | 功能 | 1,2 |
| 12 | 首页改造 + 导航改造 + 页脚文案 | 页面 | 8 |
| 13 | 真实 API 测试（抠图 1 次、试穿 1 件和 3 件各 1 次）+ 手机端检查 | 测试记录 | 全部 |

> **`MPS 抠图` 需先验证**：在写表单前，先用一个 Node 脚本调通腾讯云 `ProcessImage` 的抠图任务（`AiCutout` 或对应 Action），确认返回白底 PNG 再继续；若 MPS 抠图接口不可用，退回本地 `@imgly/background-removal-node`（离线、免费），代码接口不变。

---

## 7. 验收清单（MVP 完成定义）

- [ ] 登录后可添加单品：多图、AI 抠图/直传白底、信息保存
- [ ] 衣橱四分类正确、可多选
- [ ] 多选 → 生成拼合图 → 保存为 Look
- [ ] Look 详情列出全部单品
- [ ] Look 卡片/详情：鼠标悬停实穿照 ⇄ 拼合图；手机可点切换
- [ ] New 区可移入衣橱、可加入搭配
- [ ] 搜索能同时出单品与搭配
- [ ] 试穿成功生成（1 件、3 件各 1 次），历史可见
- [ ] 手机/平板/桌面三档布局正确
- [ ] 无 Secret 泄漏、越权访问返回 404
- [ ] 删除记录后 COS 对象删除

---

## 8. 待定与风险

| # | 事项 | 处理 |
| --- | --- | --- |
| R1 | 腾讯云 MPS「商品抠图」的具体 Action 名与参数需查文档确认 | 第 3 步前用脚本试跑；备选 `@imgly/background-removal-node` |
| R2 | AI 识别款式/颜色：MPS 抠图是否直接返回标签？ | 若不返回，MVP 先只做抠图；颜色/标签靠手填 |
| R3 | 拼合图「上 3 下 4」时 7 件的排布（3+4 或 4+3） | 按 4+3（下排多）居中 |
| R4 | 旧导购模块代码是否删除 | MVP **保留代码**，只从导航移除，避免误删影响 |
| R5 | 现有 `Product` 种子数据与衣橱是两套 | 保留；新窗口不要往 `Product` 里写衣橱数据 |
