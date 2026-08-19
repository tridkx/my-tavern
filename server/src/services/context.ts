import { getCharacter, getChat, getConnection, getDefaultConnection, getGroup, getWorldbook, listGroupMembers, listMessages, listWorldbookEntries } from '../repo.js';
import type { Character, Chat, ChatCompletionMessage, Connection, WorldbookEntry } from '../types.js';

export function estimateTokens(text: string): number {
  // 粗略估计：英文约 4 字符/token，中文约 1.5 字符/token
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const other = text.length - cjk;
  return Math.ceil(cjk / 1.5 + other / 4);
}

export interface WorldbookHit {
  entry: WorldbookEntry;
  matchedKey: string;
}

/**
 * 根据最近文本匹配世界书条目。
 * constant 条目始终返回；其余条目要求 key 命中。
 */
export function findWorldbookHits(worldbookId: string | null | undefined, text: string, enabledOnly = true): WorldbookHit[] {
  if (!worldbookId) return [];
  const entries = listWorldbookEntries(worldbookId);
  const hits: WorldbookHit[] = [];
  for (const entry of entries) {
    if (enabledOnly && !entry.enabled) continue;
    if (entry.constant) {
      hits.push({ entry, matchedKey: '' });
      continue;
    }
    const keys: string[] = entry.key || [];
    const lower = text.toLowerCase();
    const matched = keys.find((k) => k && lower.includes(k.toLowerCase()));
    if (matched) {
      // 概率命中：probability < 100 时按概率决定是否注入
      const probability = typeof entry.probability === 'number' ? entry.probability : 100;
      if (probability < 100 && Math.random() * 100 >= probability) continue;
      hits.push({ entry, matchedKey: matched });
    }
  }
  hits.sort((a, b) => a.entry.order_index - b.entry.order_index);
  return hits;
}

function formatWorldbook(hits: WorldbookHit[]): string {
  if (!hits.length) return '';
  const sections = hits.map((h) => {
    const label = h.matchedKey ? `[关键词: ${h.matchedKey}]` : '[常驻]';
    return `${label}\n${h.entry.content}`;
  });
  return `【世界书资料】\n${sections.join('\n\n')}`;
}

function characterSystemPrompt(character: Character): string {
  const parts: string[] = [];
  if (character.system_prompt) parts.push(character.system_prompt);
  const card = [
    `你是「${character.name}」。`,
    character.description ? `角色描述：${character.description}` : '',
    character.personality ? `性格：${character.personality}` : '',
    character.scenario ? `场景：${character.scenario}` : '',
    character.post_history_instructions ? `回复要求：${character.post_history_instructions}` : '',
  ].filter(Boolean).join('\n');
  parts.push(card);
  if (character.mes_example) {
    parts.push(`示例对话：\n${character.mes_example}`);
  }
  return parts.join('\n\n');
}

function defaultSystemPrompt(): string {
  return '你是一个角色扮演助手。请以第二人称“你”称呼用户，自然地推进剧情，不要暴露你是 AI。';
}

/**
 * 构造单聊上下文消息。
 */
export function buildSingleTurnMessages(params: {
  chatId: string;
  userText?: string;
  connection?: Connection;
  extraSystem?: string;
  visibleOnly?: boolean;
}): ChatCompletionMessage[] {
  const chat = getChat(params.chatId);
  if (!chat) throw new Error('会话不存在');

  const character = chat.character_id ? getCharacter(chat.character_id) : undefined;
  const connection = params.connection || (character?.connection_id ? getConnection(character.connection_id) : undefined) || getDefaultConnection();
  if (!connection) throw new Error('没有可用的模型连接，请先在设置中添加连接');
  const messages = listMessages(params.chatId);

  const systemParts: string[] = [];
  systemParts.push(character ? characterSystemPrompt(character) : defaultSystemPrompt());
  if (character?.worldbook_id) {
    const historyText = messages.map((m) => m.content).join('\n');
    const searchText = `${historyText}\n${params.userText || ''}`;
    const hits = findWorldbookHits(character.worldbook_id, searchText);
    const wb = formatWorldbook(hits);
    if (wb) systemParts.push(wb);
  }
  if (params.extraSystem) systemParts.push(params.extraSystem);
  const systemContent = systemParts.join('\n\n');

  const result: ChatCompletionMessage[] = [{ role: 'system', content: systemContent }];

  for (const m of messages) {
    if (params.visibleOnly && !m.visible_to_player) continue;
    if (m.role === 'user') {
      result.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant' || m.role === 'narrator' || m.role === 'gm' || m.role === 'companion' || m.role === 'enemy') {
      result.push({
        role: 'assistant',
        content: m.content,
        ...(character && m.role === 'assistant' && m.character_id === character.id ? { name: character.name } : {}),
      });
    } else if (m.role === 'system') {
      result.push({ role: 'system', content: m.content });
    }
  }

  if (params.userText) {
    result.push({ role: 'user', content: params.userText });
  }

  // 粗略截断到 context_window
  const maxTokens = connection?.context_window || 8192;
  while (estimateTokens(JSON.stringify(result)) > maxTokens * 0.8 && result.length > 2) {
    result.splice(1, 1);
  }

  return result;
}

export function buildGroupTurnMessages(params: {
  chatId: string;
  speakerId: string;
  connection: Connection;
  userText?: string;
}): ChatCompletionMessage[] {
  const chat = getChat(params.chatId);
  if (!chat?.group_id) throw new Error('这不是群聊会话');
  const group = getGroup(chat.group_id);
  if (!group) throw new Error('群聊不存在');

  const members = listGroupMembers(group.id).filter((m) => m.enabled);
  const speaker = getCharacter(params.speakerId);
  if (!speaker) throw new Error('发言角色不存在');

  const memberLines = members.map((m) => {
    const c = getCharacter(m.character_id);
    const roleLabel = { player: '玩家', companion: 'AI同伴', gm: 'GM', enemy: 'AI敌人' }[m.kind] || m.kind;
    return `${roleLabel}: ${c?.name || '未知'}${m.kind === 'enemy' && !group.settings.enemyActionVisible ? ' (行动对玩家隐藏)' : ''}`;
  });

  const systemParts: string[] = [
    '你正在参与一个群聊角色扮演。请严格遵守当前身份，不要混淆其他角色。',
    `群聊成员：\n${memberLines.join('\n')}`,
    `你的身份是「${speaker.name}」。`,
    speaker.description ? `角色描述：${speaker.description}` : '',
    speaker.personality ? `性格：${speaker.personality}` : '',
    speaker.scenario ? `场景：${speaker.scenario}` : '',
    speaker.system_prompt ? speaker.system_prompt : '',
    speaker.post_history_instructions ? `回复要求：${speaker.post_history_instructions}` : '',
    !group.settings.enemyActionVisible
      ? '重要规则：AI 敌人的行动对玩家隐藏。你可以在推理时知道这些隐藏信息，但在任何公开回复中都不得提及、转述、暗示或总结敌人的具体行动。'
      : '',
  ];

  const gm = group.gm_character_id ? getCharacter(group.gm_character_id) : undefined;
  if (gm) {
    systemParts.push(
      `GM 是「${gm.name}」。GM 负责场景旁白与规则裁定，玩家不可见的信息要由 GM 保管；非 GM 角色不要代替 GM 揭露隐藏信息。`,
    );
  }

  const result: ChatCompletionMessage[] = [{ role: 'system', content: systemParts.filter(Boolean).join('\n\n') }];

  for (const m of listMessages(params.chatId)) {
    const c = m.character_id ? getCharacter(m.character_id) : undefined;
    const displayContent = !m.visible_to_player ? `【隐藏信息，禁止向玩家公开提及】${m.content}` : m.content;
    if (m.role === 'user') {
      result.push({ role: 'user', content: displayContent });
    } else if (m.role === 'system') {
      result.push({ role: 'system', content: displayContent });
    } else {
      result.push({
        role: 'assistant',
        content: displayContent,
        ...(c ? { name: c.name } : {}),
      });
    }
  }

  if (params.userText) {
    result.push({ role: 'user', content: params.userText });
  }

  result.push({ role: 'system', content: `现在请以「${speaker.name}」的身份直接回复，不要包含角色名前缀或括号说明。` });

  const maxTokens = params.connection.context_window || 8192;
  while (estimateTokens(JSON.stringify(result)) > maxTokens * 0.8 && result.length > 3) {
    result.splice(1, 1);
  }
  return result;
}
