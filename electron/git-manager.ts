/**
 * Iori v4.0 - Git Manager
 * @module electron/git-manager
 *
 * Manages Git/GitHub operations via git and gh CLI
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

/** Git status file entry */
export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
  staged: boolean;
}

/** Git commit info */
export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

/** Git branch info */
export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
}

/** Git repository status */
export interface GitRepoStatus {
  isRepo: boolean;
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  hasChanges: boolean;
  hasUntracked: boolean;
}

/** GitHub PR info */
export interface GitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
  author: string;
  createdAt: string;
}

/** Command result */
interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number | null;
}

/**
 * Execute shell command and return result
 */
async function execCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      shell: true,
      timeout: 30000,
    });

    let output = '';
    let error = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      error += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output.trim(),
        error: error.trim() || undefined,
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        output: '',
        error: err.message,
        exitCode: null,
      });
    });
  });
}

/**
 * Git Manager - Manages Git/GitHub operations
 */
export class GitManager extends EventEmitter {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    super();
    this.repoPath = repoPath;
  }

  /**
   * Check if current directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    const result = await execCommand('git', ['rev-parse', '--is-inside-work-tree']);
    return result.success && result.output === 'true';
  }

  /**
   * Check if gh CLI is available and authenticated
   */
  async isGhAvailable(): Promise<{ available: boolean; authenticated: boolean; user?: string }> {
    const versionResult = await execCommand('gh', ['--version']);
    if (!versionResult.success) {
      return { available: false, authenticated: false };
    }

    const authResult = await execCommand('gh', ['auth', 'status']);
    if (!authResult.success) {
      return { available: true, authenticated: false };
    }

    // Extract username from auth status
    const userMatch = authResult.output.match(/Logged in to .+ as (\S+)/);
    return {
      available: true,
      authenticated: true,
      user: userMatch?.[1],
    };
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<GitRepoStatus> {
    if (!(await this.isGitRepo())) {
      return {
        isRepo: false,
        branch: '',
        ahead: 0,
        behind: 0,
        files: [],
        hasChanges: false,
        hasUntracked: false,
      };
    }

    // Get current branch
    const branchResult = await execCommand('git', ['branch', '--show-current']);
    const branch = branchResult.output || 'HEAD';

    // Get ahead/behind
    let ahead = 0;
    let behind = 0;
    const aheadBehindResult = await execCommand('git', [
      'rev-list',
      '--left-right',
      '--count',
      `origin/${branch}...HEAD`,
    ]);
    if (aheadBehindResult.success) {
      const [behindStr, aheadStr] = aheadBehindResult.output.split('\t');
      behind = parseInt(behindStr, 10) || 0;
      ahead = parseInt(aheadStr, 10) || 0;
    }

    // Get file status
    const statusResult = await execCommand('git', ['status', '--porcelain']);
    const files: GitFileStatus[] = [];
    let hasUntracked = false;

    if (statusResult.success && statusResult.output) {
      const lines = statusResult.output.split('\n');
      for (const line of lines) {
        if (!line) continue;

        const indexStatus = line[0];
        const workStatus = line[1];
        const path = line.slice(3);

        let status: GitFileStatus['status'] = 'modified';
        let staged = false;

        if (indexStatus === '?' && workStatus === '?') {
          status = 'untracked';
          hasUntracked = true;
        } else if (indexStatus === 'A') {
          status = 'added';
          staged = true;
        } else if (indexStatus === 'D' || workStatus === 'D') {
          status = 'deleted';
          staged = indexStatus === 'D';
        } else if (indexStatus === 'R') {
          status = 'renamed';
          staged = true;
        } else if (indexStatus === 'M') {
          status = 'modified';
          staged = true;
        } else if (workStatus === 'M') {
          status = 'modified';
          staged = false;
        }

        files.push({ path, status, staged });
      }
    }

    return {
      isRepo: true,
      branch,
      ahead,
      behind,
      files,
      hasChanges: files.length > 0,
      hasUntracked,
    };
  }

  /**
   * Get recent commits
   */
  async getCommits(limit = 10): Promise<GitCommit[]> {
    const result = await execCommand('git', [
      'log',
      `-${limit}`,
      '--format=%H|%h|%s|%an|%ai',
    ]);

    if (!result.success) return [];

    return result.output.split('\n').filter(Boolean).map((line) => {
      const [hash, shortHash, message, author, date] = line.split('|');
      return { hash, shortHash, message, author, date };
    });
  }

  /**
   * Get branches
   */
  async getBranches(): Promise<GitBranch[]> {
    const result = await execCommand('git', ['branch', '-a', '--format=%(refname:short)|%(HEAD)|%(upstream:short)']);
    if (!result.success) return [];

    return result.output.split('\n').filter(Boolean).map((line) => {
      const [name, isCurrent, remote] = line.split('|');
      return {
        name,
        current: isCurrent === '*',
        remote: remote || undefined,
      };
    });
  }

  /**
   * Stage files
   */
  async stageFiles(paths: string[] = ['.']): Promise<boolean> {
    const result = await execCommand('git', ['add', ...paths]);
    this.emit('staged', paths);
    return result.success;
  }

  /**
   * Unstage files
   */
  async unstageFiles(paths: string[]): Promise<boolean> {
    const result = await execCommand('git', ['reset', 'HEAD', ...paths]);
    this.emit('unstaged', paths);
    return result.success;
  }

  /**
   * Create commit
   */
  async commit(message: string): Promise<{ success: boolean; hash?: string; error?: string }> {
    const result = await execCommand('git', ['commit', '-m', message]);

    if (!result.success) {
      return { success: false, error: result.error || result.output };
    }

    // Extract commit hash
    const hashMatch = result.output.match(/\[.+ ([a-f0-9]+)\]/);
    const hash = hashMatch?.[1];

    this.emit('committed', { hash, message });
    return { success: true, hash };
  }

  /**
   * Push to remote
   */
  async push(remote = 'origin', branch?: string): Promise<boolean> {
    const args = ['push', remote];
    if (branch) args.push(branch);

    const result = await execCommand('git', args);
    if (result.success) {
      this.emit('pushed', { remote, branch });
    }
    return result.success;
  }

  /**
   * Pull from remote
   */
  async pull(remote = 'origin', branch?: string): Promise<boolean> {
    const args = ['pull', remote];
    if (branch) args.push(branch);

    const result = await execCommand('git', args);
    if (result.success) {
      this.emit('pulled', { remote, branch });
    }
    return result.success;
  }

  /**
   * Checkout branch
   */
  async checkout(branch: string, create = false): Promise<boolean> {
    const args = ['checkout'];
    if (create) args.push('-b');
    args.push(branch);

    const result = await execCommand('git', args);
    if (result.success) {
      this.emit('checkout', branch);
    }
    return result.success;
  }

  /**
   * Get diff for file or all changes
   */
  async getDiff(path?: string, staged = false): Promise<string> {
    const args = ['diff'];
    if (staged) args.push('--cached');
    if (path) args.push(path);

    const result = await execCommand('git', args);
    return result.output;
  }

  // ===== GitHub (gh CLI) Operations =====

  /**
   * List PRs
   */
  async listPRs(state: 'open' | 'closed' | 'all' = 'open', limit = 10): Promise<GitHubPR[]> {
    const result = await execCommand('gh', [
      'pr',
      'list',
      '--state',
      state,
      '--limit',
      String(limit),
      '--json',
      'number,title,state,url,author,createdAt',
    ]);

    if (!result.success) return [];

    try {
      const prs = JSON.parse(result.output);
      return prs.map((pr: Record<string, unknown>) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.url,
        author: (pr.author as { login?: string })?.login || 'unknown',
        createdAt: pr.createdAt,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Create PR
   */
  async createPR(
    title: string,
    body: string,
    base = 'main'
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const result = await execCommand('gh', [
      'pr',
      'create',
      '--title',
      title,
      '--body',
      body,
      '--base',
      base,
    ]);

    if (!result.success) {
      return { success: false, error: result.error || result.output };
    }

    // Extract URL from output
    const urlMatch = result.output.match(/https:\/\/github\.com\/[^\s]+/);
    return { success: true, url: urlMatch?.[0] };
  }

  /**
   * Get repo info
   */
  async getRepoInfo(): Promise<{
    name: string;
    owner: string;
    url: string;
    isPrivate: boolean;
  } | null> {
    const result = await execCommand('gh', [
      'repo',
      'view',
      '--json',
      'name,owner,url,isPrivate',
    ]);

    if (!result.success) return null;

    try {
      const info = JSON.parse(result.output);
      return {
        name: info.name,
        owner: info.owner?.login || info.owner,
        url: info.url,
        isPrivate: info.isPrivate,
      };
    } catch {
      return null;
    }
  }

  /**
   * Sync .iori/ state to GitHub (commit and push)
   */
  async syncState(message?: string): Promise<{ success: boolean; error?: string }> {
    // Stage .iori/ directory
    await this.stageFiles(['.iori/']);

    // Commit
    const commitMsg = message || `chore: sync Iori state [${new Date().toISOString()}]`;
    const commitResult = await this.commit(commitMsg);

    if (!commitResult.success) {
      return { success: false, error: commitResult.error };
    }

    // Push
    const pushResult = await this.push();
    if (!pushResult) {
      return { success: false, error: 'Failed to push to remote' };
    }

    this.emit('synced');
    return { success: true };
  }
}

// Singleton instance
let gitManagerInstance: GitManager | null = null;

/**
 * Get Git Manager singleton
 */
export function getGitManager(): GitManager {
  if (!gitManagerInstance) {
    gitManagerInstance = new GitManager();
  }
  return gitManagerInstance;
}
