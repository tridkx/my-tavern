import type { Connection, ProviderPreset } from '../types.js';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek-official',
    name: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 65536, maxTokens: 8192 },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', contextWindow: 65536, maxTokens: 8192 },
    ],
  },
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    baseUrl: 'https://api.opencodego.com/v1',
    apiKeyEnv: 'OPENCODE_GO_API_KEY',
    models: [
      { id: 'qwen3.7-max', name: 'Qwen3.7 Max', contextWindow: 1000000, maxTokens: 65536 },
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', contextWindow: 1000000, maxTokens: 384000 },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', contextWindow: 1000000, maxTokens: 384000 },
      { id: 'glm-5.2', name: 'GLM-5.2', contextWindow: 1000000, maxTokens: 131072 },
      { id: 'kimi-k3', name: 'Kimi K3', contextWindow: 1048576, maxTokens: 131072 },
      { id: 'grok-4.5', name: 'Grok 4.5', contextWindow: 500000, maxTokens: 500000 },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    types: ['llm', 'tts', 'image'],
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, maxTokens: 16384 },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', contextWindow: 128000, maxTokens: 16384 },
      { id: 'o3-mini', name: 'o3-mini', contextWindow: 200000, maxTokens: 100000 },
    ],
  },
  {
    id: 'moonshot',
    name: 'Moonshot / Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
    models: [
      { id: 'kimi-k2-0711-preview', name: 'Kimi K2', contextWindow: 128000, maxTokens: 16384 },
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', contextWindow: 8192, maxTokens: 2048 },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', contextWindow: 32768, maxTokens: 8192 },
    ],
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'ZHIPU_API_KEY',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus', contextWindow: 128000, maxTokens: 8192 },
      { id: 'glm-4-air', name: 'GLM-4 Air', contextWindow: 128000, maxTokens: 8192 },
    ],
  },
  {
    id: 'qwen',
    name: '阿里云通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    models: [
      { id: 'qwen-max', name: 'Qwen Max', contextWindow: 32768, maxTokens: 8192 },
      { id: 'qwen-plus', name: 'Qwen Plus', contextWindow: 131072, maxTokens: 8192 },
      { id: 'qwen-turbo', name: 'Qwen Turbo', contextWindow: 131072, maxTokens: 8192 },
    ],
  },
  {
    id: 'dashscope-tts',
    name: '阿里云 CosyVoice（语音）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    types: ['tts'],
    models: [
      { id: 'cosyvoice-v2', name: 'CosyVoice V2', contextWindow: 8192, maxTokens: 4096 },
      { id: 'cosyvoice-v1', name: 'CosyVoice V1', contextWindow: 8192, maxTokens: 4096 },
    ],
  },
  {
    id: 'dashscope-image',
    name: '阿里云通义万相（图片）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    types: ['image'],
    models: [
      { id: 'wanx2.1-t2i-turbo', name: '万相 2.1 Turbo', contextWindow: 8192, maxTokens: 4096 },
      { id: 'wanx2.1-t2i-plus', name: '万相 2.1 Plus', contextWindow: 8192, maxTokens: 4096 },
    ],
  },
  {
    id: 'volcengine-image',
    name: '火山引擎豆包 Seedream（图片）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyEnv: 'VOLCENGINE_API_KEY',
    types: ['image'],
    models: [
      { id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0', contextWindow: 8192, maxTokens: 4096 },
      { id: 'doubao-seedream-5-0-pro-260628', name: 'Seedream 5.0 Pro', contextWindow: 8192, maxTokens: 4096 },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    models: [
      { id: 'openai/gpt-4o', name: 'GPT-4o via OpenRouter', contextWindow: 128000, maxTokens: 16384 },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: 200000, maxTokens: 8192 },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat via OpenRouter', contextWindow: 65536, maxTokens: 8192 },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, maxTokens: 32768 },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', contextWindow: 8192, maxTokens: 8192 },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000, maxTokens: 8192 },
      { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 32000, maxTokens: 8192 },
    ],
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyEnv: 'TOGETHER_API_KEY',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Instruct', contextWindow: 128000, maxTokens: 8192 },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen2.5 72B', contextWindow: 131072, maxTokens: 8192 },
    ],
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKeyEnv: 'SILICONFLOW_API_KEY',
    types: ['llm', 'tts', 'image'],
    models: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', contextWindow: 65536, maxTokens: 8192 },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5 72B', contextWindow: 131072, maxTokens: 8192 },
    ],
  },
  {
    id: 'xai',
    name: 'xAI / Grok',
    baseUrl: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
    models: [
      { id: 'grok-beta', name: 'Grok Beta', contextWindow: 131072, maxTokens: 8192 },
      { id: 'grok-2-1212', name: 'Grok 2', contextWindow: 131072, maxTokens: 8192 },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
    models: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', contextWindow: 128000, maxTokens: 8192 },
      { id: 'qwen/qwen2.5-72b-instruct', name: 'Qwen2.5 72B', contextWindow: 131072, maxTokens: 8192 },
    ],
  },
  {
    id: 'github-models',
    name: 'GitHub Models',
    baseUrl: 'https://models.github.ai/inference',
    apiKeyEnv: 'GITHUB_TOKEN',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, maxTokens: 16384 },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', contextWindow: 128000, maxTokens: 16384 },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    apiKeyEnv: '',
    models: [
      { id: 'llama3.1', name: 'Llama 3.1', contextWindow: 128000, maxTokens: 8192 },
      { id: 'qwen2.5', name: 'Qwen 2.5', contextWindow: 32768, maxTokens: 8192 },
    ],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (本地)',
    baseUrl: 'http://localhost:1234/v1',
    apiKeyEnv: '',
    models: [
      { id: 'local-model', name: '本地模型', contextWindow: 8192, maxTokens: 2048 },
    ],
  },
  {
    id: 'vllm',
    name: 'vLLM (本地)',
    baseUrl: 'http://localhost:8000/v1',
    apiKeyEnv: '',
    models: [
      { id: 'local-model', name: '本地模型', contextWindow: 8192, maxTokens: 2048 },
    ],
  },
];

export function getProviderPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}

/** 允许通过连接配置引用的环境变量白名单，防止任意读取服务器环境变量。 */
export const ALLOWED_API_KEY_ENVS = new Set<string>(
  PROVIDER_PRESETS.map((p) => p.apiKeyEnv).filter((v): v is string => Boolean(v)),
);

export function resolveApiKey(connection: Connection): string {
  if (connection.api_key_env && ALLOWED_API_KEY_ENVS.has(connection.api_key_env)) {
    const envValue = process.env[connection.api_key_env];
    if (envValue) return envValue;
  }
  return connection.api_key || '';
}
