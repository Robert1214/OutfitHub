# M5 题库：结构与标注说明（2026-11-15）

> 文件：`memory-bank/m5-current-scope-eval.json`（机器可读，评测脚本直接读）
> 规模：**33 个会话 / 42 轮**（原 12 / 17 轮 + 新增 21 / 25 轮）
> 本文解释分组、字段含义和当前局限，不记录跑分结果。

## 1. 分组

| 组 | 会话 / 轮 | 来源 | 用途 |
| --- | --- | --- | --- |
| `regression`（R01–R09） | 9 / 14 | 2026-11-11 起陆续建立 | 已跑多轮，回归用 |
| `new_wording`（H01–H03） | 3 / 3 | 内部改写 | 换句说法后是否仍能正确提取 |
| `real_wording`（S01–S10） | 10 / 10 | **小红书真实问法**（`m5-real-questions-20261115.md`） | 顾客实际怎么问 |
| `backlog`（B01–B04） | 4 / 4 | **积压问题**（`m5-backlog-triage-20261115.md`） | PM-011、N-01、N-02 的固定复现 |
| `uncovered`（P01–P04） | 4 / 5 | 未测场景 | 政策、库存、澄清、转人工 |
| `d01_edge`（D02–D04） | 3 / 6 | D01-1 边界 | 拒绝加预算、拒绝调整、搭配超预算 |

按期望状态分布：

| status | 期望轮数 | 是否达到「每类 ≥5」 |
| --- | --- | --- |
| `matched_known_constraints` | 15 | ✅ |
| `needs_clarification` | 9 | ✅ |
| `over_budget` | 6 | ✅ |
| `unsupported_request` | 5 | ✅（刚够） |
| `no_match_for_query` | 4 | ⚠️ 差 1 |
| `needs_verification` | 3 | ⚠️ 差 2 |
| `anchor_unavailable` | 0 | ❌ 未覆盖 |

## 2. 字段

每轮（turn）的 `expected` 里：

| 字段 | 含义 | 谁能自动核 |
| --- | --- | --- |
| `status` | 工具应返回的状态 | 人工核（网站代理不暴露） |
| `intent` | 应识别成的意图 | 人工核 |
| `productSlugs` | 应出现在卡片上的商品（精确集合） | **脚本自动核** |
| `budgetCents` / `budgetScope` / `category` / `style` / `excludeShoes` | 应提取到的条件 | 人工核 |
| `priceCents` / `minimumPriceCents` / `overByCents` / `budgetRemainderCents` / `outfitTotalCents` | 金额 | 人工核 |
| `maxQuestions` / `noRedundantClarification` | 澄清次数 | 人工核 |
| `no*` 系列 | 「不得出现」类检查 | 人工核 |

`no*` 类检查是**否定式**，脚本无法自动判定，必须人工逐条读回复。这是当前最大的自动化缺口。

## 3. 关键局限（必须写进结论）

1. **网站代理不暴露工具状态**：`/api/chat` 只返回文本和标记，拿不到 `status`、`requirements`、`checkedConstraints`。所有 `status`/`intent`/金额类断言都靠人工读回复推断。
2. **新增组的 `intent` 是我标注的，没经你确认**。其中 3 轮标的是 `unknown`（不确定该归哪类），不能计入意图准确率分母。
3. **一部分 `status` 是推测值**（S05、P01、P02、S08 等）。跑完后以实际工具返回为准修正，不能反过来按期望值改代码。
4. **单次运行结论不可靠**：LLM 有随机性，尤其 B01（PM-011）这种文案问题。稳定性题应跑 3 次。

## 4. 当前不能据题库认定的事

- **不能算通过率**：`status`/`intent` 人工核完之前，自动化只覆盖「商品标记集合」一项。
- **不能算意图准确率**：3 轮 `intent=unknown`，且新增的标注未经你复核。
- **不能证覆盖完整**：`needs_verification` 只有 3 轮、`anchor_unavailable` 一轮都没有——后者是「顾客说『这件』但页面没有对应商品」的最明确分支，居然没测。

## 5. 下一步

1. 跑完这一轮，人工逐条核对 `status` 与「不得出现」项；
2. 把推测错的 `status` 改正，并记录为什么；
3. 补 `anchor_unavailable` 与 `needs_verification` 到各 5 轮；
4. 用真实结果决定扩展优先级（尺码 vs 组合式搭配）。
