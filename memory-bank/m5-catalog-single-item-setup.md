# 真实商品单品查询：接入现有 Dify 草稿

日期：2026-11-11。当前阶段：本小块核心预览检查已由用户验收，用户确认已发布；已进入项目页面联调。下方节点修改步骤保留供复盘，不要求重复修改。继续使用原应用、原节点和3000端口。原始样例DSL保留在`.local/dify-snapshots/wardrobe-sample-baseline-20261110.yml`，此次实际发布配置的新导出尚待保存。

## 这一步交付什么

完整需求进入现有`/api/assistant/products`的新分支，查询现有数据库中的演示商品。支持独立单品的明确品类、全部风格标签、关键词、单件预算与已识别的排除品类，返回真实商品ID、名称、价格、图片及商品事实。普通单品查询没有当前浏览主体。

只要请求携带requirements，就不会降级走旧关键词搭配/相似/配色分支。未带requirements的旧接口保持兼容。原三件样例接口继续保留，但本步骤不是将三件样例入库或上架。

## 一次修改现有三个节点

### 1. 参数提取

- SYSTEM全文替换为[m5-extraction-multi-category.txt](m5-extraction-multi-category.txt)，同步缺失的第7条预算定义，字段格式与代码执行保持一致。
- USER改为[m5-catalog-extraction-user.txt](m5-catalog-extraction-user.txt)：两个变量通过选择器分别选`用户输入.query`（sys.query）与`用户输入.product_context`。空商品资料保持空，不填样例名或S01。
- 保留现有模型、记忆配置和关闭的结构化输出开关。

### 2. HTTP 请求

URL改为`http://host.docker.internal:3000/api/assistant/products`，仍为GET。

Params清空旧行后只保留这三行；特别是不要保留旧q、anchorSampleId、category、styleTags：

| 键 | 值 |
| --- | --- |
| requirements | 变量选择器：代码执行 → requirements |
| limit | 固定文本4 |
| contextProductId | 变量选择器：用户输入 → product_id；允许为空 |

鉴权Header使用现有值，不复制到文档或聊天。新接口发现旧参数混入会400，避免静默将整段JSON当关键词。contextProductId在本次独立搜索中不用于生成“当前商品”或假定已选主体。

若body提示“完整需求查询只接受requirements、limit和contextProductId”，先核对这三行各出现一次、键名大小写正确、旧行全部删除，尤其limit从旧值5改为4。该文案也用于值范围错误，不能只据此判断是额外参数。检查的是HTTP Params；不要删除requirements JSON内部的q/category/styleTags等需求字段。

### 3. 商品分支的「回答」

- SYSTEM：保留前面的商品事实、预算、顾客表达与肤色规则；从`【内部样例工具判断】`开始直到提示词末尾（包含needs_selection段）替换为[m5-catalog-answer-rules.txt](m5-catalog-answer-rules.txt)。其scope只作用于本次真实商品分支，不能把样例禁配判断假称已迁入真实商品库。
- USER全文替换为[m5-catalog-answer-user.txt](m5-catalog-answer-user.txt)。三处变量分别选`用户输入.query`、`HTTP请求.body`、`代码执行.requirements`，去掉之前多出的左花括号并补齐空的需求引用。
- 上述SYSTEM局部替换与[m5-catalog-answer-system.txt](m5-catalog-answer-system.txt)全文替换是二选一；已按第一条完成就不要再替换一次。完整文件以用户实际导出版本为基础保留前文并换好新规则；选择全文复制时，确认顶部product_context仍是正确的变量块。

代码执行节点内容和连接不需要改。本地另有`.local/dify-snapshots/wardrobe-catalog-single-item-20261111.draft.yml`，只改三个节点数据、保留12节点/11连接，供对照或后续导入；本轮默认按上面修改原草稿，不要求新建应用或直接导入覆盖。

## 最小预览验收

先仅做第一题，新预览会话且开始商品上下文留空：

> 找一条极简风裤子，单件预算400元，不要鞋。

预期HTTP的requirements为search/bottoms/40000/item，保留不要鞋；status=matched_known_constraints。products包含黑色高腰阔腿裤，priceCents=35900，id=`cmvy2n4w9000oa4tqhpng6ynm`（本地数据库当前值，以实际工具返回为准）。回复介绍这条裤子，不能推荐裙子或鞋；标记仅含本次products的真实ID。Dify预览通常只显示标记文本，项目页面才解析为商品卡片，不能将预览没渲染卡片当接口失败。

第一题通过后，同会话只改“那单件预算改成300元。”，预期over_budget、products=[]，最低359元/超59元，只协商一次，不给卡片；再改400元检查其他条件保持。后续按变更影响补未知品类和无匹配对照，不让用户在接线未确认时一次跑全套。

### 预算恢复后的条件保持（2026-11-11，本轮已通过）

用户已确认limit改为4后两题通过，见运行03；不要求重跑已通过题。下一条沿用原极简裤子会话，仅发送“那单件预算改回400元。”，不在这句重新补品类、风格或不要鞋，以检查历史需求是否保留。前两题原文未回贴，不补写为已逐字段核验的400/300两轮。

验收要求：HTTP body的requirements仍为intent=search、category=bottoms、styleTags含极简或极简风、otherRequirements保留不要鞋，预算为40000/item；status=matched_known_constraints，products包含359元黑色高腰阔腿裤。最终回答自然推荐该裤子、使用本轮真实ID，不重复询问已知品类/风格，不沿用超预算状态。

用户已回传requirements上述条件、匹配状态及商品ID，最终回复359元/低于预算41元、标记ID与本轮工具一致，本轮通过，见[m5-catalog-run-20261111-04.md](m5-catalog-run-20261111-04.md)。完整商品对象未回贴，不补造字段；项目页面卡片渲染仍待验。本轮不再重复测试或改文案。

### 未知品类与无匹配对照（2026-11-11）

新会话、空商品上下文问“我想买件衣服，单件预算400元。”，用户确认字段与回复均符合预期：品类未知、预算40000/item、needs_clarification、products=[]、currentProduct=null，只追问一个品类问题，无旧会话条件或虚构浏览主体。接受用户确认，见[运行05](m5-catalog-run-20261111-05.md)，不重复测试。

沿用该会话回答“想找摇滚风的裤子，不要鞋。”，预期提取search/bottoms/摇滚并保留40000/item；本地接口返回no_match_for_query、products=[]、currentProduct=null。用户已确认Dify字段与回复符合预期，见[运行06](m5-catalog-run-20261111-06.md)。本小块核心预览对照收尾；不擅自换风格、输出旧商品ID或把样例S03当真实库候选，后续进入项目页面联调。

## 状态与边界

| status | 当前分支行为 |
| --- | --- |
| matched_known_constraints | 从products推荐真实单品，最多4件；多件结果是备选，不是一套 |
| over_budget | products为空，budgetAssessment给最低单价及差额，不输出推荐卡片 |
| needs_clarification | 缺品类、预算范围未知/多件总预算或品类冲突时先澄清 |
| no_match_for_query | 按这次记录的条件未查到，不声称全店无货 |
| needs_verification | otherRequirements中除已识别排除品类外的条件未自动核实；保留并说明，不能静默丢弃 |
| unsupported_request | outfit/similar/product_info/color_advice或多品类尚未接入这条新查询路径，不走旧逻辑冒称完成；有真实页面资料时仍可回答其商品事实 |

关键词匹配保守，特定裤子/裙子/T恤会核对名称/标签，剩余关键词按字段匹配；可能漏召回，空结果只限本次查询。支持明确列出的风格别名（极简风→极简等），不随意放宽未知风格。未新增数据库字段或店主禁配关系，组合预算后续接入。

聊天代理原来会在无标记时自动补当前商品或售罄替代品，已移除该无条件补卡，避免超预算/未匹配仍出现无关卡片。尺码分支已有的明确商品标记保留，前端标记解析和按ID取卡链路保留。没有新保证“所有由模型给出的ID都满足条件”；仍需Dify回复验收。

用户已确认发布当前配置，网站/api/chat实际三轮请求及卡片数据一致性已验证，见[运行07](m5-catalog-run-20261111-07.md)。浏览器视觉与点击尚待完成，不把API成功当成页面已验收；当前没有新导出的实际发布DSL，原AI草稿不能替代快照。
