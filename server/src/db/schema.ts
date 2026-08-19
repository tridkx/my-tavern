export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'custom',
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL DEFAULT '',
  api_key_env TEXT,
  model TEXT NOT NULL,
  context_window INTEGER NOT NULL DEFAULT 8192,
  max_tokens INTEGER NOT NULL DEFAULT 2048,
  temperature REAL NOT NULL DEFAULT 0.8,
  top_p REAL NOT NULL DEFAULT 1,
  top_k INTEGER,
  frequency_penalty REAL NOT NULL DEFAULT 0,
  presence_penalty REAL NOT NULL DEFAULT 0,
  stop_sequences TEXT NOT NULL DEFAULT '[]',
  extra_headers TEXT NOT NULL DEFAULT '{}',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_id TEXT,
  avatar_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL DEFAULT '',
  first_mes TEXT NOT NULL DEFAULT '',
  mes_example TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  post_history_instructions TEXT NOT NULL DEFAULT '',
  creator TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0',
  tags TEXT NOT NULL DEFAULT '[]',
  worldbook_id TEXT,
  connection_id TEXT,
  kind TEXT NOT NULL DEFAULT 'general',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS worldbooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS worldbook_entries (
  id TEXT PRIMARY KEY,
  worldbook_id TEXT NOT NULL,
  key TEXT NOT NULL DEFAULT '[]',
  content TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  constant INTEGER NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 100,
  order_index INTEGER NOT NULL DEFAULT 0,
  recursive INTEGER NOT NULL DEFAULT 0,
  selective INTEGER NOT NULL DEFAULT 0,
  position TEXT NOT NULL DEFAULT 'before',
  comment TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (worldbook_id) REFERENCES worldbooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'single',
  character_id TEXT,
  group_id TEXT,
  background_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  character_id TEXT,
  content TEXT NOT NULL DEFAULT '',
  visible_to_player INTEGER NOT NULL DEFAULT 1,
  connection_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  gm_character_id TEXT,
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'companion',
  enabled INTEGER NOT NULL DEFAULT 1,
  connection_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT,
  source TEXT NOT NULL DEFAULT 'upload',
  url TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_characters_worldbook ON characters(worldbook_id);
CREATE INDEX IF NOT EXISTS idx_entries_worldbook ON worldbook_entries(worldbook_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
`;
