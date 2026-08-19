import { createConnection, listConnections } from './repo.js';
import { PROVIDER_PRESETS } from './providers/presets.js';

export function seedConnections() {
  const existing = listConnections();
  if (existing.length > 0) return;

  const candidates = PROVIDER_PRESETS.filter((p) => p.apiKeyEnv && process.env[p.apiKeyEnv]);
  let first = true;
  for (const preset of candidates) {
    const model = preset.models[0];
    if (!model) continue;
    createConnection({
      name: preset.name,
      provider: preset.id,
      base_url: preset.baseUrl,
      api_key_env: preset.apiKeyEnv,
      model: model.id,
      context_window: model.contextWindow,
      max_tokens: model.maxTokens,
      is_default: first ? 1 : 0,
    });
    first = false;
  }
}
