import { AIResponse, AgentTool, ChatMessage } from '../../types/index.js';

export interface AIProviderOptions {
  apiKey?: string;
  model?: string;
  workspacePath?: string;
  temperature?: number;
  maxTokens?: number;
  openRouterBaseUrl?: string;
}

export interface AIProvider {
  readonly id: 'gemini' | 'openrouter';
  readonly name: string;
  readonly isConfigured: boolean;

  generateResponse(
    messages: ChatMessage[],
    tools?: AgentTool[],
    options?: AIProviderOptions
  ): Promise<AIResponse>;

  testConnection?(
    config?: { apiKey?: string; model?: string; baseUrl?: string }
  ): Promise<{ success: boolean; message?: string; error?: string }>;
}
