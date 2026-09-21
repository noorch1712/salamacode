import {
  AIErrorType,
  AIModel,
  AIProvider,
  AIRequest,
  AIResponse,
  AppSettings,
  FallbackDecision,
  ProviderHealthStatus,
} from '../../types/index.js';
import { providerManager, ProviderManager } from './ProviderManager.js';
import { uiFetch } from '../api/apiClient.js';

export interface SmartRouterOptions {
  settings: AppSettings;
  manager?: ProviderManager;
  onFallbackNotice?: (decision: FallbackDecision) => void;
  onAskFallbackPermission?: (decision: FallbackDecision) => Promise<boolean>;
}

export class SmartRouter {
  private settings: AppSettings;
  private manager: ProviderManager;
  private onFallbackNotice?: (decision: FallbackDecision) => void;
  private onAskFallbackPermission?: (decision: FallbackDecision) => Promise<boolean>;

  constructor(options: SmartRouterOptions) {
    this.settings = options.settings;
    this.manager = options.manager || providerManager;
    this.onFallbackNotice = options.onFallbackNotice;
    this.onAskFallbackPermission = options.onAskFallbackPermission;
  }

  updateSettings(settings: AppSettings) {
    this.settings = settings;
  }

  /**
   * Classifies raw error into standardized AIErrorType
   */
  classifyError(err: any): AIErrorType {
    const msg = (err.message || '').toLowerCase();
    const status = err.status || 0;

    if (
      status === 401 ||
      status === 403 ||
      msg.includes('api key') ||
      msg.includes('unauthorized') ||
      msg.includes('authentication')
    ) {
      return 'AUTH_ERROR';
    }

    if (
      status === 429 ||
      err.isQuota ||
      msg.includes('quota') ||
      msg.includes('resource_exhausted') ||
      msg.includes('credit')
    ) {
      return 'QUOTA_EXCEEDED';
    }

    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'RATE_LIMIT';
    }

    if (status === 404 || msg.includes('model not found') || msg.includes('not found')) {
      return 'MODEL_NOT_FOUND';
    }

    if (status >= 500 || msg.includes('internal error') || msg.includes('bad gateway') || status === 503) {
      return 'SERVER_ERROR';
    }

    if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('econnrefused')) {
      return 'NETWORK_ERROR';
    }

    if (status === 400 || msg.includes('invalid argument') || msg.includes('bad request')) {
      return 'INVALID_REQUEST';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Determine whether error is safe for exponential backoff retry
   */
  isRetryable(errorType: AIErrorType): boolean {
    return errorType === 'RATE_LIMIT' || errorType === 'SERVER_ERROR' || errorType === 'NETWORK_ERROR';
  }

  /**
   * Priority list of available providers
   */
  getProviderCandidates(): string[] {
    const list = this.settings.providerPriority && this.settings.providerPriority.length > 0
      ? [...this.settings.providerPriority]
      : ['gemini', 'openrouter', 'custom'];

    // Ensure primary provider comes first if defined
    if (this.settings.primaryProvider) {
      const idx = list.indexOf(this.settings.primaryProvider);
      if (idx > 0) {
        list.splice(idx, 1);
        list.unshift(this.settings.primaryProvider);
      }
    }

    return list.filter((id) => {
      if (id === 'custom' && !this.settings.enableCustomProvider) return false;
      return true;
    });
  }

  /**
   * Discovers the best provider based on configuration, health, and capability
   */
  async getBestProvider(requiredCapability?: keyof AIModel): Promise<{
    provider: AIProvider;
    modelName: string;
    apiKey?: string;
    baseUrl?: string;
  }> {
    const candidates = this.getProviderCandidates();

    for (const pid of candidates) {
      const p = this.manager.getProvider(pid);
      if (!p) continue;

      const health = this.manager.getHealth(pid);
      if (health === 'ERROR') continue; // skip errored providers if alternatives exist

      // Check required capabilities if specified
      if (requiredCapability) {
        const models = await p.listModels();
        const capable = models.some((m: any) => m[requiredCapability]);
        if (!capable) continue;
      }

      return this.resolveProviderConfig(pid, p);
    }

    // Fallback to first available provider
    const fallbackId = candidates[0] || 'gemini';
    const fallbackP = this.manager.getProvider(fallbackId)!;
    return this.resolveProviderConfig(fallbackId, fallbackP);
  }

  private resolveProviderConfig(pid: string, p: AIProvider) {
    if (pid === 'openrouter') {
      return {
        provider: p,
        modelName: this.settings.openRouterModel || 'google/gemini-2.5-flash',
        apiKey: this.settings.openRouterApiKey,
        baseUrl: this.settings.openRouterBaseUrl || 'https://openrouter.ai/api/v1',
      };
    }

    if (pid === 'custom') {
      return {
        provider: p,
        modelName: this.settings.customProviderModel || 'custom-model',
        apiKey: this.settings.customProviderApiKey,
        baseUrl: this.settings.customProviderBaseUrl,
      };
    }

    // Gemini
    return {
      provider: p,
      modelName: this.settings.modelName || 'gemini-3.8-flash',
      apiKey: this.settings.geminiApiKey,
    };
  }

  /**
   * Main Smart Routing Execution with Retry and Fallback
   */
  async executeWithRouting(
    request: AIRequest,
    onProgress?: (text: string) => void
  ): Promise<AIResponse> {
    const candidates = this.getProviderCandidates();
    let currentProviderIndex = 0;
    let lastError: any = null;

    while (currentProviderIndex < candidates.length) {
      const providerId = candidates[currentProviderIndex];
      const provider = this.manager.getProvider(providerId);

      if (!provider) {
        currentProviderIndex++;
        continue;
      }

      const config = this.resolveProviderConfig(providerId, provider);
      const activeRequest: AIRequest = {
        ...request,
        model: request.model || config.modelName,
        apiKey: request.apiKey || config.apiKey,
        baseUrl: request.baseUrl || config.baseUrl,
      };

      // Perform retries on retryable errors
      const maxRetries = 2;
      let attempt = 0;

      while (attempt <= maxRetries) {
        try {
          const startTime = Date.now();
          const response = provider.chat
            ? await provider.chat(activeRequest)
            : await provider.generateResponse(activeRequest.messages, activeRequest.tools, {
                model: activeRequest.model,
                apiKey: activeRequest.apiKey,
                baseUrl: activeRequest.baseUrl,
                workspacePath: activeRequest.workspacePath,
                temperature: activeRequest.temperature,
                maxTokens: activeRequest.maxTokens,
              });

          // Mark as healthy
          this.manager.setHealth(providerId, 'HEALTHY');

          // Log local usage
          this.recordLocalUsage({
            timestamp: Date.now(),
            provider: providerId,
            model: activeRequest.model || 'default',
            requestType: 'chat',
            inputTokens: response.usage?.promptTokens,
            outputTokens: response.usage?.completionTokens,
            durationMs: Date.now() - startTime,
            status: 'SUCCESS',
          });

          return response;
        } catch (rawErr: any) {
          lastError = rawErr;
          const errorType = this.classifyError(rawErr);

          // Update health
          if (errorType === 'QUOTA_EXCEEDED' || errorType === 'RATE_LIMIT') {
            this.manager.setHealth(providerId, 'LIMITED');
          } else {
            this.manager.setHealth(providerId, 'ERROR');
          }

          // Record failed log
          this.recordLocalUsage({
            timestamp: Date.now(),
            provider: providerId,
            model: activeRequest.model || 'default',
            requestType: 'chat',
            durationMs: 0,
            status: errorType === 'RATE_LIMIT' ? 'RATE_LIMIT' : 'ERROR',
            errorType,
          });

          // Non-retryable error check (e.g. AUTH_ERROR, INVALID_REQUEST)
          if (!this.isRetryable(errorType)) {
            // Check if we should fallback immediately on QUOTA_EXCEEDED
            if (errorType === 'QUOTA_EXCEEDED') {
              break; // Proceed to next fallback provider
            }
            throw rawErr;
          }

          // If retryable, sleep with exponential backoff (1s, 2s)
          attempt++;
          if (attempt <= maxRetries) {
            const backoffMs = Math.pow(2, attempt - 1) * 1000;
            onProgress?.(`Rate limit / error pada ${provider.name}. Mencoba ulang (Retry ${attempt}/${maxRetries}) dalam ${backoffMs / 1000}s...`);
            await new Promise((res) => setTimeout(res, backoffMs));
          }
        }
      }

      // Exhausted retries or encountered QUOTA_EXCEEDED -> Check fallback to next provider
      const nextIndex = currentProviderIndex + 1;
      if (nextIndex < candidates.length) {
        const nextProviderId = candidates[nextIndex];
        const nextProvider = this.manager.getProvider(nextProviderId);

        if (nextProvider) {
          const nextConfig = this.resolveProviderConfig(nextProviderId, nextProvider);
          const decision: FallbackDecision = {
            previousProvider: providerId,
            nextProvider: nextProviderId,
            reason: lastError?.message || 'Quota limit reached or service unavailable.',
            model: nextConfig.modelName,
          };

          // Ask permission if requested by user settings
          if (this.settings.askBeforeFallback && this.onAskFallbackPermission) {
            const allowed = await this.onAskFallbackPermission(decision);
            if (!allowed) {
              throw new Error(`Fallback ke ${nextProvider.name} dibatalkan oleh pengguna.`);
            }
          }

          this.onFallbackNotice?.(decision);
          currentProviderIndex++;
          continue; // loop with next provider
        }
      }

      break;
    }

    throw lastError || new Error('Tidak ada AI provider yang tersedia.');
  }

  private recordLocalUsage(entry: {
    timestamp: number;
    provider: string;
    model: string;
    requestType: string;
    inputTokens?: number;
    outputTokens?: number;
    durationMs: number;
    status: 'SUCCESS' | 'RATE_LIMIT' | 'ERROR';
    errorType?: AIErrorType;
  }) {
    try {
      uiFetch('/api/ai/usage/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => {});
    } catch {}
  }
}
