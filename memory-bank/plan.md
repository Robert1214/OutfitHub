# 实施计划 — outfitexpert-shop

> **依据**：`memory-bank/prd.md` v0.8
> **阻断：全量回归无法进行——DeepSeek 账户余额不足（402）（2026-11-14）**：17 轮中 12 个首轮全部 application_stream_error/空回答；assistant_logs 显示 DeepSeek 返回 402 Insufficient Balance。R2 修复后最后一次成功调用在 07:2x，余额在此之前耗尽。合并比较节点后每轮 LLM 调用增多、单轮耗时升到 19~78 秒，更耗额度。需用户充值后重跑：node scripts/eval-current-scope.mjs --run --snapshot=.local/dify-snapshots/catalog-outfit-v1-20261114-local（新基线已建好，含 v1 DSL 与当前代码指纹）。本次空跑记录不得当作回归结果。
> **当前：R2 已修（场合词走 occasionTags）（2026-11-14）**：用户定夺 Q1 改场合、Q2 暂不补、Q3 观察。「400元以内极简风格裤子」修复前 6/6 未找到，修复后 17/17 返回 359 元；tool 直测「极简+通勤」由 no_match 变 matched。tsc/eslint/build、单测 36/36 通过。未改 Dify 配置（Dify 仍读同一接口）。剩余：单品段缺少 matched/over_budget 说明（未复现影响，待观察）；回答杂音观察中；全量回归待跑。详见 m5-fix-pm013-pm014-20261114.md。
> **当前：D1 已定位为我方 anonId 问题，回归实为通过（2026-11-14）**：Dify 无故障（重启/重建均无关）。续轮失败根因：/api/chat 每轮生成新 Dify user，旧 conversationId 属于新 user → 404。固定 anonId 真实三轮复测全过：预算追问 → 总预算 818 超 18 协商；T1（续轮失忆）与 R2（400 极简无匹配）均未复现，已排除；温度 0.2 未损伤能力。仍待：P2 单件预算口径仍报 818（确认，待修）；会话过期应友好提示。详见 m5-regression-20261114.md。
> **历史：温度0.2+预算规则首轮回归（2026-11-14，结论已更正）**：当日 7 次调用中 T1/R2 判断被后续复测推翻，PM-012 关闭；PM-013（P2）保留。
> **历史：两项观察用户已定夺（2026-11-14）**：用户已浏览器复测测试③（商品信息正常）；已授权并完成提取节点温度 0.7→0.2 调整；预算解读选择「总预算口径」，Prompt 修改已应用并导出 20261114.yml。已存档提交 ae007a7。
> **历史：网站端到端测试③已定位并验证通过（2026-11-13）**：测试③初报失败，全程排查确认后端链路健康（Dify收到完整product_context、提取正确输出outfit+anchor、HTTP参数正确——用户日志确认）；早期失败为提取模型波动（温度0.7，2次search）+AI探针漏传product_id触发contextProductId校验假阳性。真实场景重跑4次全部outfit通过（页面衬衫识别、359元裤子真实ID、预算口径透明）。诊断记录m5-e2e-test3-diagnosis-20261113.md。两项观察待用户判断：①提取节点温度0.7→0.2建议（降波动，需授权改配置+发布+回归）；②预算解读漂移（今天3/3判"只买裤子"359余441，与M5已确认的818超18协商不一致）。待办：用户浏览器复测③、观察项定夺、casebook、交付报告。未commit。
> **当前：比较能力已发布，进入网站端到端（2026-11-13）**：用户已发布Dify，DSL快照.local/dify-snapshots/20261113.yml，核对与验证配置一致（生产口径句在位、旧测试口径/测试资料标记为0、引用完整）。下一步网站端到端三题：/assistant比较题、单品卡片题、黑色真丝衬衫商品页搭配题；通过后补casebook并出报告。未commit。
> **当前：比较接入全部验证完成，待用户授权发布（2026-11-13）**：CF01/02/03整链预览全过；回归抽查两题完全符合预期（单品matched_known_constraints带真实ID标记、搭配无页面主体needs_clarification），老链路无回归。全部验证：本地tsc/eslint/5新测试/31现有测试/build、Dify预览三题、回归两题。下一步：用户授权并在Dify点击发布→网站端到端（比较题/单品卡片题/商品页搭配题）→建议导出新DSL快照至.local/dify-snapshots/→报告。发布需用户明确授权；未发布、未commit。
> **当前：比较三题整链预览全部通过，进入回归抽查（2026-11-13）**：CF02/CF03整链首轮通过；CF01空历史首轮intent=search（题目缺"两套方案"上下文，已定位为评测设计问题，首轮保留），带上下文前缀重跑通过（intent=comparison、scope=internal_style_comparison）。观察项待用户定夺（不阻塞）：CF01结尾倾向后追加追问、CF02结尾"内部比较"内部口径、CF03/CF01主动报小计并声明非总价。下一步回归抽查两题（单品400元极简裤子/搭配题无页面主体应needs_clarification），通过后用户授权发布→网站端到端。未发布、未commit。
> **当前：比较接入Dify三处编辑完成，进入草稿预览（2026-11-13）**：代码执行节点已换新版脚本、提取SYSTEM已加comparison定义与第13条字段规则、回答节点比较规则段重加并应用生产口径句（恢复临时内联时该段曾被误删，发布版本未受影响，已记录m5-comparison-node-test.md）；HTTP节点异常处理为"无"，保留不改（方案§7待确认项1已关闭）。本地3000已带新代码运行。下一步Dify草稿预览：CF01/02/03整链（每题新对话空历史）+ 回归抽查原单品题与搭配题各一题，按brief验收表核对，回传原文；发布需用户授权。未发布、未commit。
> **当前：比较接入代码完成并本地验证通过（2026-11-13）**：intent枚举（assistant-requirements.ts:8与dify-parse-requirements.js:33）已加comparison；新增src/lib/assistant-comparisons.ts（店主认可通勤比较组v1，与单节点验证fixture同形，provenance=owner_reviewed_comparison_catalog，无商品ID/购买链接）；products路由comparison分支直接返回该资料不查库（route.ts:608-615）。本地验证全过：tsc、eslint（0错误）、新增5项测试（scripts/test-assistant-comparisons.ts，含非法requirements fail-closed 400）、现有31项助手测试、build。下一步用户在Dify改三处：代码执行节点全文替换为更新脚本、提取SYSTEM插入comparison定义与第13条字段规则、回答节点"内部测试输入"改"店主审核的内部比较方案"；并确认HTTP节点异常处理配置；然后草稿预览CF01-03整链+回归抽查2题，发布需用户授权。未发布、未commit。
> **当前：比较接入方案成稿，待用户评审（2026-11-13）**：用户已按恢复清单还原节点临时内联。AI核对代码与契约，定位五个缺口（意图枚举/提取提示词/工具路由/比较资料宿主/回答规则段测试口径），成稿m5-comparison-integration-plan.md：intent加comparison、新增assistant-comparisons.ts存放店主认可比较组、route加comparison返回与单节点验证同形的body、Dify改三处（代码执行脚本/提取SYSTEM/回答一句口径）。待用户评审确认后先实施代码并本地验证，Dify步骤另给。未改代码，发布版本未动。
> **当前owned-v2完整回归收尾（2026-11-12）**：用户已发布并保存新版DSL；核对仅提取Prompt一处变化、其他节点/连线未变，另存独立v2基线。现有3000网站API完整运行12会话17轮，17/17实际服务器graph主要配置与导出一致，代码与13件商品前后未变。结构化/传递/技术/标记均17/17，有解任务7/7、边界核心5/5、实际带卡片8/8数据一致，原H03恢复。报告m5-current-scope-report-20261112-v2.md；旧版失败和成绩保留，未新增盲测或重复稳定性证明。PM-010本轮回归通过，PM-011原裙装错误未关闭；边界回复的不可执行下一步及首段中位8.340秒仍待改善。下一块先明确资料未核实时的可执行动作标准，再改回答规则，之后做延迟对照。不继续追加已通过预算题，不自动改Dify/发布/commit。
> **当前局部功能对照收尾（2026-11-12用户确认）**：用户确认一起购买900元字段/回复与预期一致（90000/total/true、matched、818元余82元），见m5-owned-anchor-retest-20261112-04.md。原H03、防水保护、撤销防水恢复及相反购买关系的局部对照完成；PM-011品类称呼及表达问题保留，不宣称整体完全通过。下一步用户发布当前修订（如已发布不重复）并导出.local/dify-snapshots/wardrobe-catalog-outfit-20261112.owned-v2.yml；AI核对实际配置、另存v2基线再自动跑同版12会话17轮，旧首轮失败与成绩保留。新版本发布/导出未确认，尚未运行新全量回归，不自动发布或commit。
> **当前撤销防水恢复推荐核心通过（2026-11-12）**：用户补贴最终回复，正确推荐黑色高腰阔腿裤359元、单件400元余41元，已有衬衫未重复收费，无多余追问或裙装称呼；与已回传requirements/status一致，见m5-owned-anchor-retest-20261112-03.md。商品标记未回贴，不扩大为卡片验收；合身度结尾说明略冗余，原PM-011保留。下一步新开预览、同一真实衬衫上下文，验证两件一起买900元应total/true、818元余82元。未改Prompt/代码，修订版发布及全量回归仍待确认。
> **当前撤销防水续轮字段通过（2026-11-12）**：用户回传完整requirements，防水移除，outfit/bottoms/极简、40000/item/false、原衬衫主体及不要鞋保持，status=matched_known_constraints。见m5-owned-anchor-retest-20261112-03.md。最终回复和完整候选/金额未提供，不将整轮记通过；当前只需补贴已有最终回复，不重跑。前轮裙装称呼错误PM-011保留，之后仍测一起购买900元；未改Prompt/代码或确认新版发布。
> **当前防水对照（2026-11-12）**：用户提供includeCurrentProduct=false、其他要求不要鞋/必须防水、unresolvedRequirements仅防水、needs_verification，真实额外要求保护通过；回复却称裙装，已记PM-011，尚未取得同轮category/q及完整HTTP，不宣称仅是错字或整轮完全通过。证据m5-owned-anchor-retest-20261112-02.md。下一步现有会话发送“先不要求防水了，其他条件不变”，验证只删除防水并恢复359元裤子/余41元，覆盖原定已有主体400元对照，之后测一起买900。未进一步改Prompt/代码或确认新版发布。
> **当前设计解释与补证（2026-11-12）**：用户要求解释H03的因果判断、其他要求字段价值、回归风险及Prompt替代方案。已复核原日志和工具代码，确认是代码将未识别的重复说明列入待核实；追加7组直接HTTP边界对照全部符合预期，保留防水/通勤/未知预算关系/一起购买/冲突等行为，记录m5-owned-anchor-design-review-20261112.md。这些是下游工具验证，未调用新Prompt，不计模型成功率。未进一步改Prompt/代码；新Prompt其余自然语言对照、同版全量复验及稳定性仍待做。
> **当前H03修订首条通过（2026-11-12用户确认）**：用户在最小提取Prompt修订后报告完全符合预期；按已明确验收项记H03预览通过，未补造原始日志，见m5-owned-anchor-retest-20261112-01.md。首轮失败和6/7成绩保留；修订版发布、已有上衣400/一起买900/必须防水对照及17轮全量复验仍待确认。当前用户询问错误原理，先解释重复条件怎样触发保守核验，不继续要求重跑已确认单题。
> **当前评估首轮已完成（2026-11-12整理）**：用户已保存真实DSL并确认搭配配置发布。12节点11边与17轮实际服务器执行graph主要配置一致，13件商品前后未变。从现有3000网站API完成12会话17轮，技术17/17、结构化预期16/17、有解任务6/7、边界核心5/5；H03已拥有主体重复进入otherRequirements而被待核实阻断，单变量工具对照已定位。首段文字中位数8.978秒；实际费用未知。报告m5-current-scope-report-20261112.md，复盘PM-010。已准备只追加提取第8条的候选m5-outfit-extraction-system-v2-owned.txt及m5-owned-anchor-fix-20261112.md，尚未应用/发布/重测；下一步只让用户替换提取SYSTEM并在新预览重测H03，保留原失败，后续同版完整回归。业务代码和冻结原Prompt未改，不声称整个导购完成。
> **当前搭配开发收尾与评估准备（2026-11-11）**：用户确认900元续轮完全符合预期，和800元首轮组成开发用例通过，见m5-catalog-outfit-run-20261111-03.md；不补造原始字段/回复。按约定暂停扩功能，已准备12会话17轮当前范围评估草案及方案决策事实底稿，分别见m5-current-scope-evaluation.md/m5-current-scope-eval.json、m5-solution-decision-record.md。未运行新评估、未定上线百分比、未改Prompt或模型。下一项用户动作是导出刚通过的实际Dify配置至.local/dify-snapshots/wardrobe-catalog-outfit-20261111.evaluation.yml，再核对版本；搭配发布仍未知，不能用旧已发布单品版本给新搭配打分。
> **当前搭配首轮通过（2026-11-11）**：用户确认800元HTTP符合预期，完整回复459+359=818、超18元，限定已核对范围且只协商预算、无商品标记，见m5-catalog-outfit-run-20261111-02.md。下一步原预览会话仅改900元，验证主体/条件保持、818元余82元及仅候选裤子ID；完成此既定两轮后暂停扩功能，优先做冻结版本评估和方案决策记录。新DSL导出/搭配发布未确认，不把单例通过当整体效果。未改业务代码或提示词。
> **当前下一块已实现（2026-11-11）**：用户确认网站回复正常并接受单品小块收尾，明确认可黑色真丝衬衫459元＋黑色高腰阔腿裤359元为极简通勤正例。已实现同接口限定主体搭配，新增anchorProductId并与页面核对、具体店主规则及实时组合预算；31项测试、tsc/eslint/build和3000 HTTP均通过，800元超18元/900元余82元，单品回归正常。操作见m5-catalog-outfit-setup.md：先保存当前实际发布DSL（10份本地源码已快照），更新原提取SYSTEM/代码执行/回答追加段，HTTP及连接不改，用已准备真实预览上下文先测800元。Dify新配置未应用或发布，页面视觉点击未单独回贴；无数据库写入或新commit。收尾与新实现见运行08及m5-catalog-outfit-run-20261111-01.md。
> **当前预览收尾及页面联调（2026-11-11）**：用户确认无匹配题通过并已发布配置，本小块核心预览检查收尾，见运行06。实际网站/api/chat三轮已通过：400元推荐与359元真实卡片数据一致、同会话300元超59元无标记、新会话摇滚裤子无匹配无标记，记录运行07/JSON。浏览器内置页连接超时，读取现有Edge活动飞书页被自动审批拒绝；已请用户切到本地/assistant后检查视觉及点击。最新实际发布DSL尚未导出，不声称配置备份或页面验收已完成。未修改代码或再次发布。
> **当前未知品类通过与下一题（2026-11-11）**：用户确认新会话400元衣服题字段/回复全符合预期，按用户确认通过，不补造原始日志，见m5-catalog-run-20261111-05.md。下一条沿该澄清会话回复“想找摇滚风的裤子，不要鞋”，验证补齐品类、保留预算并如实表达无匹配。本地3000已返回200/no_match_for_query/空products，Dify待测；通过后收尾既定预览对照，保存实际配置并安排项目页面验收。未改业务代码或Dify。
> **当前真实单品续轮通过（2026-11-11）**：用户回传40000/item、search/bottoms/极简/不要鞋保持，工具matched_known_constraints及真实ID；回复359元、低于预算41元，PRODUCTS与工具一致，无重复澄清，本轮通过，见m5-catalog-run-20261111-04.md。完整products及原query未回贴，不冒称全链路日志/页面卡片通过。用户正在询问测试目的，先解释多轮条件更新/保持与状态恢复；后续仍为未知品类和无匹配对照，不重复本题。
> **当前下一条验收（2026-11-11）**：按真实单品小块既定顺序，沿用极简裤子会话发送“那单件预算改回400元”，验证更新预算且保留品类/风格/不要鞋、恢复匹配及真实ID。此题待用户运行，具体核对字段已补入m5-catalog-single-item-setup.md；不重跑用户已确认的两题，也不补造其原始内容。无代码或Dify配置变更。
> **当前真实单品重测（2026-11-11）**：用户只将limit改为4后确认两题通过，结合旧DSL的5、本地单变量复现及接口1至4范围，PM-009配置问题关闭。两题原文/HTTP/回复未回贴，按用户确认记录，不扩大为全部评测或正式发布/UI通过；见m5-catalog-run-20261111-03.md。此前“阻断/待测”条目保留为历史。
> **当前真实单品首测阻断（2026-11-11）**：用户更正为HTTP 400，body定位外层查询参数校验，尚未进入需求JSON解析和商品查询。本地三参数/limit=4返回200和359元裤子；旧limit=5、额外q或重复requirements均复现同错误，实际违规项未知。下一步仅核对HTTP Params并重测原400元题，不改Prompt或重启；Dify未通过，见m5-catalog-run-20261111-02.md及PM-009。
> **当前真实单品接入（2026-11-11）**：已完成requirements新分支、共用校验、真实库存/品类/风格/关键词/单件预算核对；旧查询兼容，未支持任务及未核实额外条件明确返回空推荐。移除代理无条件补卡，真实ID可取一致卡片数据。样例15项和真实库8项回归通过，类型/lint/build及3000 HTTP通过，见m5-catalog-run-20261111-01.md。原DSL保留，三个节点改动草稿及精确操作见m5-catalog-single-item-setup.md。下一步用户应用草稿后只测400元极简裤子题，尚未改实际Dify/发布/数据库，不声称模型或项目UI端到端通过。
> **当前基线已保存（2026-11-11）**：收到实际DSL并核对12节点/11连接，导出解析代码与本地逻辑一致、5组有效/5组无效实测通过，最新文案/来源规则及样例requirements绑定存在。已保存原文件SHA-256、manifest和6份匹配指纹的本地源文件快照，原始含鉴权配置仅存Git忽略目录。差异：HTTP残留5个旧参数且q仍为LLM.text；提取第7条为旧版且无product_context绑定；回答需求标题未绑定变量、body前多花括号。当前样例读取body可用，不推翻用户验收；下一块接正式查询时一起同步，不能只换URL。详见m5-dify-snapshot-audit-20261111.md；未改Dify、正式接口、数据库或发布状态。
> **当前收尾与下一步（2026-11-10，运行15）**：用户确认未知品类和页面来源两条回复均正确，PM-007关闭；样例开发小块收尾，不再重复调这两题。已检查原商品接口和卡片链路，卡片基础已存在，完整requirements/约束尚未接入正式查询。当前小任务是导出实际Dify草稿DSL至`.local/dify-snapshots/`并核对配置，目录排除Git，代码指纹已准备；DSL尚未取得。操作与证据表见 `m5-sample-baseline.md`，不将此描述为全49条评测或所有用例在最终DSL重放通过。备份后进入正式商品查询接入，未改正式接口/数据库/发布状态。
> **当前修复（2026-11-10，运行14）**：用户新会话提取search/空品类/50000/item正确，product_context为空，但回答称正在浏览S01并伪称读取页面。原代码用固定S01无条件填currentProduct，本地用用户原样需求复现。已修复未知品类提前澄清不带主体/候选，独立搜索不带固定主体或错误排除S01；明确outfit保留计算并标记internal_sample_anchor来源。15项测试、tsc/eslint/build和现有3000 HTTP验证通过，500/600金额路径未破坏。下一步用户只替换回答一段来源规则（§12.14），新会话核对最终文字；不再要求寻找已丢失旧日志。Dify结果尚待确认，本块暂不收尾；无新端口、commit或发布。
> **当前结论（2026-11-10，运行13）**：用户确认“这次回答没有多余的了”，成功回复文案问题关闭，未重贴回复或HTTP，不扩大为所有状态重新验收。此前主体选择、500元超预算、600元条件保持均已有证据。当前小块只剩原计划的未知品类对照：新预览会话发送“我想买件衣服，预算500元。”，检查空category/空requestedCategories、needs_clarification和一个必要品类问题，不擅自套入S01。通过后结束本块，先保存实际Dify配置，再推进正式商品查询/数据与卡片接入；后文“文案待测”保留为历史。
> **当前提示词核对（2026-11-10）**：用户贴出的SYSTEM没有顾客表达段，只有needs_selection而缺其他样例状态正文。操作已改为两个明确插入点：ID规则之后/肤色标题之前加表达段；needs_selection之前补样例事实来源、状态与ID判断，见 `m5-dify-chatflow.md` §12.12–12.13。此次为配置补证，未新建运行记录，未操作Dify或改服务。应用后复核600元最终表达，未知品类对照仍待测。
> **当前进度（2026-11-10，运行12）**：新增品类列表流程的600元续轮，用户确认requirements/status/products正确，实际回复556元/余44元，预算修改及条件保持通过。成功回复仍附落选西裤、样例编号和无商品ID说明，用户要求收敛；已更新 `m5-dify-chatflow.md` §12.12 局部替换段，待用户应用并复核一次成功回复。此后继续真正未知品类对照；不再重复验证已通过的金额链路。仅改文档，未改Dify或业务代码。下方各“最新”条目按历史保留，不代表当前仍待600元测试。
> **最新选定主体续轮（2026-11-10）**：用户回传requestedCategories=[bottoms]、outfit/bottoms、50000/total/true、摇滚及不要鞋；HTTP over_budget，回复确认188元上衣，说明556元/超56元并仅询问是否提高预算，当前步骤通过，见运行11。未把“就选这件”当加预算授权。下一步原会话只改600元，核对新列表及其余条件保持；再做未知品类对照。无配置/代码变更，本次仅保存证据。
> **最新配置恢复（2026-11-10）**：用户确认新版代码未复制、HTTP的requirements/anchorSampleId缺失；恢复后回复正确询问是否选用188元T恤作为主体，本轮选款行为通过，见运行10及PM-004/005补证。完整HTTP未重贴，旧products=[]运行的URL仍未知，不把所有历史失败归为模型或同一原因。下一步不改配置、不新开会话，回复“就选这件”，核对requestedCategories=[bottoms]、500元及不要鞋保留，并正确协商超56元。
> **最新代码执行阻断（2026-11-10）**：重试报未知字段；用户提供实际输入为原九字段加requestedCategories，本地新版脚本原样通过，运行代码需同步。新脚本报错会列未知字段名，13项测试通过。该输入另将统一预算提为unknown，已补提取第7条的多件统一预算语义，脚本仍不改写unknown。Dify实际脚本/更新后结果尚未取得，运行09/PM-005保存；下游HTTP本轮未执行，原URL问题仍待代码恢复后核对。
> **最新新分支首测（2026-11-10）**：用户报告HTTP仅products=[]，回复无商品资料并重复询问条件；缺少样例scope/requirements/status，不能判为新分支无匹配。直接检查3000：sample-products返回needs_selection完整结构，原products接口同词返回仅products=[]。首要假设是请求原商品接口，尚待同次GET地址/Params确认；记录运行08/PM-004。未改代码或Prompt，先修正/确认链路再验收多品类。
> **当前下一块（2026-11-10）**：按用户“做下一步”继续处理多品类待选。样例接口新增可选requestedCategories，以needs_selection区别于缺信息；currentProduct为空，selection.anchorCandidate仅候选、anchorConfirmed=false，避免固定S01被当作已选。确认主体后仍走原500/600预算逻辑。13项测试、tsc、eslint、build及3000直接HTTP序列通过；Dify尚未应用/验收。用户下一步按 `m5-multi-category-setup.md` 更新原代码执行脚本、提取SYSTEM及回答的新状态说明，HTTP/节点拓扑不变；先测原自然问法。通用组合搜索仍未实现，无新commit或发布。
> **最新话术裁定（2026-11-10）**：用户提供600元回复（556元/余44元）并明确：若“不包含鞋”有顾客条件依据则正常。原话及运行06的otherRequirements均有“不要鞋”，本条表达可接受，运行07已保存，PM-002及话术草稿按新标准更新。此前一律要求删除条件复述的AI判断过严，不再为删该句继续调Prompt；其他内部术语和无依据限制仍需检查。指定主体预算样例已获通过证据，通用上下装搜索等边界未变；本轮只更新文档，未改Dify或业务代码。
> **最新600元续轮（2026-11-10）**：用户回传requirements=60000/total/true、outfit/bottoms/摇滚，保留188元上衣及不要鞋；工具matched_known_constraints、products片段含S03，最终回复556元/余额44元且无重复追问，S-E03核心行为通过，见运行06。实际前序包含确认主体的中间轮，未提供会话ID或完整products，不声称固定两轮完整日志通过。成功回复仍复述“只配裤子，不含鞋”并主动说明排除西裤，下一步按 `m5-dify-chatflow.md` §12.12 集中优化话术；通用上下装搜索未覆盖。下列待测项保留为历史状态。
> **最新自然表达变体（2026-11-10）**：同轮HTTP已确认search、空category触发两条澄清，预算50000/total/true没有触发包含关系缺失。用户随后确认明确选择188元上衣后的处理正确，未重贴续轮日志；记录见运行05/PM-003。样例工具未覆盖同时挑上下装，不能把澄清后恢复当作原始两类搜索已支持。当前解释三种问法中主体选择与搭配关系的差别；下一步仍为同会话600元续轮，尚未验证。未改配置或接口。
> **最新500元重测（2026-11-10）**：用户确认提取/HTTP关键字段符合预期（includeCurrentProduct=true、over_budget、products=[]），提交的首条回复直接说明556元/超56元，仅询问是否调整到556元；S-E02超预算处理通过，文案“店主也确认”待改。字段依据用户确认，未重贴完整日志；证据见 `m5-sample-run-20261110-04.md`，PM-002补充字段教学。顾客尚未接受加预算，任务仍在协商；下一步保留同会话续答600元，S-E03未运行。下方待查/待测记录为此前状态。
> **首轮补证定位（2026-11-10）**：用户补齐第一轮 HTTP 的 needs_clarification/“总预算是否包含搭配主体”，并确认第一轮参数提取为50000/total/includeCurrentProduct=null/missingInformation=[]。已定位明确预算包含关系被提取为未知，工具据此澄清；不是已知首轮 over_budget 被忽略。已修订 `m5-dify-chatflow.md` §12.1 第8条并追加 PM-002/运行03证据，待用户在Dify替换后新会话重测500元，再继续600元。未改接口或商品数据，未确认新规则生效。下列取证记录为历史状态。
> **最新500元实测（2026-11-10）**：S-E02 首轮重复确认顾客已明确的“两件合计500元”；用户回答“对的”后，第二轮正确说明556元/超56元并询问是否调整到556元。用户明确所贴 over_budget/products=[] 属于第二轮，首轮 HTTP 未取得，不能据此断言首轮提取正确。两轮各问一个问题，失败点是首轮无必要确认；整条S-E02未通过。证据见 `m5-sample-run-20261110-03.md`，复盘 PM-002 已保存。下一步取首轮预算字段/状态并核对同轮节点输入，再决定修复位置；600元续轮未运行。
> **复盘保存约定（2026-11-10）**：用户要求本次及后续类似问题持续整理保存。已建立 `ai-pm-casebook.md`，PM-001 记录从顾客要求、HTTP body 到最终回复的判断、受控对照、规则修订、失败与重测证据及适用边界；持续记录要求写入 `CLAUDE.md` §2.7，Ownership 文档新增入口。当前业务下一步仍为另开会话 B 测 500 元，再同会话续测 600 元。
> **最新重测（2026-11-10）**：用户回传 S-E01 重测结果：q=摇滚风裤子、category=bottoms、status=matched_known_constraints、products 仅 S03；最终选 S01+S03，556 元/余额 244，核心流程通过。原始回复与 HTTP 关键字段见 `m5-sample-run-20261110-02.md`，首次失败保留。回复仍暴露 S01–S03 内部编号并出现“基础款硬凑”的无必要比较，文案待改。下一步保持配置，另开会话 B 测 500 元，再于同一 B 会话续答 600 元；S-E02/S-E03 尚未运行。下列记录为历史状态。
> **最新实测（2026-11-10）**：用户回传 S-E01 的最终回复与 HTTP body，选款 S01+S03、总价 556/余额 244 正确，但 requirements.category 为空，工具返回 needs_clarification 与空 products，回答仍从 evaluations 作成功推荐，集成未通过。原文保存在 `m5-sample-run-20261110-01.md`。直接 HTTP 对照确认只补 category=bottoms 即返回 matched_known_constraints 与 S03。已修订文档中的候选品类定义及工具状态处理说明，待用户在 Dify 草稿修改后同题重测；S-E02/S-E03 仍未运行。下文“当前工作”为此前准备状态。
> **上次收尾（2026-11-10）**：按用户要求将全部工作本地提交为 `57ebea6`，未 push。用户指出“只推荐这条裤子，不附带鞋履”属于面向顾客的冗余表达，已起草自然回复规则，尚未确认写入 Dify。Dify 配置未导出 DSL，本仓库保存配置步骤、已知修改和测试记录，不能将 Git 提交视为 Dify 配置备份。
> **当前工作（2026-11-10）**：用户明确选择复用 3000。确认该端口是本项目 `next start` 后，已切换为 `next dev --port 3000`，未启动 3001。样例接口直接 HTTP 检查通过：800/600 元选 S03、总价 556 元；500 元超出 56 元；S02 不适配；鉴权与无效输入返回 401/400。原商品查询仍返回极简裤子 ¥359。此前 8 项本地测试、tsc、eslint、build 全部通过。下一步由用户按 `m5-sample-tool-setup.md` 修改现有 Dify 草稿的 HTTP 地址、两个参数和临时回答说明，先运行 800 元用例，再以另一会话测试 500→600 元；三条 Dify 集成用例尚未运行。正式商品库与查询接口未改；M5 为主案例、M4 后置、不发布测试配置。下列按日期记录保留历史。
> **最新进展（2026-11-09，用户确认）**：用户已在现有商品「回答」节点完成本轮提示词局部修改，涵盖按指定品类推荐、组合总价、无匹配时协商条件与多轮要求保持；原排除重复推荐规则保留并补充当前商品计价说明。用户截图确认回答节点已引用用户问题与 HTTP body、记忆已开启。尚未确认发布，未运行验收；肤色规则本轮未变更。下一步检查「参数提取」节点提示词和记忆设置，再核对 HTTP 查询参数，确认完整需求能传到商品工具。
> **参数提取节点核对（2026-11-09，用户截图）**：模型为 `deepseek-v4-flash`；SYSTEM 要求只输出一个简短检索关键词、不输出 JSON；USER 引用当前 query，未显示当前商品资料引用；记忆、结构化输出、推理标签分离均关闭。该节点尚未表达独立的品类、风格和预算字段，多轮需求保留存在缺口；这不是一次运行失败的实测结论。已核对接口：普通搜索用显式参数过滤单件价格，不能把自然语言总预算直接等同于该价格字段，带当前商品的搭配分支另有过滤缺口。下一步指导用户开启该节点记忆，并取得现有 HTTP 查询参数映射，再给与接口匹配的局部修改；尚未确认开关修改、发布或测试结果。
> **HTTP 核对与下一步（2026-11-09）**：用户提供当前 URL 和 Params，确认仅有 q（参数提取.text）、limit=5、contextProductId（Start 商品变量，截图名称截断）。已准备 `m5-dify-chatflow.md` §12 与 `m5-query-extraction.schema.json`，用于在现有提取节点先验证完整需求输出；属于草稿，未修改接口代码或 Dify 配置。节点输出改为结构化后，必须配套改 HTTP 映射及接口预算/搭配过滤，不能把 JSON 直接传给 q，不发布中间配置。三件样例未入库、三个集成用例仍未执行。
> **模型能力纠正（2026-11-09，用户反馈）**：当前接入模型不支持结构化输出，撤回开启该开关及上传 Schema 的步骤。§12 已改为普通 text 生成 JSON 的完整提示词草稿，后续拟以代码解析/校验后再映射 HTTP；未配置代码节点、未修改接口。旧“不要 JSON”要求随原 SYSTEM 整体替换，不能与新规则并存。格式正确与需求理解正确需要分别验证。
> **历史运行阻塞（2026-11-09，用户截图）**：分类器曾返回 HTTP 402 `Insufficient Balance`；后续用户截图已有最终回复，本次已不受该错误阻断，具体凭证处理方式未知，不能推断所有节点额度。新回复拒绝推荐查到的鞋、说明缺少 T 恤资料，搭配任务尚未完成。原文及假设见 `m5-dify-chatflow.md` §12.4；下一步读取此次参数提取的 text，再核对 HTTP 实际 q/body，检查是否把 JSON 整体作为检索词。三件样例未接入商品工具，不能将本次预览当作正式 S-E02 验收。
> **提取输出已收到（2026-11-09）**：用户提供的 JSON 已提取搭配、下装、摇滚风、500 元总预算、包含当前商品及不要鞋，但漏了必需的 q。§12.5 保存原始 text，§12.6 提供解析校验代码草稿；未保存推理内容，未修改 Dify。下一步补齐 q 后单节点复验，再接解析节点及接口；“摇滚风”与库内标签的映射也需核对。不能将整段 JSON 传给 q，三条集成用例仍未验收。
> **规则**：每个里程碑结束必须能运行、能演示、能提交；未通过验收不得进入下一阶段。

---

## 1. 总体策略

1. **先闭环，再加 AI**：M0~M3 打通「商品 → 登录 → 购物车 → 下单 → 订单」，再接入 AI。
2. **M5 优先**：目标岗位是 AI 产品经理，导购助手是主案例；先做 M5，M4 试穿后置为第二 AI 案例。
3. **复用旧项目已验证代码**：MPS 试穿（`src/lib/tryon/`）、合身引擎（`src/lib/size-engine/`）直接参考/改造，不重新踩坑。
4. **外部依赖后置**：Neon/Vercel（M6）放到后期，避免早期被网络/账号卡住。
5. **每阶段先写验收清单，再写代码**；验收以 PRD 对应章节为准。
6. **不做超出 PRD 的功能**；有歧义先问。

---

## 2. 阶段依赖与顺序

```
M0 项目初始化 + DB + 商品模型
 └─ M1 商品浏览/搜索/详情
     ├─ M2 登录 + 个人中心
     └─ M3 购物车 + 下单 + Mock 支付 + 订单
         ├─ M5 Dify 导购助手（优先；AI PM 主案例）
         └─ M4 AI 试穿（M5 后执行；依赖 M2 照片 + M3 购物车）
             └─ M6 后台 + 看板 + 部署
```

- **M5 先于 M4**：求职方向是 AI PM，导购助手是主案例；M4 试穿作为第二 AI 案例。
- M2 与 M3 可部分并行，但建议按顺序做，减少联调成本。
- M6 的后台可在 M3 后提前做商品管理，但整体放最后。
- 每个阶段结束打一个 Git tag（可选）：`m0`、`m1`……

---

## 3. 技术栈与依赖包（计划）

| 类别 | 包 | 用途 | 安装阶段 |
| --- | --- | --- | --- |
| 框架 | `next@16`、`react@19`、`react-dom@19` | App Router 全栈 | M0 |
| 语言 | `typescript`、`@types/node`、`@types/react`、`@types/react-dom` | 类型 | M0 |
| 样式 | `tailwindcss@4`、`@tailwindcss/postcss` | 样式 | M0 |
| UI | `shadcn`（CLI，按需生成组件） | 按钮/表单/弹层 | M0 |
| 数据库 | `prisma`、`@prisma/client` | ORM | M0 |
| 登录 | `next-auth@beta`（Auth.js v5）、`bcryptjs`、`@types/bcryptjs` | 登录 | M0 |
| 校验 | `zod` | 输入校验 | M0 |
| 腾讯云 | `cos-nodejs-sdk-v5`、`tencentcloud-sdk-nodejs` | COS/MPS | M2/M4 |
| 工具 | `tsx`（dev） | seed / 导入脚本 | M0 |
| 部署 | Vercel、Neon | 上线 | M6 |

> 具体版本在 M0 安装时锁定到当时的最新稳定版，写进 `package.json`；不在此处猜版本号。

**不引入**：图表库（看板用数字卡片）、状态管理库（优先 Server Component + URL 参数）、UI 框架（除 shadcn）、ORM 之外的数据库工具。

---

## 4. 目录结构（计划）

```
outfitexpert-shop/
├── CLAUDE.md
├── START_HERE.md
├── memory-bank/
│   ├── prd.md
│   └── plan.md
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── import-products.ts
├── data/
│   └── products-template.csv
├── public/
│   └── products/           # 商品图 {slug}-1.jpg ~ -3.jpg
├── src/
│   ├── app/
│   │   ├── (shop)/
│   │   │   ├── page.tsx                 # 首页
│   │   │   ├── products/
│   │   │   │   ├── page.tsx             # 列表
│   │   │   │   └── [slug]/page.tsx      # 详情
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/
│   │   │   │   ├── page.tsx
│   │   │   │   └── success/page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── tryon/page.tsx
│   │   │   ├── assistant/page.tsx
│   │   │   ├── account/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── tryons/page.tsx
│   │   │   │   └── orders/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── terms/page.tsx
│   │   ├── admin/
│   │   │   ├── page.tsx                 # 看板
│   │   │   ├── products/page.tsx
│   │   │   └── orders/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── products/route.ts        # 列表/按 ids 查
│   │   │   ├── assistant/products/route.ts
│   │   │   ├── chat/route.ts            # Dify 代理
│   │   │   ├── orders/route.ts
│   │   │   ├── tryon/route.ts
│   │   │   └── tryon/[id]/route.ts      # 轮询
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                          # shadcn
│   │   ├── layout/                      # Header/Footer/DemoBadge
│   │   ├── product/ cart/ checkout/ orders/ tryon/ assistant/ admin/
│   ├── lib/
│   │   ├── db.ts                        # PrismaClient 单例
│   │   ├── auth.ts                      # Auth.js 配置
│   │   ├── cos.ts                       # 上传/签名/删除
│   │   ├── tryon/                       # 复用旧项目
│   │   ├── size-engine/                 # 复用旧项目
│   │   ├── validations/                 # zod schema
│   │   └── utils.ts
│   └── types/
├── .env.example
├── .env.local                           # 不入库
├── docker-compose.yml
└── README.md
```

---

## 5. 环境变量

| 变量 | 必填 | 用途 | 获取方式 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | Postgres 连接串 | M0 Docker：`postgresql://postgres:postgres@localhost:5432/outfitexpert`；部署用 Neon |
| `AUTH_SECRET` | 是 | Auth.js 签名 | `npx auth secret` |
| `AUTH_URL` | 是 | 站点 URL | 本地 `http://localhost:3000`；部署填 Vercel 域名 |
| `NEXT_PUBLIC_APP_URL` | 是 | 前端绝对地址 | 同上 |
| `TENCENT_SECRET_ID` | M2 | 腾讯云密钥 | 旧项目 `.env.local` |
| `TENCENT_SECRET_KEY` | M2 | 腾讯云密钥 | 同上 |
| `TENCENT_COS_BUCKET` | M2 | COS 桶 | 同上 |
| `TENCENT_COS_REGION` | M2 | COS 地域 | 默认 `ap-guangzhou` |
| `TENCENT_MPS_REGION` | M4 | MPS 地域 | 默认 `ap-guangzhou` |
| `DIFY_API_BASE_URL` | M5 | Dify API | 默认 `https://api.dify.ai/v1` |
| `DIFY_API_KEY` | M5 | Dify 应用 Key | Dify 后台 |
| `TRYON_DAILY_LIMIT` | 否 | 每日试穿次数 | 默认 5 |

> `.env.local` 不入库；`.env.example` 只写变量名和示例占位。

---

## 6. 数据模型落地

### 6.1 Prisma 模型顺序

1. `User`（Auth.js 字段 + 资料 + 身材 + `photoKey`）
2. `Category`、`Product`（含 `refType`、上装/下装尺寸）、`ProductImage`
3. `Cart`、`CartItem`
4. `Address`、`Order`、`OrderItem`
5. `TryonRecord`、`TryonRecordItem`
6. `ChatSession`、`ChatMessage`（M5 再启用）

### 6.2 Seed 数据

| 数据 | 数量 | 说明 |
| --- | --- | --- |
| 管理员 | 1 | `admin@outfitexpert.demo` / `Admin123456` |
| 测试用户 | 1 | `demo@outfitexpert.demo` / `Demo123456` |
| 分类 | 6 | 上装 / 下装 / 连衣裙 / 外套 / 配饰 / 鞋履 |
| 商品 | 13 | 含 `refType`（GARMENT / ACCESSORIES / SHOES）、3 图；上装/连衣裙/外套含胸围/衣长/版型，下装含腰围/臀围/裤长/版型；12 件在售 + 1 件 `SOLD` |
| 占位图 | 39 | `public/products/`，先用纯色/文字占位，后替换真图 |

### 6.3 商品 CSV 导入模板

文件：`data/products-template.csv`

| 列 | 必填 | 说明 |
| --- | --- | --- |
| `slug` | 是 | 唯一，URL 用；小写英文/数字/- |
| `name` | 是 | 商品名 |
| `ref_type` | 是 | `GARMENT` / `ACCESSORIES` / `SHOES` |
| `description` | 是 | 描述 |
| `price_yuan` | 是 | 元，导入时转分 |
| `category` | 是 | 分类名，不存在则创建 |
| `color` | 是 | 颜色 |
| `size_label` | 否 | 如「均码」「M」 |
| `material` | 是 | 材质 |
| `care` | 是 | 护理 |
| `tags` | 否 | 逗号分隔 |
| `fit_type` | 否* | `SLIM` / `REGULAR` / `LOOSE`；`ref_type=GARMENT` 时必填 |
| `chest_cm` | 否* | 成衣胸围（平铺×2）；上装/连衣裙/外套必填 |
| `length_cm` | 否* | 衣长；上装/连衣裙/外套必填 |
| `shoulder_cm` | 否 | 肩宽（上装/连衣裙/外套可选） |
| `waist_cm` | 否* | 成衣腰围（平铺×2）；下装必填 |
| `hip_cm` | 否* | 成衣臀围（平铺×2）；下装必填 |
| `pants_length_cm` | 否* | 裤长/裙长；下装必填 |
| `image1` / `image2` / `image3` | 是 | `public/products/` 下的文件名 |

> *`ref_type=GARMENT` 时 `fit_type` 必填；分类为「下装」时 `waist_cm` / `hip_cm` / `pants_length_cm` 必填，其余 GARMENT 填 `chest_cm` / `length_cm`；`ACCESSORIES` / `SHOES` 尺寸留空即可。

导入脚本 `prisma/import-products.ts`：校验必填与按 `ref_type` / 分类条件必填、去重 slug、创建分类/商品/图片，`stock=1`、`status=ON_SALE`；失败逐行报告，不中断整批。

---

## 7. M0：项目初始化 + DB + 商品模型 + 导入模板（3~5 天）

### 任务

- [x] 0.1 初始化 Next.js 16 + TS + Tailwind + App Router + `src/`。
  - 已在临时子目录初始化后合并到根目录；旧 `START_HERE.md` 已删除。
- [x] 0.2 安装依赖：Prisma、Auth.js v5、bcryptjs、zod、腾讯云 SDK、tsx。
- [x] 0.3 `npx shadcn@latest init`，按需添加：button、card、input、label、select、dialog、sheet、tabs、table、badge、sonner。
  - base-nova 预设未提供 `form` 组件；M2 表单用 Base UI + zod 实现，不阻塞 M0。
- [x] 0.4 `docker-compose.yml`：Postgres 16，端口 5432，库 `outfitexpert`，命名卷持久化。
- [x] 0.5 `.env.example` + `.env.local`（腾讯云密钥从旧项目复制，**不提交**）。
- [x] 0.6 Prisma schema：M0 先建 `User`、`Category`、`Product`（含 `refType`、上装/下装尺寸）、`ProductImage`；其余表 M3/M4 前补。
  - Prisma 7 使用 `prisma7.config.ts` + `@prisma/adapter-pg`，Client 生成到 `src/generated/prisma/`（不入库）。
- [x] 0.7 `npx prisma migrate dev --name init`。
- [x] 0.8 Seed：管理员 + 测试用户 + 6 分类 + 13 件占位商品（12 在售 + 1 已售）。
- [x] 0.9 商品 CSV 模板（含 `ref_type`、`waist_cm`、`hip_cm`、`pants_length_cm`）+ `prisma/import-products.ts` 导入脚本（按品类条件校验）。
- [x] 0.10 全局布局：Header/Footer + 演示标识；首页占位。
- [x] 0.11 Auth.js 最小配置（`src/lib/auth.ts` + 路由骨架），完整登录留到 M2。
- [x] 0.12 README：环境要求、启动、Docker、迁移、seed、演示账号、目录说明。
- [x] 0.13 跑 `npx tsc --noEmit`、`npx eslint src`、`npm run build`。
- [x] 0.14（2026-11-02 追加）下装尺寸：`Product` 增加 `waistCm` / `hipCm` / `pantsLengthCm`，迁移 `bottom_measurements`；seed/CSV 增加下装样例。

### 验收

- [x] `docker compose up -d` 后 Postgres 可连。
- [x] `npx prisma migrate dev` 成功；`npx prisma db seed` 成功。
- [x] 数据库能查到 13 件商品；上装/连衣裙/外套含胸围/衣长，下装含腰围/臀围/裤长，ACCESSORIES / SHOES 尺寸为空。
- [x] `npm run dev` 首页可打开，页脚有演示标识。
- [x] `npm run build` 通过。
- [x] `.env.local` 未被提交；`.env.example` 完整。

### 提交

`feat: M0 项目初始化与商品模型`

---

## 8. M1：商品浏览 / 搜索 / 筛选（1~2 周）

### 任务

- [x] 1.1 商品查询函数：`q`、分类、颜色、版型（仅 GARMENT）、价格区间、排序、默认 8 件 + 展开（无页码分页）、是否含已售。
- [x] 1.2 首页：`Wardrobe` 页头、Bodoni 标题、搜索右上、5 件主推大屏轮播（6 秒左滑 + 箭头）、默认 8 件 + 下箭头展开、分类入口。
- [x] 1.3 列表页：筛选侧栏（移动端抽屉）、排序、默认 8 件 + 下箭头展开（无页码分页）、URL query 同步、空结果。
- [x] 1.4 详情页：3 图轮播、描述、材质/护理、标签、库存状态；成衣尺寸表按品类展示：上装/连衣裙/外套胸围/衣长/肩宽/版型，下装腰围/臀围/裤长/版型。
- [x] 1.5 加入购物车（M1 先 localStorage）：重复加购提示、角标更新。
- [x] 1.6 售罄状态：按钮置灰、列表默认隐藏、可切换显示。
- [x] 1.7 响应式：375px / 768px / 1280px 检查。
  - 已用 headless Chrome 实测 375 / 768 / 1280，无横向滚动；移动端筛选抽屉可开关。
- [x] 1.8 验收 + 提交。
  - 已验证：搜索「针织」、组合筛选、价格排序、售罄切换、3 图切换、重复加购去重、刷新后购物车保留。
  - 2026-11-02 结构改版：主推轮播 6 秒左滑/箭头、首页与列表默认 8 件 + 下箭头展开 8 件。

### 验收

- 对应 PRD §7.1~§7.3 全部勾选。
- 搜索「针织」能命中名称/描述/标签；组合筛选正确。
- 刷新 URL 后筛选条件保持。

### 提交

`feat: M1 商品列表详情与搜索筛选`

---

## 9. M2：登录 + 个人中心 + 身材 + 照片（1 周）

### 任务

- [x] 2.1 Auth.js v5：Credentials Provider（邮箱+密码 / 手机号+演示码），JWT 7 天。
- [x] 2.2 注册：邮箱唯一、密码 ≥8、bcrypt；手机号自动建号。
- [x] 2.3 登录/登出 UI + 错误文案 + 简单限流；登录后回来源页，页头登录态显示「个人」。
- [x] 2.4 受保护路由：`/account`、`/checkout`、`/orders`、`/tryon`、`/account/tryons`、`/admin`；未登录跳 `/login?next=...`。
- [x] 2.5 个人中心：昵称、身材数据（选填）、照片上传/替换/删除；卡片两列同排等高对齐。
- [x] 2.6 COS 封装：`putObject`、`getSignedUrl`、`deleteObject`；上传校验（类型/大小/解码）。
  - 2026-11-02 充值后复测：上传、签名 URL 预览、替换删旧对象、删除清空、私有桶未签名 403 全部通过。
- [x] 2.7 隐私政策 / 用户协议页面；注册页链接。
- [x] 2.8 Seed 管理员角色 + 后台路由守卫（M6 完整后台）。
- [x] 2.9 验收 + 提交。

### 验收

- [x] 邮箱注册/登录、手机号 `123456` 登录、退出登录。
- [x] JWT 7 天；Cookie HttpOnly + SameSite=Lax（本地 HTTP 下 Secure=false，HTTPS 由 Auth.js 自动开启）。
- [x] 未登录访问受保护页跳 `/login?next=...`；普通用户进 `/admin` 跳转。
- [x] 个人资料/身材保存后写入数据库。
- [x] 上传类型/大小/尺寸校验；COS 异常时显示友好错误。
- [x] 照片上传成功、签名 URL 预览、替换/删除同步 COS —— 2026-11-02 复测通过。
- [x] 未签名 URL 访问返回 403（私有桶）。
- [x] 登录后回来源页，页头显示「个人」。
- [x] 个人中心桌面两列卡片同排等高。
- [x] 隐私政策/用户协议可访问。

### 提交

`feat: M2 登录与个人中心`

---

## 10. M3：购物车 + 地址 + 下单 + Mock 支付 + 订单（1~2 周）

### 任务

- [x] 10.1 购物车：游客 localStorage + 登录 DB + 登录合并去重。
- [x] 10.2 购物车页：勾选、全选、合计、删除、售罄标灰、件数。
- [x] 10.3 地址 CRUD + 默认地址。
- [x] 10.4 结算页：地址选择、订单确认、包邮、演示支付二次确认。
- [x] 10.5 下单 API：zod 校验、事务、条件更新库存、幂等键、订单号。
- [x] 10.6 支付成功页 + 订单列表/详情 + 状态筛选。
- [x] 10.7 取消/退款（演示）+ 库存恢复。
- [x] 10.8 并发测试：两请求抢同一件，只成功 1 个。
- [x] 10.9 验收 + 提交。

### 验收

- 对应 PRD §7.6~§7.8 全部勾选。
- 重复点击支付只创建 1 单；售罄商品不可结算。
- 订单快照不受商品改价影响。

### 提交

`feat: M3 购物车下单与演示支付`

---

## 11. M4：AI 试穿（1 周，M5 后执行）

### 任务

- [ ] 11.0 图片与 MPS 标准严格沿用旧项目（PRD §6.8）：
  - 人像 1 张、单品 1~4 张；JPG/PNG/WebP；单张 ≤8MB；≥200×200；不要求固定比例；人像全身/半身/大头均可。
  - 原图上传，不压缩、不重编码；900px / quality 0.85 只用于预览/localStorage，不得作为 MPS 输入。
  - `tryon-1.0-lite` + 1K + `identity`；类型 `garment` / `accessories` / `shoes`；配饰 Prompt 用「佩戴」；配饰图不带模特脸/手。
  - Prompt 保留五官/脸型/肤色/发型；不得自行改模型、分辨率或 Prompt 结构。
- [ ] 11.1 复用旧项目 `src/lib/tryon/`：`config`、`cos`、`errors`、`image`、`mps`、`run`，按新项目改造。
- [ ] 11.2 `POST /api/tryon`：登录、照片、1~4 件、`ON_SALE` 校验；校验格式/≤8MB/≥200×200；创建 `PENDING` 记录，写入 `tryon_record_items` 时快照 `refType`、`fitBasis` 与商品尺寸；商品图/人像**原图**上传 COS 临时目录；发起 MPS。
- [ ] 11.3 `GET /api/tryon/[id]`：轮询 MPS；成功后下载结果 → COS 私有桶 → 更新记录 `SUCCEEDED`。
- [ ] 11.4 `/tryon` 页面：选中商品、照片预览、进度（准备素材/生成中/保存结果）、结果页；上传提示写明 JPG/PNG/WebP、≤8MB、全身/半身/大头均可。
- [ ] 11.5 合身判断：复用 `size-engine` 的 `canJudgeFit` / `judgeFit` / `lengthPositionHint` 纯函数，按 `fitBasis` 分支：
  - `UPPER`（上装/连衣裙/外套）：用户身高 + 胸围、商品成衣胸围 + 版型齐全时生效；衣长存在时附长度提示。
  - `LOWER`（下装）：用户腰围 + 臀围、商品成衣腰围 + 臀围 + 版型齐全时生效；腰围/臀围分别算放量，任一低于区间 → 偏紧，任一高于区间 → 偏松，否则合身；裤长/裙长仅展示，不判断。
  - `NONE`（ACCESSORIES/SHOES）不判断；对应最低数据缺失标注「无尺码数据，请以实物为准」。
  - 覆盖上装/下装的有数据、缺数据、全空用例；不输出 S/M/L。
  - 下装放量建议值：腰围 紧身 0~2 / 合身 2~4 / 宽松 4~8cm；臀围 紧身 2~4 / 合身 4~8 / 宽松 8~12cm，M4 联调可调。
  - 旧引擎字段映射：
    - `fitType`：`SLIM` / `REGULAR` / `LOOSE` ↔ 「紧身」 / 「合身」 / 「宽松」，集中映射，DB 不存中文；新项目 GARMENT 必填 `fitType`，不使用旧引擎「缺省合身」。
    - `refType`：`GARMENT` / `ACCESSORIES` / `SHOES` → MPS ImageSet `garment` / `accessories` / `shoes`（旧项目 `GARMENT_REF_TYPES` 为小写）。
    - `fitBasis`：由分类派生——上装/连衣裙/外套 → `UPPER`，下装 → `LOWER`，ACCESSORIES/SHOES → `NONE`；写入试穿项快照。
- [ ] 11.6 我的试穿：列表、详情、删除（同步删 COS）。
- [ ] 11.7 每日额度 `TRYON_DAILY_LIMIT`；超限提示。
- [ ] 11.8 真实 API 测试：1 件、3 件各 1 次；记录耗时/费用。
- [ ] 11.9 验收 + 提交。

### 验收

- 对应 PRD §7.9 全部勾选。
- 试穿输入为原图，未走 900px 压缩；MPS 参数与旧项目一致（`tryon-1.0-lite` / 1K / identity）。
- 图片校验：JPG/PNG/WebP、≤8MB、≥200×200；人像全身/半身/大头均可；配饰图不带脸/手。
- UPPER 身高/胸围 + 成衣胸围/版型齐全才出判断；LOWER 腰围/臀围 + 成衣腰围/臀围/版型齐全才出判断；NONE 不出判断；缺最低数据有「无尺码数据」标注。
- 上装长度提示仅在合身判断成立且用户身高 + 商品衣长齐全时出现；下装展示裤长/裙长，但不输出长度结论。
- 结果图带「AI 生成」；失败文案不暴露 MPS 原始错误。
- 浏览器源码/网络响应无腾讯云 Secret。
- 删除记录后 COS 对象不存在。

### 提交

`feat: M4 购物车 AI 试穿`

---

## 12. M5：Dify 导购助手（优先；1~2 周）

> **定位**：AI PM 面试主案例。目标不是“接一个聊天框”，而是展示意图路由、RAG/工具分工、评测、护栏和迭代闭环。
> **已确认（2026-11-03）**：本地 Dify；v1 只读工具；Router + 复杂分支 Agent；评测集由我起草、用户确认标签。

> **现状核对（2026-11-09）**：用户截图确认现有分类、参数提取、HTTP 商品查询、政策知识检索、回答及尺码/转人工出口，Start 已有 `product_context`、`size_advice`、`product_id`。代码已实现商品接口、聊天代理、上下文与会话 ID 传递、尺码计算；已有 49 条历史评测结果。截图不能证明节点内部 Prompt、记忆和当前发布配置正确，代码存在也不等于本轮验收通过。下列大项未勾选包含未完成的增强要求，不代表基础功能尚未建设。

> **本轮静态发现**：`src/app/api/assistant/products/route.ts` 的 `findOutfitProducts(targetId, limit)` 使用互补品类与标签评分，当前商品搭配分支未把预算、指定品类、指定风格过滤条件传入该函数；也没有组合总价或样例搭配禁配规则的校验。旧 Prompt 模板还含优先推荐鞋/配饰的规则。下一步核对现有商品回答节点怎样使用候选与对话历史，再依据用户已确认的三条用例提出局部修复；本轮未修改运行行为、未调用被测模型。

### 目标

- 用户能用自然语言完成：找商品、问搭配、问尺码、问政策、转人工。
- 关键链路可观测：意图、工具调用、商品 ID、引用、转人工、延迟、成本都能记录。
- 形成两版对比材料：Chatflow 路由 baseline vs 复杂分支 Agent。
- 面试能讲清楚：为什么这样分工、怎么评测、失败怎么迭代。

### 架构

```text
用户输入
  ↓
意图路由（Dify LLM 节点，JSON：intent + confidence + slots）
  ↓
置信度 / 槽位检查
  ├─ 不足 → 只追问一个关键问题
  └─ 足够 → 分流
        ├─ 商品搜索/推荐 → GET /api/assistant/products（Postgres）
        ├─ 尺码建议 → size-engine 工具（确定性）
        ├─ 政策/FAQ → Dify 知识库 RAG
        ├─ 订单物流 → v1 引导到订单页（v2 再接登录态工具）
        ├─ 转人工 → handoff 记录
        └─ 复杂搭配/多约束 → Agent 分支（工具白名单 + 最大 4 步）
  ↓
回答组装（自然语言 + 商品 ID + 引用 + handoff）
  ↓
/api/chat 流式代理：剥离 [[META]]、校验商品 ID、写日志
  ↓
前端：消息流 + 商品卡片 + 引用 + 反馈 + 转人工提示
```

### 关键决策

- 商品是结构化事实数据，走 Postgres 工具；知识库只放政策/FAQ/尺码指南，不把商品塞进向量库。
- 意图识别单独做，不交给 Agent 隐式完成；低置信度先澄清。
- v1 工具只读：不自动加购、下单、改订单；动作工具需要用户确认，放到 v2。
- 复杂请求才进 Agent；简单请求走确定性分支，控成本、延迟和可评测性。
- 输出统一契约：`[[PRODUCTS:id1,id2]]`、引用、`[[META]]` 追踪块；前端按 ID 从数据库取卡片，不信任 LLM 生成的价格/标题。
- 如果本地 Dify 版本没有 Agent 节点，就在 Next 服务端实现受限 Agent 循环，由 Chatflow 通过 HTTP 调用。

### 任务

- [x] 12.0 **评测集与契约冻结（第一步）**
  - 评审说明：`memory-bank/m5-eval.md`（49 条，含用户 10 条 gold cases + 7 条肤色用例）。
  - 机器可读评测集：`memory-bank/m5-eval.csv`（v0 已冻结）。
  - 契约：`memory-bank/m5-contract.md`（意图、槽位、商品工具、输出、校验、话术）。
  - 已确认：退换按商品（5 件不可退测试数据）、不承诺当天发货/加急走 handoff、商品上下文、相似款不考虑预算、肤色建议边界、模糊需求先问品类+可选预算、正品话术 B。
  - 风险记录：正品话术 B 与 PRD「禁止误导性正品保障」存在张力；实现时必须始终带演示限定语，PRD 待同步。
- [x] 12.1 本地 Dify 连通性检查
  - 本地 Dify `http://localhost`，版本 `1.16.0`；API `http://localhost/v1` 可达。
  - Dify 容器访问 `http://host.docker.internal:3000` 已通。
  - 本地 Dify SSRF 白名单已加 `host.docker.internal` 并重启 `ssrf_proxy`；代理测试 200。
  - 配置说明：`memory-bank/m5-dify-setup.md`。
  - 已有应用接入与历史调用记录；不再要求创建应用或重新配置 Key，不在文档保存真实密钥。
- [x] 12.2 商品查询工具 `/api/assistant/products`
  - 商品数据补全清单：`memory-bank/m5-product-data.md`（已确认 2026-11-03；13 件；新增 `returnPolicy` / `styleTags` / `occasionTags`）。
  - 支持 `q` / `category` / `color` / `refType` / `styleTags` / `occasionTags` / `minPriceCents` / `maxPriceCents` / `limit` / `ids` / `similarTo`。
  - 只返回 `ON_SALE`；字段精简；商品 ID 为唯一下单依据。
  - 返回 `returnPolicy`（可退/不可退）与商品级退换说明；商品模型/商品页同步补该字段。
  - `ASSISTANT_TOOL_TOKEN` 校验 + 限流；Dify 配置说明。
  - 实测：无 token 401；带 token 200；`q` / `similarTo` / `ids` / `returnPolicy` 正常；Dify 容器可访问。
- [ ] 12.3 Dify Chatflow baseline
  - 历史搭建与增量配置记录：`memory-bank/m5-dify-chatflow.md`；现有分支已由用户截图确认，后续核对配置和验收缺口。
  - 意图路由 JSON + 置信度/槽位检查 + 一次澄清。
  - 知识库检索节点（topK、阈值、引用输出）。
  - 商品 HTTP 工具、尺码工具、政策分支、转人工分支。
  - 退换按商品 `returnPolicy` 回答；无商品上下文先问是哪件；通用知识库只解释规则。
  - 回答组装节点：只允许引用工具结果中的商品 ID；输出 `[[PRODUCTS:...]]` + `[[META]]`。
- [ ] 12.4 `/api/chat` 服务端代理
  - 基础链路已完成（2026-11-03）：Dify streaming → NDJSON、剥离 `<think>`、限流与错误兜底。
  - `assistant_logs` 已接入（2026-11-03）：query/answer、商品 ID 有效/无效、延迟、首 token、token usage、错误；实测写入成功。
  - 代理 Dify `/v1/chat-messages`，`response_mode=streaming`。
  - 剥离 `[[META]]`，解析商品标记，校验/去重/丢弃无效 ID。
  - 记录 `assistant_logs`：输入、intent、工具、商品 ID、引用、延迟、token、成本、错误、handoff、prompt 版本。
  - 限流、超时、流式中断兜底；Dify Key 只在服务端。
- [ ] 12.5 前端聊天 UI
  - 基础链路已完成（2026-11-03）：流式消息、快捷问题、商品标记解析、商品卡片、引用展示、错误兜底；反馈与转人工待补。
  - 流式消息、快捷问题、商品卡片、引用来源、转人工提示、👍/👎/没解决反馈。
  - 商品卡片按 ID 从数据库渲染；无图/售罄状态兜底。
- [ ] 12.6 评测脚本与 baseline
  - 评测脚本已建立（2026-11-03）：`scripts/eval-assistant.mjs`，可读 `m5-eval.csv`、跑 `/api/chat`、输出商品命中/无效 ID/延迟；`--limit=2` 冒烟通过。
  - 商品上下文 Next 侧已完成（2026-11-03）：商品页「问导购」→ `/assistant?product=slug` → `/api/chat` 将 `product_context` 随 Dify 请求发送；评测脚本按 `context_product` 发送 `productSlug`。
  - 2026-11-09 截图确认 Start 已声明 `product_context`；此前“尚未声明”的阻塞已过期。当前 Prompt 引用、字段设置、发布版本与多轮条件保持需结合现有配置和运行记录核验，不重复添加变量。
  - blocking 模式跑评测集，输出 CSV：意图准确率、任务成功率、商品相关性、无效 ID 率、引用准确率、澄清率、转人工率、P50/P95 延迟、token/成本、幻觉率。
  - 人工抽检 + 可选的 LLM-as-judge；保留 baseline 结果。
- [ ] 12.7 Agent 分支与对比
  - 只接复杂搭配/多约束/多意图；工具白名单、最大 4 步、20s 超时、失败回退。
  - 同一评测集对比 baseline vs Agent 的成功率、成本、延迟。
- [ ] 12.8 护栏、日志、人工兜底
  - 前置：限流、输入长度、越界拦截。
  - 中置：工具白名单、只读、超时、最大步数。
  - 后置：商品 ID allowlist、引用校验、禁用承诺、空结果兜底、一键关闭。
  - 日志脱敏；转人工生成 handoff 记录，明确演示环境不真实联系客服。
  - 加急/售后备注走 handoff 记录；v1 不直接写订单或仓库，写操作需二次确认并另立 v2。
- [ ] 12.9 案例材料
  - 失败分类表、Prompt/流程版本记录、指标前后对比、Dify 流程截图、README 案例、面试讲稿。
- [ ] 12.10 验收 + 提交。

### 评测指标

| 指标 | 定义 | 测量 |
| --- | --- | --- |
| 意图准确率 | 路由意图与标注一致 | META/日志对比 |
| 任务成功率 | 满足需求且无违规 | rubric 人工 + 抽检 |
| 商品相关性 | 推荐是否符合需求 | Precision@3 人工标注 |
| 无效商品 ID 率 | 无效 ID / 总 ID | 数据库自动校验 |
| 引用准确率 | 引用是否支持回答 | 人工/LLM judge 抽检 |
| 澄清率 | 模糊问题正确追问比例 | 自动 + 人工判断 |
| 转人工率 | handoff / 总请求 | 日志自动统计 |
| P50/P95 延迟 | 首 token / 总响应 | `/api/chat` 时间戳 |
| 单次成本 | token × 单价 + 工具成本 | Dify usage + 价格 |
| 幻觉率 | 无依据陈述 / 回答数 | 人工抽检 |

### 失败分类与迭代

- 分类：意图错、槽位漏/错、该澄清没澄清/过度澄清、工具选错、参数错、空结果硬编、商品 ID 编造、推荐不相关、引用不支持、合规违规、格式失败、超时/成本高、多轮丢上下文、该转人工没转。
- 每条失败记录：原话、期望、实际、分类、根因、修复动作、回归结果。
- 迭代顺序按“频率 × 严重程度”排序；一次只改一个变量（Prompt、few-shot、工具 schema、topK、阈值、模型）。
- 每次改动保留版本号并重跑同一评测集，维护回归集。

### 分工

- **我做**：契约与评测集草案、商品工具、`/api/chat`、日志/反馈、聊天 UI、Dify 配置文档、Prompt 模板、评测脚本、案例文档。
- **你做**：本地 Dify 应用/模型配置、知识库内容确认、评测标签最终确认、Dify API Key 写入本地环境、最终面试讲述与演示。
- 我无法代替你操作 Dify UI 或使用你的账号；需要你按步骤配置，我提供逐项说明。

### 验收

- 对应 PRD §7.10 全部勾选（实施前同步更新 PRD 的 M5 架构与验收）。
- 问「约会穿什么」返回 ≥2 张有效商品卡片；问政策带引用；模糊问题会澄清；越界/投诉可转人工。
- 评测集可一键跑出指标；baseline 与 Agent 有对比数据。
- 前端源码、网络响应、日志中无 Dify Key / 腾讯云 Secret。
- 无效商品 ID 被丢弃并计数；无结果不硬推。

### 提交

`feat: M5 Dify 导购助手`

---

## 13. M6：后台 + 看板 + 打磨 + 部署（1~2 周）

### 任务

- [ ] 13.1 后台布局 + `role=ADMIN` 守卫。
- [ ] 13.2 商品管理：列表/搜索/状态筛选、新建/编辑、上下架、软删除；表单含 `refType`，按分类条件必填：上装/连衣裙/外套版型/胸围/衣长，下装版型/腰围/臀围/裤长，ACCESSORIES/SHOES 尺寸可空；图片路径 + 预览。
- [ ] 13.3 订单管理：列表/详情、发货（假单号）、完成、退款（恢复库存）、备注。
- [ ] 13.4 看板：商品总数/在售/已售、订单数、演示成交额、最近 5 单、试穿次数。
- [ ] 13.5 全站打磨：loading/empty/error、移动端、键盘可达、图片 alt。
- [ ] 13.6 部署：Vercel + Neon；环境变量；`prisma migrate deploy`；商品图随仓库；Dify 公网地址。
- [ ] 13.7 README + 截图/演示说明。
- [ ] 13.8 全站验收 + 提交。

### 验收

- 对应 PRD §7.11 + §8 全部勾选。
- 部署后可完成一次「逛 → 登录 → 下单 → 支付 → 试穿 → 导购」全流程。

### 提交

`feat: M6 后台看板与部署`

---

## 14. 每阶段 Definition of Done

每个里程碑结束必须全部满足：

- [ ] `npx tsc --noEmit` 无错误。
- [ ] `npx eslint src` 无 error。
- [ ] `npm run build` 成功。
- [ ] PRD 对应章节验收清单全部勾选。
- [ ] 演示路径可走通（本地）。
- [ ] 无密钥进入前端/仓库。
- [ ] PRD 变更记录已更新（如有改动）。
- [ ] Git 提交，信息中文 `feat/fix/docs: 描述`。

---

## 15. 需要用户提供 / 确认

| 事项 | 内容 | 截止 |
| --- | --- | --- |
| 商品样例 | 当前 13 件占位（12 在售 + 1 已售）；真实图/文案在 M6 演示前替换 | 已完成占位 |
| 商品全量 | 30~50 件（含真实图与文案） | M6 演示前 |
| 品牌资料 | 店名、Logo、主色、风格参考 | M1 前 |
| 规则文案 | 运费、退换货、隐私政策、用户协议 | M2/M3 前 |
| 腾讯云密钥 | 旧项目 `.env.local` 已有，确认可复用 | M2 前 |
| Dify | 账号 + API Key + 知识库资料 | M5 前 |
| Neon / Vercel | 账号 | M6 前 |
| 测试素材 | 本人照片（JPG/PNG/WebP、≤8MB、≥200×200，全身/半身/大头均可）+ 身材数据 | M4 前 |
| PRD §10.2 | 12 条默认方案已确认（2026-11-02） | 已完成 |

---

## 16. 风险与应对

| 风险 | 应对 |
| --- | --- |
| 商品数据未就绪 | 当前 13 件占位；M6 演示前替换真图与文案 |
| MPS 成本 | 每日额度 + 测试只跑 1/3 件 |
| Dify localhost 不可达 | Docker Dify 或 cloudflared/ngrok |
| Neon 国内不稳 | 本地 Docker 开发；部署前实测，必要时换 Supabase |
| 孤品并发 | 事务 + 条件更新；M3 做并发测试 |
| Vercel 不能写 `public/` | 商品图随仓库；后台只填路径 |
| Auth.js v5 变动 | 锁版本；先跑通最小登录 |
| 腾讯云账号欠费 | COS/MPS 不可用 | 保持余额；2026-11-02 充值后 M2 照片链路已复测通过 |
| 工期超预期 | 保 M0~M4，M5/M6 可后补 |

---

## 17. 当前进度

- [x] 第 1 步：PRD v0.8（2026-11-02 个人中心与商品互动增强记录；v0.1 初版 2026-11-01）
- [x] 第 2 步：`CLAUDE.md` + `memory-bank/plan.md`
- [x] 用户确认 plan
- [x] M0 完成（2026-11-02）
- [x] 2026-11-02 追加下装尺寸：`waistCm` / `hipCm` / `pantsLengthCm`
- [x] M1 完成（2026-11-02）
- [x] 2026-11-02 图片与 MPS 标准沿用旧项目（PRD v0.4）
- [x] 2026-11-02 PRD §10.2 的 12 条默认方案已确认
- [x] M2 完成（2026-11-02）：登录/注册/个人中心/身材/照片上传/隐私页
- [x] M2 照片链路验收：COS 上传/签名 URL/替换删旧/删除/私有桶 403
- [x] 2026-11-02 前端结构改版：Wardrobe / 主推大屏 / 8+N 展开 / 登录回跳 / 个人中心对齐
- [x] M3 完成（2026-11-02）：购物车/地址/结算/演示支付/订单/退款
- [x] M3 验收：游客合并、地址 CRUD、无地址拦截、下单事务、幂等、刷新恢复、并发抢孤品、快照、退款恢复库存、越权 403、移动端无横向溢出
- [x] 2026-11-02 前端细节调整（PRD v0.7）：首页文案、商品详情右侧发货/地址/不退换、四个标签与左右滚动态、购物车已选小图
- [x] 2026-11-02 个人中心与商品互动增强（PRD v0.8）：头像/订单统计/收藏/足迹、收藏星标、足迹记录、尺码建议与身材快捷填写
- [x] 2026-11-03 M5 方案确定：本地 Dify / 只读工具 / Router + 复杂分支 Agent / 评测闭环
- [x] 2026-11-03 M5 评测集与契约冻结 v0：`m5-eval.md` / `m5-eval.csv`（42 条）/ `m5-contract.md`
- [x] 2026-11-03 商品数据补全清单：`m5-product-data.md`（已确认，13 件，P0 字段与建议 tags/退换）
- [x] 2026-11-03 M5 本地 Dify 连通性：Dify 1.16.0，容器可访问 Next
- [x] 2026-11-03 商品数据与商品查询工具 `/api/assistant/products` 完成并通过 token 测试
- [x] 2026-11-03 聊天基础链路：`/api/chat` 流式代理 + `/assistant` UI + think 过滤 + 商品标记解析
- [x] 2026-11-03 商品卡片实测通过：Dify 返回 `[[PRODUCTS:...]]`，前端解析并渲染卡片；桌面/375px 无横向溢出
- [x] 2026-11-03 知识库文档起草：`memory-bank/m5-knowledge/`（发货/退换/正品/支付/尺码/FAQ）
- [x] 2026-11-03 索引方案：先用经济/关键词索引（内存不足，暂不装 Ollama embedding）；混合检索待办
- [x] 2026-11-03 政策咨询 RAG 分支测试通过（经济/关键词索引）
- [x] 2026-11-03 `assistant_logs` 实测写入成功（商品 ID、有效/无效、延迟、token）
- [x] 2026-11-03 评测脚本 `scripts/eval-assistant.mjs` 冒烟通过；已支持按 `context_product` 发送 `productSlug`
- [x] 2026-11-03 商品上下文 Next 侧完成：商品页「问导购」→ `/assistant?product=slug` → `/api/chat` 发送 `product_context` + 评测脚本注入
- [x] Dify Start 已有 `product_context` / `size_advice` / `product_id`（2026-11-09 用户截图）；当前节点内部引用及发布配置仍需核验
- [x] M5 已有 49 条历史评测结果；历史商品命中率不等同于任务成功率
- [x] M5 分类与商品/政策/尺码/转人工分支已经搭建（2026-11-09 用户截图）
- [x] M5 assistant_logs / 评测脚本基础实现存在；日志和判分完整性仍待补强
- [x] 三件商品样例及三条预算/多轮验收标准已由用户确认
- [ ] 在现有 Chatflow 上核对配置，确定样例接入方式并执行三条用例；不得将样例编号当作真实数据库商品 ID
- [ ] 同版本完整 baseline 与行为判分复验；保留原始失败和重测，不把重测修正值当作原始全量结果
- [ ] M5 剩余增强与验收（Agent、反馈、handoff 等按用户决定推进）
- [ ] M4 试穿（M5 后）
- [ ] GitHub 远程仓库（本地 Git 已初始化；远程连接暂缓）
