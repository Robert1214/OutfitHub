# M5 本地 Dify 配置指南

> 状态：本地 Dify 已连通（2026-11-03）。
> 本机 Dify：`http://localhost`，版本 `1.16.0`。
> Next 开发服务器：`http://localhost:3000`。
> Dify API：`http://localhost/v1`（未带 Key 返回 401，说明已通）。

## 1. 已验证的网络关系

```text
宿主机浏览器 → http://localhost:3000                 ✅
Dify 容器 → http://host.docker.internal:3000          ✅
Dify 容器 → /api/assistant/products（带工具 token）   ✅
Dify SSRF 代理 → host.docker.internal:3000            ✅
```

- 浏览器不要用 `host.docker.internal`，那是容器内部地址。
- Dify HTTP 工具使用 `http://host.docker.internal:3000`。
- 当前商品工具已实现，不带 token 返回 401，带 token 返回商品 JSON。

### 本地 Dify 的 SSRF 白名单

Dify 默认会拦截私有地址。已在 Dify 的 `docker/.env` 增加：

```env
SSRF_PROXY_ALLOW_PRIVATE_DOMAINS=host.docker.internal
```

并重启：

```bash
cd <dify>/docker
docker compose up -d --force-recreate ssrf_proxy
```

验证生成的 Squid 配置包含：

```text
acl dify_allowed_private_domains dstdomain host.docker.internal
http_access allow client_localnet dify_allowed_private_domains
```

## 2. 商品工具配置

在 Dify 中创建自定义 HTTP 工具或 HTTP Request 节点：

```text
GET http://host.docker.internal:3000/api/assistant/products
```

Header：

```text
x-assistant-token: <从项目 .env.local 的 ASSISTANT_TOOL_TOKEN 读取>
```

不要把这个 token 写进前端、Prompt 或提交到 Git。

支持参数：

| 参数 | 说明 |
| --- | --- |
| `q` | 关键词 |
| `category` | 分类 slug：tops / bottoms / dresses / outerwear / accessories / shoes |
| `color` | 颜色 |
| `refType` | GARMENT / ACCESSORIES / SHOES |
| `styleTags` | 逗号分隔，如 `中性,复古` |
| `occasionTags` | 逗号分隔，如 `通勤,约会` |
| `minPriceCents` / `maxPriceCents` | 预算，分 |
| `similarTo` | 商品 ID；相似款忽略预算 |
| `contextProductId` | 当前商品 ID；用于搭配/相似款识别，不传则按普通搜索 |
| `ids` | 逗号分隔，前端/工具按 ID 取卡片 |
| `limit` | 1~12，默认 8 |

测试请求：

```text
GET .../api/assistant/products?q=通勤&limit=3
GET .../api/assistant/products?styleTags=中性&occasionTags=通勤&limit=5
GET .../api/assistant/products?similarTo=<商品ID>&limit=3
```

## 3. 你在 Dify 里要做的步骤

1. 打开 `http://localhost`，用本地 Dify 账号登录。
2. 创建 Chatflow 应用，命名 `Wardrobe 导购助手 v0`。
3. 配置 DeepSeek 模型供应商（若尚未配置）。
4. 创建知识库，上传政策/FAQ/尺码指南（内容由我起草，你审核）。
5. 添加 HTTP 工具，按上面的 URL 和 Header 配置。
6. 按 `m5-eval.md` / `m5-contract.md` 搭意图路由和分支。
7. 发布应用，复制 API Key。
8. 把 API Key 写入项目 `.env.local` 的 `DIFY_API_KEY`，不要发到聊天里。
9. 告诉我“已配置”，我继续接 `/api/chat`、商品卡片和日志。

## 4. 当前 Dify 工具测试结果

```text
无 token             → 401
带 token q=通勤      → 200，返回商品 JSON
带 token similarTo   → 200，返回相似商品
Dify 容器访问        → 200
```

## 5. 商品上下文输入变量检查

商品页「问导购」会把 `product_context` 作为 Dify 输入发送。用 Dify API 检查应用是否已经声明该变量：

```bash
curl -s http://localhost/v1/parameters \
  -H "Authorization: Bearer <DIFY_API_KEY>"
```

返回的 `user_input_form` 里应出现：

```json
{
  "variable": "product_context",
  "label": "当前商品资料",
  "type": "paragraph",
  "required": false
}
```

如果没有，Dify 会忽略 `product_context`，回答仍会拿错商品。按 `m5-dify-chatflow.md` 第 7 节在 Start 节点添加后，重新发布应用再看一次。

## 6. 注意事项

- 本地 Dify 版本 `1.16.0`；如果 Chatflow 里有 Agent 节点，复杂分支可以直接用；没有则在 Next 服务端实现受限 Agent 循环。
- 商品工具只返回 `ON_SALE`；`ids` 模式也不会返回已售出商品。
- `returnPolicy` 已随商品数据返回；5 件不可退测试商品见 `m5-product-data.md`。
- 不要修改 `.env.local` 里的腾讯云/Dify 密钥；新增的 `ASSISTANT_TOOL_TOKEN` 只给 Dify 工具用。
