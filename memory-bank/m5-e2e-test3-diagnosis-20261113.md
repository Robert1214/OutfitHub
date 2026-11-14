# 网站端到端测试③失败：诊断与结论

日期：2026-11-13。状态：已定位、已验证通过，两项观察待用户判断。

## 现象

用户浏览器：从黑色真丝衬衫商品详情页点"问导购"，页面没显示商品信息，提问后回答"我找不到这件衬衫的信息"。
AI 首次 API 复测（POST /api/chat + productSlug=black-silk-shirt）：回答走单品搜索（359元裤子，余441元），未识别页面衬衫。

## 排查过程（按证据顺序）

1. 服务器渲染 /assistant?product=black-silk-shirt 正常（欢迎语显示「黑色真丝衬衫」）→ 前端传参路径代码正确。
2. 量 product_context JSON 长度：505 字符，远低于 Start 节点 max_length 4000 → 排除截断。
3. Dify 查询 API（/conversations + /messages，零模型费用）：确认 Dify 收到完整 inputs（product_context 505字符内容完整；未定义的 product_name/product_slug 被 Dify 按 Start 定义过滤——证明变量映射在工作）。
4. 探针1（直连 Dify，标记 context，要求复述）：回答正确复述"标记衬衫XYZ 123元" → 传输链路完全正常。
5. 探针2×2（直连 Dify，真实 context + 真实搭配问题，**但未传 product_id**）：两次均 outfit + anchorProductId 正确，但回答"请从商品详情页进入导购"。
6. 用户查 Dify 日志确认：提取输出 intent=outfit、anchorProductId=cmvy255tt000caotqizp21rtq（完整正确），HTTP 请求参数也正确 → 提取/解析/传输全部正常。
7. 代码定位：src/lib/assistant-outfits.ts:41-45 要求 anchorProductId 必须等于 contextProductId（页面商品ID），否则 needs_clarification"请先从选定上衣的商品详情页进入导购"。探针2 未传 product_id → contextProductId 空 → 命中该校验。**探针2 失败是探针缺陷，不是系统 bug**。
8. 真实场景重跑（经 /api/chat 带 productSlug）4 次：全部走 outfit 流程，页面衬衫正确识别、359元裤子真实ID卡片、预算口径透明。

## 结论

- 后端链路（页面context传输 → 提取 → anchor → HTTP工具 → 回答）**全程健康**，无需修复。
- 早期两次失败是提取模型波动（同一输入偶发输出 intent=search，deepseek-v4-flash 温度0.7）；之后 6 次连续 outfit 通过。
- 用户浏览器"进去后没有商品信息"与服务器渲染正常矛盾，疑为浏览器侧（缓存/旧构建/会话状态），待用户复测确认；提问后"找不到衬衫"可由当时的提取波动或 context 未达解释（早期 debug 调用确有一次 search）。

## 两项观察（待用户判断）

1. **提取波动**：同一搭配问题，早期 2 次 intent=search、后续 6 次 outfit。建议把参数提取节点 temperature 0.7 → 0.2（结构化任务稳定性优先；回答节点保持 0.7）。需用户授权改配置并重新发布，发布后回归抽查。
2. **预算解读漂移**：今天 3/3 次提取把"预算800元"判为只买裤子（includeCurrentProduct=false，359元余441元），与 M5 已确认行为不一致（2026-11-11 首轮：total/true → 818 超18元协商，见 plan.md 记录与 m5-catalog-outfit-run-20261111-02.md）。规则 8 要求"包含关系确实不清楚时填 null"（→ 触发追问），模型却过度自信判 false。风险：顾客若本意是总预算800，会超支。修复方向与观察1同源（温度/规则加固），是否要回到"总预算协商"由用户决定。

## 方法沉淀

- Dify 应用 API 的 /conversations + /messages 端点可零成本回读每次调用的 inputs，用于排查"传了什么/收到了什么"。
- Dify 运行日志（UI）是唯一能看到提取节点输出与 HTTP 节点参数的地方；本次靠它确认 anchor 正确、把嫌疑从提取转移到工具校验。
- 探针实验必须复现真实场景的全部关键参数：漏传 product_id 会触发 contextProductId 校验产生假阳性失败。
