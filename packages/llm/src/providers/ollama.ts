import type {
  LLMProvider,
  LLMProviderConfig,
  GenerateOptions,
  GenerateResult,
  EmbeddingOptions,
  EmbeddingResult,
  ToolCall,
} from '../types.js';

interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
}

interface OllamaChatResponse {
  message: OllamaMessage;
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  embeddings: number[][];
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly model: string;
  private baseUrl: string;

  constructor(config: LLMProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';
    this.model = config.model ?? process.env['OLLAMA_MODEL'] ?? 'llama3.1';
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const messages: OllamaMessage[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const msg of options.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
        num_predict: options.maxTokens ?? 4096,
      },
    };

    if (options.tools && options.tools.length > 0) {
      body['tools'] = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama request failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as OllamaChatResponse;

    const toolCalls: ToolCall[] | undefined = data.message.tool_calls?.map((tc, i) => ({
      id: `ollama-tool-${i}`,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      content: data.message.content ?? '',
      toolCalls,
      usage:
        data.prompt_eval_count !== undefined
          ? {
              promptTokens: data.prompt_eval_count,
              completionTokens: data.eval_count ?? 0,
              totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            }
          : undefined,
      finishReason:
        toolCalls && toolCalls.length > 0
          ? 'tool_calls'
          : data.done_reason === 'length'
            ? 'length'
            : 'stop',
    };
  }

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    const input = Array.isArray(options.text) ? options.text : [options.text];
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', input }),
    });

    if (!res.ok) {
      throw new Error(`Ollama embed request failed: ${res.status}`);
    }

    const data = (await res.json()) as OllamaEmbedResponse;
    return { embeddings: data.embeddings };
  }
}
