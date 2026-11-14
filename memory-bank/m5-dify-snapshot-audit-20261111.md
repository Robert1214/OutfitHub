# Dify 实际草稿备份核对

日期：2026-11-11。用户已导出并保存DSL，本轮只读核对原文件，完成指纹和本地源文件快照，没有导入、发布或修改Dify。

## 已保存

- 原始DSL：`.local/dify-snapshots/wardrobe-sample-baseline-20261110.yml`，40302字节，DSL版本0.7.0，应用类型advanced-chat。
- SHA-256：`93db4c5852a57585e2b92a213b3e468120de524af82dfba9038c2a3578b316f0`。备份检查后原文件内容未改变。
- manifest：`.local/dify-snapshots/sample-baseline-20261110.manifest.json`，状态更新为export_received_and_reviewed，关联本地audit.json。
- 本地源码快照：`.local/dify-snapshots/sample-baseline-20261110-local/`，保留6份原始文件：样例工具、可复制解析代码、自动测试、样例数据、提取提示词、Chatflow说明。六项指纹均与前一天manifest一致，已保存实际内容，不仅是哈希。
- 原始DSL有HTTP鉴权值，仅保留在Git排除目录；未输出凭证、不生成含凭证的可提交副本。该目录的备份属于本机文件，未声称已异地备份或Git提交。

## 核对结果

| 项目 | 实际导出内容 | 结论 |
| --- | --- | --- |
| 图结构 | 12节点、11连接；商品分支为分类器→参数提取→代码执行→HTTP→回答→直接回复 | 主要链路正确，原政策/尺码/转人工分支仍在 |
| 开始输入 | product_context、size_advice、product_id均可选 | 无强制假商品ID |
| 代码执行 | 输入来自参数提取.text，输出q/category/styleTags/requirements四个字符串 | 去掉注释与行首尾空白后，与本地脚本一致 |
| 导出代码实测 | 5组有效输入原样保留，5组无效输入拒绝 | 直接执行导出的代码，不只检查文本；未调用模型 |
| 样例HTTP | GET /api/assistant/sample-products，requirements=代码执行.requirements，anchorSampleId=S01 | 当前样例关键绑定正确 |
| 回答SYSTEM | 有顾客表达、五种样例状态、产品来源规则 | 最新两次修复已在导出中，product_context确有变量引用 |
| 记忆配置 | 提取节点有memory配置，窗口enabled=true、size=10；回答节点有memory配置，窗口enabled=false、size=10 | 后者是窗口限制关闭，不据此误称记忆关闭 |
| 结构化输出 | 提取节点structured_output_enabled=false | 与普通JSON文本+代码校验方案一致 |

## 发现的实际差异

1. HTTP还保留q、limit、contextProductId、category、styleTags五个旧参数；其中q=参数提取.text，仍是整段JSON。当前样例路由不读取这五项，所以不因此否定已通过的样例测试；正式商品接口会读取q，迁移时不能只换URL。
2. 提取SYSTEM与本地完整版本的实质差异仅在第7条：导出仍为简短budgetScope定义，未包含“一次列出多件商品并给统一预算→total”的后来补充。这不证明每次都会错，但不能声称本地预算规则已全部同步到Dify。
3. 提取USER只引用sys.query，没有product_context。提示词说“根据当前商品资料”不代表节点实际接到了该变量；进入真实商品页场景前需要接入。
4. 商品回答USER末尾只有“已提取的顾客需求：”标题，后面没有requirements变量；HTTP body本身带requirements，因此当前样例仍可读取。正式工具改接时应明确该绑定。
5. 商品回答USER的HTTP body引用前多一个左花括号；有效变量引用仍存在，额外字符属于文本清理项，不认定为已导致解析失败。

这些是原始导出的真实状态，原文件保留不改，不将理想配置写回后再冒称是曾经跑过的版本。用户确认的回复证据继续保留；DSL检查不代表所有历史题在该版本完整重跑。

## 下一块处理顺序

基线保存完成。进入正式商品查询接入时，一次性配套接口与Dify变量映射：先用现有库商品验证独立单品的品类、风格、预算和真实ID，保留旧查询兼容；再迁移主体选择、组合预算与店主明确禁配。不要让用户现在反复手动清理参数、随后又改一遍。

下一块涉及的Dify改动应使用这份实际导出作参照，并同时补第7条、product_context与requirements绑定；不重建Chatflow。生成可审阅改动后再让用户应用，保留原始配置作为回退点。
