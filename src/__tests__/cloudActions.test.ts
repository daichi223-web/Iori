/**
 * Unit Tests for Cloud Actions
 * Tests command building and action validation
 */

import { describe, it, expect } from 'vitest';
import { buildCommand, getGitSyncCommands, isActionAllowed, type CloudAction } from '../core/cloudActions.js';

describe('Cloud Actions', () => {
  describe('buildCommand', () => {
    describe('git actions', () => {
      it('should build git status command', () => {
        const action: CloudAction = { service: 'git', action: 'status' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('git');
        expect(cmd.args).toContain('status');
        expect(cmd.args).toContain('--porcelain=v1');
        expect(cmd.description).toContain('git status');
      });
    });

    describe('gh (GitHub) actions', () => {
      it('should build gh login command', () => {
        const action: CloudAction = { service: 'gh', action: 'login' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('gh');
        expect(cmd.args).toContain('auth');
        expect(cmd.args).toContain('login');
        expect(cmd.args).toContain('--web');
        expect(cmd.description).toContain('Login');
      });

      it('should build gh status command', () => {
        const action: CloudAction = { service: 'gh', action: 'status' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('gh');
        expect(cmd.args).toContain('auth');
        expect(cmd.args).toContain('status');
      });
    });

    describe('vercel actions', () => {
      it('should build vercel deploy command', () => {
        const action: CloudAction = { service: 'vercel', action: 'deployProd' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('vercel');
        expect(cmd.args).toContain('--prod');
        expect(cmd.args).toContain('--yes');
        expect(cmd.description).toContain('production');
      });

      it('should build vercel whoami command', () => {
        const action: CloudAction = { service: 'vercel', action: 'whoami' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('vercel');
        expect(cmd.args).toContain('whoami');
      });

      it('should build vercel login command', () => {
        const action: CloudAction = { service: 'vercel', action: 'login' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('vercel');
        expect(cmd.args).toContain('login');
      });
    });

    describe('firebase actions', () => {
      it('should build firebase deploy firestore command', () => {
        const action: CloudAction = { service: 'firebase', action: 'deployFirestore' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('firebase');
        expect(cmd.args).toContain('deploy');
        expect(cmd.args).toContain('--only');
        expect(cmd.args).toContain('firestore');
      });

      it('should build firebase deploy functions command', () => {
        const action: CloudAction = { service: 'firebase', action: 'deployFunctions' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('firebase');
        expect(cmd.args).toContain('deploy');
        expect(cmd.args).toContain('--only');
        expect(cmd.args).toContain('functions');
      });

      it('should build firebase projects list command', () => {
        const action: CloudAction = { service: 'firebase', action: 'projectsList' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('firebase');
        expect(cmd.args).toContain('projects:list');
      });

      it('should build firebase login command', () => {
        const action: CloudAction = { service: 'firebase', action: 'login' };
        const cmd = buildCommand(action);

        expect(cmd.cmd).toBe('firebase');
        expect(cmd.args).toContain('login');
      });
    });

    describe('error handling', () => {
      it('should throw error for unknown service', () => {
        const action: any = { service: 'unknown', action: 'test' };
        expect(() => buildCommand(action)).toThrow('Unknown service');
      });

      it('should throw error for unknown git action', () => {
        const action: any = { service: 'git', action: 'unknown' };
        expect(() => buildCommand(action)).toThrow('Unknown git action');
      });

      it('should throw error for unknown gh action', () => {
        const action: any = { service: 'gh', action: 'unknown' };
        expect(() => buildCommand(action)).toThrow('Unknown gh action');
      });

      it('should throw error for unknown vercel action', () => {
        const action: any = { service: 'vercel', action: 'unknown' };
        expect(() => buildCommand(action)).toThrow('Unknown vercel action');
      });

      it('should throw error for unknown firebase action', () => {
        const action: any = { service: 'firebase', action: 'unknown' };
        expect(() => buildCommand(action)).toThrow('Unknown firebase action');
      });
    });
  });

  describe('getGitSyncCommands', () => {
    it('should return sequential git commands', () => {
      const commands = getGitSyncCommands();

      expect(commands).toHaveLength(4);

      // Check branch creation
      expect(commands[0].cmd).toBe('git');
      expect(commands[0].args[0]).toBe('checkout');
      expect(commands[0].args[1]).toBe('-b');
      expect(commands[0].args[2]).toMatch(/^evolve\/run-\d+$/);

      // Check git add
      expect(commands[1].cmd).toBe('git');
      expect(commands[1].args).toContain('add');
      expect(commands[1].args).toContain('.');

      // Check git commit
      expect(commands[2].cmd).toBe('git');
      expect(commands[2].args[0]).toBe('commit');
      expect(commands[2].args[1]).toBe('-m');
      expect(commands[2].args[2]).toContain('evolve');

      // Check git push
      expect(commands[3].cmd).toBe('git');
      expect(commands[3].args).toContain('push');
      expect(commands[3].args).toContain('origin');
    });

    it('should create branch names with evolve prefix', () => {
      const commands = getGitSyncCommands();
      const branch = commands[0].args[2];

      // Branch names should follow evolve/run-{timestamp} pattern
      expect(branch).toMatch(/^evolve\/run-\d+$/);
      expect(branch).toContain('evolve/run-');
    });

    it('should NOT push to main branch', () => {
      const commands = getGitSyncCommands();
      const pushCommand = commands[3];

      const branchName = pushCommand.args[pushCommand.args.length - 1];
      expect(branchName).toMatch(/^evolve\/run-/);
      expect(branchName).not.toBe('main');
      expect(branchName).not.toBe('master');
    });

    it('should include safety description', () => {
      const commands = getGitSyncCommands();

      expect(commands[0].description).toContain('safe');
      expect(commands[0].description).toContain('main untouched');
    });
  });

  describe('isActionAllowed', () => {
    describe('git actions', () => {
      it('should allow git status', () => {
        expect(isActionAllowed('git', 'status')).toBe(true);
      });

      it('should allow git syncMain', () => {
        expect(isActionAllowed('git', 'syncMain')).toBe(true);
      });

      it('should NOT allow git push --force', () => {
        expect(isActionAllowed('git', 'push --force')).toBe(false);
      });

      it('should NOT allow arbitrary git commands', () => {
        expect(isActionAllowed('git', 'reset --hard')).toBe(false);
      });
    });

    describe('gh actions', () => {
      it('should allow gh login', () => {
        expect(isActionAllowed('gh', 'login')).toBe(true);
      });

      it('should allow gh status', () => {
        expect(isActionAllowed('gh', 'status')).toBe(true);
      });

      it('should NOT allow arbitrary gh commands', () => {
        expect(isActionAllowed('gh', 'repo delete')).toBe(false);
      });
    });

    describe('vercel actions', () => {
      it('should allow vercel deployProd', () => {
        expect(isActionAllowed('vercel', 'deployProd')).toBe(true);
      });

      it('should allow vercel whoami', () => {
        expect(isActionAllowed('vercel', 'whoami')).toBe(true);
      });

      it('should allow vercel login', () => {
        expect(isActionAllowed('vercel', 'login')).toBe(true);
      });

      it('should NOT allow arbitrary vercel commands', () => {
        expect(isActionAllowed('vercel', 'remove')).toBe(false);
      });
    });

    describe('firebase actions', () => {
      it('should allow firebase deployFirestore', () => {
        expect(isActionAllowed('firebase', 'deployFirestore')).toBe(true);
      });

      it('should allow firebase deployFunctions', () => {
        expect(isActionAllowed('firebase', 'deployFunctions')).toBe(true);
      });

      it('should allow firebase projectsList', () => {
        expect(isActionAllowed('firebase', 'projectsList')).toBe(true);
      });

      it('should allow firebase login', () => {
        expect(isActionAllowed('firebase', 'login')).toBe(true);
      });

      it('should NOT allow arbitrary firebase commands', () => {
        expect(isActionAllowed('firebase', 'database:remove')).toBe(false);
      });
    });

    describe('unknown services', () => {
      it('should NOT allow unknown service', () => {
        expect(isActionAllowed('unknown', 'action')).toBe(false);
      });

      it('should return false for empty strings', () => {
        expect(isActionAllowed('', '')).toBe(false);
      });
    });
  });

  describe('Security Features', () => {
    it('should only allow hardcoded actions', () => {
      // Try all services with random actions
      const services = ['git', 'gh', 'vercel', 'firebase'];
      const randomActions = ['hack', 'delete', 'destroy', 'rm -rf'];

      for (const service of services) {
        for (const action of randomActions) {
          expect(isActionAllowed(service, action)).toBe(false);
        }
      }
    });

    it('should prevent main branch operations', () => {
      const commands = getGitSyncCommands();

      // Ensure no command touches main
      for (const cmd of commands) {
        const fullCmd = `${cmd.cmd} ${cmd.args.join(' ')}`;
        expect(fullCmd).not.toContain('push origin main');
        expect(fullCmd).not.toContain('push origin master');
      }
    });

    it('should use evolve branches only', () => {
      const commands = getGitSyncCommands();
      const branchCmd = commands[0];

      expect(branchCmd.args[2]).toMatch(/^evolve\//);
    });
  });
});
