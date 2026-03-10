export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface GenerateOptions {
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface GenerateResult {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface EmbeddingOptions {
  text: string | string[];
}

export interface EmbeddingResult {
  embeddings: number[][];
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  embed?(options: EmbeddingOptions): Promise<EmbeddingResult>;
}

export interface LLMProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxRetries?: number;
  timeout?: number;
}
