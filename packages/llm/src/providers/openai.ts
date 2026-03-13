import OpenAI from 'openai';
import type {
  LLMProvider,
  LLMProviderConfig,
  GenerateOptions,
  GenerateResult,
  EmbeddingOptions,
  EmbeddingResult,
  ToolCall,
} from '../types.js';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly model: string;
  private client: OpenAI;

  constructor(config: LLMProviderConfig = {}) {
    const apiKey = config.apiKey ?? process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY or pass apiKey in config.');
    }
    this.model = config.model ?? 'gpt-4o';
    this.client = new OpenAI({
      apiKey,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 120_000,
    });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const msg of options.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const tools: OpenAI.Chat.ChatCompletionTool[] | undefined = options.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
    });

    const choice = response.choices[0];
    if (!choice) throw new Error('No completion choice returned from OpenAI');

    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    return {
      content: choice.message.content ?? '',
      toolCalls,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason:
        choice.finish_reason === 'tool_calls'
          ? 'tool_calls'
          : choice.finish_reason === 'length'
            ? 'length'
            : 'stop',
    };
  }

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    const input = Array.isArray(options.text) ? options.text : [options.text];
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input,
    });
    return {
      embeddings: response.data.map((d) => d.embedding),
    };
  }
}
