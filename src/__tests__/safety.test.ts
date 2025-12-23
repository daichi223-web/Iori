/**
 * Unit Tests for Safety System
 * Tests confirmation prompts, Safe Mode, and risk assessment
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRiskLevel,
  getImpactDescription,
  needsConfirmation,
  createPendingOperation,
  getPendingOperation,
  confirmOperation,
  cancelOperation,
  getAllPendingOperations,
  getSafeModeConfig,
  setSafeModeConfig,
  isAllowedInSafeMode,
  validateAction,
  type CloudAction
} from '../core/safety.js';

describe('Safety System', () => {
  describe('Risk Level Assessment', () => {
    it('should classify vercel deployProd as destructive', () => {
      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      expect(getRiskLevel(action)).toBe('destructive');
    });

    it('should classify firebase deployFirestore as destructive', () => {
      const action: CloudAction = { service: 'firebase', action: 'deployFirestore' };
      expect(getRiskLevel(action)).toBe('destructive');
    });

    it('should classify firebase deployFunctions as destructive', () => {
      const action: CloudAction = { service: 'firebase', action: 'deployFunctions' };
      expect(getRiskLevel(action)).toBe('destructive');
    });

    it('should classify git syncMain as caution', () => {
      const action: CloudAction = { service: 'git', action: 'syncMain' };
      expect(getRiskLevel(action)).toBe('caution');
    });

    it('should classify git status as safe', () => {
      const action: CloudAction = { service: 'git', action: 'status' };
      expect(getRiskLevel(action)).toBe('safe');
    });

    it('should classify gh login as safe', () => {
      const action: CloudAction = { service: 'gh', action: 'login' };
      expect(getRiskLevel(action)).toBe('safe');
    });

    it('should classify vercel whoami as safe', () => {
      const action: CloudAction = { service: 'vercel', action: 'whoami' };
      expect(getRiskLevel(action)).toBe('safe');
    });

    it('should classify firebase projectsList as safe', () => {
      const action: CloudAction = { service: 'firebase', action: 'projectsList' };
      expect(getRiskLevel(action)).toBe('safe');
    });
  });

  describe('Impact Descriptions', () => {
    it('should provide production warning for vercel deploy', () => {
      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      const impact = getImpactDescription(action);

      expect(impact).toContain('PRODUCTION');
      expect(impact).toContain('⚠️');
    });

    it('should provide Firestore warning', () => {
      const action: CloudAction = { service: 'firebase', action: 'deployFirestore' };
      const impact = getImpactDescription(action);

      expect(impact).toContain('Firestore');
      expect(impact).toContain('PRODUCTION');
    });

    it('should provide git sync warning', () => {
      const action: CloudAction = { service: 'git', action: 'syncMain' };
      const impact = getImpactDescription(action);

      expect(impact).toContain('evolve');
      expect(impact).toContain('branch');
    });

    it('should indicate safe operation for git status', () => {
      const action: CloudAction = { service: 'git', action: 'status' };
      const impact = getImpactDescription(action);

      expect(impact).toContain('safe');
      expect(impact).toContain('read-only');
    });
  });

  describe('Confirmation Requirements', () => {
    it('should require confirmation for destructive actions', () => {
      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      expect(needsConfirmation(action)).toBe(true);
    });

    it('should require confirmation for caution actions', () => {
      const action: CloudAction = { service: 'git', action: 'syncMain' };
      expect(needsConfirmation(action)).toBe(true);
    });

    it('should NOT require confirmation for safe actions', () => {
      const action: CloudAction = { service: 'git', action: 'status' };
      expect(needsConfirmation(action)).toBe(false);
    });
  });

  describe('Pending Operations', () => {
    beforeEach(() => {
      // Clear all pending operations before each test
      const allPending = getAllPendingOperations();
      allPending.forEach(op => cancelOperation(op.id));
    });

    it('should create pending operation with unique ID', () => {
      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      const pending = createPendingOperation(action);

      expect(pending.id).toMatch(/^op-\d+-[a-z0-9]+$/);
      expect(pending.action).toEqual(action);
      expect(pending.riskLevel).toBe('destructive');
    });

    it('should store and retrieve pending operation', () => {
      const action: CloudAction = { service: 'git', action: 'syncMain' };
      const created = createPendingOperation(action);

      const retrieved = getPendingOperation(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.action).toEqual(action);
    });

    it('should return null for non-existent operation', () => {
      const result = getPendingOperation('op-999999-invalid');
      expect(result).toBeNull();
    });

    it('should set expiration time (5 minutes)', () => {
      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      const pending = createPendingOperation(action);

      const expectedExpiry = pending.timestamp + 5 * 60 * 1000;
      expect(pending.expiresAt).toBe(expectedExpiry);
    });

    it('should confirm and remove operation', () => {
      const action: CloudAction = { service: 'firebase', action: 'deployFirestore' };
      const created = createPendingOperation(action);

      const confirmed = confirmOperation(created.id);

      expect(confirmed).not.toBeNull();
      expect(confirmed?.id).toBe(created.id);

      // Should be removed after confirmation
      const retrieved = getPendingOperation(created.id);
      expect(retrieved).toBeNull();
    });

    it('should cancel operation', () => {
      const action: CloudAction = { service: 'git', action: 'syncMain' };
      const created = createPendingOperation(action);

      const cancelled = cancelOperation(created.id);

      expect(cancelled).toBe(true);

      const retrieved = getPendingOperation(created.id);
      expect(retrieved).toBeNull();
    });

    it('should list all pending operations', () => {
      const action1: CloudAction = { service: 'vercel', action: 'deployProd' };
      const action2: CloudAction = { service: 'git', action: 'syncMain' };

      createPendingOperation(action1);
      createPendingOperation(action2);

      const allPending = getAllPendingOperations();

      expect(allPending.length).toBeGreaterThanOrEqual(2);
    });

    it('should clean up expired operations', () => {
      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      const pending = createPendingOperation(action);

      // Manually expire the operation
      pending.expiresAt = Date.now() - 1000; // 1 second ago

      const retrieved = getPendingOperation(pending.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Safe Mode', () => {
    beforeEach(() => {
      // Reset Safe Mode to default
      setSafeModeConfig({
        enabled: true,
        allowedServices: ['git', 'gh', 'vercel', 'firebase'],
        blockDestructive: true
      });
    });

    it('should get Safe Mode config', () => {
      const config = getSafeModeConfig();

      expect(config.enabled).toBe(true);
      expect(config.blockDestructive).toBe(true);
      expect(config.allowedServices).toContain('git');
    });

    it('should update Safe Mode config', () => {
      setSafeModeConfig({ enabled: false });

      const config = getSafeModeConfig();
      expect(config.enabled).toBe(false);
    });

    it('should block destructive actions when Safe Mode enabled', () => {
      setSafeModeConfig({ enabled: true, blockDestructive: true });

      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      const allowed = isAllowedInSafeMode(action);

      expect(allowed).toBe(false);
    });

    it('should allow safe actions when Safe Mode enabled', () => {
      setSafeModeConfig({ enabled: true, blockDestructive: true });

      const action: CloudAction = { service: 'git', action: 'status' };
      const allowed = isAllowedInSafeMode(action);

      expect(allowed).toBe(true);
    });

    it('should allow caution actions when Safe Mode enabled', () => {
      setSafeModeConfig({ enabled: true, blockDestructive: true });

      const action: CloudAction = { service: 'git', action: 'syncMain' };
      const allowed = isAllowedInSafeMode(action);

      expect(allowed).toBe(true); // Only blocks 'destructive', not 'caution'
    });

    it('should allow all when Safe Mode disabled', () => {
      setSafeModeConfig({ enabled: false });

      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      const allowed = isAllowedInSafeMode(action);

      expect(allowed).toBe(true);
    });

    it('should block disallowed services', () => {
      setSafeModeConfig({ allowedServices: ['git'] });

      const action: CloudAction = { service: 'vercel', action: 'whoami' };
      const allowed = isAllowedInSafeMode(action);

      expect(allowed).toBe(false);
    });
  });

  describe('Action Validation', () => {
    beforeEach(() => {
      // Reset Safe Mode to default
      setSafeModeConfig({
        enabled: true,
        allowedServices: ['git', 'gh', 'vercel', 'firebase'],
        blockDestructive: true
      });

      // Clear pending operations
      const allPending = getAllPendingOperations();
      allPending.forEach(op => cancelOperation(op.id));
    });

    it('should allow safe actions immediately', () => {
      const action: CloudAction = { service: 'git', action: 'status' };
      const result = validateAction(action);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.pendingId).toBeUndefined();
    });

    it('should block destructive actions in Safe Mode', () => {
      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      const result = validateAction(action);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Safe Mode');
    });

    it('should create pending operation for caution actions', () => {
      setSafeModeConfig({ blockDestructive: false });

      const action: CloudAction = { service: 'git', action: 'syncMain' };
      const result = validateAction(action);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('confirmation');
      expect(result.pendingId).toBeDefined();
      expect(result.pendingId).toMatch(/^op-/);
    });

    it('should provide pending ID for actions needing confirmation', () => {
      setSafeModeConfig({ enabled: false });

      const action: CloudAction = { service: 'firebase', action: 'deployFirestore' };
      const result = validateAction(action);

      expect(result.allowed).toBe(false);
      expect(result.pendingId).toBeDefined();

      // Should be able to retrieve the pending operation
      const pending = getPendingOperation(result.pendingId!);
      expect(pending).not.toBeNull();
      expect(pending?.action).toEqual(action);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full confirmation workflow', () => {
      // Disable Safe Mode to test confirmation flow
      setSafeModeConfig({ enabled: false });

      // 1. User tries destructive action
      const action: CloudAction = { service: 'vercel', action: 'deployProd' };
      const validation = validateAction(action);

      expect(validation.allowed).toBe(false);
      expect(validation.pendingId).toBeDefined();

      // 2. User confirms the operation
      const confirmed = confirmOperation(validation.pendingId!);

      expect(confirmed).not.toBeNull();
      expect(confirmed?.action).toEqual(action);

      // 3. Operation is removed from pending list
      const retrieved = getPendingOperation(validation.pendingId!);
      expect(retrieved).toBeNull();
    });

    it('should handle cancellation workflow', () => {
      setSafeModeConfig({ enabled: false });

      const action: CloudAction = { service: 'firebase', action: 'deployFunctions' };
      const validation = validateAction(action);

      expect(validation.pendingId).toBeDefined();

      // User cancels
      const cancelled = cancelOperation(validation.pendingId!);

      expect(cancelled).toBe(true);

      // Should not be retrievable
      const retrieved = getPendingOperation(validation.pendingId!);
      expect(retrieved).toBeNull();
    });
  });
});
