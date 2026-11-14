# 已拥有主体被重复当成附加要求：最小修订

日期：2026-11-12。最新状态：局部功能对照完成后，用户已发布并导出owned-v2；同版12会话17轮完整回归通过核心检查，原H03恢复，见[m5-current-scope-report-20261112-v2.md](m5-current-scope-report-20261112-v2.md)。本修复收尾，尚不证明所有表达稳定；防水轮“裙装”历史错误及边界行动问题保留。下文为修订及历史操作依据，不重复要求修改或测试。原始失败与受控工具对照见[m5-current-scope-report-20261112.md](m5-current-scope-report-20261112.md)。

后续防水对照：用户已提供false、不要鞋/必须防水、needs_verification及防水未核实项，条件保留和保护通过；回复误称“裙装”，单独记PM-011，未把整轮记完全通过。见[m5-owned-anchor-retest-20261112-02.md](m5-owned-anchor-retest-20261112-02.md)。下一步同会话明确撤销防水，覆盖原计划的已有主体400元恢复对照，再测一起购买900元。

## 本步只改一处

当前续轮进展：撤销防水后，requirements保留其他条件，工具恢复matched_known_constraints；用户补贴回复正确推荐359元裤子/余41元，上衣未重复计价，核心行为通过，见[m5-owned-anchor-retest-20261112-03.md](m5-owned-anchor-retest-20261112-03.md)。末句合身度说明略冗余，集中复核；原防水轮裙装错误保留。下一步新会话验证明确一起购买两件900元。下文修订步骤不需再次应用。

在已有“参数提取”LLM节点的SYSTEM第8条末尾、第9条之前，追加以下一条。其他提示词、模型/温度、记忆、代码执行和HTTP不改：

```text
   - 已拥有主体只影响预算包含关系：顾客说“已经有这件上衣”“衣柜里有了”“上衣不用再买”等时，用includeCurrentProduct=false表达；不要再把这些同义说明写入otherRequirements。otherRequirements只保留尚未由专用字段表达的真实附加条件。例如“上衣已有，只配裤子，单件250元，不要鞋，而且必须防水”应为budgetCents=25000、budgetScope="item"、includeCurrentProduct=false、otherRequirements=["不要鞋","必须防水"]。不要为消除重复而删除防水、颜色、场合等真实要求，也不要改变顾客明确指定但无法对应页面ID的主体名称保留规则。输出前核对专用字段与otherRequirements，去除只是在重复其含义的文字。
```

为避免寻找插入位置有误，也准备了完整SYSTEM文件[m5-outfit-extraction-system-v2-owned.txt](m5-outfit-extraction-system-v2-owned.txt)。它由本轮实际导出SYSTEM生成，只插入上述一条；不是重建节点，也没有修改USER变量。

## 第一条预览验证

新建预览会话，保留此前真实衬衫页面测试输入：product_id=`cmvy255tt000caotqizp21rtq`，product_context使用[m5-outfit-preview-context.json](m5-outfit-preview-context.json)，不沿用旧预算协商历史。

发送：

> 这件衬衫我衣柜里有了，只给它配条极简裤子。裤子单件三百五十九封顶，别加鞋。

预期：

- requirements为outfit/bottoms/极简、35900/item、includeCurrentProduct=false、正确anchorProductId、otherRequirements只含不要鞋，missingInformation为空。
- HTTP为matched_known_constraints，products含黑色高腰阔腿裤，assessedPriceCents=35900、budgetRemainderCents=0。
- 回复推荐裤子359元，说明与已有衬衫适配，主体不再收费，不重复确认只买下装，只输出裤子ID。

本步请回传otherRequirements、status和最终回复；无需Header或reasoning_content。不要仅看到359元就判通过。

## 后续验证计划（第一条通过后再做）

对照已有主体/单件400、一起购买/两件900、必须防水三类，验证只消除预算语义重复而不吞其他条件。新版本验收后再保存DSL和发布，再完整复验，不把工具直接回放成功说成新Prompt已通过。若再次重复，保留发生次数并研究更明确的需求结构/有限规范化，不通过多重试到成功来隐去失败。
