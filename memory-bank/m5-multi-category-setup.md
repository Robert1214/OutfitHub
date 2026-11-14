# 多个品类待选：现有 Chatflow 的下一小步

日期：2026-11-10。目标是让“一件滚石T恤和一条摇滚裤子，预算500，不要鞋”先正确进入选款，再由顾客确认主体。沿用现有草稿和3000，不新建节点，不发布测试配置。

## 本地验证结果

最新收尾（运行15）：用户确认新会话品类澄清及页面来源追问两条均正确，来源缺陷关闭。该样例开发小块收尾，下一步先保存实际Dify草稿DSL及配置指纹，见m5-sample-baseline.md。下文阻断/待测均为历史过程，不要求重复运行已获确认的两题；不等于全量评测通过。

当前阻断（运行14）：新会话未知品类提取正确，product_context为空，回复却把固定S01称作正在浏览商品。本地已修复currentProduct无条件赋值：未知品类不输出主体/候选详情，独立搜索不带固定主体；明确outfit的兼容字段标记来源为internal_sample_anchor，不代表真实浏览。15项测试及项目检查、现有3000 HTTP均通过；用户下一步只替换回答中的一段来源规则并新会话复核，见m5-dify-chatflow.md §12.14。用户原失败保留，新重试偶尔未提T恤不能当作问题已消失。

最新验收（运行13）：用户确认成功回复已没有多余内容，本项文案关闭，不再重复600元成功题。选主体、500元协商及600元续轮已有证据；本块剩下方“反向检查”的真正未知品类新会话对照。通过后结束本块，转入实际配置保存及正式商品查询接入；本次确认不证明所有分支或正式商品能力完成。见 `m5-sample-run-20261110-13.md`。

当前进度（运行12）：用户确认600元续轮的requirements/status/products均符合预期，实际回复556元/余44元；本条新流程的预算续轮通过。成功回复仍输出落选商品和样例内部说明，下一步按 `m5-dify-chatflow.md` §12.12 替换回答表达段并复核一次，之后做真正未知品类对照。见 `m5-sample-run-20261110-12.md`；下文“下一步600元”“未应用”等为历史状态。

最新续轮：用户完成主体选择后，HTTP回传requestedCategories=[bottoms]、50000/total/true、outfit及不要鞋，status=over_budget；回复556元/超56元并只询问是否加预算，本轮通过，见 `m5-sample-run-20261110-11.md`。接下来同会话测试600元，再做未知品类对照；下方“尚未执行”的内容为历史状态。

最新实际反馈：用户发现新版代码未复制、HTTP两项Params缺失，恢复后已正确收到候选188元T恤的选款确认。本轮回复行为通过，见 `m5-sample-run-20261110-10.md`。下一步在原会话回复“就选这件”，检查预算500元/不要鞋的保持及超预算协商；下面关于尚未同步的表述为历史记录。

已通过13项测试（含可复制Dify代码的真实执行）、TypeScript、src ESLint和生产构建。构建首次在沙箱内遇到spawn EPERM，获准沙箱外重试后通过。3000直接HTTP依次返回：多品类未选定时needs_selection/currentProduct=null/候选S01未确认；明确主体且500元时over_budget；同样主体与600元时matched_known_constraints/products=[S03]。这些是受控输入的工具验证，不证明Dify提取、记忆或新状态回复通过，用户尚未应用或运行新分支。

用户随后首测body仅products=[]，缺少样例字段；本地重查sample-products仍正常，而原products接口可返回相同空列表。当前等待同次GET地址/Params确认，不能认定Dify新分支实际执行；证据见 `m5-sample-run-20261110-08.md`。

后续重试在代码执行报“需求提取包含未约定字段”，用户给出的实际输入只有原九字段加requestedCategories，本地新版脚本原样执行通过；Dify运行脚本未直接读取，需全文同步。已让新报错列出具体未知字段，并保留该原样输入的回归检查。该输入还把统一500元预算提取为unknown，新提取提示词第7条明确一次多件购买的统一预算范围；代码不自动改写该字段。详见 `m5-sample-run-20261110-09.md`。解析阻断时HTTP未执行，原请求路径问题仍未核实。

## 为什么加一个字段

旧category=""同时表示“品类未知”和“多个品类都待选”，工具无法区分。新增requestedCategories表达待选列表：

| 情况 | category | requestedCategories |
| --- | --- | --- |
| 要挑上衣和裤子，两件都没定 | 空字符串 | ["tops","bottoms"] |
| 上衣选定，还需搭裤子 | bottoms | ["bottoms"] |
| 没说要什么品类 | 空字符串 | [] |

现有九字段输入仍可使用；新分支只有列表明确有多个品类时启用，不从关键词强行推断，更不把空category默认改成bottoms。

## Dify修改顺序

配置完成后的首次排查，先确认实际代码已包含requestedCategories，HTTP真实地址为sample-products，requirements确实绑定代码执行输出且anchorSampleId为S01。以同次运行输入为准，本地文件的存在不等于Dify已经更新。已确认恢复的配置不重复修改。

1. 打开原「代码执行」节点，将代码全文替换为 [dify-parse-requirements.js](../scripts/dify-parse-requirements.js)。输入仍是text=参数提取.text；四个String输出仍为q、category、styleTags、requirements。新增列表在requirements中传递，不增加节点输出变量。先做这步，避免旧校验器拒绝新字段。
2. 打开原「参数提取」节点，把SYSTEM替换为 [多品类提取提示词](m5-extraction-multi-category.txt)。USER中的query及product_context引用、已开启的记忆保持原配置；结构化输出仍关闭。该文本与 `m5-dify-chatflow.md` §12.1同步，新增requestedCategories及主体确认后的更新规则。
3. 原「回答」SYSTEM中，在现有样例状态处理段加入下方needs_selection规则。继续保留over_budget/needs_clarification等分支，不覆盖整个回答提示词。
4. HTTP地址仍为 `http://host.docker.internal:3000/api/assistant/sample-products`；Params仍是requirements=代码执行.requirements、anchorSampleId=S01，Header保持原样。

```text
【多个品类待选】
当样例工具status=needs_selection时，表示顾客已经说明多个待选品类，但还没有选定具体搭配主体；这不是缺少品类或总预算。
selection.anchorCandidate只是一件候选商品，不是顾客已经选定的商品，也不是符合整套预算的推荐。
先核对候选是否符合顾客原话。若相符，只询问是否选用这件具体商品，例如“滚石T恤可以先看这件188元的巡演图案款，你想用它来搭配吗？”；不能称为“你选的这件”。
若候选不符或不存在，只询问先从顾客已说出的哪个品类挑选，不编造其他商品，不要求顾客重新说一遍已经明确的品类或预算。
一次只问一个选择问题，不同时确认预算，不自动缩减购买目标，也不从空products/evaluations编造整套方案。后续按用户真实选择继续；原有未知事实、样例ID和其他状态规则继续适用。
```

只在有限样例中使用候选S01；不以固定参数证明用户已选，不承诺现货/合身/可下单。不同主体或拒绝S01后的商品查找不在本步骤已实现能力内。

## 按顺序测试

先新开会话输入原来的自然问法：

> 我想买一件滚石T恤和一条摇滚裤子，预算500，不要鞋。

第一轮检查：

- requirements.requestedCategories包含tops、bottoms；category为空，50000/total及不要鞋保留。没有选定主体时includeCurrentProduct可为null；它不再作为这轮已选主体的依据。
- HTTP status=needs_selection，clarification为空；currentProduct为空，selection.anchorConfirmed=false，selection.anchorCandidate是S01；products/evaluations为空。
- 回复只让顾客选择是否用188元这件T恤，不重复确认已说出的品类与总预算，不假装已经找到预算内整套。

实际第一轮回复正确后，在同一会话明确选择：

> 就用这件188元的滚石T恤，给它搭配一条摇滚裤子。

第二轮检查：requestedCategories=["bottoms"]、category=bottoms、intent=outfit；50000/total/true和不要鞋保留。HTTP over_budget，回复556元/超56元，仅询问预算是否愿意调整。未明确同意加价前仍用500元。

然后同会话只修改预算：

> 那总预算提高到600元，其他要求不变。

第三轮检查：60000、其余条件不变；HTTP matched_known_constraints、products含S03，回复556元/余44元。按用户最新标准，简短确认有来源的“不包含鞋”可接受。

反向检查（另一个新会话，首轮即可）：

> 我想买件衣服，预算500元。

不能提取成tops+bottoms；品类不明确时应为requestedCategories=[]，工具needs_clarification并询问必要信息，不能仅因样例固定S01就当作顾客要这件T恤。

保存各轮原始输出与失败。新分支未在Dify验证之前，不把本地规则测试当作模型理解、记忆或对话验收通过。

## 验证范围

本步骤修复“多个已知品类被误当未知”的表示与选择流程，不枚举任意商品组合，不新增真实商品，也不解决正式商品接口已有的通用预算过滤问题。仍需顾客确认主体后使用已有两件预算/搭配规则。未来完整多品类搜索需要更完整的候选与组合表示，不靠让顾客背固定问法替代实现。
