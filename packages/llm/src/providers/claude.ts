import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  LLMProviderConfig,
  GenerateOptions,
  GenerateResult,
  ToolCall,
} from '../types.js';

export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude';
  readonly model: string;
  private client: Anthropic;

  constructor(config: LLMProviderConfig = {}) {
    const apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new Error(
        'Anthropic API key is required. Set ANTHROPIC_API_KEY or pass apiKey in config.'
      );
    }
    this.model = config.model ?? 'claude-sonnet-4-6';
    this.client = new Anthropic({
      apiKey,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 120_000,
    });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const tools: Anthropic.Tool[] | undefined = options.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        ...(t.parameters as Record<string, unknown>),
      },
    }));

    const messages: Anthropic.MessageParam[] = options.messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 4096,
      system: options.systemPrompt,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      temperature: options.temperature ?? 0.2,
    });

    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    const toolCalls: ToolCall[] | undefined =
      toolUseBlocks.length > 0
        ? toolUseBlocks.map((tu) => ({
            id: tu.id,
            name: tu.name,
            arguments: tu.input as Record<string, unknown>,
          }))
        : undefined;

    return {
      content: textContent,
      toolCalls,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason:
        response.stop_reason === 'tool_use'
          ? 'tool_calls'
          : response.stop_reason === 'max_tokens'
            ? 'length'
            : 'stop',
    };
  }
}
