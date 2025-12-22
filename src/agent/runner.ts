/**
 * DAG Runner - Multi-Agent DAG Execution System
 * MetaPilot: Executes agents in dependency order with concurrency control
 */

import { EventEmitter } from 'events';
import type {
  AgentDefinition,
  AgentContext,
  AgentOutput,
  DAGConfig,
  DAGStatus,
  DAGNode,
} from './types.js';

/**
 * DAG Runner - Executes agents in topological order
 */
export class DAGRunner extends EventEmitter {
  private dag: Map<string, DAGNode>;
  private agents: Map<string, AgentDefinition>;
  private outputs: Map<string, AgentOutput>;

  constructor(agentDefinitions: AgentDefinition[]) {
    super();
    this.agents = new Map(agentDefinitions.map((a) => [a.id, a]));
    this.outputs = new Map();
    this.dag = this.buildDAG(agentDefinitions);
    this.validateDAG();
  }

  /**
   * Build DAG from agent definitions
   */
  private buildDAG(agents: AgentDefinition[]): Map<string, DAGNode> {
    const dag = new Map<string, DAGNode>();

    // Create nodes
    for (const agent of agents) {
      dag.set(agent.id, {
        agent,
        dependencies: [...agent.dependsOn],
        dependents: [],
        status: 'pending',
      });
    }

    // Build dependent relationships
    for (const [id, node] of dag.entries()) {
      for (const depId of node.dependencies) {
        const depNode = dag.get(depId);
        if (depNode) {
          depNode.dependents.push(id);
        }
      }
    }

    return dag;
  }

  /**
   * Validate DAG for circular dependencies
   */
  private validateDAG(): void {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        recStack.add(nodeId);

        const node = this.dag.get(nodeId);
        if (node) {
          for (const depId of node.dependencies) {
            if (!visited.has(depId) && hasCycle(depId)) {
              return true;
            } else if (recStack.has(depId)) {
              return true;
            }
          }
        }
      }
      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.dag.keys()) {
      if (hasCycle(nodeId)) {
        throw new Error('Circular dependency detected in DAG');
      }
    }
  }

  /**
   * Get DAG structure
   */
  getDAG(): Map<string, DAGNode> {
    return this.dag;
  }

  /**
   * Create agent execution context
   */
  private createContext(agentId: string): AgentContext {
    const fs = require('fs/promises');
    const { execSync } = require('child_process');

    return {
      readFile: async (path: string) => {
        return fs.readFile(path, 'utf-8');
      },

      writeFile: async (path: string, content: string) => {
        await fs.writeFile(path, content, 'utf-8');
      },

      callLLM: async (prompt: string, model = 'gemini') => {
        // TODO: Integrate with actual LLM API
        return `Mock LLM response for: ${prompt.substring(0, 50)}...`;
      },

      execShell: async (command: string) => {
        try {
          const stdout = execSync(command, { encoding: 'utf-8' });
          return { stdout, stderr: '', exitCode: 0 };
        } catch (error: any) {
          return {
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            exitCode: error.status || 1,
          };
        }
      },

      getDependencyOutput: async (depId: string) => {
        const output = this.outputs.get(depId);
        if (!output) {
          throw new Error(`Dependency output not found: ${depId}`);
        }
        return output;
      },
    };
  }

  /**
   * Execute a single agent
   */
  private async executeAgent(agentId: string): Promise<AgentOutput> {
    const node = this.dag.get(agentId);
    if (!node) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const { agent } = node;
    const startTime = Date.now();
    node.status = 'running';

    try {
      const context = this.createContext(agentId);
      const output = await agent.execute(context);

      node.status = 'completed';
      node.output = output;
      this.outputs.set(agentId, output);

      this.emit('agentComplete', output);
      return output;
    } catch (error: any) {
      const errorOutput: AgentOutput = {
        agentId,
        status: 'error',
        artifacts: {},
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      node.status = 'failed';
      node.output = errorOutput;
      this.outputs.set(agentId, errorOutput);

      this.emit('agentError', errorOutput);
      return errorOutput;
    }
  }

  /**
   * Get agents that are ready to run
   */
  private getReadyAgents(statusOutputs: Record<string, AgentOutput>): string[] {
    const ready: string[] = [];

    for (const [id, node] of this.dag.entries()) {
      if (node.status !== 'pending') continue;

      // Check if all dependencies are completed
      const allDepsCompleted = node.dependencies.every((depId) => {
        const depNode = this.dag.get(depId);
        return depNode?.status === 'completed';
      });

      // Check if any dependency failed
      const anyDepFailed = node.dependencies.some((depId) => {
        const depNode = this.dag.get(depId);
        return depNode?.status === 'failed' || depNode?.status === 'skipped';
      });

      if (anyDepFailed) {
        node.status = 'skipped';
        const skippedOutput: AgentOutput = {
          agentId: id,
          status: 'skipped',
          artifacts: {},
          error: 'Dependency failed',
          duration: 0,
          timestamp: new Date().toISOString(),
        };
        node.output = skippedOutput;
        this.outputs.set(id, skippedOutput);
        statusOutputs[id] = skippedOutput; // Add to status outputs
        this.emit('agentSkipped', skippedOutput);
      } else if (allDepsCompleted) {
        ready.push(id);
      }
    }

    return ready;
  }

  /**
   * Build execution subgraph from entry point
   */
  private buildExecutionSubgraph(entryId: string): Set<string> {
    const subgraph = new Set<string>();
    const queue = [entryId];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (subgraph.has(id)) continue;

      subgraph.add(id);
      const node = this.dag.get(id);
      if (node) {
        queue.push(...node.dependencies);
      }
    }

    return subgraph;
  }

  /**
   * Run DAG execution
   */
  async run(config: DAGConfig): Promise<DAGStatus> {
    const { entry, concurrency, stopOnError = false } = config;
    const startTime = new Date().toISOString();

    // Build subgraph from entry point
    const executionSubgraph = this.buildExecutionSubgraph(entry);

    // Reset status for nodes in subgraph
    for (const id of executionSubgraph) {
      const node = this.dag.get(id);
      if (node) {
        node.status = 'pending';
        node.output = undefined;
      }
    }
    this.outputs.clear();

    const status: DAGStatus = {
      state: 'running',
      totalAgents: executionSubgraph.size,
      completedAgents: 0,
      failedAgents: 0,
      runningAgents: [],
      outputs: {},
      startTime,
    };

    this.emit('statusChange', status);

    const running = new Set<Promise<void>>();

    while (true) {
      // Get agents ready to run
      const readyAgents = this.getReadyAgents(status.outputs).filter((id) =>
        executionSubgraph.has(id)
      );

      // Start new agents up to concurrency limit
      while (readyAgents.length > 0 && running.size < concurrency) {
        const agentId = readyAgents.shift()!;
        status.runningAgents.push(agentId);

        const promise = this.executeAgent(agentId).then((output) => {
          status.runningAgents = status.runningAgents.filter((id) => id !== agentId);
          status.outputs[agentId] = output;

          if (output.status === 'success') {
            status.completedAgents++;
          } else if (output.status === 'error') {
            status.failedAgents++;
          }

          this.emit('statusChange', status);
        });

        running.add(promise);
        promise.finally(() => running.delete(promise));
      }

      // Wait for at least one agent to complete
      if (running.size > 0) {
        await Promise.race(running);
      } else {
        // No more running and no more ready - done
        break;
      }

      // Stop on error if configured
      if (stopOnError && status.failedAgents > 0) {
        break;
      }
    }

    // Wait for all remaining agents
    await Promise.all(running);

    // Mark any remaining pending agents as skipped (due to stopOnError or failed dependencies)
    for (const id of executionSubgraph) {
      const node = this.dag.get(id);
      if (node && node.status === 'pending') {
        node.status = 'skipped';
        const skippedOutput: AgentOutput = {
          agentId: id,
          status: 'skipped',
          artifacts: {},
          error: 'Execution stopped early or dependency failed',
          duration: 0,
          timestamp: new Date().toISOString(),
        };
        node.output = skippedOutput;
        this.outputs.set(id, skippedOutput);
        status.outputs[id] = skippedOutput;
        this.emit('agentSkipped', skippedOutput);
      }
    }

    status.state = status.failedAgents > 0 ? 'failed' : 'completed';
    status.endTime = new Date().toISOString();

    this.emit('statusChange', status);

    return status;
  }
}
