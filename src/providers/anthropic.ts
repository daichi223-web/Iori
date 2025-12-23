/**
 * Iori Trinity Protocol - Anthropic Provider
 * @module providers/anthropic
 *
 * Anthropic Claude SDK wrapper for in-process AI calls
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  ProviderRequest,
  ProviderResponse,
  ProviderConfig,
} from './types.js';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT = 120000;

/**
 * Anthropic Claude provider implementation
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly defaultModel: string;

  private client: Anthropic;
  private model: string;
  private ready = false;

  constructor(config: ProviderConfig = {}) {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    this.client = new Anthropic({
      apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || DEFAULT_TIMEOUT,
    });

    this.model = config.model || DEFAULT_MODEL;
    this.defaultModel = this.model;
    this.ready = true;
  }

  /**
   * Send completion request to Claude
   */
  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();

    try {
      // Convert messages to Anthropic format
      const messages = request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      // Build system prompt
      let systemPrompt = request.systemPrompt || '';
      const systemMessages = request.messages.filter(m => m.role === 'system');
      if (systemMessages.length > 0) {
        systemPrompt = systemMessages.map(m => m.content).join('\n\n') + '\n\n' + systemPrompt;
      }

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || DEFAULT_MAX_TOKENS,
        system: systemPrompt || undefined,
        messages,
        temperature: request.temperature,
        stop_sequences: request.stopSequences,
      });

      const latencyMs = Date.now() - startTime;

      // Extract text content
      const content = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('');

      return {
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        stopReason: this.mapStopReason(response.stop_reason),
        model: response.model,
        latencyMs,
      };
    } catch {
      const latencyMs = Date.now() - startTime;

      return {
        content: '',
        usage: { inputTokens: 0, outputTokens: 0 },
        stopReason: 'error',
        model: this.model,
        latencyMs,
      };
    }
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.ready) return false;

    try {
      // Simple check - just verify API key works
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get provider info
   */
  getInfo(): { name: string; model: string; ready: boolean } {
    return {
      name: this.name,
      model: this.model,
      ready: this.ready,
    };
  }

  /**
   * Map Anthropic stop reason to our format
   */
  private mapStopReason(
    reason: string | null
  ): 'end_turn' | 'max_tokens' | 'stop_sequence' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'end_turn';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }
}

/**
 * Create Anthropic provider with optional config
 */
export function createAnthropicProvider(config?: ProviderConfig): AnthropicProvider {
  return new AnthropicProvider(config);
}
