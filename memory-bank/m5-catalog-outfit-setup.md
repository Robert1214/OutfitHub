# 指定页面上衣搭配裤子：下一小块

日期：2026-11-11。更新2026-11-12：本地31项回归及工程检查通过，Dify800/900获用户验收，实际DSL已保存、搭配发布获用户确认且服务器执行配置比对一致。首轮当前范围17轮已完成，H03漏推荐已定位待修，见[m5-current-scope-report-20261112.md](m5-current-scope-report-20261112.md)。下文保留原接入步骤，不要求重新搭建或重复应用旧配置；当前操作见[m5-owned-anchor-fix-20261112.md](m5-owned-anchor-fix-20261112.md)。

## 店主已确认的规则

用户对以下问题选择“认可，作为这组搭配的正例”：黑色真丝衬衫（459元，极简/优雅/利落）＋黑色高腰阔腿裤（359元，极简/利落），作为极简通勤搭配。只确认这组演示商品的审美适配，不代表尺码合身、所有黑色单品适配或其他衬衫/裤子均可搭。

固定规则记录商品slug与确认依据；真实ID、价格、库存仍从数据库读取，价格不写死在搭配判断里。该组目前合计818元。未确认关系返回needs_verification，不标成禁配；没有用新规则覆盖原S01/S02/S03正反例。

## 先保存当前已发布版本

原单品版本的10份本地源文件与SHA-256已经保存在`.local/dify-snapshots/catalog-single-baseline-20261111-local/`。本次实际发布DSL尚未导出，本地AI生成的draft不能代替。

在现有Dify应用导出刚才通过的版本，保存为项目下`.local/dify-snapshots/wardrobe-catalog-single-item-20261111.published.yml`，与旧样例文件分开。若只能导出草稿，确认发布后未改动，或明确记录导出的是草稿，不冒称取得发布快照。原始配置含鉴权，存既有Git忽略目录。此项不要求重跑已通过用例。

## 更新现有三个节点

1. 参数提取的SYSTEM全文替换为[m5-outfit-extraction-system.txt](m5-outfit-extraction-system.txt)。保留USER中的query和真实product_context变量、现有模型及记忆；结构化输出仍关闭。新增anchorProductId仅在顾客明确选择当前页面商品用于搭配时复制真实id，独立搜索为null。
2. 代码执行全文替换为[scripts/dify-parse-requirements.js](../scripts/dify-parse-requirements.js)。输入text仍选参数提取.text，四个字符串输出q/category/styleTags/requirements不变。需要一起更新，否则新anchorProductId会被旧代码拒绝。
3. 商品回答的SYSTEM末尾追加[m5-outfit-answer-rules.txt](m5-outfit-answer-rules.txt)，保留现有【真实商品单品查询】段；两个scope分别适用。USER的query/HTTP.body/代码执行.requirements不变。

HTTP节点地址仍为`http://host.docker.internal:3000/api/assistant/products`；Params仍仅requirements=代码执行.requirements、limit=4、contextProductId=用户输入.product_id。不新增HTTP参数，不把JSON内部anchorProductId单独拆成参数。节点连接不改。

## 第一条测试：真实页面主体、800元总预算

先在Dify预览检查，不在网站用旧发布配置测试新提示词。开始输入填写：

| 输入字段 | 值 |
| --- | --- |
| product_id | `cmvy255tt000caotqizp21rtq` |
| product_context | 复制[m5-outfit-preview-context.json](m5-outfit-preview-context.json)文件全文，作为该文本字段的值 |
| size_advice | 留空 |

上述ID和资料从本地实际商品查询生成，不是虚构样例。文件本身是该商品JSON对象的文本，不需要另包一层product_context。只作预览输入，不能声称顾客实际在预览中浏览了网站商品；此处“这件”有对应输入资料。

问题：

> 我想买这件黑色真丝衬衫，再配一条极简风裤子，两件总预算800元，不要鞋。

预期requirements：intent=outfit、category=bottoms、requestedCategories=[bottoms]、styleTags含极简、budgetCents=80000、budgetScope=total、includeCurrentProduct=true、anchorProductId等于真实衬衫ID、otherRequirements含不要鞋，无重复主体选择/预算文字。HTTP scope=catalog_anchored_outfit、status=over_budget、products=[]；budgetAssessment为45900+35900=81800，overByCents=1800。回复说明818元、超18元，只协商一个条件，无商品标记。

通过后同会话只说“那两件总预算改成900元。”：应保留主体与其他条件，matched_known_constraints，products只有359元裤子，outfits合计81800、余额8200，标记仅裤子真实ID。

本阶段先完成这两轮，不同时扩大到任意商品名称选主体、上下装都未选定、整套穷举、其他品类或未确认审美关系。页面端最终从[黑色真丝衬衫详情页](http://localhost:3000/products/black-silk-shirt)的导购入口进入，自动带真实上下文；网站使用已发布配置，须等新版预览通过后再发布联调。

## 回归边界

单品400/300预算、缺品类、无匹配、样例原15项均继续保留。已拥有主体时只计新下装；没有预算不当成0；主体缺失/页面不一致/总价包含关系未知先澄清；主体要购买但售罄不推荐，未核实额外条件不丢弃。

顾客没有提出通勤时不擅自添加需求；若明确通勤，提取为otherRequirements的“通勤”，结合已确认规则和候选场合资料核对。不由其他未识别自由文字推断符合条件。
