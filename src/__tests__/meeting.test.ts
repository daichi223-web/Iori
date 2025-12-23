/**
 * Trinity Protocol Meeting Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  MeetingContext,
  MeetingResult,
  WorkUnit,
  PersonaType,
} from '../providers/types.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock response' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        stop_reason: 'end_turn',
        model: 'claude-sonnet-4-20250514',
      }),
    },
  })),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('mock content'),
    readdir: vi.fn().mockResolvedValue([]),
    access: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Provider Types', () => {
  it('should define all persona types', () => {
    const personaTypes: PersonaType[] = ['strategist', 'designer', 'engineer', 'chair'];
    expect(personaTypes).toHaveLength(4);
  });

  it('should validate MeetingContext structure', () => {
    const context: MeetingContext = {
      intent: 'Test intent',
      spec: 'SPEC content',
      dod: 'DOD content',
      constraints: {
        priority: 'balanced',
        maxIterations: 3,
      },
    };

    expect(context.intent).toBe('Test intent');
    expect(context.constraints?.priority).toBe('balanced');
  });

  it('should validate WorkUnit structure', () => {
    const workUnit: WorkUnit = {
      id: 'WU-01',
      title: 'Implement feature',
      description: 'Feature description',
      dodItems: ['Item 1', 'Item 2'],
      estimatedComplexity: 'medium',
      dependencies: [],
      rollback: 'Revert commit',
    };

    expect(workUnit.id).toBe('WU-01');
    expect(workUnit.dodItems).toHaveLength(2);
  });

  it('should validate MeetingResult structure', () => {
    const result: MeetingResult = {
      id: 'meeting_123',
      timestamp: new Date().toISOString(),
      intent: 'Test meeting',
      plan: {
        summary: 'Test summary',
        workUnits: [],
        nextActions: ['Action 1'],
        risks: ['Risk 1'],
      },
      decisions: [],
      participants: ['strategist', 'designer', 'engineer', 'chair'],
      duration: 1000,
      tokenUsage: {
        total: 500,
        byPersona: {
          strategist: 100,
          designer: 100,
          engineer: 100,
          chair: 200,
        },
      },
    };

    expect(result.participants).toHaveLength(4);
    expect(result.tokenUsage.total).toBe(500);
  });
});

describe('Meeting Runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variable for tests
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  it('should generate unique meeting IDs', async () => {
    const { MeetingRunner } = await import('../scripts/meeting-runner.js');
    const runner = new MeetingRunner({ traceEnabled: false });

    // Access private method via prototype
    const id1 = (runner as unknown as { generateMeetingId: () => string }).generateMeetingId();
    const id2 = (runner as unknown as { generateMeetingId: () => string }).generateMeetingId();

    expect(id1).toMatch(/^meeting_\d{8}_\d{6}_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it('should build context summary', async () => {
    const { MeetingRunner } = await import('../scripts/meeting-runner.js');
    const runner = new MeetingRunner({ traceEnabled: false });

    const context: MeetingContext = {
      intent: 'Test',
      spec: 'SPEC content here',
      dod: 'DOD content here',
      gitDiff: '3 files changed',
    };

    const summary = (runner as unknown as {
      buildContextSummary: (ctx: MeetingContext) => string;
    }).buildContextSummary(context);

    expect(summary).toContain('SPEC.md');
    expect(summary).toContain('DOD.md');
    expect(summary).toContain('git diff');
  });

  it('should parse work units from plan output', async () => {
    const { MeetingRunner } = await import('../scripts/meeting-runner.js');
    const runner = new MeetingRunner({ traceEnabled: false });

    const planOutput = `## Summary
Test summary

### WU-01: First work unit
Description of first unit
DoD items: Item 1, Item 2
Complexity: high
Dependencies: None
Rollback: Revert changes

### WU-02: Second work unit
Description of second unit
DoD items: Item 3
Complexity: low
Dependencies: WU-01
`;

    const workUnits = (runner as unknown as {
      parseWorkUnits: (output: string) => WorkUnit[];
    }).parseWorkUnits(planOutput);

    expect(workUnits).toHaveLength(2);
    expect(workUnits[0]?.id).toBe('WU-01');
    expect(workUnits[0]?.estimatedComplexity).toBe('high');
    expect(workUnits[1]?.dependencies).toContain('WU-01');
  });

  it('should parse plan sections', async () => {
    const { MeetingRunner } = await import('../scripts/meeting-runner.js');
    const runner = new MeetingRunner({ traceEnabled: false });

    const planOutput = `## Summary
This is the summary of the plan.

## Next Actions
- First action
- Second action
- Third action

## Risks
- Risk one
- Risk two
`;

    const sections = (runner as unknown as {
      parsePlanSections: (output: string) => {
        summary: string;
        nextActions: string[];
        risks: string[];
      };
    }).parsePlanSections(planOutput);

    expect(sections.summary).toContain('summary of the plan');
    expect(sections.nextActions).toHaveLength(3);
    expect(sections.risks).toHaveLength(2);
  });
});

describe('Meeting Skill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  it('should export skill metadata', async () => {
    const { meetingSkill } = await import('../skills/meeting.js');

    expect(meetingSkill.name).toBe('meeting');
    expect(meetingSkill.description).toBeDefined();
    expect(typeof meetingSkill.execute).toBe('function');
    expect(typeof meetingSkill.list).toBe('function');
    expect(typeof meetingSkill.get).toBe('function');
  });

  it('should list meetings (empty)', async () => {
    const { listMeetings } = await import('../skills/meeting.js');
    const meetings = await listMeetings('/tmp/nonexistent');

    expect(meetings).toEqual([]);
  });
});

describe('Anthropic Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  it('should create provider with API key', async () => {
    const { AnthropicProvider } = await import('../providers/anthropic.js');
    const provider = new AnthropicProvider();

    expect(provider.name).toBe('anthropic');
    expect(provider.defaultModel).toBeDefined();
  });

  it('should throw error without API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { AnthropicProvider } = await import('../providers/anthropic.js');

    expect(() => new AnthropicProvider({ apiKey: undefined })).toThrow('ANTHROPIC_API_KEY is required');
  });

  it('should get provider info', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    const { AnthropicProvider } = await import('../providers/anthropic.js');
    const provider = new AnthropicProvider();
    const info = provider.getInfo();

    expect(info.name).toBe('anthropic');
    expect(info.ready).toBe(true);
  });
});
