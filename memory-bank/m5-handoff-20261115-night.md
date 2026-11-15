# M5 导购助手：2026-11-15 会话交接

> 写给下一个接手的人（或下一个会话的我）。记录本晚全部改动、每轮回归结果、踩过的坑、未完成事项。
> 不美化、不省略失败轮次。

---

## 1. 当前状态一句话

- 源码：全部改动**已提交**（b225a01、da08843），工作区干净（仅 `.local/` 未纳入版本库）。
- Dify：线上版本为 `2021115-V3.yml`（文件名少一位数字，是用户导出时的笔误，内容正常）。
- 回归：最近一轮 v9 结果 **技术 41/42、商品标记 39/42**，失败项见 §5。
- 核心未解问题：**商品标记漏输出约 7%**，属模型随机波动，改规则无法根治；待决策是否做代理层兜底。

---

## 2. 基线目录（`.local/dify-snapshots/`）

| 基线 | 对应 Dify 导出 | 主要内容 |
|---|---|---|
| d01-1-v4-20261115-local | 20261115-published.yml | 场合筛选、同品类候选、宽泛品类先澄清 |
| d01-1-v5-20261115-local | 20261115-published.yml（15:50 重导） | needs_verification 给候选、尺码追问不出标记 |
| d01-1-v6-20261115-local | 20261115-published.yml（16:19） | 新增【商品标记总规则】 |
| d01-1-v7-20261115-local | 20261115-published-V1.yml | 售罄写进 nextAction、举例只在售品类、缺预算不许说查不到价格 |
| d01-1-v8-20261115-local | `20261115-V2.yml` | JSON 容错、差额只用 overByCents |
| d01-1-v9-20261115-local | `2021115-V3.yml` | 商品标记总规则提到人设最开头 |

跑法：`node scripts/eval-current-scope.mjs --snapshot=<基线目录> --run`
预检会校验源码与 DSL 的 sha256，以及 `publication.status === "user_confirmed_published"`。

---

## 3. 源码改动（git 状态）

### 3.1 已提交

- **b225a01** `fix: needs_verification时仍返回最接近候选，预算外候选取同款式最低价`
  - `assistant-catalog.ts`：`unresolved.length` 分支改为返回最接近商品；同款式按「预算内优先，否则最低价」排序；新增 `FAMILY_TERMS` / `familyWhere` / `familyMatches`。
- 更早的三条（f655878、758a685、1a6da7e）见 `git log`。

### 3.2 本次提交：da08843 `fix: 售罄款式如实告知、尺码追问不出卡片、题库期望值对齐`

**`src/app/api/chat/route.ts`**（6 行）
- `buildSizeAdviceText` 的 `missing-body` / `missing-product` 两个分支**去掉 `${marker}`**，即追问信息时不再输出商品标记。
- `not-applicable`（配饰不涉及合身）和正常结论仍保留标记。

**`src/app/api/assistant/products/route.ts`**（23 行）
- `findSoldExact(query)` → `findSoldExact(terms: string[])`，改为关键词数组任一命中即可。
- 调用处改为 `findSoldWithAlternatives([searchQuery, ...queryTokens(searchQuery)], limit)`。
- 目的：顾客问「有复古乐福鞋吗」时能匹配到售罄的「复古乐福鞋」。

**`src/lib/assistant-catalog.ts`**（33 行）
- `no_match_for_query` 分支新增 `findSoldOutByTokens()` 调用。
- 售罄款式名**直接写进 `nextAction` 文字**（模板字符串），不新增 `unavailableProducts` 字段。
- 原因：Dify HTTP 工具是否透传新字段未知，写进 nextAction 最稳。

**`memory-bank/m5-current-scope-eval.json`**（71 行）
- 期望值更新：D03/P02/R08/S09/D04 改为 D01-1 最近候选。
- R09/S01/S02 期望鞋款卡片（白板鞋）。
- S10/B04 改为 `needs_clarification` + 无标记。
- R08/S09 清除与 `productSlugs` 矛盾的 `noProductMarkers: true`。

---

## 4. Dify 侧改动汇总（按时间顺序）

全部在**回答节点**，除非注明。

1. **分类器 instruction**：「转人工」仅限顾客明确要求（早期，用户手改）。
2. **参数提取规则 13**：`compareItems` 语义（早期）。
3. **代码执行节点**：`allowed` 增加 `compareItems`（早期）。
4. **回答节点-单品段 needs_verification**：由「不输出推荐卡片」改为「products 非空时仍按 D01-1 展示并输出标记」（D04 修复）。
5. **回答节点-两处 needs_clarification**：加「本轮只提问，不推荐、不介绍商品，不输出商品标记」（S05 修复）。
6. **【商品标记总规则】**：正文提到商品就必须输出标记，优先于各 status 分支（v6 加入）。**标题行后来被删，正文仍在，位置在《真实商品单品查询》段内。**
7. **举例只能用店里在售品类**：放在了全局规则区「-按顾客明确要求的品类寻找搭配」之后（v7）。
8. **no_match_for_query（candidates为空）**：追问缺失条件时不得说「查不到价格信息」（v7）。
9. **回答节点代码执行**：参数提取 JSON 改为容错解析（`attempts` = 原文 / 去代码块 / 截取首个 `{` 到末个 `}`）（v8）。
10. **超出预算差额**：只能由 `budgetAssessment.overByCents` / `reportedPriceCents` 换算，不得自己相减（v8）。
11. **商品标记总规则迁到人设最开头**：改名「【商品标记总规则·最高优先级】」，措辞覆盖「最接近的、不匹配的、供参考的」「不得因为不是推荐而省略标记」（v9）。

**Dify 上仍有但本地 DSL 里缺失的**：第 9、10、11 条只在用户导出里体现；`.local/dify-snapshots/20261115.yml` 是旧的本地工作副本，不代表线上。

---

## 5. 各轮回归结果（客观记录）

| 基线 | 技术 | 标记 | 失败项 |
|---|---|---|---|
| v3 | 41/42 通过 | — | P03-T2 仍澄清 |
| v4 | **42/42** | 33/42 | P03-T1✅；P03-T2❌；S06/S10/B04/D04 无卡片 |
| v5 | 42/42 | 42/42 | 5 项期望值错误（D03/P02/R08/S09/D04）已改 |
| v6 | **42/42** | **42/42** | **全通过** |
| v7 | 41/42 | 38/42 | D02、D03、S01、S06 漏标记；**R07-T2 崩溃（空回答）** |
| v8 | 41/42 | 39/42 | D02、D03、R02 漏标记；R01-T3 流中断 |
| v9 | 41/42 | 39/42 | P02、S01、S09 漏标记；S10-T1 空回答 |

**规律**：商品标记通过数在 38～42 之间波动，**失败题每轮不同**，属模型输出随机性。

---

## 6. 踩过的坑（最重要的部分）

### 6.1 我（助手）的重复性错误

1. **未核实数据就断言「编造」**
   - 曾判定 R09 的「37 码、不支持退换」和 H01/P03-T2/P04-T1 的「均码」是编造。
   - 实际 DB 里 `sizeLabel` 有「均码」和「37」，`returnPolicy` 有 `RETURNABLE` / `NO_RETURN`。**全部是模型读对了数据**，是我错。
   - 教训：报问题前必须查 `catalog.json` 或工具输出。

2. **只用标题字符串判断规则是否丢失**
   - 曾因搜不到「【商品标记总规则】」就报「规则丢了」。
   - 实际用户按我的指示删掉了标题，正文三句完整保留。**又是误报**。

3. **给 Dify 改法时没写清「整体替换哪几行」**
   - 结果用户在代码节点里造成 `let data;` 重复声明，**线上导购全部不可用**，连续两轮才修好。

4. **S05 上反复改口**
   - 先说该去掉卡片，查完界面又说该保留，最后用户指出「顶部横幅一直显示正在咨询 xxx」才定论。

### 6.2 环境/工具陷阱

- **dev server 热更新延迟**：改完代码立刻验证会拿到旧结果。需等 5～8 秒。曾因此误判筛选逻辑写错。
- **`@prisma/client` 在 `.local/` 下 require 失败**（`MODULE_NOT_FOUND`）。改用 HTTP 工具接口验证，不直连 DB。
- **Git Bash + Python heredoc 中文损坏**：`<<'EOF'` 里 `${...}` 触发 bad substitution，会破坏 JS 字符串。改用 `Write` 工具写 `.py` 文件再 `py -3 -I` 执行。
- **`py -3` 默认不是 UTF-8**：需 `PYTHONIOENCODING=utf-8`。
- **Dify DSL 的 YAML 双引号折行**：`\\\n<缩进>\\ ` 折叠为一个空格，`\\\n<缩进>\\` 折叠为空串。提取代码节点时容易把 `throw new Error` 拆成 `thrownew Error`。

---

## 7. 未完成 / 待决策

### 7.1 商品标记漏输出（核心未解）

- 现状：约 93%（v7 38/42、v8 39/42、v9 39/42）。
- 已试并在、都无法根治：分支内写、段首写、人设最开头写。
- 两条路：
  - **A. 代理层兜底**：`/api/chat` 在 `fullAnswer` 完成后，按**精确商品名**匹配 catalog，补 `[[PRODUCTS:id]]`。难点：流式输出已结束才补，卡片会后到；需避免把「你已有的衬衫」补成推荐卡片。
  - **B. 接受 93%**。
- **用户尚未决策。**

### 7.2 空回答偶发

- v7 的 R07-T2、v9 的 S10-T1 出现 `application_stream_error` / `empty_answer`。
- R07-T2 的根因已查明并修复：参数提取输出非合法 JSON → 代码节点 `JSON.parse` 抛错 → 工作流中断。
- S10-T1 这次未查日志，**根因未知**，可能是同一原因残留或 DeepSeek 侧波动。

### 7.3 未纳入版本库的内容

`.local/` 全部未提交，含调试脚本、基线快照、DSL 导出、回归结果。这是本地工作产物，不进版本库。

### 7.4 `memory-bank/m5-v6-answers-20261115.txt`

v6 那一轮 42 条回答的可读导出，供人工做语义审阅。**语义审阅尚未完成。**

### 7.5 语义层面已发现但未处理

- P03-T1 曾举例「卫衣」（店里没有）→ 已加规则「举例只能用店里在售品类」，v7 起未见复发。
- 其余语义问题（如措辞、口吻）**未系统检查**。

### 7.6 下一步建议顺序

**第 1 步：查 S10-T1 空回答的根因（10 分钟，不用等任何人拍板）**

v9 的 S10-T1 落在哪个时间点、日志里有没有对应报错：

```bash
# 1) 取这一轮的失败记录，看 startedAt 和 errors
python -c "import json;print(json.load(open('.local/dify-snapshots/d01-1-v9-20261115-local/runs/2026-11-15T13-11-22-515Z-8ba0b648/S10-T1.json',encoding='utf-8'))['errors'])"

# 2) 在服务端日志里按 G 过滤出真实错误（fonts.googleapis 噪音很多，必须先排掉）
grep -n "工作流失败" .next/dev/logs/next-development.log | grep -v fonts.googleapis | tail -5
```

判读：

- 报 `需求提取输出不是合法 JSON` → 容错解析仍有漏网写法，看模型实际输出长什么样，再补 `attempts` 的候选
- 报 `Insufficient Balance` / `Server Unavailable` → DeepSeek 侧问题，不是代码，记一笔即可
- **没有报错** → 和 v7 的 R07-T2 一样，属偶发；连续重跑 5 次，5 次都正常就结案

**第 2 步：决定商品标记走 A 还是 B（需要人拍板，见 §7.1）**

拍板前先把结论摆清楚：

- 改规则这条路已经走到头：v6 的 42/42 是运气好，v7/v8/v9 都是 38～39/42
- 漏标的场景**全部**是「没有完全匹配、正文逐条说明差异」的长回复
- 漏标时顾客能从文字看到商品名和价格，**只是点不进商品页**

如果决定走 A，实现要点（先想清楚再动手）：

1. 在 `/api/chat` 的 `finally` 之前、`fullAnswer` 拼接完成后处理
2. **只做精确名称匹配**：正文包含 `product.name` 全称才补，不做模糊匹配
3. **排除顾客已拥有的商品**：本轮 `includeCurrentProduct=false` 且商品是锚点时不补
4. 补的位置是 `fullAnswer` 末尾，但注意流式下前端可能已经渲染完，卡片会晚一步出现——这点要告知用户
5. 补之前先查 `fullAnswer` 是否已有 `[[PRODUCTS:`，有就跳过

**第 3 步：语义审阅（半小时，需要人看）**

`memory-bank/m5-v6-answers-20261115.txt` 是 v6 那轮的 42 条可读文本。审阅时按这个清单看：

- 有没有把「无法核实」说成「已满足」（显瘦、防水、梨形这类）
- 有没有把「不是推荐」和「推荐」混着说
- 金额有没有算错（差额应以 `overByCents` 为准）
- 有没有提到店里没有的品类或商品
- 澄清场景有没有一次问超过一个问题

注意：**v6 之后的 3 轮 Dify 规则有变化**（V1/V2/V3），审阅 v6 文本只能发现内容问题，不能用来判断当前版本行为。要审当前版本，得先重跑一轮并导出文本。

**第 4 步（可选）：更新 PRD §11 变更记录**

本晚改动涉及 `needs_verification` 行为、售罄告知、尺码追问文案，按项目规范应同步 PRD。**本轮未做。**

---

## 8. 关键文件位置

```
src/lib/assistant-catalog.ts          单品查询主逻辑（needs_verification、预算、售罄）
src/lib/assistant-outfits.ts          搭配查询
src/app/api/assistant/products/route.ts  Dify HTTP 工具入口（售罄匹配）
src/app/api/chat/route.ts             网站 /api/chat 代理（尺码建议、流式转发）
memory-bank/m5-current-scope-eval.json   题库 33 用例 / 42 轮
scripts/eval-current-scope.mjs        回归脚本
.local/dify-snapshots/                所有基线与 DSL 导出
```

复现一轮回归：
```bash
node scripts/eval-current-scope.mjs --snapshot=.local/dify-snapshots/d01-1-v9-20261115-local --run
```
（源码或 DSL 一改，预检就会失败，需新建基线）
