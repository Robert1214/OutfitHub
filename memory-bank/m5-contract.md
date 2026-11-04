# M5 导购助手契约 v0

> 状态：v0 评审稿，随 `memory-bank/m5-eval.csv` 一起冻结。
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
- 一次最多追问一个问题；不要连续盘问。

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
