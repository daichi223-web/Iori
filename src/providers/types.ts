/**
 * Iori Trinity Protocol - Provider Abstraction Layer
 * @module providers/types
 *
 * Common interface for AI providers (Anthropic, Google, OpenAI)
 */

/** Message role in conversation */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Single message in conversation */
export interface Message {
  role: MessageRole;
  content: string;
}

/** Provider request options */
export interface ProviderRequest {
  messages: Message[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

/** Provider response */
export interface ProviderResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'error';
  model: string;
  latencyMs: number;
}

/** Provider error */
export interface ProviderError {
  code: string;
  message: string;
  retryable: boolean;
}

/** Provider configuration */
export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeout?: number;
}

/** AI Provider interface */
export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;

  /** Send a completion request */
  complete(request: ProviderRequest): Promise<ProviderResponse>;

  /** Check if provider is available */
  isAvailable(): Promise<boolean>;

  /** Get provider info */
  getInfo(): { name: string; model: string; ready: boolean };
}

/** Meeting persona types */
export type PersonaType = 'strategist' | 'designer' | 'engineer' | 'chair';

/** Persona definition */
export interface Persona {
  type: PersonaType;
  name: string;
  systemPrompt: string;
  focus: string[];
}

/** Meeting context input */
export interface MeetingContext {
  intent: string;
  spec?: string;
  dod?: string;
  evidence?: string;
  gitDiff?: string;
  logSummary?: string;
  constraints?: {
    maxIterations?: number;
    maxTokens?: number;
    priority?: 'speed' | 'quality' | 'balanced';
  };
}

/** Meeting decision */
export interface MeetingDecision {
  id: string;
  topic: string;
  adopted: string;
  rejected: string[];
  reasoning: string;
  owner: PersonaType;
}

/** Work Unit from plan */
export interface WorkUnit {
  id: string;
  title: string;
  description: string;
  dodItems: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  dependencies: string[];
  rollback?: string;
}

/** Meeting result output */
export interface MeetingResult {
  id: string;
  timestamp: string;
  intent: string;
  plan: {
    summary: string;
    workUnits: WorkUnit[];
    nextActions: string[];
    risks: string[];
  };
  decisions: MeetingDecision[];
  participants: PersonaType[];
  duration: number;
  tokenUsage: {
    total: number;
    byPersona: Record<PersonaType, number>;
  };
}

/** Trace entry for debugging */
export interface TraceEntry {
  timestamp: string;
  persona: PersonaType;
  action: 'thinking' | 'speaking' | 'deciding' | 'error';
  content: string;
  tokens?: number;
}
