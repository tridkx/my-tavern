import { completeChat } from '../providers/openai.js';
import { getConnection, getDefaultConnection } from '../repo.js';
import type { Character } from '../types.js';

async function resolveConnection(connectionId?: string) {
  if (connectionId) {
    const c = getConnection(connectionId);
    if (c) return c;
  }
  const c = getDefaultConnection();
  if (!c) throw new Error('没有可用的模型连接，请先在设置中添加连接');
  return c;
}

function extractJson(text: string): any {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('AI 没有返回有效 JSON');
  return JSON.parse(text.slice(start, end + 1));
}

export async function generateCharacterDraft(prompt: string, connectionId?: string): Promise<Partial<Character>> {
  const conn = await resolveConnection(connectionId);
  const messages = [
    {
      role: 'system' as const,
      content:
        '你是一位角色卡写作专家。根据用户描述生成角色卡 JSON，字段包括：name, description, personality, scenario, first_mes, mes_example, system_prompt, post_history_instructions, tags。只输出 JSON，不要解释。',
    },
    { role: 'user' as const, content: prompt },
  ];
  const text = await completeChat(conn, messages);
  return extractJson(text);
}

export async function polishCharacter(character: Character, instruction: string, connectionId?: string): Promise<Partial<Character>> {
  const conn = await resolveConnection(connectionId);
  const input = JSON.stringify({
    name: character.name,
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    first_mes: character.first_mes,
    mes_example: character.mes_example,
    system_prompt: character.system_prompt,
    post_history_instructions: character.post_history_instructions,
    tags: character.tags,
  });
  const messages = [
    {
      role: 'system' as const,
      content:
        '你是一位角色卡润色专家。根据用户的要求润色角色卡，返回修改后的完整 JSON，字段包括：name, description, personality, scenario, first_mes, mes_example, system_prompt, post_history_instructions, tags。未修改的字段也要原样返回。只输出 JSON，不要解释。',
    },
    { role: 'user' as const, content: `角色卡：${input}\n\n润色要求：${instruction}` },
  ];
  const text = await completeChat(conn, messages);
  return extractJson(text);
}

export async function generateWorldbookDraft(prompt: string, connectionId?: string): Promise<Array<{ key: string[]; content: string; comment?: string; constant?: boolean; probability?: number }>> {
  const conn = await resolveConnection(connectionId);
  const messages = [
    {
      role: 'system' as const,
      content:
        '你是世界书/世界观资料写作专家。根据用户描述生成世界书条目数组 JSON，每个条目字段：key(触发关键词字符串数组), content(条目内容), comment(备注), constant(是否常驻), probability(0-100)。只输出 JSON 数组，不要解释。',
    },
    { role: 'user' as const, content: prompt },
  ];
  const text = await completeChat(conn, messages);
  return extractJson(text);
}
