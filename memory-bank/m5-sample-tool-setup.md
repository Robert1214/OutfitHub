# 三件样例的本地工具测试

日期：2026-11-10。沿用现有 Chatflow 草稿；不新建应用、不上架样例、不发布测试配置。三条预期仍以 `m5-sample-acceptance.md` 为准。

## 已准备的内容

- `data/assistant-samples.json`：三件已确认样例及两组适配关系。价格来自用户，库存/材质/退换保持未知；没有复制照片或生成数据库商品 ID。
- `src/lib/assistant-samples.ts`：读取需求，核对品类、风格和明确适配关系，并用整数分计算金额。`摇滚风` 映射为样例标签 `摇滚`；不任意删掉其他风格条件。
- `GET /api/assistant/sample-products`：仅非 production 可用，沿用助手工具 token 与限流；不查询/修改数据库。生产构建返回 404。
- 返回的 `currentProduct` 是指定样例的事实；`products` 是符合已检查条件且未超预算的候选；`evaluations` 保留所有相关候选、适配依据及预算差额，防止空结果丢失超预算原因。
- `differenceCents` 为预算减所计入商品总价，负值表示超出。无预算、预算范围未知或缺搭配主体时不猜数值。
- 内部样例的标识只有 `sampleId`，没有正式 `id`，不能用于 `[[PRODUCTS:...]]`、商品卡片或下单。

## 当前验证状态

当前结果（运行12）：新增requestedCategories后的600元续轮已获用户确认，实际回复556元/余44元，核心行为通过；成功文案仍有内部编号及落选说明，正在收敛。回答表达规则以 `m5-dify-chatflow.md` §12.12 的最新替换段为准；工具limitations继续约束事实，但不应逐条输出为顾客回复。Dify应用与文案重测待用户完成，下方各轮状态保留为历史。

新的多个待选品类步骤：本地样例工具新增可选requestedCategories；收到多个明确品类时返回needs_selection，selection.anchorCandidate只是候选、不是已选主体，currentProduct为空，不再把已说出的多个品类误当未知。接入顺序、提示词和回归题见 [多个品类待选接入](m5-multi-category-setup.md)。尚未在Dify应用或运行新分支；以下为此前预算用例的记录。

最新话术复核：用户明确接受有顾客条件来源的“不包含鞋”，本句可追溯到原话及运行06需求字段。运行07回复组合/金额正确且无排除西裤的过程说明，本条通过；不为删除该句继续修改Dify或重复测试。下方话术待改判断为此前历史，当前以用户最新标准为准。

最新600元续轮：HTTP已回传60000/total/true、outfit/bottoms/摇滚、188元上衣及不要鞋，status=matched_known_constraints、products片段含S03；最终回复556元/余额44元且不重复追问，核心行为通过，见 `m5-sample-run-20261110-06.md`。前序有确认主体的中间轮，完整products/会话轨迹未提供。下一步优化成功回复中复述排除条件、主动解释反例的文案，草稿见 `m5-dify-chatflow.md` §12.12；此后文字为此前各轮的历史状态。

最新重测：修订提取SYSTEM的includeCurrentProduct定义后，用户确认提取/HTTP关键字段符合预期，实际首条回复直接说明556元/超56元，只问是否调整预算。S-E02超预算处理通过，记录见 `m5-sample-run-20261110-04.md`；本次完整日志未重贴，字段部分依据用户确认。文案仍待改，下一步在同一会话续答600元；之前失败与取证保留如下。

已完成本地规则/路由函数测试以及项目类型、lint、生产构建检查。800 元用例首次失败保留于 `m5-sample-run-20261110-01.md`；重测核心流程通过，仍有文案问题，见 `m5-sample-run-20261110-02.md`。500 元用例已运行：首轮重复确认已明确的总预算，第二轮才正确协商预算；用户确认 over_budget 与空 products 来自第二轮，首轮 HTTP 待取证，见 `m5-sample-run-20261110-03.md`。本轮先取同轮证据定位，再修复重测；600 元实际续轮尚未运行，代码算术测试不证明模型多轮保留条件。

用户已明确选择复用 3000。2026-11-10 确认该端口运行本项目的 `next start` 后，将该进程切换为同端口 `next dev --port 3000`；未启动 3001。直接 HTTP 检查通过：800/600 元返回 S03、组合总价 556 元；500 元返回 `over_budget`、超出 56 元；S02 始终被判不适配。缺鉴权返回 401、无效需求返回 400，原商品接口仍能返回极简裤子 ¥359。上述为本地 HTTP 检查，Dify 集成与真实多轮仍待用户执行。

## 开发服务可用后的 Dify 操作

先保留现有 HTTP 配置，便于测试后恢复：原地址 `/api/assistant/products`，q=代码执行.q、category=代码执行.category、styleTags=代码执行.styleTags、limit=5、contextProductId=用户输入.product_id。

仍使用原 HTTP 节点，仅修改草稿：

1. URL 改为 `http://host.docker.internal:3000/api/assistant/sample-products`；鉴权 Header 保留，不发送凭证截图。
2. Params 本轮只使用两项：`requirements` 通过变量选择器选「代码执行.requirements」；`anchorSampleId` 固定填 `S01`，这是本组三题指定的样例主体，不能写入正式商品 ID 字段。测试其他主体时要相应改动。
3. 在原「回答」SYSTEM 末尾增加以下临时测试说明；USER 继续引用 HTTP body 和代码执行.requirements：

```text
【内部样例工具测试】
仅当工具结果 scope 为 internal_samples_only 时应用本段。
样例工具不提供页面浏览证据。currentProduct仅供已明确主体的样例搭配计算，currentProductSource=internal_sample_anchor；真实页面资料须来自实际非空product_context。未知品类与独立搜索不应带入该主体，新增推荐候选只能来自products。evaluations只用于核对原因、事实和金额，不是备用推荐列表。具体回答来源规则以m5-dify-chatflow.md §12.14为准。
先检查 status：仅 matched_known_constraints 且 products 非空时可作成功推荐；仍需核对工具未覆盖的其他顾客条件。
status=needs_clarification 时，不得从 evaluations 选款或宣布推荐成功；按 clarification/nextAction 处理，不宣称无商品。已在用户问题中明确的条件不得重复追问，发现与提取结果冲突时不要伪装推荐成功。
status=over_budget 时可说明 evaluations 中适配组合的实际总价及差额，再询问是否愿意调整预算；顾客同意前不得当作预算内推荐。
status=no_known_match_in_samples 时仅说明本组资料内未找到已确认的匹配，不能断言全店无货。未知状态或错误时不从 evaluations 兜底推荐。
样例未进入真实商品库，sampleId 不是商品 ID，不输出 [[PRODUCTS:...]]。
只在 S01–S03 范围内判断；未知库存、材质、尺寸和退换保持未知，不声称可下单或合身。
evaluations 中超预算或不适配的商品只能用于解释限制，不能作为满足条件的推荐。
按工具的已检查条件和金额解释，不将已提取的顾客要求当成商品事实。
缺条件时一次澄清一项；不能擅自提高预算、换品类或改变风格。
成功推荐时自然解释商品特征、适配理由和金额，不输出“店主资料明确确认”“本次只核对样例”等内部核验过程，不主动逐一列出被排除商品。只有解释无匹配时才说明本组范围。
不得将部分缺失概括为全部没有尺码信息：S01 已有 M、衣长 61cm、胸围记录 94cm（测量口径未知），S03 具体尺寸未知；已有尺寸也不代表已确认合身。
```

4. 预览输入 `product_context` 与 `product_id` 留空；如 `product_id` 在开始节点仍为必填，仅在草稿关闭必填（原设计为可选）。商品事实由此次工具返回，不往正式商品 ID 字段塞样例名。
5. 先新开会话 A 测 S-E01（800 元），记录 HTTP body 和最终回复；再新开会话 B 测 S-E02（500 元），S-E03（600 元）紧接 B 的真实上一轮回复，不能清空会话或补写理想回复。
6. 保存失败原文。若分类器不把续轮交给商品分支，或提取器丢条件，应记录实际问题，不能靠重新问完整题替代多轮验收。

本轮预览未提供商品 ID，主体由 HTTP 的 anchorSampleId=S01 固定指定。S-E01 明确使用名称提问：“我想买滚石巡演图案 T 恤，再搭配一条摇滚风裤子，两件总预算 800 元。请推荐合适的搭配并说明理由。”这不验证真实商品指代或名称到商品 ID 的匹配。当前先按 `m5-dify-chatflow.md` §12.1 修正提取节点的 q/category 规则，替换上面的临时回答说明，再用同题新会话重测；不要固定输出 bottoms，也不要修改用户问题来掩盖漏提取。

完成测试后将 HTTP URL/Params 恢复为保留的正式配置，并移除临时测试说明，再决定后续改动；测试期间不发布。

## 能说明什么

本测试覆盖现有 Chatflow 的路由、需求提取、解析、HTTP 调用、对样例规则与金额的解释，以及真实续轮时的条件保持。它不能证明原数据库检索、商品卡片、真实库存、合身、多件通用搭配或业务转化已通过。原商品接口的搭配过滤与预算处理仍需后续修复，不因样例测试通过而标为完成。
