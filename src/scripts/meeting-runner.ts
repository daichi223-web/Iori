/**
 * Iori Trinity Protocol - Meeting Runner
 * @module scripts/meeting-runner
 *
 * Orchestrates 3-persona meetings with Context Firewall
 * Strategist -> Designer -> Engineer -> Chair (synthesis)
 */

import fs from 'fs/promises';
import path from 'path';
import { createAnthropicProvider } from '../providers/anthropic.js';
import type {
  AIProvider,
  MeetingContext,
  MeetingResult,
  MeetingDecision,
  WorkUnit,
  Persona,
  PersonaType,
  TraceEntry,
  Message,
} from '../providers/types.js';

/** Persona definitions */
const PERSONAS: Record<PersonaType, Persona> = {
  strategist: {
    type: 'strategist',
    name: 'Strategist',
    systemPrompt: `You are the Strategist in Iori's Trinity Council.
Your role is to analyze scope, prioritize work, and optimize DoD progression.

Focus areas:
- Scope definition and boundaries
- Priority ordering of work units
- DoD item progression strategy
- Risk identification and mitigation
- Resource allocation recommendations

Output format: Provide structured analysis with clear priorities.
Be concise and actionable. Focus on WHAT and WHY, not HOW.`,
    focus: ['scope', 'priority', 'dod', 'risk'],
  },

  designer: {
    type: 'designer',
    name: 'Designer',
    systemPrompt: `You are the Designer in Iori's Trinity Council.
Your role is to design UI/UX, information architecture, and user flows.

Focus areas:
- Dashboard layout (A: Active tasks, B: DoD progress, C: Next actions)
- Information hierarchy and visual design
- User experience flows
- Apple-style minimalist aesthetics
- Accessibility and responsiveness

Output format: Provide design decisions with rationale.
Be visual-thinking oriented. Consider the user's mental model.`,
    focus: ['ui', 'ux', 'layout', 'flow'],
  },

  engineer: {
    type: 'engineer',
    name: 'Engineer',
    systemPrompt: `You are the Engineer in Iori's Trinity Council.
Your role is to define implementation details, technical approach, and testing strategy.

Focus areas:
- Implementation steps and file changes
- Technical risks and dependencies
- Testing strategy (TDD approach)
- Rollback procedures
- Performance considerations

Output format: Provide concrete implementation plan with file paths.
Be specific about code changes. Include test cases.`,
    focus: ['implementation', 'testing', 'rollback', 'performance'],
  },

  chair: {
    type: 'chair',
    name: 'Chair',
    systemPrompt: `You are the Chair of Iori's Trinity Council.
Your role is to synthesize the inputs from Strategist, Designer, and Engineer into a unified plan.

Responsibilities:
- Resolve conflicts between perspectives
- Create actionable Work Units (WU-01, WU-02, etc.)
- Ensure DoD alignment
- Define clear success criteria
- Provide rollback procedures

Output format: Generate a structured plan.md with:
1. Summary
2. Work Units with DoD mappings
3. Next Actions
4. Risks and Mitigations

Be decisive. Create a plan that can be executed immediately.`,
    focus: ['synthesis', 'planning', 'decisions'],
  },
};

/** Meeting runner configuration */
interface MeetingRunnerConfig {
  provider?: AIProvider;
  outputDir?: string;
  maxTokensPerTurn?: number;
  traceEnabled?: boolean;
}

/**
 * Meeting Runner - Orchestrates Trinity Council meetings
 */
export class MeetingRunner {
  private provider: AIProvider;
  private outputDir: string;
  private maxTokensPerTurn: number;
  private traceEnabled: boolean;
  private traces: TraceEntry[] = [];

  constructor(config: MeetingRunnerConfig = {}) {
    this.provider = config.provider || createAnthropicProvider();
    this.outputDir = config.outputDir || '.iori/meetings';
    this.maxTokensPerTurn = config.maxTokensPerTurn || 2048;
    this.traceEnabled = config.traceEnabled ?? true;
  }

  /**
   * Run a Trinity Council meeting
   */
  async runMeeting(context: MeetingContext): Promise<MeetingResult> {
    const meetingId = this.generateMeetingId();
    const startTime = Date.now();
    this.traces = [];

    // Create meeting directory
    const meetingDir = path.join(this.outputDir, meetingId);
    await fs.mkdir(meetingDir, { recursive: true });

    // Save context
    await this.saveJson(meetingDir, 'context.json', context);

    try {
      // Build context summary for personas
      const contextSummary = this.buildContextSummary(context);

      // Phase 1: Gather perspectives from 3 personas
      this.trace('strategist', 'thinking', 'Analyzing scope and priorities...');
      const strategistOutput = await this.runPersona('strategist', context, contextSummary);

      this.trace('designer', 'thinking', 'Designing user experience...');
      const designerOutput = await this.runPersona('designer', context, contextSummary, strategistOutput);

      this.trace('engineer', 'thinking', 'Planning implementation...');
      const engineerOutput = await this.runPersona('engineer', context, contextSummary, strategistOutput, designerOutput);

      // Phase 2: Chair synthesizes into plan
      this.trace('chair', 'thinking', 'Synthesizing perspectives...');
      const planOutput = await this.runChair(context, {
        strategist: strategistOutput,
        designer: designerOutput,
        engineer: engineerOutput,
      });

      // Parse outputs
      const workUnits = this.parseWorkUnits(planOutput);
      const decisions = this.parseDecisions(planOutput, strategistOutput, designerOutput, engineerOutput);
      const { summary, nextActions, risks } = this.parsePlanSections(planOutput);

      // Build result
      const duration = Date.now() - startTime;
      const result: MeetingResult = {
        id: meetingId,
        timestamp: new Date().toISOString(),
        intent: context.intent,
        plan: {
          summary,
          workUnits,
          nextActions,
          risks,
        },
        decisions,
        participants: ['strategist', 'designer', 'engineer', 'chair'],
        duration,
        tokenUsage: {
          total: 0, // Will be calculated from traces
          byPersona: {
            strategist: 0,
            designer: 0,
            engineer: 0,
            chair: 0,
          },
        },
      };

      // Calculate token usage from traces
      for (const trace of this.traces) {
        if (trace.tokens) {
          result.tokenUsage.total += trace.tokens;
          result.tokenUsage.byPersona[trace.persona] += trace.tokens;
        }
      }

      // Save outputs
      await this.savePlan(meetingDir, planOutput, result);
      await this.saveJson(meetingDir, 'decisions.json', decisions);
      await this.saveTraces(meetingDir);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.trace('chair', 'error', message);
      await this.saveTraces(meetingDir);
      throw error;
    }
  }

  /**
   * Run a single persona
   */
  private async runPersona(
    type: PersonaType,
    context: MeetingContext,
    contextSummary: string,
    ...previousOutputs: string[]
  ): Promise<string> {
    const persona = PERSONAS[type];

    // Build conversation
    const messages: Message[] = [
      {
        role: 'user',
        content: this.buildPersonaPrompt(persona, context, contextSummary, previousOutputs),
      },
    ];

    const response = await this.provider.complete({
      messages,
      systemPrompt: persona.systemPrompt,
      maxTokens: this.maxTokensPerTurn,
      temperature: 0.7,
    });

    this.trace(type, 'speaking', response.content, response.usage.outputTokens);

    return response.content;
  }

  /**
   * Run the Chair to synthesize
   */
  private async runChair(
    context: MeetingContext,
    outputs: Record<'strategist' | 'designer' | 'engineer', string>
  ): Promise<string> {
    const persona = PERSONAS.chair;

    const prompt = `# Trinity Council Meeting Synthesis

## Meeting Intent
${context.intent}

## Strategist's Analysis
${outputs.strategist}

## Designer's Recommendations
${outputs.designer}

## Engineer's Implementation Plan
${outputs.engineer}

---

Based on the above inputs, create a unified implementation plan.

Output a structured plan with:
1. **Summary**: 2-3 sentence overview
2. **Work Units**: WU-01, WU-02, etc. with:
   - Title
   - Description
   - DoD items addressed
   - Complexity (low/medium/high)
   - Dependencies
   - Rollback procedure
3. **Next Actions**: Immediate steps (max 5)
4. **Risks**: Potential issues and mitigations

Format as Markdown.`;

    const response = await this.provider.complete({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: persona.systemPrompt,
      maxTokens: this.maxTokensPerTurn * 2,
      temperature: 0.5,
    });

    this.trace('chair', 'deciding', response.content, response.usage.outputTokens);

    return response.content;
  }

  /**
   * Build context summary for personas
   */
  private buildContextSummary(context: MeetingContext): string {
    const parts: string[] = [];

    if (context.spec) {
      parts.push(`## SPEC.md\n${context.spec.slice(0, 1000)}...`);
    }

    if (context.dod) {
      parts.push(`## DOD.md\n${context.dod.slice(0, 1000)}...`);
    }

    if (context.evidence) {
      parts.push(`## EVIDENCE.md\n${context.evidence.slice(0, 500)}...`);
    }

    if (context.gitDiff) {
      parts.push(`## Recent Changes (git diff --stat)\n${context.gitDiff.slice(0, 500)}`);
    }

    if (context.logSummary) {
      parts.push(`## Log Summary\n${context.logSummary.slice(0, 300)}`);
    }

    return parts.join('\n\n') || 'No additional context provided.';
  }

  /**
   * Build prompt for a persona
   */
  private buildPersonaPrompt(
    persona: Persona,
    context: MeetingContext,
    contextSummary: string,
    previousOutputs: string[]
  ): string {
    let prompt = `# Trinity Council Meeting

## Intent
${context.intent}

## Context
${contextSummary}

## Constraints
- Priority: ${context.constraints?.priority || 'balanced'}
- Max iterations: ${context.constraints?.maxIterations || 'unlimited'}
`;

    if (previousOutputs.length > 0) {
      prompt += '\n## Previous Perspectives\n';
      const personaOrder = ['strategist', 'designer', 'engineer'];
      previousOutputs.forEach((output, i) => {
        prompt += `### ${personaOrder[i]?.toUpperCase() || 'Unknown'}\n${output}\n\n`;
      });
    }

    prompt += `\nProvide your ${persona.name} perspective. Focus on: ${persona.focus.join(', ')}.`;

    return prompt;
  }

  /**
   * Parse work units from plan output
   */
  private parseWorkUnits(planOutput: string): WorkUnit[] {
    const workUnits: WorkUnit[] = [];
    const wuPattern = /### (WU-\d+)[:\s]+(.+?)(?=### WU-|## |$)/gs;

    let match;
    while ((match = wuPattern.exec(planOutput)) !== null) {
      const [, id, content] = match;
      const title = content.split('\n')[0]?.trim() || '';
      const description = content.slice(title.length).trim();

      // Extract DoD items
      const dodMatch = content.match(/DoD[^:]*:([^\n]+)/i);
      const dodItems = dodMatch
        ? dodMatch[1].split(',').map(s => s.trim())
        : [];

      // Extract complexity
      const complexityMatch = content.match(/Complexity[^:]*:\s*(low|medium|high)/i);
      const complexity = (complexityMatch?.[1]?.toLowerCase() as 'low' | 'medium' | 'high') || 'medium';

      // Extract dependencies
      const depsMatch = content.match(/Dependencies[^:]*:([^\n]+)/i);
      const dependencies = depsMatch
        ? depsMatch[1].split(',').map(s => s.trim()).filter(s => s !== 'None' && s !== 'none')
        : [];

      // Extract rollback
      const rollbackMatch = content.match(/Rollback[^:]*:([^\n]+)/i);
      const rollback = rollbackMatch?.[1]?.trim();

      workUnits.push({
        id: id || `WU-${workUnits.length + 1}`,
        title,
        description,
        dodItems,
        estimatedComplexity: complexity,
        dependencies,
        rollback,
      });
    }

    return workUnits;
  }

  /**
   * Parse decisions from outputs
   */
  private parseDecisions(
    _planOutput: string,
    strategistOutput: string,
    designerOutput: string,
    engineerOutput: string
  ): MeetingDecision[] {
    const decisions: MeetingDecision[] = [];

    // Extract decisions from each persona's output
    const extractDecisions = (output: string, owner: PersonaType): void => {
      const decisionPattern = /(?:Decision|Recommendation|Conclusion)[:\s]+([^\n]+)/gi;
      let match;
      while ((match = decisionPattern.exec(output)) !== null) {
        decisions.push({
          id: `decision_${decisions.length + 1}`,
          topic: match[1].slice(0, 50),
          adopted: match[1],
          rejected: [],
          reasoning: 'Based on Trinity Council discussion',
          owner,
        });
      }
    };

    extractDecisions(strategistOutput, 'strategist');
    extractDecisions(designerOutput, 'designer');
    extractDecisions(engineerOutput, 'engineer');

    return decisions;
  }

  /**
   * Parse plan sections
   */
  private parsePlanSections(planOutput: string): {
    summary: string;
    nextActions: string[];
    risks: string[];
  } {
    // Extract summary
    const summaryMatch = planOutput.match(/##\s*Summary\s*\n([\s\S]*?)(?=##|$)/i);
    const summary = summaryMatch?.[1]?.trim() || planOutput.slice(0, 200);

    // Extract next actions
    const nextActions: string[] = [];
    const actionsMatch = planOutput.match(/##\s*Next Actions?\s*\n([\s\S]*?)(?=##|$)/i);
    if (actionsMatch) {
      const lines = actionsMatch[1].split('\n');
      for (const line of lines) {
        const item = line.replace(/^[-*\d.)\s]+/, '').trim();
        if (item) nextActions.push(item);
      }
    }

    // Extract risks
    const risks: string[] = [];
    const risksMatch = planOutput.match(/##\s*Risks?\s*\n([\s\S]*?)(?=##|$)/i);
    if (risksMatch) {
      const lines = risksMatch[1].split('\n');
      for (const line of lines) {
        const item = line.replace(/^[-*\d.)\s]+/, '').trim();
        if (item) risks.push(item);
      }
    }

    return { summary, nextActions: nextActions.slice(0, 5), risks };
  }

  /**
   * Save plan.md
   */
  private async savePlan(
    meetingDir: string,
    planContent: string,
    result: MeetingResult
  ): Promise<void> {
    const header = `# Trinity Council Meeting Plan
**Meeting ID:** ${result.id}
**Timestamp:** ${result.timestamp}
**Intent:** ${result.intent}
**Duration:** ${result.duration}ms

---

`;
    await fs.writeFile(
      path.join(meetingDir, 'plan.md'),
      header + planContent,
      'utf-8'
    );
  }

  /**
   * Save JSON file
   */
  private async saveJson(dir: string, filename: string, data: unknown): Promise<void> {
    await fs.writeFile(
      path.join(dir, filename),
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }

  /**
   * Save trace log
   */
  private async saveTraces(meetingDir: string): Promise<void> {
    if (!this.traceEnabled || this.traces.length === 0) return;

    const content = this.traces
      .map(t => JSON.stringify(t))
      .join('\n');

    await fs.writeFile(
      path.join(meetingDir, 'trace.jsonl'),
      content,
      'utf-8'
    );
  }

  /**
   * Add trace entry
   */
  private trace(
    persona: PersonaType,
    action: TraceEntry['action'],
    content: string,
    tokens?: number
  ): void {
    this.traces.push({
      timestamp: new Date().toISOString(),
      persona,
      action,
      content: content.slice(0, 500), // Truncate for storage
      tokens,
    });
  }

  /**
   * Generate unique meeting ID
   */
  private generateMeetingId(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0]?.replace(/-/g, '') || '00000000';
    const time = now.toISOString().split('T')[1]?.slice(0, 8).replace(/:/g, '') || '000000';
    const random = Math.random().toString(36).slice(2, 6);
    return `meeting_${date}_${time}_${random}`;
  }
}

/**
 * Create and run a meeting
 */
export async function runTrinityMeeting(
  context: MeetingContext,
  config?: MeetingRunnerConfig
): Promise<MeetingResult> {
  const runner = new MeetingRunner(config);
  return runner.runMeeting(context);
}
