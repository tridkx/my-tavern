# MyTavern · 精简版酒馆

> 本项目由 AI 辅助完成。技术架构、数据模型、API 与维护指南见 [docs/TECHNICAL.md](docs/TECHNICAL.md)。

一个面向自部署的精简版 SillyTavern：支持任意 OpenAI 兼容模型后端、角色卡与世界书、TTS 语音输出、图片生成、群聊（AI 同伴 / GM / AI 敌人）、移动端友好。

## 功能

- **多后端模型连接**：每个连接可独立配置 API 地址、Key、模型名、上下文长度、采样参数；内置 DeepSeek、OpenCode Go、OpenAI、Kimi、GLM、Qwen、OpenRouter、Groq、Mistral、Together、SiliconFlow、Ollama、LM Studio、vLLM 等预设。
- **角色卡**：通用/专用角色卡，专用角色绑定世界书；支持创建、编辑、导入导出（Tavern V2 JSON / PNG 图片卡）、AI 生成/润色。
- **世界书**：关键词触发、常驻、概率、顺序等条目；支持创建、导入导出、AI 生成。
- **聊天**：流式输出、停止、重新生成、手动编辑/删除消息、从任意消息分支新会话、上下文预览（Token 估算）；会话可绑定背景图。
- **群聊**：AI 同伴、GM、AI 敌人，每个角色可指定不同模型连接；支持轮询/随机/手动发言模式；敌人行动可对玩家隐藏，GM Prompt 会显式约束不得透露隐藏行动。
- **语音输出**：OpenAI 兼容 `/audio/speech` TTS，可独立使用。
- **图片生成**：OpenAI 兼容 `/images/generations`，可独立使用并保存到资源库。
- **资源库**：背景图、头像、图片、语音统一管理，支持上传/URL/AI 生成。
- **移动端**：响应式 + PWA（可安装、离线缓存），可部署到云服务器后通过公网端口访问。
- **访问保护**：设置 `ACCESS_TOKEN` 后启用口令登录，保护 `/api` 与 `/media`。

## 技术栈

- 后端：Node.js + TypeScript + Fastify + SQLite（`node:sqlite`，无原生编译依赖）
- 前端：Vue 3 + Vite + Pinia + Vue Router
- 存储：SQLite 单文件，数据目录 `data/`

## 本地开发

要求 Node.js >= 22.5（使用内置 `node:sqlite`）。

```bash
npm install
npm run dev
```

- 前端开发服务器：http://localhost:5173
- 后端 API：http://localhost:3000

生产构建：

```bash
npm run build
npm start
```

## 配置

环境变量：

| 变量 | 说明 |
| --- | --- |
| `PORT` | 服务端口，默认 `3000` |
| `HOST` | 监听地址，默认 `0.0.0.0` |
| `ACCESS_TOKEN` | 访问口令，留空表示不开启登录（公网部署务必设置） |
| `MY_TAVERN_DATA` | 数据目录，默认项目下 `data/` |
| `CORS_ORIGIN` | 允许跨域的来源（逗号分隔，如 `https://a.com,https://b.com`）。留空则关闭跨域；同源部署无需设置 |
| `TRUST_PROXY` | 在可信反向代理（Nginx/Caddy）后设为 `1`，让登录限流使用真实客户端 IP |
| `COOKIE_SECURE` | 设为 `1` 时登录 Cookie 增加 `Secure` 标志并使用 `__Host-` 前缀（仅在全 HTTPS 下启用） |
| `LOGIN_MAX_ATTEMPTS` | 登录限流：单个 IP 在窗口内允许的失败次数，默认 `10`；`0` 关闭 |
| `LOGIN_WINDOW_MS` | 登录限流窗口，默认 `900000`（15 分钟） |
| `OUTBOUND_TIMEOUT_MS` | 出站模型请求超时，默认 `120000`（120 秒） |
| `MAX_CONCURRENT_GENERATIONS` | 并发生成上限，超出返回 429，默认 `8` |
| `MAX_CONCURRENT_MEDIA_GENERATIONS` | TTS/图片生成并发上限，超出返回 429，默认 `4` |
| `MAX_CONCURRENT_UPLOADS` | 上传并发上限（防止大文件同时读入内存），超出返回 429，默认 `4` |
| `ALLOW_PRIVATE_BASE_URLS` | 设为 `false` 时拒绝把请求发往私网/环回地址（防 SSRF）；默认允许以兼容本地 Ollama / LM Studio / vLLM |
| `DEEPSEEK_API_KEY` / `OPENCODE_GO_API_KEY` / ... | 首次启动时会自动创建对应预设连接 |

### 安全配置建议（公网部署）

1. **必须设置 `ACCESS_TOKEN`**；服务启动时若检测到未设置口令且监听地址不是回环地址，会打印醒目警告。口令建议 12 位以上随机字符串（过短时启动会提示）。
2. 全部流量走 HTTPS（Caddy/Nginx 反代），并设置 `COOKIE_SECURE=1`，让登录 Cookie 只通过加密连接传输。
3. 设置 `CORS_ORIGIN=你的域名`，收紧跨域来源。
4. 如果前面有 Nginx/Caddy 反向代理，设置 `TRUST_PROXY=1`，否则登录限流会按代理 IP 统计。
5. 上传仅接受图片（png/jpg/gif/webp）与音频（mp3/ogg/wav/flac/m4a），服务端按魔数校验真实类型；上传内容一律 `nosniff`，杜绝 HTML/SVG 存储型 XSS。
6. 如果不需要连接本地模型（Ollama/LM Studio），可设 `ALLOW_PRIVATE_BASE_URLS=false` 启用 SSRF 防护。

## Docker 部署

```bash
cp .env.example .env
# 编辑 .env，至少设置 ACCESS_TOKEN 和你的 API Key
docker compose up -d --build
```

公网访问时建议在前面再加一层 HTTPS 反向代理（Caddy/Nginx），参考 `deploy/nginx.conf` 和 `deploy/Caddyfile`。注意代理需要关闭缓冲以支持 SSE 流式输出。

## 如何更新已部署的实例

### Docker Compose 方式

```bash
cd /path/to/my-tavern
git pull
docker compose up -d --build
```

- `git pull` 拉取最新代码。
- `docker compose up -d --build` 重新构建镜像并重建容器。
- `./data` 目录通过 volume 挂载，数据库与上传文件不会丢失。
- 如果 `.env.example` 增加了新环境变量，记得同步到你的 `.env`。

### 非 Docker 方式

```bash
cd /path/to/my-tavern
git pull
npm ci
npm run build
# 重启后端进程，例如 pm2 restart my-tavern 或 systemctl restart my-tavern
```

## 什么是反向代理？

反向代理（Reverse Proxy）是放在公网用户和你的应用之间的一层服务器。用户访问 `https://your.domain.com`，反向代理再把请求转发给本机 `127.0.0.1:3000` 的 MyTavern。

它主要解决：

1. **HTTPS 加密**：用户通过 `https` 访问，数据加密传输。
2. **隐藏真实端口/服务器**：公网只需开放 80/443。
3. **SSE 流式支持**：Nginx/Caddy 正确配置后，AI 回复可以流式输出。
4. **统一入口**：以后加多个服务时可以在同一域名下分发。

示例见 `deploy/nginx.conf` 和 `deploy/Caddyfile`。

## 目录结构

```
server/          Fastify 后端
  src/
    db/          SQLite schema
    providers/   OpenAI 兼容客户端与预设
    routes/      REST/SSE 路由
    services/    上下文构建、AI 工具、Tavern 格式转换
web/             Vue 3 前端
docs/            技术文档
deploy/          Nginx / Caddy 反代示例
data/            SQLite 与上传资源（不入库）
```

## 路线图

- [x] 项目骨架、SQLite、连接/角色/世界书/会话/消息/群聊/资源数据模型
- [x] OpenAI 兼容聊天（流式）、TTS、图片生成 API
- [x] 角色卡/世界书导入导出与 AI 生成润色
- [x] PNG 图片角色卡导入导出（WebP 导入为尽力支持）
- [x] 群聊隐藏行动约束、轮询/随机/手动发言模式
- [x] 移动端基础 UI、PWA 离线缓存
- [x] 分支会话、删除后续消息、上下文预览/Token 估算
- [x] HTTPS 反代示例（Nginx/Caddy）
- [ ] 消息自动摘要
- [ ] 更多 TTS/图片提供商
