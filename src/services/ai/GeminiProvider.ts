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

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';

  async listModels(): Promise<AIModel[]> {
    try {
      const res = await uiFetch('/api/ai/models?provider=gemini');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          return data.models;
        }
      }
    } catch {
      // fallback to hardcoded list below
    }

    return [
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash (Recommended)',
        provider: 'gemini',
        contextWindow: 1048576,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsStructuredOutput: true,
        supportsLongContext: true,
        costType: 'Free',
        estimatedCost: '$0.0000',
        status: 'Available',
        description: 'Next-generation ultra-fast multimodal model with native tool-calling.',
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        contextWindow: 1048576,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsStructuredOutput: true,
        supportsLongContext: true,
        costType: 'Free',
        estimatedCost: '$0.0000',
        status: 'Available',
        description: 'Balanced speed and efficiency for coding and planning tasks.',
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'gemini',
        contextWindow: 2097152,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        supportsStructuredOutput: true,
        supportsLongContext: true,
        costType: 'Paid',
        estimatedCost: 'Estimated: $0.001 / 1k tokens',
        status: 'Available',
        description: 'Deep reasoning and complex multi-file architectural refactoring.',
      },
    ];
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const res = await uiFetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'gemini',
        messages: request.messages,
        tools: request.tools,
        workspacePath: request.workspacePath,
        customApiKey: request.apiKey,
        modelName: request.model || 'gemini-3.8-flash',
        temperature: request.temperature ?? 0.3,
        maxTokens: request.maxTokens ?? 8192,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const err = new Error(
        errorData.error || `Gemini API Error (HTTP ${res.status}): Gagal memproses permintaan.`
      ) as any;
      err.status = res.status;
      err.isQuota = errorData.isQuota;
      err.errorType = errorData.errorType;
      err.provider = 'gemini';
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
      // Simulate real-time streaming chunks if server returned content
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
          provider: 'gemini',
          apiKey: config?.apiKey,
          model: config?.model || 'gemini-3.8-flash',
        }),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startTime;
      return {
        success: data.success,
        message: data.message,
        error: data.error,
        latencyMs,
        model: config?.model || 'gemini-3.8-flash',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Gagal terhubung ke Gemini API',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async getUsage(): Promise<ProviderUsage> {
    try {
      const res = await uiFetch('/api/ai/usage');
      if (res.ok) {
        const data = await res.json();
        return data.gemini || { totalRequests: 0, successfulRequests: 0, failedRequests: 0, tokensUsed: 'Unavailable' };
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
    });
  }
}
