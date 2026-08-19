import type { Character, WorldbookEntry } from '../types.js';

export interface TavernV2Data {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  creator?: string;
  character_version?: string;
  tags?: string[];
  creator_notes?: string;
  alternate_greetings?: string[];
  extensions?: Record<string, unknown>;
}

export interface TavernV2 {
  spec: 'chara_card_v2';
  spec_version: string;
  data: TavernV2Data;
}

export function toTavernV2(c: Character): TavernV2 {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: c.name,
      description: c.description,
      personality: c.personality,
      scenario: c.scenario,
      first_mes: c.first_mes,
      mes_example: c.mes_example,
      system_prompt: c.system_prompt,
      post_history_instructions: c.post_history_instructions,
      creator: c.creator,
      character_version: c.version,
      tags: c.tags,
      extensions: {
        my_tavern: {
          worldbook_id: c.worldbook_id || null,
          connection_id: c.connection_id || null,
          kind: c.kind,
        },
      },
    },
  };
}

export function fromTavernV2(input: unknown): Partial<Character> {
  const card = input as TavernV2;
  const data = card?.data || (input as TavernV2Data);
  if (!data || typeof data.name !== 'string') throw new Error('无法识别的角色卡格式');
  const ext = (data.extensions as any)?.my_tavern || {};
  return {
    name: data.name,
    description: data.description || '',
    personality: data.personality || '',
    scenario: data.scenario || '',
    first_mes: data.first_mes || '',
    mes_example: data.mes_example || '',
    system_prompt: data.system_prompt || '',
    post_history_instructions: data.post_history_instructions || '',
    creator: data.creator || '',
    version: data.character_version || '1.0',
    tags: Array.isArray(data.tags) ? data.tags : [],
    worldbook_id: typeof ext.worldbook_id === 'string' ? ext.worldbook_id : null,
    connection_id: typeof ext.connection_id === 'string' ? ext.connection_id : null,
    kind: ext.kind === 'special' ? 'special' : 'general',
  };
}

export function toSillyTavernWorldInfo(entries: WorldbookEntry[]) {
  return entries.map((e, i) => ({
    uid: i,
    key: e.key,
    keysecondary: [],
    comment: e.comment || '',
    content: e.content,
    constant: Boolean(e.constant),
    selective: Boolean(e.selective),
    insertion_order: e.order_index,
    enabled: Boolean(e.enabled),
    position: e.position === 'after' ? 'after_char' : 'before_char',
    probability: e.probability ?? 100,
    useProbability: true,
    recursive: Boolean(e.recursive),
    order: e.order_index,
    display_index: i,
  }));
}

export function fromSillyTavernWorldInfo(input: unknown): Array<Partial<WorldbookEntry>> {
  const raw = Array.isArray(input)
    ? input
    : (input as any)?.entries && Array.isArray((input as any).entries)
      ? (input as any).entries
      : [];
  if (!Array.isArray(raw)) throw new Error('无法识别的世界书格式');
  return raw.map((e: any) => ({
    key: Array.isArray(e.key) ? e.key : [],
    content: e.content || '',
    enabled: e.enabled === false ? 0 : 1,
    constant: e.constant ? 1 : 0,
    probability: typeof e.probability === 'number' ? e.probability : 100,
    order_index: e.insertion_order ?? e.order ?? 0,
    recursive: e.recursive ? 1 : 0,
    selective: e.selective ? 1 : 0,
    position: e.position === 'after_char' ? 'after' : 'before',
    comment: e.comment || '',
  }));
}
