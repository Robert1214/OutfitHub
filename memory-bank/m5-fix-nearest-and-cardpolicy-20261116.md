# M5 修改方案 v1 执行记录：收尾与卡片各归一路（2026-11-16）

> 依据：`m5-handoff-20261115-night.md` 的问题复盘 + 用户 2026-11-16 认可的方案。
> 用户拍板：①收尾规则合并；②卡片规则「本轮第一次点名才给卡、已给过的不重复给」；③非下装搭配「按条件筛 + 筛不到仍给建议并带卡片」；④空回答/断线单独记一栏不判对错。
> 状态：**代码与回答规则已完成；单元/接口测试全过、tsc/eslint/build 通过；Dify 未改、42 轮未跑、新基线未建。**

## 1. 改了什么（按层）

### 1.1 工具层：所有非 matched 状态统一返回 `nearest`

```jsonc
"nearest": [
  { "product": {...},                    // 卡片用它的 id
    "satisfied": ["在售且有库存", "极简"], // 只列真实核对过的条件
    "violations": [{ "field": "budget", "text": "超出预算 ¥59.00" }],
    "role": "over_budget" }              // over_budget | unverified | no_match | extra_requirement
],
"soldOut": [{ "name": "复古乐福鞋", "category": "鞋履" }]   // 顾客问的款式已售罄时
"cardPolicy": { "mode": "name-once", "hint": "..." }       // products | name-once | none | match-only
```

- 单品：`over_budget` / `needs_verification` / `no_match_for_query` / `unsupported_request` 全部填 `nearest`；`matched_known_constraints` 不填（避免同一件被点两次名）。
- 搭配：`catalog_anchored_outfit` 同结构，额外带 `outfit`（组合金额、candidateProductName）。
- `violations` 来自真实核对：预算差额、缺哪个风格标签、缺哪个场合标签、未核实的偏好、款式家族不符。

### 1.2 合并掉的重复实现

| 原来 | 现在 |
| --- | --- |
| `FAMILY_TERMS`（catalog 内）+ `families`（keywordFilters 内）两份款式家族 | 一份 `garmentFamilies`，两处共用 |
| `findSoldOutByTokens`（catalog，n-gram）+ `findSoldExact`（route，关键词任一命中）两条售罄识别 | 两条保留合并为「售罄 → `soldOut` 字段」，由 route 统一交回 |
| `needs_verification` 自己写的一套取数/排序/预算 | 与主路径共用 `familyMatches` + `missingTagViolations` |
| `unsupported_request` 只查 `category`、不查顾客条件（S01/S02 给最便宜的鞋） | `nearestForCategory`：先按风格/场合/关键词/预算筛；筛不到退回同品类在售并标出差异 |
| `narrowing` 五个布尔或 | 保留逻辑，但条件集中在同一处（未拆函数，见 §4） |

### 1.3 回答节点（本地规则文件，待导入 Dify）

`memory-bank/m5-catalog-answer-system.txt`、`memory-bank/m5-outfit-answer-rules.txt`：

- 新增【收尾规则·唯一版本】：说明没完全匹配 → 逐件点名 + 照 violations 说差异 → 两个出口 → 转人工（演示）。
- 新增【卡片规则·唯一版本】：按 `cardPolicy.mode` 处理；本节没点名的商品不补标记；前面已给过卡片的同一件不重复给，用「前面提到的这条」指代。
- `over_budget` / `needs_verification` / `no_match_for_query` / `unsupported_request` 四段各写一套的收尾话术，合并为指向【收尾规则·唯一版本】。
- 【商品标记总规则·最高优先级】移到人设第二行，措辞改为指向 `cardPolicy`。

## 2. 验证结果（本机，2026-11-16）

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 通过 |
| `npx eslint src` | 无告警 |
| `npm run build` | 通过 |
| `scripts/test-assistant-catalog.ts` | 10/10 |
| `scripts/test-assistant-outfits.ts` | 8/8 |
| `scripts/test-assistant-samples.ts` | 15/15 |
| `scripts/test-assistant-comparisons.ts` | 5/5 |
| HTTP 工具直连（R01/D03/S06/S01/S09/R03a/B01/P02） | 见 §3 |

## 3. 工具直连抽查（与题库对应轮次）

| 轮次 | 输入 | 返回 |
| --- | --- | --- |
| R01-T1 | 极简裤子 400 不要鞋 | `matched`，products 1 件，`cardPolicy=products` |
| D03-T1 | 摇滚风极简裤子 400 | `no_match`，nearest = 阔腿裤[风格不符：缺少「摇滚」]、牛仔半身裙[款式不对｜风格不符] |
| S06 | 显瘦 160 斤梨形 300 | `needs_verification`，nearest = 阔腿裤[160斤梨形｜显瘦｜超出预算 ¥59.00] |
| S01 | 冬裙配鞋（无风格） | `unsupported_request`，nearest = 白色板鞋（条件能筛到，无违反项） |
| S01' | 冬裙配鞋 + 复古 | `unsupported_request`，nearest = 白色板鞋[风格不符：缺少「复古」] |
| S09 | 裤子配上衣 | `unsupported_request`，nearest = 灰背心 / 米白开衫 / 黑衬衫 |
| R03-T1 | 黑衬衫 + 极简裤 总 800 | `over_budget`，nearest = 阔腿裤[组合超出预算 ¥18.00] |
| B01 | 极简裤 400 必须防水 | `needs_verification`，nearest = 阔腿裤，violations 含「必须防水」 |
| P02 | 复古乐福鞋 | `needs_clarification`（缺预算）；补未核实条件后 `soldOut=[复古乐福鞋]`、nearest=白色板鞋 |

## 4. 已知未做 / 待你确认

1. **Dify 还没导入**：规则文件已改，需你按 §5 导入并发布，才能跑 42 轮。
2. **新基线未建**：源码、规则文件都变了，旧基线预检会失败。
3. **`narrowing` 未拆成 `hasEnoughSignal()`**：方案里写了，实际保留原布尔（改动风险大于收益，先观察一轮）。
4. **两条售罄识别仍未合并**：`findSoldOutByTokens`（catalog）与 `findSoldExact`（route）都保留，只是售罄信息统一进 `soldOut` 字段。合并需要先定「门店 n-gram 还是关键词」的口径。
5. **`nearest` 对 `unsupported_request` 的筛选强度**：现在按「风格/场合/关键词/预算」筛，不筛「体型、显瘦」这类无法核实的偏好（它们会进 violations）。

## 5. 你要做的（导入 Dify）

1. 打开导购应用 → 回答节点 → 用 `memory-bank/m5-catalog-answer-system.txt` 替换「真实商品单品查询」整段（从「【真实商品单品查询】」到文件末尾）。
2. 用 `memory-bank/m5-outfit-answer-rules.txt` 替换「真实商品指定主体搭配」整段。
3. 确认人设第二行是【商品标记总规则·最高优先级】。
4. 导出 DSL 覆盖 `.local/dify-snapshots/CURRENT.yml`，告诉我导出完成，我建基线并跑 42 轮。
