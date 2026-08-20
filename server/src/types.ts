/** 连接用途：llm = 对话模型，tts = 语音合成，image = 图片生成 */
export type ConnectionType = 'llm' | 'tts' | 'image';

export interface Connection {
  id: string;
  name: string;
  type: ConnectionType;
  provider: string;
  base_url: string;
  api_key: string;
  api_key_env?: string | null;
  model: string;
  context_window: number;
  max_tokens: number;
  temperature: number;
  top_p: number;
  top_k?: number | null;
  frequency_penalty: number;
  presence_penalty: number;
  stop_sequences: string[];
  extra_headers: Record<string, string>;
  is_default: number;
  created_at?: string;
  updated_at?: string;
}

export interface Character {
  id: string;
  name: string;
  avatar_id?: string | null;
  avatar_url?: string | null;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  system_prompt: string;
  post_history_instructions: string;
  creator: string;
  version: string;
  tags: string[];
  worldbook_id?: string | null;
  connection_id?: string | null;
  kind: 'general' | 'special';
  enabled: number;
  created_at?: string;
  updated_at?: string;
}

export interface Worldbook {
  id: string;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorldbookEntry {
  id: string;
  worldbook_id: string;
  key: string[];
  content: string;
  enabled: number;
  constant: number;
  probability: number;
  order_index: number;
  recursive: number;
  selective: number;
  position: 'before' | 'after';
  comment: string;
}

export interface Chat {
  id: string;
  title: string;
  mode: 'single' | 'group';
  character_id?: string | null;
  group_id?: string | null;
  background_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: string;
  character_id?: string | null;
  content: string;
  visible_to_player: number;
  connection_id?: string | null;
  created_at?: string;
  edited_at?: string | null;
}

export interface Group {
  id: string;
  title: string;
  gm_character_id?: string | null;
  settings: GroupSettings;
  created_at?: string;
  updated_at?: string;
}

export interface GroupSettings {
  enemyActionVisible: boolean;
  autoMode: 'round-robin' | 'manual' | 'random';
  playerCharacterId?: string | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  character_id: string;
  kind: 'player' | 'companion' | 'gm' | 'enemy';
  enabled: number;
  connection_id?: string | null;
  sort_order: number;
}

export interface MediaItem {
  id: string;
  kind: 'background' | 'avatar' | 'image' | 'voice';
  name: string;
  file_path?: string | null;
  source: 'upload' | 'url' | 'generated';
  url?: string | null;
  meta: Record<string, unknown>;
  created_at?: string;
}

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnv?: string;
  /** 该提供商支持的连接用途；缺省视为仅 ['llm'] */
  types?: ConnectionType[];
  models: { id: string; name: string; contextWindow: number; maxTokens: number }[];
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  stop?: string[];
  stream?: boolean;
}
