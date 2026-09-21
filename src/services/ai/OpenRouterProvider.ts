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

export class OpenRouterProvider implements AIProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';

  constructor(public baseUrl?: string) {}

  async listModels(): Promise<AIModel[]> {
    try {
      const res = await uiFetch('/api/ai/models?provider=openrouter');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          return data.models;
        }
      }
    } catch {
      // fallback
    }

    return [
      {
        id: 'google/gemini-2.5-flash',
        name: 'Google: Gemini 2.5 Flash',
        provider: 'openrouter',
        contextWindow: 1000000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsStructuredOutput: true,
        supportsLongContext: true,
        costType: 'Free',
        estimatedCost: 'Free / Community',
        status: 'Available',
        description: 'Fast, intelligent model with tool calling on OpenRouter.',
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Anthropic: Claude 3.5 Sonnet',
        provider: 'openrouter',
        contextWindow: 200000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsStructuredOutput: true,
        supportsLongContext: true,
        costType: 'Paid',
        estimatedCost: 'Estimated: $0.003 / 1k tokens',
        status: 'Available',
        description: 'Industry-leading code generation and reasoning benchmark champion.',
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Meta: Llama 3.3 70B Instruct',
        provider: 'openrouter',
        contextWindow: 128000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false,
        supportsStructuredOutput: true,
        supportsLongContext: true,
        costType: 'Free',
        estimatedCost: 'Free tier available',
        status: 'Available',
        description: 'Open-weights powerhouse for code generation and debugging.',
      },
      {
        id: 'qwen/qwen-2.5-coder-32b-instruct',
        name: 'Qwen: 2.5 Coder 32B Instruct',
        provider: 'openrouter',
        contextWindow: 128000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false,
        supportsStructuredOutput: true,
        supportsLongContext: true,
        costType: 'Free',
        estimatedCost: 'Free tier available',
        status: 'Available',
        description: 'Specialized coding model with superior syntax accuracy.',
      },
    ];
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const res = await uiFetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openrouter',
        messages: request.messages,
        tools: request.tools,
        workspacePath: request.workspacePath,
        customApiKey: request.apiKey,
        openRouterBaseUrl: request.baseUrl || this.baseUrl || 'https://openrouter.ai/api/v1',
        openRouterModel: request.model || 'google/gemini-2.5-flash',
        temperature: request.temperature ?? 0.3,
        maxTokens: request.maxTokens ?? 8192,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const err = new Error(
        errorData.error || `OpenRouter Error (HTTP ${res.status}): Gagal memproses permintaan.`
      ) as any;
      err.status = res.status;
      err.isQuota = errorData.isQuota;
      err.errorType = errorData.errorType;
      err.provider = 'openrouter';
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
          provider: 'openrouter',
          apiKey: config?.apiKey,
          model: config?.model || 'google/gemini-2.5-flash',
          baseUrl: config?.baseUrl || this.baseUrl || 'https://openrouter.ai/api/v1',
        }),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startTime;
      return {
        success: data.success,
        message: data.message,
        error: data.error,
        latencyMs,
        model: config?.model || 'google/gemini-2.5-flash',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Gagal terhubung ke OpenRouter API',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async getUsage(): Promise<ProviderUsage> {
    try {
      const res = await uiFetch('/api/ai/usage');
      if (res.ok) {
        const data = await res.json();
        return data.openrouter || { totalRequests: 0, successfulRequests: 0, failedRequests: 0, tokensUsed: 'Unavailable' };
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
      model: options?.model,
      apiKey: options?.apiKey,
      workspacePath: options?.workspacePath,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      baseUrl: options?.openRouterBaseUrl || this.baseUrl,
    });
  }
}
