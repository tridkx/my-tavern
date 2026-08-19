# MyTavern 技术文档

> 本仓库由 AI 辅助完成。本文档面向后续维护的开发者或 AI 助手，描述架构、数据模型、API、扩展方式与部署更新流程。

## 1. 项目概览

MyTavern 是一个自部署的精简版 SillyTavern（酒馆），核心能力：

- 任意 OpenAI 兼容后端（多连接、每连接独立采样参数）
- 角色卡 / 世界书管理与 Tavern V2 导入导出
- 单聊 / 群聊（AI 同伴、GM、AI 敌人、隐藏行动）
- TTS 语音输出、OpenAI 兼容图片生成
- 移动端友好、PWA、可选访问口令保护

技术栈：

| 层 | 技术 |
| --- | --- |
| 后端 | Node.js >= 22.5、TypeScript、Fastify 5、SQLite（内置 `node:sqlite`） |
| 前端 | Vue 3、Vite 6、Pinia、Vue Router、TypeScript |
| 部署 | Docker / docker-compose、Nginx/Caddy 反代 |

## 2. 目录结构

```
my-tavern/
├── server/                 # Fastify 后端
│   ├── src/
│   │   ├── index.ts        # 入口：启动 HTTP 服务
│   │   ├── app.ts          # 组装 Fastify 插件、路由、静态资源、鉴权
│   │   ├── config.ts       # 路径、端口、环境变量
│   │   ├── auth.ts         # ACCESS_TOKEN 登录/鉴权（限流、恒定时间比较）
│   │   ├── active.ts       # 流式生成 AbortController 注册表（并发生成上限）
│   │   ├── net.ts          # URL/私网地址校验（防 SSRF、URL 协议白名单）
│   │   ├── seed.ts         # 首次启动根据环境变量创建默认连接
│   │   ├── types.ts        # 实体与 OpenAI 请求类型
│   │   ├── db/
│   │   │   ├── schema.ts   # SQLite DDL
│   │   │   └── database.ts # 数据库连接与查询辅助
│   │   ├── repo.ts         # 所有数据访问 CRUD
│   │   ├── providers/
│   │   │   ├── presets.ts  # 内置提供商预设
│   │   │   └── openai.ts   # chat/completions、images、audio/speech 客户端
│   │   ├── routes/         # REST / SSE 路由
│   │   │   ├── connections.ts
│   │   │   ├── characters.ts
│   │   │   ├── worldbooks.ts
│   │   │   ├── chat.ts
│   │   │   ├── groups.ts
│   │   │   ├── tts.ts
│   │   │   ├── images.ts
│   │   │   └── media.ts
│   │   └── services/
│   │       ├── context.ts  # 单聊/群聊 Prompt 构造、世界书匹配、Token 估算
│   │       ├── aiTools.ts  # 角色卡/世界书 AI 生成与润色
│   │       ├── tavern.ts   # Tavern V2 JSON 与世界书格式转换
│   │       └── imageCard.ts# PNG/WebP 角色卡内嵌 JSON 解析与生成
│   └── tests/              # Vitest 单元测试
├── web/                    # Vue 3 前端
│   ├── public/             # PWA manifest、sw.js、图标
│   └── src/
│       ├── api/client.ts   # fetch 封装、SSE 流解析
│       ├── stores/         # Pinia（app/chat）
│       ├── views/          # 页面组件
│       └── styles/         # 全局样式
├── deploy/                 # Nginx / Caddy 反代示例
├── data/                   # 运行时数据（SQLite、上传文件；gitignored）
└── README.md
```

## 3. 数据模型

SQLite 单文件 `data/my-tavern.db`，核心表：

| 表 | 用途 | 关键字段 |
| --- | --- | --- |
| `connections` | 模型连接 | `base_url`, `api_key`, `api_key_env`, `model`, `context_window`, `max_tokens`, 采样参数, `is_default` |
| `characters` | 角色卡 | `name`, `description`, `personality`, `scenario`, `first_mes`, `mes_example`, `system_prompt`, `worldbook_id`, `connection_id`, `kind` |
| `worldbooks` | 世界书 | `name`, `description` |
| `worldbook_entries` | 世界书条目 | `key`(JSON 数组), `content`, `constant`, `probability`, `order_index`, `position` |
| `chats` | 会话 | `mode`(`single`/`group`), `character_id`, `group_id`, `background_id` |
| `messages` | 消息 | `role`, `character_id`, `content`, `visible_to_player`, `connection_id` |
| `groups` | 群聊 | `gm_character_id`, `settings`(JSON) |
| `group_members` | 群聊成员 | `kind`(`player`/`companion`/`gm`/`enemy`), `connection_id` |
| `media` | 媒体资源 | `kind`, `file_path`, `source`, `url`, `meta` |
| `settings` | 全局 KV 设置 | `key`, `value` |

注意：

- 所有“布尔值”在 SQLite 中存为 `0/1` 整数；API 输入输出使用 JSON `boolean`，路由层负责转换。
- JSON 字段（`tags`、`key`、`settings`、`meta`、`stop_sequences`、`extra_headers`）以 TEXT 存储，`repo.ts` 中负责解析。

## 4. 核心流程

### 4.1 单聊生成

1. 前端 `POST /api/chat/generate`，SSE 流式返回。
2. 后端先保存用户消息，再创建空 assistant 消息占位。
3. `buildSingleTurnMessages` 构造：
   - 角色卡系统提示（人设、性格、场景、示例对话）
   - 世界书命中条目（关键词触发 + 常驻）
   - 历史消息
   - 当前用户输入
4. 调用 `streamChat`（OpenAI 兼容 `/chat/completions`），逐段把 `delta` 通过 SSE 发给前端。
5. 结束后更新 assistant 消息内容，发送 `done` 事件。
6. `active.ts` 保存 AbortController，支持 `/api/chat/stop` 中断。

### 4.2 群聊生成

- `POST /api/chat/generate-group`
- 发言人选择：
  - 手动模式：前端传 `speakerId`
  - 轮询/随机：`pickNextSpeaker`
  - 如果最后一条是隐藏的敌人行动且群里有 GM，则优先让 GM 发言，降低泄露风险
- `buildGroupTurnMessages` 会把成员表、当前身份、GM 规则、隐藏信息规则写入系统提示。
- 隐藏消息（`visible_to_player=0`）仍会进入模型上下文，但加 `【隐藏信息，禁止向玩家公开提及】` 前缀，并在系统提示中要求不得透露。

### 4.3 世界书匹配

`findWorldbookHits`：

- `constant=1` 条目始终注入
- 其他条目按 `key` 在“历史 + 当前输入”中做不区分大小写包含匹配
- 按 `order_index` 排序后拼入系统提示

### 4.4 Token 估算

`estimateTokens` 是粗略估算：

- 中文字符按 `1/1.5` token
- 其他字符按 `1/4` token

不是真实 tokenizer，仅用于上下文预览和粗略截断。

## 5. API 一览

### 系统 / 鉴权

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/auth/status` | 是否开启口令、当前是否已认证 |
| POST | `/api/auth/login` | 口令登录，写 HttpOnly Cookie |
| POST | `/api/auth/logout` | 登出 |

### 连接与提供商

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/providers/presets` | 内置提供商预设 |
| GET/POST | `/api/connections` | 连接列表 / 新建 |
| PUT/DELETE | `/api/connections/:id` | 更新 / 删除 |

### 角色卡

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/characters` | 列表 / 新建 |
| GET/PUT/DELETE | `/api/characters/:id` | 详情 / 更新 / 删除 |
| GET | `/api/characters/:id/export` | 导出 Tavern V2 JSON |
| GET | `/api/characters/:id/export-image` | 导出 PNG 图片卡 |
| POST | `/api/characters/import` | 导入 JSON（body `{json}`） |
| POST | `/api/characters/import-file` | 导入 PNG/WebP/JSON 文件（multipart） |
| POST | `/api/characters/ai/generate` | AI 生成角色草稿 |
| POST | `/api/characters/:id/ai/polish` | AI 润色角色 |

### 世界书

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/worldbooks` | 列表 / 新建 |
| GET | `/api/worldbooks/:id` | 世界书 + 条目 |
| PUT/DELETE | `/api/worldbooks/:id` | 更新 / 删除 |
| POST | `/api/worldbooks/:id/entries` | 新建条目 |
| PUT/DELETE | `/api/worldbook-entries/:id` | 更新 / 删除条目 |
| GET | `/api/worldbooks/:id/export` | 导出 SillyTavern World Info JSON |
| POST | `/api/worldbooks/import` | 导入世界书 |
| POST | `/api/worldbooks/ai/generate` | AI 生成世界书条目 |

### 会话与消息

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/chats` | 会话列表 / 新建 |
| GET | `/api/chats/:id` | 会话详情 + 消息 |
| PATCH/DELETE | `/api/chats/:id` | 更新 / 删除 |
| GET/POST | `/api/chats/:id/messages` | 消息列表 / 手工新增 |
| PATCH/DELETE | `/api/messages/:id` | 编辑 / 删除消息 |
| POST | `/api/messages/:id/regenerate` | 重新生成 |
| POST | `/api/messages/:id/delete-after` | 删除该消息之后的所有消息 |
| POST | `/api/chats/:id/fork` | 从指定消息分支新会话 |
| POST | `/api/chats/:id/context-preview` | 返回实际构造的 Prompt 与 Token 估算 |
| POST | `/api/chat/generate` | 单聊 SSE 生成 |
| POST | `/api/chat/stop` | 停止生成 |

### 群聊

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/groups` | 群聊列表 / 新建 |
| GET | `/api/groups/:id` | 群聊详情 + 成员 |
| PATCH/DELETE | `/api/groups/:id` | 更新 / 删除 |
| POST | `/api/groups/:id/members` | 添加成员 |
| PATCH/DELETE | `/api/group-members/:id` | 更新 / 移除成员 |
| POST | `/api/chat/generate-group` | 群聊 SSE 生成 |

### 工具与资源

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/tts` | 文本转语音，返回音频流 |
| POST | `/api/images/generate` | OpenAI 兼容图片生成 |
| GET | `/api/media` | 资源列表（可按 `kind` 过滤） |
| POST | `/api/media/upload` | multipart 上传 |
| POST | `/api/media/from-url` | 保存 URL 资源 |
| DELETE | `/api/media/:id` | 删除资源 |

## 6. 如何新增一个提供商

1. 打开 `server/src/providers/presets.ts`。
2. 在 `PROVIDER_PRESETS` 数组新增：

```ts
{
  id: 'my-provider',
  name: '我的服务',
  baseUrl: 'https://api.example.com/v1',
  apiKeyEnv: 'MY_PROVIDER_API_KEY', // 可选，留空表示手动填 Key
  models: [
    { id: 'model-a', name: 'Model A', contextWindow: 8192, maxTokens: 2048 },
  ],
}
```

3. 如果服务兼容 OpenAI `/chat/completions`，无需改代码即可用。
4. 在 `.env.example` 和 `docker-compose.yml` 中补充环境变量。

## 7. 如何新增一个后端路由

1. 在 `server/src/routes/` 下新建或修改文件。
2. 导出 `registerXxxRoutes(app: FastifyInstance)`。
3. 在 `server/src/app.ts` 中调用注册函数。
4. 数据访问统一走 `server/src/repo.ts`。
5. 前端在 `web/src/api/client.ts` 使用 `api.get/post/...` 或 `streamPost` 调用。

## 8. 如何新增前端页面

1. 在 `web/src/views/` 新建 `.vue`。
2. 在 `web/src/router.ts` 注册路由。
3. 在 `web/src/App.vue` 底部导航加入口。
4. 状态管理放 `web/src/stores/`。

## 9. 构建与测试

```bash
# 安装依赖
npm install

# 本地开发（前后端并行）
npm run dev

# 生产构建
npm run build

# 启动生产服务
npm start

# 后端单元测试
npm test -w server

# 单独构建后端/前端
npm run build -w server
npm run build -w web
```

## 10. 部署与更新

### 首次部署（Docker Compose）

```bash
git clone https://github.com/tridkx/my-tavern.git
cd my-tavern
cp .env.example .env
# 编辑 .env：设置 ACCESS_TOKEN、API Key、PORT
docker compose up -d --build
```

### 更新已有 Docker 实例

```bash
cd /path/to/my-tavern
git pull
docker compose up -d --build
```

- `git pull` 拉取新代码
- `docker compose up -d --build` 重新构建镜像并滚动重建容器
- `./data` 挂载在宿主机，数据库和上传文件不会丢失
- 若 `.env.example` 出现新变量，记得同步到 `.env`

### 非 Docker 更新

```bash
cd /path/to/my-tavern
git pull
npm ci          # 或 npm install
npm run build
# 重启后端进程，例如：
# pm2 restart my-tavern
# 或 systemctl restart my-tavern
```

### 数据库兼容

- 使用 SQLite `CREATE TABLE IF NOT EXISTS`，新增表会自动创建。
- 如果后续修改了已有表结构，需要额外写迁移脚本，不能只改 `schema.ts`（已存在的表不会自动加列）。

## 11. 安全注意事项

- `ACCESS_TOKEN` 是公网部署的第一道防线；生产环境务必设置。启动时若未设置且监听地址非回环，会打印醒目警告。
- API Key 存储在后端 SQLite/环境变量，`/api/connections` 返回时已脱敏（`api_key` 为空，`has_api_key` 表示是否存在）。
- 如果通过公网直接暴露 3000 端口，建议用 Nginx/Caddy 加 HTTPS，并参考 `deploy/` 示例关闭 SSE 缓冲；HTTPS 下建议设 `COOKIE_SECURE=1`（Cookie 加 `Secure` 并启用 `__Host-` 前缀）。
- 生产建议设 `CORS_ORIGIN=你的域名` 收紧跨域来源；默认关闭跨域（同源部署不受影响）。
- 在 Nginx/Caddy 后部署时建议设 `TRUST_PROXY=1`，否则登录限流按代理 IP 统计。
- 登录接口有限流（默认 15 分钟窗口内 10 次失败，按 IP + 全局兜底），口令比较使用恒定时间算法。
- 媒体上传只接受图片（png/jpg/gif/webp）与音频（mp3/ogg/wav/flac/m4a），服务端按魔数校验真实类型并以嗅探结果命名存储；`/media` 静态响应带 `nosniff` 与 `X-Frame-Options: DENY`。API 响应不回传服务器绝对路径（`file_path`）。
- `base_url` 完全由用户配置，出站请求支持超时（`OUTBOUND_TIMEOUT_MS`，默认 120s）。若不需要本地模型（Ollama/LM Studio），设 `ALLOW_PRIVATE_BASE_URLS=false` 可拒绝发往私网/环回地址的请求（防 SSRF）；聊天、图片、TTS 均会校验，并手动处理重定向避免绕过。
- `api_key_env` 仅允许引用内置提供商预设的白名单环境变量，避免任意读取服务器环境变量外带。
- 未预期的 500 错误只返回通用文案，内部细节仅记录在服务端日志。
- 前端启用 CSP（`web/index.html`），消息渲染全部走文本插值（无 `v-html`），会话 Cookie 为 `HttpOnly` + `SameSite=Lax`。
- `data/` 包含用户数据和 API Key，必须保持 gitignored，不要提交。

## 12. 已知限制与后续方向

- WebP 导入是“尽力解析”，尚未用真实 WebP 卡片样本验证。
- Token 估算不是真实 tokenizer。
- 群聊 GM 调度是简单规则，可继续扩展。
- 消息自动摘要尚未实现。
- 更多 TTS/图片后端可扩展。
