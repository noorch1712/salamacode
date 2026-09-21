import {
  AIProvider,
  AIRequest,
  AIResponse,
  AIStreamEvent,
  ProviderTestResult,
  ProviderUsage,
  AIModel,
} from '../../types/index.js';
import { uiFetch } from '../api/apiClient.js';

export class OpenAICompatibleProvider implements AIProvider {
  readonly id = 'custom';
  name = 'Custom OpenAI-Compatible';

  constructor(public baseUrl?: string, public model?: string) {}

  async listModels(): Promise<AIModel[]> {
    return [
      {
        id: this.model || 'custom-model',
        name: `${this.name} (${this.model || 'Default'})`,
        provider: 'custom',
        contextWindow: 128000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false,
        supportsStructuredOutput: true,
        supportsLongContext: true,
        costType: 'Unknown',
        estimatedCost: 'Cost: Unknown',
        status: 'Available',
        description: 'Custom OpenAI-compatible endpoint provider.',
      },
    ];
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const res = await uiFetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'custom',
        messages: request.messages,
        tools: request.tools,
        workspacePath: request.workspacePath,
        customApiKey: request.apiKey,
        customBaseUrl: request.baseUrl || this.baseUrl,
        customModel: request.model || this.model || 'custom-model',
        temperature: request.temperature ?? 0.3,
        maxTokens: request.maxTokens ?? 8192,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const err = new Error(
        errorData.error || `Custom Provider Error (HTTP ${res.status}): Gagal memproses permintaan.`
      ) as any;
      err.status = res.status;
      err.isQuota = errorData.isQuota;
      err.errorType = errorData.errorType;
      err.provider = 'custom';
      throw err;
    }

    const data = await res.json();
    return {
      content: data.content || '',
      toolCalls: data.toolCalls || [],
      plan: data.plan,
      usage: data.usage,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIStreamEvent> {
    const response = await this.chat(request);
    if (response.content) {
      const words = response.content.split(' ');
      for (let i = 0; i < words.length; i += 3) {
        yield {
          type: 'text_chunk',
          text: (i > 0 ? ' ' : '') + words.slice(i, i + 3).join(' '),
        };
      }
    }
    yield {
      type: 'done',
      response,
    };
  }

  async testConnection(config?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }): Promise<ProviderTestResult> {
    const startTime = Date.now();
    try {
      const res = await uiFetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'custom',
          apiKey: config?.apiKey,
          model: config?.model || this.model || 'custom-model',
          baseUrl: config?.baseUrl || this.baseUrl || 'https://api.openai.com/v1',
        }),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startTime;
      return {
        success: data.success,
        message: data.message,
        error: data.error,
        latencyMs,
        model: config?.model || this.model || 'custom-model',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Gagal terhubung ke endpoint kustom',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async getUsage(): Promise<ProviderUsage> {
    try {
      const res = await uiFetch('/api/ai/usage');
      if (res.ok) {
        const data = await res.json();
        return data.custom || { totalRequests: 0, successfulRequests: 0, failedRequests: 0, tokensUsed: 'Unavailable' };
      }
    } catch {}
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      tokensUsed: 'Unavailable',
    };
  }

  // Backward compatibility with Phase 2 generateResponse signature
  async generateResponse(
    messages: any[],
    tools?: any[],
    options?: any
  ): Promise<AIResponse> {
    return this.chat({
      messages,
      tools,
      model: options?.model || this.model,
      apiKey: options?.apiKey,
      workspacePath: options?.workspacePath,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      baseUrl: options?.customBaseUrl || this.baseUrl,
    });
  }
}
