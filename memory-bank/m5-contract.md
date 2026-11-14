# M5 导购助手契约 v0

> 状态：v0 评审稿，随 `memory-bank/m5-eval.csv` 一起冻结。
> 2026-11-15 D01-1 变更记录：2026-11-14 全量回归已通过（12 会话 17 轮技术 17/17，见 `m5-v1-full-regression-20261114.md`）；2026-11-15 已按 D01-1 改 DSL 并回归 17/17（见 `m5-d01-1-followup-20261114.md`、`m5-dify-d01-1-edit-checklist.md`），Dify 配置已由用户确认发布。D01-1 收尾规则：确无匹配时说明没有完全匹配，展示最接近的单件/组合并标明违反哪一条（不得称为推荐），给出「调整条件 / 先到这里」两个出口，最后询问是否需要转人工（演示），并可输出所展示商品的标记。由此，首段（下）「over_budget 金额见 budgetAssessment 且不返回卡片」的有效部分只剩「金额见 budgetAssessment」；「不返回卡片」已被 D01-1 取代，over_budget 现在返回最接近商品并出卡片。单品分支 matched 时另返回 `budgetRemainderCents`（分，未提供预算为 null），回答须用「预算还剩XX元」。
> 2026-11-14搭配金额口径（PM-013）：scope=catalog_anchored_outfit 新增 `purchaseBasis`（`both` / `newItemsOnly`）、`reportedPriceCents`（本次应报金额，分；matched 与 over_budget 均返回），并在 newItemsOnly 时追加 `priceBasisNote`。回答节点必须按 reportedPriceCents 说明金额，不得把搭配主体价格计入本次合计。注解在 route.ts 统一处理，Dify HTTP 参数不变。
> 2026-11-11指定主体搭配扩展：同一requirements分支新增scope=catalog_anchored_outfit，只有intent=outfit、明确anchorProductId与实际contextProductId一致、已选上衣找单类下装时核对。具体店主规则与实时商品数据决定结果，返回products仅候选下装，outfits含单个组合价格及余额，over_budget金额见budgetAssessment且不返回卡片。未知关系needs_verification、主体不可购买anchor_unavailable，不能泛称全店无搭配。原单品行为保留，详见m5-catalog-outfit-setup.md；本地31项通过，Dify新增配置待验。下方2026-11-11单品扩展记录为此前阶段。
> 2026-11-11兼容扩展：`/api/assistant/products`新增独立requirements分支，使用现有提取的search/outfit等枚举（与下方历史路由枚举不同）。该分支返回scope=catalog_single_item及status、requirements、products、clarification、unresolvedRequirements、budgetAssessment；仅支持本阶段独立单品，不降级旧快捷分支。只接受requirements、limit(1–4)、contextProductId，拒绝旧q/anchorSampleId等混用。未带requirements的旧协议继续适用。完整操作及状态说明见m5-catalog-single-item-setup.md，Dify集成仍待验证。
> 2026-11-09 补充：用户已确认无完整搭配匹配时采用先协商条件的 A 方案（§1）；对应实现与多轮评测尚未验收，不代表历史 CSV 已覆盖该规则。
> 目标：先固定输入、意图、工具、输出和校验规则，再搭 Dify。

## 1. 意图与槽位

意图枚举：

| intent | 说明 |
| --- | --- |
| `product_info` | 当前商品的材质、价格、颜色、护理、风格等 |
| `product_search` | 按条件找商品、相似款、颜色/风格建议 |
| `outfit_recommend` | 多件搭配、整套推荐 |
| `size_advice` | 尺码与合身判断 |
| `policy_faq` | 发货、退换、发票、正品、演示说明 |
| `order_logistics` | 订单、物流、售后 |
| `smalltalk` | 问候、闲聊 |
| `handoff` | 投诉、越界、无法处理、需要人工 |

意图路由 JSON：

```json
{
  "intent": "product_search",
  "confidence": 0.86,
  "slots": {
    "category": "dress",
    "budgetCents": 100000,
    "occasion": "wedding",
    "color": null,
    "productId": null,
    "similarTo": null
  },
  "missing": ["category"],
  "needsClarification": false,
  "handoff": false
}
```

规则：

- `confidence < 0.6`：先澄清，不调用商品工具。
- 缺少**品类**且问题太宽泛：追问品类。
- 预算不是必填：用户不给预算，就按品类/风格推荐；给了预算则严格过滤。
- 同款/相似款：使用 `similarTo`，**不考虑预算**。
- 一次最多追问一个问题；允许为解决需求进行必要的多轮沟通，避免重复询问已知信息。

无完整搭配匹配时（2026-11-09 用户已确认，决策 D01）：

- 商品查询无法找到满足全部已知条件的完整搭配时，先说明没有完整匹配，再询问顾客是否愿意调整条件；每次只问一个问题。
- 调整由顾客决定，确认前不自动放宽预算、品类或风格要求；确认后按更新条件继续查询，保留未改变的条件。
- 用户接受必要的多轮沟通，以解决需求为目标；不能把只完成追问计为已完成搭配任务。
- 顾客拒绝调整或多轮仍无可行候选时的收尾/转人工规则待确认；本决定不设固定轮次上限，也不保证一定有可推荐商品。
- 依据：`ai-pm-user-task-card.md` §8。具体话术、评测用例与实现后续在批准范围内落实。

## 2. 商品查询工具

```text
GET /api/assistant/products
Authorization: Bearer <ASSISTANT_TOOL_TOKEN>
```

参数：

| 参数 | 说明 |
| --- | --- |
| `q` | 关键词，匹配名称/描述/标签 |
| `category` | 分类 slug |
| `color` | 颜色 |
| `refType` | `GARMENT` / `ACCESSORIES` / `SHOES` |
| `minPriceCents` / `maxPriceCents` | 预算，分为单位 |
| `similarTo` | 商品 ID，按同品类 + tags/颜色找相似 |
| `ids` | 逗号分隔，前端按 ID 取卡片，不用于 LLM 自由搜索 |
| `limit` | 默认 8，最大 12 |

约束：

- 只返回 `ON_SALE`；`ids` 模式也不返回已删除商品。
- 价格、库存、名称、图片、退换政策都来自数据库。
- 返回商品 ID 是唯一允许被引用的商品身份。
- 相似款忽略预算；普通搜索按预算过滤。

返回：

```json
{
  "products": [
    {
      "id": "cuid",
      "slug": "ivory-knit-cardigan",
      "name": "米白针织开衫",
      "priceCents": 32900,
      "color": "米白",
      "sizeLabel": "均码",
      "refType": "GARMENT",
      "tags": ["针织", "温柔", "通勤"],
      "imageUrl": "/products/ivory-knit-cardigan-1.jpg",
      "returnPolicy": "RETURNABLE"
    }
  ]
}
```

`returnPolicy`：

- `RETURNABLE`：可退（演示）
- `NO_RETURN`：不可退（演示）

评测用固定数据：

- 不可退：`silver-hoop-earrings`、`retro-loafers`、`leather-belt`、`white-sneakers`、`floral-midi-dress`
- 可退：其余 8 件
- 无商品上下文时先问「是哪一件」，不能给统一退换答案。

## 3. 输出契约

回答正文可以自然语言，但必须遵守：

1. 商品推荐只允许引用工具返回的 ID：
   `[[PRODUCTS:id1,id2]]`
2. 引用：
   `[[CITATIONS:docId#chunkId,...]]`（没有引用则省略）
3. 追踪块：
   `[[META]]{"intent":"...","confidence":0.86,"productIds":["..."],"citations":["..."],"handoff":false,"returnPolicyChecked":true}[[/META]]`
4. 前端只渲染 `[[PRODUCTS]]` 中经数据库校验有效的 ID；无效 ID 丢弃并计数。
5. `[[META]]` 只给服务端日志，不展示给用户。

## 4. 固定话术

### 正品/鉴定（B 方案）

> 本店商品支持鉴定（演示设定，不构成真实承诺；演示环境不涉及真实商品与交易）。

只回答「支持鉴定」不带限定语，评测算失败。

### 当天发货 / 加急

> 演示环境不承诺当天发货；可以帮你记录一条加急备注，但不会真的通知仓库。

加急走 handoff 备注记录，v1 不直接写订单或仓库。

### 退换

- 可退：`这件支持退换（演示）。`
- 不可退：`这件不支持退换（演示）。`
- 无上下文：`请告诉我是哪一件，退换规则按具体商品不同。`

## 5. 校验与日志

`/api/chat` 负责：

- 剥离 `[[META]]` 后再流式转发。
- 解析 `[[PRODUCTS:...]]`，去重、查库校验、丢弃无效 ID。
- 解析 `[[CITATIONS:...]]`，只保留知识库实际检索到的文档。
- 记录 `assistant_logs`：输入、intent、confidence、工具调用、原始/有效/无效 ID、引用、延迟、token、成本、handoff、prompt 版本、错误。
- 错误不暴露 Dify Key、内部 Prompt、原始堆栈。

## 6. 评测输入

- 机器可读评测集：`memory-bank/m5-eval.csv`（49 条，含肤色 C01–C07）。
- 每条 case 的 `context_product`、`body_fixture`、`login`、`conversation` 必须注入测试环境。
- 评测看行为与约束，不要求逐字一致。
