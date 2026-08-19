# MyTavern · 精简版酒馆

一个面向自部署的精简版 SillyTavern：支持任意 OpenAI 兼容模型后端、角色卡与世界书、TTS 语音输出、图片生成、群聊（AI 同伴 / GM / AI 敌人）、移动端友好。

## 功能

- **多后端模型连接**：每个连接可独立配置 API 地址、Key、模型名、上下文长度、采样参数；内置 DeepSeek、OpenCode Go、OpenAI、Kimi、GLM、Qwen、OpenRouter、Groq、Mistral、Together、SiliconFlow、Ollama、LM Studio、vLLM 等预设。
- **角色卡**：通用/专用角色卡，专用角色绑定世界书；支持创建、编辑、导入导出（Tavern V2 JSON）、AI 生成/润色。
- **世界书**：关键词触发、常驻、概率、顺序等条目；支持创建、导入导出、AI 生成。
- **聊天**：流式输出、停止、重新生成、手动编辑/删除消息；会话可绑定背景图。
- **群聊**：AI 同伴、GM、AI 敌人，每个角色可指定不同模型连接；敌人行动可对玩家隐藏，GM Prompt 会显式约束不得透露隐藏行动。
- **语音输出**：OpenAI 兼容 `/audio/speech` TTS，可独立使用。
- **图片生成**：OpenAI 兼容 `/images/generations`，可独立使用并保存到资源库。
- **资源库**：背景图、头像、图片、语音统一管理，支持上传/URL/AI 生成。
- **移动端**：响应式 + PWA，可部署到云服务器后通过公网端口访问。
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
| `DEEPSEEK_API_KEY` / `OPENCODE_GO_API_KEY` / ... | 首次启动时会自动创建对应预设连接 |

## Docker 部署

```bash
cp .env.example .env
# 编辑 .env，至少设置 ACCESS_TOKEN 和你的 API Key
docker compose up -d --build
```

公网访问时建议在前面再加一层 HTTPS 反向代理（Caddy/Nginx）。

## 目录结构

```
server/          Fastify 后端
  src/
    db/          SQLite schema
    providers/   OpenAI 兼容客户端与预设
    routes/      REST/SSE 路由
    services/    上下文构建、AI 工具、Tavern 格式转换
web/             Vue 3 前端
data/            SQLite 与上传资源（不入库）
```

## 路线图

- [x] 项目骨架、SQLite、连接/角色/世界书/会话/消息/群聊/资源数据模型
- [x] OpenAI 兼容聊天（流式）、TTS、图片生成 API
- [x] 角色卡/世界书导入导出与 AI 生成润色
- [x] 群聊隐藏行动约束
- [x] 移动端基础 UI
- [ ] PNG/WebP 角色卡内嵌 JSON 导入
- [ ] 分支时间线、消息摘要
- [ ] 更多 TTS/图片提供商
