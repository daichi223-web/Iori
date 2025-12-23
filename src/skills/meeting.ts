/**
 * Iori Trinity Protocol - Meeting Skill
 * @module skills/meeting
 *
 * Entry point for Trinity Council meetings
 * Called from Neural Console via /meeting command
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { runTrinityMeeting } from '../scripts/meeting-runner.js';
import type { MeetingContext, MeetingResult } from '../providers/types.js';

/** Skill input */
export interface MeetingSkillInput {
  intent: string;
  workingDir?: string;
}

/** Skill output */
export interface MeetingSkillOutput {
  success: boolean;
  meetingId: string;
  planPath: string;
  summary: string;
  workUnits: number;
  duration: number;
  error?: string;
}

/**
 * Read file if exists, return undefined otherwise
 */
async function readFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Get git diff stat safely
 */
function getGitDiffStat(workingDir: string): string | undefined {
  try {
    return execSync('git diff --stat HEAD~5', {
      cwd: workingDir,
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch {
    return undefined;
  }
}

/**
 * Get recent log summary
 */
async function getLogSummary(workingDir: string): Promise<string | undefined> {
  try {
    const logDir = path.join(workingDir, '.iori', 'logs');
    const files = await fs.readdir(logDir);
    const recentFile = files.sort().reverse()[0];

    if (recentFile) {
      const content = await fs.readFile(path.join(logDir, recentFile), 'utf-8');
      const lines = content.split('\n').slice(-20);
      return lines.join('\n');
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Build meeting context from project state
 */
async function buildContext(
  intent: string,
  workingDir: string
): Promise<MeetingContext> {
  const [spec, dod, evidence] = await Promise.all([
    readFileIfExists(path.join(workingDir, 'SPEC.md')),
    readFileIfExists(path.join(workingDir, 'DOD.md')),
    readFileIfExists(path.join(workingDir, 'EVIDENCE.md')),
  ]);

  const gitDiff = getGitDiffStat(workingDir);
  const logSummary = await getLogSummary(workingDir);

  return {
    intent,
    spec,
    dod,
    evidence,
    gitDiff,
    logSummary,
    constraints: {
      priority: 'balanced',
      maxIterations: 3,
    },
  };
}

/**
 * Execute meeting skill
 */
export async function executeMeeting(
  input: MeetingSkillInput
): Promise<MeetingSkillOutput> {
  const workingDir = input.workingDir || process.cwd();
  const startTime = Date.now();

  try {
    // Build context from project state
    const context = await buildContext(input.intent, workingDir);

    // Run Trinity Council meeting
    const result = await runTrinityMeeting(context, {
      outputDir: path.join(workingDir, '.iori', 'meetings'),
    });

    const planPath = path.join(
      workingDir,
      '.iori',
      'meetings',
      result.id,
      'plan.md'
    );

    return {
      success: true,
      meetingId: result.id,
      planPath,
      summary: result.plan.summary,
      workUnits: result.plan.workUnits.length,
      duration: result.duration,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      meetingId: '',
      planPath: '',
      summary: '',
      workUnits: 0,
      duration: Date.now() - startTime,
      error: message,
    };
  }
}

/**
 * List recent meetings
 */
export async function listMeetings(
  workingDir?: string,
  limit = 10
): Promise<Array<{ id: string; timestamp: string; intent: string }>> {
  const dir = path.join(workingDir || process.cwd(), '.iori', 'meetings');

  try {
    const entries = await fs.readdir(dir);
    const meetings = await Promise.all(
      entries
        .filter(e => e.startsWith('meeting_'))
        .sort()
        .reverse()
        .slice(0, limit)
        .map(async id => {
          try {
            const contextPath = path.join(dir, id, 'context.json');
            const context = JSON.parse(await fs.readFile(contextPath, 'utf-8'));
            return {
              id,
              timestamp: id.replace('meeting_', '').slice(0, 15),
              intent: context.intent || '',
            };
          } catch {
            return { id, timestamp: '', intent: '' };
          }
        })
    );

    return meetings;
  } catch {
    return [];
  }
}

/**
 * Get meeting result by ID
 */
export async function getMeeting(
  meetingId: string,
  workingDir?: string
): Promise<MeetingResult | null> {
  const planPath = path.join(
    workingDir || process.cwd(),
    '.iori',
    'meetings',
    meetingId,
    'plan.md'
  );

  try {
    const planContent = await fs.readFile(planPath, 'utf-8');
    const contextPath = path.join(
      workingDir || process.cwd(),
      '.iori',
      'meetings',
      meetingId,
      'context.json'
    );
    const context = JSON.parse(await fs.readFile(contextPath, 'utf-8'));

    // Return minimal result structure
    return {
      id: meetingId,
      timestamp: new Date().toISOString(),
      intent: context.intent,
      plan: {
        summary: planContent.slice(0, 500),
        workUnits: [],
        nextActions: [],
        risks: [],
      },
      decisions: [],
      participants: ['strategist', 'designer', 'engineer', 'chair'],
      duration: 0,
      tokenUsage: {
        total: 0,
        byPersona: { strategist: 0, designer: 0, engineer: 0, chair: 0 },
      },
    };
  } catch {
    return null;
  }
}

/**
 * Skill metadata for registration
 */
export const meetingSkill = {
  name: 'meeting',
  description: 'Run a Trinity Council meeting with 3 AI personas',
  execute: executeMeeting,
  list: listMeetings,
  get: getMeeting,
};

export default meetingSkill;
