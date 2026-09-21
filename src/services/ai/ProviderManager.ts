import {
  AIModel,
  AIProvider,
  AppSettings,
  ProviderHealthStatus,
  ProviderInfo,
  ProviderTestResult,
} from '../../types/index.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';

export class ProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private healthStatuses: Map<string, ProviderHealthStatus> = new Map();

  constructor() {
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new OpenRouterProvider());
    this.registerProvider(new OpenAICompatibleProvider());
  }

  registerProvider(provider: AIProvider) {
    this.providers.set(provider.id, provider);
    if (!this.healthStatuses.has(provider.id)) {
      this.healthStatuses.set(provider.id, 'NOT_CONFIGURED');
    }
  }

  getProvider(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  setHealth(providerId: string, health: ProviderHealthStatus) {
    this.healthStatuses.set(providerId, health);
  }

  getHealth(providerId: string): ProviderHealthStatus {
    return this.healthStatuses.get(providerId) || 'NOT_CONFIGURED';
  }

  async getAllHealthStatuses(): Promise<Record<string, ProviderHealthStatus>> {
    const map: Record<string, ProviderHealthStatus> = {};
    for (const [id, status] of this.healthStatuses.entries()) {
      map[id] = status;
    }
    // Ensure all standard providers are covered
    if (!map.gemini) map.gemini = 'HEALTHY';
    if (!map.openrouter) map.openrouter = 'HEALTHY';
    if (!map.custom) map.custom = 'HEALTHY';
    return map;
  }

  async listModels(providerId: string): Promise<AIModel[]> {
    const provider = this.getProvider(providerId);
    if (!provider) return [];
    try {
      return await provider.listModels();
    } catch {
      return [];
    }
  }

  async testProvider(
    providerId: string,
    config?: { apiKey?: string; model?: string; baseUrl?: string }
  ): Promise<ProviderTestResult> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        success: false,
        error: `Provider ${providerId} tidak terdaftar.`,
      };
    }
    const result = await provider.testConnection(config);
    if (result.success) {
      this.setHealth(providerId, 'HEALTHY');
    } else {
      this.setHealth(providerId, 'ERROR');
    }
    return result;
  }

  getProvidersInfo(settings: AppSettings): ProviderInfo[] {
    const priority = settings.providerPriority || ['gemini', 'openrouter', 'custom'];

    return priority.map((id) => {
      const p = this.getProvider(id);
      const isConfigured =
        id === 'gemini'
          ? true // Server provides default GEMINI_API_KEY if not in settings
          : id === 'openrouter'
          ? !!settings.openRouterApiKey
          : !!settings.customProviderApiKey;

      const health = isConfigured ? this.getHealth(id) === 'NOT_CONFIGURED' ? 'HEALTHY' : this.getHealth(id) : 'NOT_CONFIGURED';

      return {
        id,
        name:
          id === 'gemini'
            ? 'Google Gemini'
            : id === 'openrouter'
            ? 'OpenRouter'
            : settings.customProviderName || 'Custom Provider',
        health,
        priority: priority.indexOf(id) + 1,
        enabled: id === 'custom' ? !!settings.enableCustomProvider : true,
        isConfigured,
      };
    });
  }
}

export const providerManager = new ProviderManager();
