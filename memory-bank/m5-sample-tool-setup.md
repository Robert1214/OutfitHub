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

已完成本地规则/路由函数测试以及项目类型、lint、生产构建检查。尚未在 Dify 运行这三条集成用例；代码测试的 500→600 仅验证不同输入下的算术，不证明模型在同一会话保留条件。

现有 `localhost:3000` 对新路径返回 HTML 404，未加载新增接口。本轮未启动或重启服务。下一步需用户按原约定批准启动单独的开发服务（建议端口 3001），或由用户自行启动；批准前不要声称该端口已就绪。不要将 production 静态 404 当作接口代码失败。

## 开发服务可用后的 Dify 操作

先保留现有 HTTP 配置，便于测试后恢复：原地址 `/api/assistant/products`，q=代码执行.q、category=代码执行.category、styleTags=代码执行.styleTags、limit=5、contextProductId=用户输入.product_id。

仍使用原 HTTP 节点，仅修改草稿：

1. URL 改为 `http://host.docker.internal:3001/api/assistant/sample-products`（端口以实际启动为准）；鉴权 Header 保留，不发送凭证截图。
2. Params 本轮只使用两项：`requirements` 通过变量选择器选「代码执行.requirements」；`anchorSampleId` 固定填 `S01`，这是本组三题指定的样例主体，不能写入正式商品 ID 字段。测试其他主体时要相应改动。
3. 在原「回答」SYSTEM 末尾增加以下临时测试说明；USER 继续引用 HTTP body 和代码执行.requirements：

```text
【内部样例工具测试】
仅当工具结果 scope 为 internal_samples_only 时应用本段。
当前商品事实使用工具结果 currentProduct；候选事实使用 products 和 evaluations。
样例未进入真实商品库，sampleId 不是商品 ID，不输出 [[PRODUCTS:...]]。
只在 S01–S03 范围内判断；未知库存、材质、尺寸和退换保持未知，不声称可下单或合身。
evaluations 中超预算或不适配的商品只能用于解释限制，不能作为满足条件的推荐。
按工具的已检查条件和金额解释，不将已提取的顾客要求当成商品事实。
缺条件时一次澄清一项；不能擅自提高预算、换品类或改变风格。
```

4. 预览输入 `product_context` 与 `product_id` 留空；如 `product_id` 在开始节点仍为必填，仅在草稿关闭必填（原设计为可选）。商品事实由此次工具返回，不往正式商品 ID 字段塞样例名。
5. 先新开会话 A 测 S-E01（800 元），记录 HTTP body 和最终回复；再新开会话 B 测 S-E02（500 元），S-E03（600 元）紧接 B 的真实上一轮回复，不能清空会话或补写理想回复。
6. 保存失败原文。若分类器不把续轮交给商品分支，或提取器丢条件，应记录实际问题，不能靠重新问完整题替代多轮验收。

完成测试后将 HTTP URL/Params 恢复为保留的正式配置，并移除临时测试说明，再决定后续改动；测试期间不发布。

## 能说明什么

本测试覆盖现有 Chatflow 的路由、需求提取、解析、HTTP 调用、对样例规则与金额的解释，以及真实续轮时的条件保持。它不能证明原数据库检索、商品卡片、真实库存、合身、多件通用搭配或业务转化已通过。原商品接口的搭配过滤与预算处理仍需后续修复，不因样例测试通过而标为完成。
