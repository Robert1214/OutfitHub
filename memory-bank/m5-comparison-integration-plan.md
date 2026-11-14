# 两套风格比较：最小增量接入方案（评审稿）

日期：2026-11-13。状态：全部验证完成（本地、Dify草稿预览三题、回归抽查两题），待用户授权发布。

**验证进度（§5）**：①本地：tsc、eslint（0错误）、新增5项测试、现有31项测试、build 全过；②Dify草稿预览：CF02/CF03首轮通过、CF01空历史首轮intent=search（题目缺"两套方案"上下文，带前缀重跑通过）——分类/提取/解析/路由/回答五环节全通；③回归抽查：单品题matched_known_constraints带真实ID标记、搭配题无页面主体needs_clarification，老链路无回归。④发布待用户授权；发布后做网站端到端。

**实施记录（2026-11-13）**：§3 代码改动已全部落地——assistant-requirements.ts 与 dify-parse-requirements.js 的 intent 枚举加 comparison；新增 src/lib/assistant-comparisons.ts（与单节点验证 fixture 同形，仅 provenance 改为 owner_reviewed_comparison_catalog）；products 路由 requirements 分支加 comparison 直返资料（不查库）。本地验证：tsc、eslint（0 错误）、新增 scripts/test-assistant-comparisons.ts 5 项全过（含非法 requirements 400 fail-closed）、现有 31 项助手测试全过、next build 成功。§7 异常与兜底一节已按现状核实补入。

依据：m5-outfit-comparison-brief.md（三题期望已确认、单节点三题已通过）、m5-comparison-node-test.md（单节点验证方法）、现有代码与契约（assistant-requirements / assistant-catalog / assistant-outfits / products route / dify-parse-requirements.js / m5-outfit-extraction-system-v2-owned.txt）。

## 1. 现有链路哪里不支持比较（证据）

| # | 缺口 | 证据 |
| --- | --- | --- |
| G1 | 意图枚举没有 comparison | `src/lib/assistant-requirements.ts:8` 的 intent 枚举；Dify 代码执行脚本 `scripts/dify-parse-requirements.js:33` 同样枚举，会拒绝 comparison |
| G2 | 提取提示词未定义 comparison 意图及字段取值 | `m5-outfit-extraction-system-v2-owned.txt:10` 第3条只列 search/outfit/similar/product_info/color_advice/unknown |
| G3 | 商品工具没有 comparison 模式 | `src/app/api/assistant/products/route.ts:609-611`：非 outfit 全部走 queryCatalogProducts，后者在 `src/lib/assistant-catalog.ts:101` 拒绝非 search 意图，返回 unsupported_request |
| G4 | 比较资料没有宿主 | S02/S04/S05 不在数据库、没有商品ID（不凭空创建）；单节点测试时靠人工内联 fixture |
| G5 | 回答节点比较规则段只在草稿、未发布；其中"内部测试输入"一句是测试口径 | 用户已在草稿 SYSTEM 追加 addon；发布前需改一句为生产口径 |

## 2. 最小增量设计

延续现有链路：问题分类 → 提取 → 解析 → HTTP 商品工具 → 回答。只增加一个 intent 值和一个工具模式，不新增节点、不改拓扑。

1. **intent=comparison**：顾客要求比较店主已提供的多套方案（"这两套怎么选"）。提取阶段只负责判 intent，其余字段为空；顾客的场合/温度/颜色偏好由回答节点直接从 sys.query 读取——这正是单节点三题验证过的行为，不再二次建模。
2. **比较资料放代码**：新建 `src/lib/assistant-comparisons.ts`，与 ownerPairingRules 同模式，存放店主已确认的通勤比较组 v1（A=S04+S02、B=S05+S02，含店主描述、图片观察、价格、禁配与未知边界）。资料来自已确认的 m5-comparison-node-context.json，无商品ID、无购买链接、purchaseScope=undecided。
3. **工具返回**：route 的 requirements 分支新增 comparison 路由，返回 scope=internal_style_comparison 的 body，与三题验证过的 fixture 同形（回答节点行为已针对该形状验证过，不增加未验证字段）。不查数据库、不造 ID。
4. **回答节点**：草稿里的比较规则段继续生效；发布前把"scope标注的资料是内部测试输入"改为"scope标注的资料是店主审核的内部比较方案"，其余一句不动。
5. **不改的**：问题分类器（CF 问题预期进"商品推荐"出口，端到端验证时观察；若分类错误再加一句指令）、Start 节点、HTTP Params、前端、/api/chat。

## 3. 代码改动清单（AI 实施，待用户确认后执行）

| 文件 | 改动 |
| --- | --- |
| `src/lib/assistant-requirements.ts` | intent 枚举加 `"comparison"` |
| `src/lib/assistant-comparisons.ts`（新） | 店主认可比较组 v1 常量 + 组装函数，body 与测试 fixture 同形，provenance 改为 `owner_reviewed_comparison_catalog` |
| `src/app/api/assistant/products/route.ts` | requirements 分支：intent=comparison → 返回比较资料；outfit/search 路由不变 |
| `scripts/dify-parse-requirements.js` | intent 枚举加 `"comparison"`（与 Dify 代码执行节点同步用） |
| 测试 | 新增：schema 接受 comparison；route 返回比较 body 与 fixture 同形；旧意图不受影响。跑 tsc/eslint/build + 现有测试 |

## 4. Dify 改动清单（用户操作，AI 给精确步骤）

1. **代码执行节点**：全文替换为更新后的 dify-parse-requirements.js（输入 text、四个 String 输出不变）。
2. **提取节点 SYSTEM**：
   - 第3条 intent 说明末尾插入："顾客要求比较多套已提供的搭配方案、问'这两套怎么选'等取舍问题时为 comparison，本轮不搜索新商品。"
   - 末尾新增一条："13. intent=comparison 时，本轮只比较店主已认可的具体方案：q 为空字符串、category 为空字符串、requestedCategories 与 styleTags 为空数组、budgetCents 为 null、budgetScope 为 none、includeCurrentProduct 为 null、anchorProductId 为 null、otherRequirements 与 missingInformation 为空数组。顾客的场合、温度、颜色等偏好保留在原话中，由回答环节直接读取，不填入检索字段。"
3. **回答节点 SYSTEM**：比较规则段里"scope标注的资料是内部测试输入"→"scope标注的资料是店主审核的内部比较方案"。
4. 草稿保存后先预览验证，**发布需用户明确授权**。

## 5. 验证顺序

1. 本地（AI）：tsc/eslint/build、现有测试全过；直接 HTTP 调 `/api/assistant/products?requirements={"intent":"comparison",...}` 确认返回 body 与测试 fixture 同形。
2. Dify 草稿预览（用户）：空历史、无页面上下文，跑 CF01/CF02/CF03 整链，按验收表核对。
3. 回归抽查：原单品题（400元极简裤子）与搭配题各一题；不重跑全部17轮。
4. 发布（用户授权）→ 网站端到端 → 报告。

## 6. 边界与不做的事

- 不创建数据库商品、不凭空造商品ID、不输出 [[PRODUCTS:...]] 或购买承诺。
- 不把新样例塞进旧 sample 接口，不声称已支持购买范围/预算/尺码比较。
- 比较组 v1 只有一组（通勤 A/B）；后续新增比较组再扩展，本轮不做多组选择。
- 单节点三题通过不自动等于整链通过；端到端三题与回归是发布前的必要验证。
- 不改分类器/Start/HTTP Params/前端；不发布、不 commit（按既有约定）。

## 7. 异常与兜底（2026-11-13 补，已按代码核实）

比较模式数据是代码内静态常量，不查数据库、无外部依赖，失败面比单品链路小；但整链异常仍需兜底。

### 已有兜底（现链路，比较模式直接复用）

| 层 | 兜底 | 证据 |
| --- | --- | --- |
| 前端 | 非200/流中断/空回答均有兜底文案；商品卡片失败不阻断回答 | src/components/assistant/assistant-chat.tsx:218-315 |
| /api/chat | 限流429、Dify连接失败502、workflow失败/流中断发error事件，全部写assistant_logs | src/app/api/chat/route.ts:293-460 |
| 商品工具 | 鉴权401、限流429、参数400、查询异常500，返回error JSON | products/route.ts:571-615、820-828 |
| 解析节点 | 空输出/非法JSON/缺字段/未知字段/枚举不合法一律抛错阻断HTTP调用，不设空值默认继续查全店（fail-closed） | scripts/dify-parse-requirements.js + m5-dify-chatflow.md:544 |
| 回答节点 | 已写"HTTP非200、body为错误、status缺失或未知：简短说明本次查询没有完成，不使用历史结果或当前页面商品兜底推荐，不输出商品卡片" | m5-catalog-answer-system.txt:61 |

### 比较模式新增异常面

- 数据静态、不查库：唯一失败点是代码bug（500→error JSON→回答节点兜底话术）。
- 枚举不同步：本方案已把 dify-parse-requirements.js 与 assistant-requirements.ts 同步改，避免"comparison 被解析器拒绝→整链失败"。
- 分类器分错支：不新增分类指令（最小改动），E2E 时观察；若分错再补一句指令。
- 回答节点比较规则段 scope-gated（internal_style_comparison 且 comparisonOnly），不影响其他任务。

### 待确认项（用户操作）

1. Dify HTTP 节点异常处理配置：2026-11-13 用户回传当前为"无"。结论：保留不改。理由——比较模式为静态资料几乎不会非200（401/400/500属配置或服务器bug，给"暂时不可用"反而诚实）；改为"继续执行"会让已发布单品/搭配链路的错误路径进入未验证的空body场景，需重新回归错误题，成本大于收益；"无"是fail-closed。回答节点已写的"HTTP非200、body为错误"规则保留为双保险。
2. 转人工：无真实转人工通道（assistant-logs 只做关键词标记供离线回看）。肤色规则里有"需要我帮你转人工"话术，但模型不得谎称已安排。本轮不做，列为后续事项。

### 没有的兜底（诚实说明）

- 没有在线质检/自动重答（LLM-judge）：回答好坏靠提示词边界规则（边界5/5已回归）+ 评测 + assistant_logs 事后回看。
- 工具失败不自动重试（重复计费风险），用户手动重发。

### 验证补充

- 本地已覆盖：非法 requirements 直接 HTTP 返回 400、不执行查询（scripts/test-assistant-comparisons.ts 第5项，2026-11-13 通过）。
- Dify 侧：草稿预览时按 §5 跑 CF01-03 与回归；HTTP 节点异常处理配置见上"待确认项1"。
