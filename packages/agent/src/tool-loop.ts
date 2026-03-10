/**
 * Core agent tool-use loop.
 * Runs LLM in a loop, executing tool calls until the model returns a final text response.
 */
import type { LLMProvider, Message, ToolDefinition, GenerateResult } from '@issuepilot/llm';
import type { ToolContext } from '@issuepilot/tools';
import { executeTool } from '@issuepilot/tools';

export interface ToolLoopOptions {
  provider: LLMProvider;
  systemPrompt: string;
  initialMessages: Message[];
  tools: ToolDefinition[];
  toolContext: ToolContext;
  maxIterations?: number;
  onToolCall?: (name: string, args: Record<string, unknown>, result: unknown) => void;
  onThinking?: (content: string) => void;
}

export interface ToolLoopResult {
  finalResponse: string;
  iterations: number;
  toolCallCount: number;
  messages: Message[];
}

export async function runToolLoop(options: ToolLoopOptions): Promise<ToolLoopResult> {
  const {
    provider,
    systemPrompt,
    initialMessages,
    tools,
    toolContext,
    maxIterations = 30,
    onToolCall,
    onThinking,
  } = options;

  const messages: Message[] = [...initialMessages];
  let iterations = 0;
  let toolCallCount = 0;

  while (iterations < maxIterations) {
    iterations++;

    const result: GenerateResult = await provider.generate({
      systemPrompt,
      messages,
      tools,
      temperature: 0.2,
      maxTokens: 4096,
    });

    if (result.content) {
      onThinking?.(result.content);
    }

    // If no tool calls, we have the final response
    if (!result.toolCalls || result.toolCalls.length === 0) {
      return {
        finalResponse: result.content,
        iterations,
        toolCallCount,
        messages,
      };
    }

    // Add assistant message with tool calls
    messages.push({ role: 'assistant', content: result.content || '' });

    // Execute each tool call and collect results
    const toolResultParts: string[] = [];

    for (const toolCall of result.toolCalls) {
      toolCallCount++;
      const toolResult = await executeTool(toolCall.name, toolCall.arguments, toolContext);
      const resultText = toolResult.success
        ? JSON.stringify(toolResult.data, null, 2)
        : `ERROR: ${toolResult.error}`;

      onToolCall?.(toolCall.name, toolCall.arguments, toolResult);
      toolResultParts.push(`Tool: ${toolCall.name}\nResult: ${resultText}`);
    }

    // Add tool results as user message
    messages.push({
      role: 'user',
      content: toolResultParts.join('\n\n---\n\n'),
    });
  }

  return {
    finalResponse: 'Max iterations reached without completing the task.',
    iterations,
    toolCallCount,
    messages,
  };
}
