/**
 * Iori Agent Framework - Type Definitions
 * MetaPilot: Multi-Agent DAG Execution System
 */

/**
 * Agent execution context - tools available to each agent
 */
export interface AgentContext {
  /** Read file from filesystem */
  readFile: (path: string) => Promise<string>;

  /** Write file to filesystem */
  writeFile: (path: string, content: string) => Promise<void>;

  /** Call LLM (Gemini/Claude/GPT) with prompt */
  callLLM: (prompt: string, model?: 'gemini' | 'claude' | 'gpt') => Promise<string>;

  /** Execute shell command */
  execShell: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

  /** Get output from dependent agents */
  getDependencyOutput: (agentId: string) => Promise<AgentOutput>;
}

/**
 * Agent execution result
 */
export interface AgentOutput {
  /** Agent ID that produced this output */
  agentId: string;

  /** Execution status */
  status: 'success' | 'error' | 'skipped';

  /** Generated artifacts (file paths or content) */
  artifacts: Record<string, string>;

  /** Error message if status is 'error' */
  error?: string;

  /** Execution duration in milliseconds */
  duration: number;

  /** Timestamp when execution started */
  timestamp: string;
}

/**
 * Agent definition structure
 */
export interface AgentDefinition {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this agent does */
  description: string;

  /** Dependencies - must complete before this agent runs */
  dependsOn: string[];

  /** Main execution function */
  execute: (context: AgentContext) => Promise<AgentOutput>;

  /** Optional retry configuration */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };

  /** Optional timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * DAG execution configuration
 */
export interface DAGConfig {
  /** Entry point agent ID */
  entry: string;

  /** Maximum number of agents to run in parallel */
  concurrency: number;

  /** Timeout for entire DAG execution */
  timeoutMs?: number;

  /** Whether to stop on first error */
  stopOnError?: boolean;
}

/**
 * DAG execution status
 */
export interface DAGStatus {
  /** Current execution state */
  state: 'pending' | 'running' | 'completed' | 'failed';

  /** Total number of agents in DAG */
  totalAgents: number;

  /** Number of completed agents */
  completedAgents: number;

  /** Number of failed agents */
  failedAgents: number;

  /** Currently running agent IDs */
  runningAgents: string[];

  /** Outputs from completed agents */
  outputs: Record<string, AgentOutput>;

  /** Start timestamp */
  startTime: string;

  /** End timestamp (if completed or failed) */
  endTime?: string;
}

/**
 * DAG node representation for execution
 */
export interface DAGNode {
  /** Agent definition */
  agent: AgentDefinition;

  /** Dependency node IDs */
  dependencies: string[];

  /** Dependent node IDs (nodes that depend on this) */
  dependents: string[];

  /** Execution status */
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';

  /** Output if completed */
  output?: AgentOutput;
}
