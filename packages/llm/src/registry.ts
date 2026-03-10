import type { LLMProvider, LLMProviderConfig } from './types.js';
import { OpenAIProvider } from './providers/openai.js';
import { ClaudeProvider } from './providers/claude.js';
import { OllamaProvider } from './providers/ollama.js';

export type ProviderName = 'openai' | 'claude' | 'ollama';

export function createProvider(name: ProviderName, config?: LLMProviderConfig): LLMProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${name as string}`);
  }
}

export function createProviderFromEnv(): LLMProvider {
  const providerName = (process.env['LLM_PROVIDER'] as ProviderName | undefined) ?? 'openai';
  const model = process.env['LLM_MODEL'];
  const apiKey = process.env['LLM_API_KEY'];
  const baseUrl = process.env['LLM_BASE_URL'];

  return createProvider(providerName, {
    model,
    apiKey,
    baseUrl,
  });
}
