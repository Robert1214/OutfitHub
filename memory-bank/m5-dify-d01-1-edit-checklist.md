# D01-1 在 Dify 回答节点里要改哪几行（2026-11-14）

> 给用户看的操作清单。代码侧（工具、priceBasisNote、budgetRemainderCents）已提交，Dify 侧尚未应用。
> 背景：Dify 回答节点里有**两段**按 status 分支的规则，两段都叫 `over_budget` / `no_match_for_query`，容易混淆。

## 先分清两个节点段

| 段 | 内容 | 用在 | 本项目的实际使用 |
| --- | --- | --- | --- |
| **单品段** | `【真实商品单品查询】`，开头写「仅当商品工具 scope=catalog_single_item 时应用本段」 | 顾客只说品类（如「摇滚风裤子」「极简裤子」），**没有指定页面上衣** | **最常用**，R01/R02/R11 等大部分题都走这里 |
| **搭配段** | `【真实商品指定主体搭配】`，开头写「仅当工具 scope=catalog_anchored_outfit 时使用本段」 | 顾客从某件上衣详情页进来，要给它配下装 | R03/R04/R06/H02/H03 等走这里 |

> 判断方法：看顾客的话有没有提到某件具体上衣 / 是不是从商品页进入。有 → 搭配段；只说品类 → 单品段。

## 单品段：改 3 处

位置：`【真实商品单品查询】` → 「先按工具status决定怎样回复：」下面的列表。

### 1) matched_known_constraints（在原句后补余额口径）

加一句：
```
有budgetRemainderCents时用「预算还剩XX元」说明余额（不得说成「还差」「还欠」），null表示未提供预算。
```

### 2) over_budget（整行替换）

替换前（Dify 当前运行的版本）：
```
- over_budget：products/outfits为空，本次应报金额见reportedPriceCents，超出金额见budgetAssessment.overByCents（单位分）。purchaseBasis=newItemsOnly时只说明下装金额与差额，不提整套合计。说明实际金额、差额，并只协商一个条件。顾客尚未同意前不得加预算，不输出商品标记。
```

替换后：
```
- over_budget：products/outfits为空，本次应报金额见reportedPriceCents，超出金额见budgetAssessment.overByCents（单位分）。purchaseBasis=newItemsOnly时只说明下装金额与差额，不提整套合计。按 D01-1：先说明没有完全匹配，再展示这件最接近的商品并明确标出超出金额（不得称为预算内推荐、推荐或可接受），给出两个出口（调整条件 / 先到这里），最后询问是否需要转人工（演示）；输出该商品的商品标记。顾客尚未同意前不得加预算。
```

### 3) no_match_for_query（一行拆成两行）

替换前：
```
- no_match_for_query：只说按本次条件暂未查到匹配，不扩大为全店无货。必要时只协商一个条件。
```

替换后：
```
- no_match_for_query（candidates非空）：说明按本次条件没有完全匹配；在candidates中展示最接近的单品，逐件标出它违反了哪一条（风格不符、关键词未满足、超出预算多少），不得称为推荐或可接受；给出两个出口（调整条件 / 先到这里），最后询问是否需要转人工（演示）；输出所展示商品的商品标记。
- no_match_for_query（candidates为空）：只说按本次条件暂未查到匹配，不扩大为全店无货。必要时只协商一个条件。
```

### 4) 另外检查单品段里有没有「只在有 products 时输出商品标记」这类限制句

如果有，放宽为：按 D01-1 展示的 candidates / over_budget 商品也可以输出标记。用户尚未提供这一段原文。

## 搭配段：改 3 处

位置：`【真实商品指定主体搭配】` → 「按本轮status回答：」下面的列表。

### 1) over_budget（整行替换）

替换前：
```
- over_budget：products/outfits为空，budgetAssessment给已核对组合范围内的最低金额。includesAnchor=true时，anchorPriceCents加minimumCandidatePriceCents为minimumPriceCents；否则minimumPriceCents仅计算新买下装。说明实际金额、超出overByCents，并只协商一个条件。顾客尚未同意前不得加预算，不输出商品标记。
```

替换后：
```
- over_budget：outfits含最接近的已核对组合，budgetAssessment给该组合金额。includesAnchor=true时，anchorPriceCents加minimumCandidatePriceCents为minimumPriceCents；否则minimumPriceCents仅计算新买下装。说明实际金额、超出overByCents，不称为推荐。按 D01-1：说明没有完全匹配，展示该组合并标明超出金额，给出两个出口（调整条件 / 先到这里），最后询问是否需要转人工（演示）；输出对应商品标记。顾客尚未同意前不得加预算。
```

### 2) no_match_for_query（原行加条件 + 新增一行）

原行改为：
```
- no_match_for_query（outfits为空）：只说明在已核对搭配范围内，当前条件未找到组合，不冒称全店或所有商品已穷举。不要把未知搭配当禁配，不断言加预算一定能解决。
```
并新增：
```
- no_match_for_query（outfits非空）：按 D01-1 说明没有完全匹配，展示outfits中最接近的已核对组合并标明违反哪一条，给出两个出口（调整条件 / 先到这里），最后询问是否需要转人工（演示）；输出对应商品标记，不得称为推荐或可接受。
```

### 3) 「只在 matched_known_constraints 时输出 [[PRODUCTS:...]]」这类限制句

替换前：
```
本分支仅在matched_known_constraints且products非空时输出[[PRODUCTS:...]]，ID只取本轮products中的真实id。currentProduct的ID、outfits里的anchorProductId、规则ID以及历史商品ID均不加入标记；新候选最多4件，不重复推荐搭配主体。
```

替换后：
```
本分支在matched_known_constraints且products非空，或按 D01-1 展示最接近组合（over_budget、no_match_for_query 且 outfits 非空）时输出[[PRODUCTS:...]]，ID只取本轮products或outfits中candidateProductId对应的真实id（必须来自本轮工具结果）。currentProduct的ID、规则ID以及历史商品ID均不加入标记；新候选最多4件，不重复推荐搭配主体。
```

## 为什么两段都要改

两段是**互斥**的：一次请求只会走其中一段（工具返回 scope 决定）。
- 只改单品段 → 「从商品页进来再配裤子」的无匹配仍然只问提不提高预算。
- 只改搭配段 → 「只说品类」的无匹配（如 R02-T2）仍然不出卡片。

## 仓库里对应的源文件

- `memory-bank/m5-catalog-answer-system.txt`（单品段全文）
- `memory-bank/m5-outfit-answer-rules.txt`（搭配段全文）

用户实测发现 Dify 线上版本比仓库文档新（多了 reportedPriceCents / purchaseBasis 两句），因此**以 Dify 编辑器里的原文为准做替换**，不要把整份文件覆盖粘贴。
