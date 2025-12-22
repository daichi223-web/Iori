/**
 * DAG Runner Tests
 * Tests for multi-agent DAG execution system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DAGRunner } from '../runner.js';
import type { AgentDefinition, AgentContext, AgentOutput } from '../types.js';

describe('DAGRunner', () => {
  let runner: DAGRunner;
  let mockAgents: AgentDefinition[];

  beforeEach(() => {
    // Create simple test agents
    const agentA: AgentDefinition = {
      id: 'agent-a',
      name: 'Agent A',
      description: 'First agent with no dependencies',
      dependsOn: [],
      execute: async (ctx: AgentContext) => ({
        agentId: 'agent-a',
        status: 'success',
        artifacts: { output: 'A output' },
        duration: 100,
        timestamp: new Date().toISOString(),
      }),
    };

    const agentB: AgentDefinition = {
      id: 'agent-b',
      name: 'Agent B',
      description: 'Second agent depending on A',
      dependsOn: ['agent-a'],
      execute: async (ctx: AgentContext) => {
        const depOutput = await ctx.getDependencyOutput('agent-a');
        return {
          agentId: 'agent-b',
          status: 'success',
          artifacts: { output: `B received: ${depOutput.artifacts.output}` },
          duration: 150,
          timestamp: new Date().toISOString(),
        };
      },
    };

    const agentC: AgentDefinition = {
      id: 'agent-c',
      name: 'Agent C',
      description: 'Third agent depending on A',
      dependsOn: ['agent-a'],
      execute: async (ctx: AgentContext) => ({
        agentId: 'agent-c',
        status: 'success',
        artifacts: { output: 'C output' },
        duration: 120,
        timestamp: new Date().toISOString(),
      }),
    };

    mockAgents = [agentA, agentB, agentC];
    runner = new DAGRunner(mockAgents);
  });

  describe('DAG Construction', () => {
    it('should build DAG from agent definitions', () => {
      const dag = runner.getDAG();

      expect(dag.size).toBe(3);
      expect(dag.get('agent-a')).toBeDefined();
      expect(dag.get('agent-b')).toBeDefined();
      expect(dag.get('agent-c')).toBeDefined();
    });

    it('should correctly identify dependencies', () => {
      const dag = runner.getDAG();
      const nodeB = dag.get('agent-b');

      expect(nodeB?.dependencies).toContain('agent-a');
      expect(nodeB?.dependencies.length).toBe(1);
    });

    it('should detect circular dependencies', () => {
      const circular: AgentDefinition[] = [
        {
          id: 'a',
          name: 'A',
          description: 'A',
          dependsOn: ['b'],
          execute: async () => ({
            agentId: 'a',
            status: 'success',
            artifacts: {},
            duration: 0,
            timestamp: '',
          }),
        },
        {
          id: 'b',
          name: 'B',
          description: 'B',
          dependsOn: ['a'],
          execute: async () => ({
            agentId: 'b',
            status: 'success',
            artifacts: {},
            duration: 0,
            timestamp: '',
          }),
        },
      ];

      expect(() => new DAGRunner(circular)).toThrow('Circular dependency detected');
    });
  });

  describe('DAG Execution', () => {
    it('should execute agents in correct order', async () => {
      const executionOrder: string[] = [];

      const trackedAgents = mockAgents.map((agent) => ({
        ...agent,
        execute: async (ctx: AgentContext) => {
          executionOrder.push(agent.id);
          return agent.execute(ctx);
        },
      }));

      runner = new DAGRunner(trackedAgents);
      await runner.run({ entry: 'agent-b', concurrency: 1 });

      // agent-a must run before agent-b
      const indexA = executionOrder.indexOf('agent-a');
      const indexB = executionOrder.indexOf('agent-b');
      expect(indexA).toBeLessThan(indexB);
    });

    it('should run independent agents in parallel', async () => {
      const status = await runner.run({ entry: 'agent-b', concurrency: 3 });

      expect(status.state).toBe('completed');
      expect(status.completedAgents).toBe(2); // agent-a and agent-b
      expect(status.failedAgents).toBe(0);
    });

    it('should return outputs from all executed agents', async () => {
      const status = await runner.run({ entry: 'agent-b', concurrency: 1 });

      expect(status.outputs['agent-a']).toBeDefined();
      expect(status.outputs['agent-b']).toBeDefined();
      expect(status.outputs['agent-a'].status).toBe('success');
    });

    it('should handle agent failures', async () => {
      const failingAgent: AgentDefinition = {
        id: 'failing',
        name: 'Failing Agent',
        description: 'Agent that always fails',
        dependsOn: [],
        execute: async () => {
          throw new Error('Intentional failure');
        },
      };

      runner = new DAGRunner([failingAgent]);
      const status = await runner.run({ entry: 'failing', concurrency: 1 });

      expect(status.state).toBe('failed');
      expect(status.failedAgents).toBe(1);
      expect(status.outputs['failing'].status).toBe('error');
    });

    it('should skip dependent agents when dependency fails', async () => {
      const agents: AgentDefinition[] = [
        {
          id: 'fail',
          name: 'Fail',
          description: 'Fails',
          dependsOn: [],
          execute: async () => {
            throw new Error('Failed');
          },
        },
        {
          id: 'dependent',
          name: 'Dependent',
          description: 'Depends on fail',
          dependsOn: ['fail'],
          execute: async () => ({
            agentId: 'dependent',
            status: 'success',
            artifacts: {},
            duration: 0,
            timestamp: '',
          }),
        },
      ];

      runner = new DAGRunner(agents);
      const status = await runner.run({ entry: 'dependent', concurrency: 1, stopOnError: true });

      expect(status.outputs['dependent'].status).toBe('skipped');
    });
  });

  describe('Concurrency Control', () => {
    it('should respect concurrency limit', async () => {
      let runningCount = 0;
      let maxConcurrent = 0;

      const agents: AgentDefinition[] = Array.from({ length: 5 }, (_, i) => ({
        id: `agent-${i}`,
        name: `Agent ${i}`,
        description: `Agent ${i}`,
        dependsOn: [],
        execute: async () => {
          runningCount++;
          maxConcurrent = Math.max(maxConcurrent, runningCount);
          await new Promise((resolve) => setTimeout(resolve, 50));
          runningCount--;
          return {
            agentId: `agent-${i}`,
            status: 'success',
            artifacts: {},
            duration: 50,
            timestamp: '',
          };
        },
      }));

      runner = new DAGRunner(agents);
      await runner.run({ entry: 'agent-0', concurrency: 2 });

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('Status Tracking', () => {
    it('should provide real-time status updates', async () => {
      const statuses: string[] = [];

      runner.on('statusChange', (status) => {
        statuses.push(status.state);
      });

      await runner.run({ entry: 'agent-b', concurrency: 1 });

      expect(statuses).toContain('running');
      expect(statuses).toContain('completed');
    });

    it('should track agent progress', async () => {
      const agentStates: string[] = [];

      runner.on('agentComplete', (output) => {
        agentStates.push(output.agentId);
      });

      await runner.run({ entry: 'agent-b', concurrency: 1 });

      expect(agentStates).toContain('agent-a');
      expect(agentStates).toContain('agent-b');
    });
  });
});
