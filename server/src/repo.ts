import { nanoid } from 'nanoid';
import { all, get, run } from './db/database.js';
import type {
  Character,
  Chat,
  Connection,
  Group,
  GroupMember,
  GroupSettings,
  MediaItem,
  Message,
  Worldbook,
  WorldbookEntry,
} from './types.js';

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ---------- connections ----------
export function listConnections(): Connection[] {
  return all<any>('SELECT * FROM connections ORDER BY is_default DESC, name').map((r) => ({
    ...r,
    stop_sequences: parseJson<string[]>(r.stop_sequences, []),
    extra_headers: parseJson<Record<string, string>>(r.extra_headers, {}),
  }));
}

export function getConnection(id: string): Connection | undefined {
  const r = get<any>('SELECT * FROM connections WHERE id = ?', id);
  return r
    ? {
        ...r,
        stop_sequences: parseJson<string[]>(r.stop_sequences, []),
        extra_headers: parseJson<Record<string, string>>(r.extra_headers, {}),
      }
    : undefined;
}

export function getDefaultConnection(): Connection | undefined {
  const r = get<any>('SELECT * FROM connections WHERE is_default = 1 ORDER BY created_at LIMIT 1');
  if (r) {
    return {
      ...r,
      stop_sequences: parseJson<string[]>(r.stop_sequences, []),
      extra_headers: parseJson<Record<string, string>>(r.extra_headers, {}),
    };
  }
  return listConnections()[0];
}

export function createConnection(data: Partial<Connection>): Connection {
  const id = nanoid(12);
  run(
    `INSERT INTO connections (id, name, provider, base_url, api_key, api_key_env, model, context_window, max_tokens, temperature, top_p, top_k, frequency_penalty, presence_penalty, stop_sequences, extra_headers, is_default)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    data.name || '未命名连接',
    data.provider || 'custom',
    data.base_url || '',
    data.api_key || '',
    data.api_key_env || null,
    data.model || '',
    data.context_window ?? 8192,
    data.max_tokens ?? 2048,
    data.temperature ?? 0.8,
    data.top_p ?? 1,
    data.top_k ?? null,
    data.frequency_penalty ?? 0,
    data.presence_penalty ?? 0,
    JSON.stringify(data.stop_sequences || []),
    JSON.stringify(data.extra_headers || {}),
    data.is_default ? 1 : 0,
  );
  if (data.is_default) {
    run('UPDATE connections SET is_default = 0 WHERE id != ?', id);
  }
  return getConnection(id)!;
}

export function updateConnection(id: string, data: Partial<Connection>): Connection | undefined {
  const existing = getConnection(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...data };
  run(
    `UPDATE connections SET name=?, provider=?, base_url=?, api_key=?, api_key_env=?, model=?, context_window=?, max_tokens=?, temperature=?, top_p=?, top_k=?, frequency_penalty=?, presence_penalty=?, stop_sequences=?, extra_headers=?, is_default=?, updated_at=datetime('now') WHERE id=?`,
    merged.name,
    merged.provider,
    merged.base_url,
    merged.api_key ?? '',
    merged.api_key_env ?? null,
    merged.model,
    merged.context_window,
    merged.max_tokens,
    merged.temperature,
    merged.top_p,
    merged.top_k ?? null,
    merged.frequency_penalty,
    merged.presence_penalty,
    JSON.stringify(merged.stop_sequences || []),
    JSON.stringify(merged.extra_headers || {}),
    merged.is_default ? 1 : 0,
    id,
  );
  if (merged.is_default) {
    run('UPDATE connections SET is_default = 0 WHERE id != ?', id);
  }
  return getConnection(id);
}

export function deleteConnection(id: string): boolean {
  const r = run('DELETE FROM connections WHERE id = ?', id);
  return r.changes > 0;
}

// ---------- characters ----------
export function listCharacters(): Character[] {
  return all<any>('SELECT * FROM characters ORDER BY updated_at DESC').map((r) => ({
    ...r,
    tags: parseJson<string[]>(r.tags, []),
    kind: r.kind,
  }));
}

export function getCharacter(id: string): Character | undefined {
  const r = get<any>('SELECT * FROM characters WHERE id = ?', id);
  return r
    ? {
        ...r,
        tags: parseJson<string[]>(r.tags, []),
        kind: r.kind,
      }
    : undefined;
}

export function createCharacter(data: Partial<Character>): Character {
  const id = nanoid(12);
  run(
    `INSERT INTO characters (id, name, avatar_id, avatar_url, description, personality, scenario, first_mes, mes_example, system_prompt, post_history_instructions, creator, version, tags, worldbook_id, connection_id, kind, enabled)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    data.name || '新角色',
    data.avatar_id || null,
    data.avatar_url || null,
    data.description || '',
    data.personality || '',
    data.scenario || '',
    data.first_mes || '',
    data.mes_example || '',
    data.system_prompt || '',
    data.post_history_instructions || '',
    data.creator || '',
    data.version || '1.0',
    JSON.stringify(data.tags || []),
    data.worldbook_id || null,
    data.connection_id || null,
    data.kind || 'general',
    data.enabled ?? 1,
  );
  return getCharacter(id)!;
}

export function updateCharacter(id: string, data: Partial<Character>): Character | undefined {
  const existing = getCharacter(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...data };
  run(
    `UPDATE characters SET name=?, avatar_id=?, avatar_url=?, description=?, personality=?, scenario=?, first_mes=?, mes_example=?, system_prompt=?, post_history_instructions=?, creator=?, version=?, tags=?, worldbook_id=?, connection_id=?, kind=?, enabled=?, updated_at=datetime('now') WHERE id=?`,
    merged.name,
    merged.avatar_id ?? null,
    merged.avatar_url ?? null,
    merged.description || '',
    merged.personality || '',
    merged.scenario || '',
    merged.first_mes || '',
    merged.mes_example || '',
    merged.system_prompt || '',
    merged.post_history_instructions || '',
    merged.creator || '',
    merged.version || '1.0',
    JSON.stringify(merged.tags || []),
    merged.worldbook_id ?? null,
    merged.connection_id ?? null,
    merged.kind || 'general',
    merged.enabled ?? 1,
    id,
  );
  return getCharacter(id);
}

export function deleteCharacter(id: string): boolean {
  const r = run('DELETE FROM characters WHERE id = ?', id);
  return r.changes > 0;
}

// ---------- worldbooks ----------
export function listWorldbooks(): Worldbook[] {
  return all<Worldbook>('SELECT * FROM worldbooks ORDER BY updated_at DESC');
}

export function getWorldbook(id: string): Worldbook | undefined {
  return get<Worldbook>('SELECT * FROM worldbooks WHERE id = ?', id);
}

export function createWorldbook(data: Partial<Worldbook>): Worldbook {
  const id = nanoid(12);
  run('INSERT INTO worldbooks (id, name, description) VALUES (?,?,?)', id, data.name || '未命名世界书', data.description || '');
  return getWorldbook(id)!;
}

export function updateWorldbook(id: string, data: Partial<Worldbook>): Worldbook | undefined {
  const existing = getWorldbook(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...data };
  run("UPDATE worldbooks SET name=?, description=?, updated_at=datetime('now') WHERE id=?", merged.name, merged.description || '', id);
  return getWorldbook(id);
}

export function deleteWorldbook(id: string): boolean {
  const r = run('DELETE FROM worldbooks WHERE id = ?', id);
  return r.changes > 0;
}

export function listWorldbookEntries(worldbookId: string): WorldbookEntry[] {
  return all<any>('SELECT * FROM worldbook_entries WHERE worldbook_id = ? ORDER BY order_index, created_at', worldbookId).map(
    (r) => ({
      ...r,
      key: parseJson<string[]>(r.key, []),
    }),
  );
}

export function getWorldbookEntry(id: string): WorldbookEntry | undefined {
  const r = get<any>('SELECT * FROM worldbook_entries WHERE id = ?', id);
  return r ? { ...r, key: parseJson<string[]>(r.key, []) } : undefined;
}

export function createWorldbookEntry(worldbookId: string, data: Partial<WorldbookEntry>): WorldbookEntry {
  const id = nanoid(12);
  const max = get<any>('SELECT COALESCE(MAX(order_index), -1) + 1 AS n FROM worldbook_entries WHERE worldbook_id = ?', worldbookId);
  run(
    `INSERT INTO worldbook_entries (id, worldbook_id, key, content, enabled, constant, probability, order_index, recursive, selective, position, comment)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    worldbookId,
    JSON.stringify(data.key || []),
    data.content || '',
    data.enabled ?? 1,
    data.constant ?? 0,
    data.probability ?? 100,
    data.order_index ?? max?.n ?? 0,
    data.recursive ?? 0,
    data.selective ?? 0,
    data.position || 'before',
    data.comment || '',
  );
  return getWorldbookEntry(id)!;
}

export function updateWorldbookEntry(id: string, data: Partial<WorldbookEntry>): WorldbookEntry | undefined {
  const existing = getWorldbookEntry(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...data };
  run(
    `UPDATE worldbook_entries SET key=?, content=?, enabled=?, constant=?, probability=?, order_index=?, recursive=?, selective=?, position=?, comment=? WHERE id=?`,
    JSON.stringify(merged.key || []),
    merged.content || '',
    merged.enabled ?? 1,
    merged.constant ?? 0,
    merged.probability ?? 100,
    merged.order_index ?? 0,
    merged.recursive ?? 0,
    merged.selective ?? 0,
    merged.position || 'before',
    merged.comment || '',
    id,
  );
  return getWorldbookEntry(id);
}

export function deleteWorldbookEntry(id: string): boolean {
  const r = run('DELETE FROM worldbook_entries WHERE id = ?', id);
  return r.changes > 0;
}

// ---------- chats ----------
export function listChats(): Chat[] {
  return all<Chat>('SELECT * FROM chats ORDER BY updated_at DESC');
}

export function getChat(id: string): Chat | undefined {
  return get<Chat>('SELECT * FROM chats WHERE id = ?', id);
}

export function createChat(data: Partial<Chat>): Chat {
  const id = nanoid(12);
  run(
    'INSERT INTO chats (id, title, mode, character_id, group_id, background_id) VALUES (?,?,?,?,?,?)',
    id,
    data.title || '',
    data.mode || 'single',
    data.character_id || null,
    data.group_id || null,
    data.background_id || null,
  );
  return getChat(id)!;
}

export function updateChat(id: string, data: Partial<Chat>): Chat | undefined {
  const existing = getChat(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...data };
  run(
    "UPDATE chats SET title=?, mode=?, character_id=?, group_id=?, background_id=?, updated_at=datetime('now') WHERE id=?",
    merged.title || '',
    merged.mode || 'single',
    merged.character_id ?? null,
    merged.group_id ?? null,
    merged.background_id ?? null,
    id,
  );
  return getChat(id);
}

export function deleteChat(id: string): boolean {
  const r = run('DELETE FROM chats WHERE id = ?', id);
  return r.changes > 0;
}

// ---------- messages ----------
export function listMessages(chatId: string): Message[] {
  return all<Message>('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at, rowid', chatId);
}

export function getMessage(id: string): Message | undefined {
  return get<Message>('SELECT * FROM messages WHERE id = ?', id);
}

export function createMessage(data: Partial<Message>): Message {
  const id = nanoid(12);
  run(
    `INSERT INTO messages (id, chat_id, role, character_id, content, visible_to_player, connection_id)
     VALUES (?,?,?,?,?,?,?)`,
    id,
    data.chat_id || '',
    data.role || 'user',
    data.character_id || null,
    data.content || '',
    data.visible_to_player ?? 1,
    data.connection_id || null,
  );
  return getMessage(id)!;
}

export function updateMessage(id: string, data: Partial<Message>): Message | undefined {
  const existing = getMessage(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...data };
  run(
    "UPDATE messages SET role=?, character_id=?, content=?, visible_to_player=?, connection_id=?, edited_at=datetime('now') WHERE id=?",
    merged.role || 'user',
    merged.character_id ?? null,
    merged.content || '',
    merged.visible_to_player ?? 1,
    merged.connection_id ?? null,
    id,
  );
  return getMessage(id);
}

export function deleteMessage(id: string): boolean {
  const r = run('DELETE FROM messages WHERE id = ?', id);
  return r.changes > 0;
}

export function deleteMessagesAfter(chatId: string, messageId: string) {
  const msg = getMessage(messageId);
  if (!msg) return;
  run("DELETE FROM messages WHERE chat_id = ? AND created_at >= ?", chatId, msg.created_at);
}

// ---------- groups ----------
export function listGroups(): Group[] {
  return all<any>('SELECT * FROM groups ORDER BY updated_at DESC').map((r) => ({
    ...r,
    settings: parseJson<GroupSettings>(r.settings, { enemyActionVisible: true, autoMode: 'round-robin' }),
  }));
}

export function getGroup(id: string): Group | undefined {
  const r = get<any>('SELECT * FROM groups WHERE id = ?', id);
  return r
    ? {
        ...r,
        settings: parseJson<GroupSettings>(r.settings, { enemyActionVisible: true, autoMode: 'round-robin' }),
      }
    : undefined;
}

export function createGroup(data: Partial<Group>): Group {
  const id = nanoid(12);
  run(
    'INSERT INTO groups (id, title, gm_character_id, settings) VALUES (?,?,?,?)',
    id,
    data.title || '新群聊',
    data.gm_character_id || null,
    JSON.stringify(data.settings || { enemyActionVisible: true, autoMode: 'round-robin' }),
  );
  return getGroup(id)!;
}

export function updateGroup(id: string, data: Partial<Group>): Group | undefined {
  const existing = getGroup(id);
  if (!existing) return undefined;
  const merged = { ...existing, ...data };
  run(
    "UPDATE groups SET title=?, gm_character_id=?, settings=?, updated_at=datetime('now') WHERE id=?",
    merged.title || '',
    merged.gm_character_id ?? null,
    JSON.stringify(merged.settings || {}),
    id,
  );
  return getGroup(id);
}

export function deleteGroup(id: string): boolean {
  const r = run('DELETE FROM groups WHERE id = ?', id);
  return r.changes > 0;
}

export function listGroupMembers(groupId: string): GroupMember[] {
  return all<GroupMember>('SELECT * FROM group_members WHERE group_id = ? ORDER BY sort_order', groupId);
}

export function addGroupMember(data: Partial<GroupMember>): GroupMember {
  const id = nanoid(12);
  const max = get<any>('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM group_members WHERE group_id = ?', data.group_id);
  run(
    `INSERT INTO group_members (id, group_id, character_id, kind, enabled, connection_id, sort_order)
     VALUES (?,?,?,?,?,?,?)`,
    id,
    data.group_id || '',
    data.character_id || '',
    data.kind || 'companion',
    data.enabled ?? 1,
    data.connection_id || null,
    data.sort_order ?? max?.n ?? 0,
  );
  return get<any>('SELECT * FROM group_members WHERE id = ?', id) as GroupMember;
}

export function updateGroupMember(id: string, data: Partial<GroupMember>): GroupMember | undefined {
  const existing = get<any>('SELECT * FROM group_members WHERE id = ?', id) as GroupMember | undefined;
  if (!existing) return undefined;
  const merged = { ...existing, ...data };
  run(
    'UPDATE group_members SET character_id=?, kind=?, enabled=?, connection_id=?, sort_order=? WHERE id=?',
    merged.character_id,
    merged.kind,
    merged.enabled ?? 1,
    merged.connection_id ?? null,
    merged.sort_order ?? 0,
    id,
  );
  return get<any>('SELECT * FROM group_members WHERE id = ?', id) as GroupMember;
}

export function removeGroupMember(id: string): boolean {
  const r = run('DELETE FROM group_members WHERE id = ?', id);
  return r.changes > 0;
}

// ---------- media ----------
export function listMedia(kind?: string): MediaItem[] {
  if (kind) {
    return all<any>('SELECT * FROM media WHERE kind = ? ORDER BY created_at DESC', kind).map((r) => ({
      ...r,
      meta: parseJson<Record<string, unknown>>(r.meta, {}),
    }));
  }
  return all<any>('SELECT * FROM media ORDER BY created_at DESC').map((r) => ({
    ...r,
    meta: parseJson<Record<string, unknown>>(r.meta, {}),
  }));
}

export function getMedia(id: string): MediaItem | undefined {
  const r = get<any>('SELECT * FROM media WHERE id = ?', id);
  return r ? { ...r, meta: parseJson<Record<string, unknown>>(r.meta, {}) } : undefined;
}

export function createMedia(data: Partial<MediaItem>): MediaItem {
  const id = nanoid(12);
  run(
    'INSERT INTO media (id, kind, name, file_path, source, url, meta) VALUES (?,?,?,?,?,?,?)',
    id,
    data.kind || 'image',
    data.name || '未命名资源',
    data.file_path || null,
    data.source || 'upload',
    data.url || null,
    JSON.stringify(data.meta || {}),
  );
  return getMedia(id)!;
}

export function deleteMedia(id: string): boolean {
  const r = run('DELETE FROM media WHERE id = ?', id);
  return r.changes > 0;
}

// ---------- settings ----------
export function getSetting<T>(key: string, fallback: T): T {
  const r = get<any>('SELECT value FROM settings WHERE key = ?', key);
  return r ? parseJson<T>(r.value, fallback) : fallback;
}

export function setSetting(key: string, value: unknown) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}
