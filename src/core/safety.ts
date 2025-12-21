/**
 * Iori v3.1 Safety System
 * Implements confirmation prompts and Safe Mode for destructive operations
 *
 * @security Design Philosophy:
 * - "Trust but verify" - All destructive operations require explicit user approval
 * - "Safe by default" - Safe Mode blocks all destructive actions
 * - "Transparent operations" - Users see exactly what will be executed
 */

import type { CloudAction } from './cloudActions.js';

// Re-export CloudAction for tests
export type { CloudAction };

/**
 * Risk levels for cloud actions
 */
export type RiskLevel = 'safe' | 'caution' | 'destructive';

/**
 * Pending operation awaiting user confirmation
 */
export interface PendingOperation {
  id: string;
  action: CloudAction;
  riskLevel: RiskLevel;
  description: string;
  impact: string;
  timestamp: number;
  expiresAt: number;
}

/**
 * Safe Mode configuration
 */
export interface SafeModeConfig {
  enabled: boolean;
  allowedServices: string[];
  blockDestructive: boolean;
}

/**
 * Determine risk level for a cloud action
 */
export function getRiskLevel(action: CloudAction): RiskLevel {
  // High-risk production deployments
  if (action.service === 'vercel' && action.action === 'deployProd') {
    return 'destructive';
  }

  if (action.service === 'firebase' &&
      (action.action === 'deployFirestore' || action.action === 'deployFunctions')) {
    return 'destructive';
  }

  // Medium-risk git operations
  if (action.service === 'git' && action.action === 'syncMain') {
    return 'caution';
  }

  // All other operations are safe
  return 'safe';
}

/**
 * Get human-readable impact description for an action
 */
export function getImpactDescription(action: CloudAction): string {
  if (action.service === 'vercel' && action.action === 'deployProd') {
    return '⚠️ This will deploy your application to PRODUCTION. Users will see these changes immediately.';
  }

  if (action.service === 'firebase' && action.action === 'deployFirestore') {
    return '⚠️ This will update Firestore rules and indexes in PRODUCTION. May affect data access.';
  }

  if (action.service === 'firebase' && action.action === 'deployFunctions') {
    return '⚠️ This will deploy Cloud Functions to PRODUCTION. May affect backend behavior.';
  }

  if (action.service === 'git' && action.action === 'syncMain') {
    return '⚠️ This will create a new evolve/* branch, commit all changes, and push to remote.';
  }

  return 'ℹ️ This is a safe, read-only operation.';
}

/**
 * Check if an action needs user confirmation
 */
export function needsConfirmation(action: CloudAction): boolean {
  const risk = getRiskLevel(action);
  return risk === 'caution' || risk === 'destructive';
}

/**
 * In-memory store for pending operations
 * In production, this should be persisted to .iori/pending-operations.json
 */
const pendingOperations = new Map<string, PendingOperation>();

/**
 * Create a pending operation that requires user confirmation
 * @returns Operation ID for tracking
 */
export function createPendingOperation(action: CloudAction): PendingOperation {
  const id = `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000; // 5 minutes expiry

  const operation: PendingOperation = {
    id,
    action,
    riskLevel: getRiskLevel(action),
    description: `${action.service} ${action.action}`,
    impact: getImpactDescription(action),
    timestamp: now,
    expiresAt
  };

  pendingOperations.set(id, operation);

  return operation;
}

/**
 * Get a pending operation by ID
 */
export function getPendingOperation(id: string): PendingOperation | null {
  const operation = pendingOperations.get(id);

  if (!operation) {
    return null;
  }

  // Check if expired
  if (Date.now() > operation.expiresAt) {
    pendingOperations.delete(id);
    return null;
  }

  return operation;
}

/**
 * Confirm a pending operation
 * @returns The confirmed operation, or null if not found/expired
 */
export function confirmOperation(id: string): PendingOperation | null {
  const operation = getPendingOperation(id);

  if (!operation) {
    return null;
  }

  // Remove from pending list after confirmation
  pendingOperations.delete(id);

  return operation;
}

/**
 * Cancel a pending operation
 */
export function cancelOperation(id: string): boolean {
  return pendingOperations.delete(id);
}

/**
 * Get all active pending operations
 */
export function getAllPendingOperations(): PendingOperation[] {
  const now = Date.now();
  const active: PendingOperation[] = [];

  for (const [id, operation] of pendingOperations.entries()) {
    if (now > operation.expiresAt) {
      // Clean up expired operations
      pendingOperations.delete(id);
    } else {
      active.push(operation);
    }
  }

  return active;
}

/**
 * Safe Mode state (default: enabled for safety)
 */
let safeModeConfig: SafeModeConfig = {
  enabled: true,
  allowedServices: ['git', 'gh', 'vercel', 'firebase'],
  blockDestructive: true
};

/**
 * Get current Safe Mode configuration
 */
export function getSafeModeConfig(): SafeModeConfig {
  return { ...safeModeConfig };
}

/**
 * Update Safe Mode configuration
 */
export function setSafeModeConfig(config: Partial<SafeModeConfig>): SafeModeConfig {
  safeModeConfig = { ...safeModeConfig, ...config };
  return safeModeConfig;
}

/**
 * Check if an action is allowed in Safe Mode
 */
export function isAllowedInSafeMode(action: CloudAction): boolean {
  if (!safeModeConfig.enabled) {
    return true; // Safe Mode disabled, allow all
  }

  // Check if service is allowed
  if (!safeModeConfig.allowedServices.includes(action.service)) {
    return false;
  }

  // Check if destructive operations are blocked
  if (safeModeConfig.blockDestructive) {
    const risk = getRiskLevel(action);
    if (risk === 'destructive') {
      return false;
    }
  }

  return true;
}

/**
 * Validate an action against all safety rules
 * @returns { allowed: boolean, reason?: string, pendingId?: string }
 */
export function validateAction(action: CloudAction): {
  allowed: boolean;
  reason?: string;
  pendingId?: string;
} {
  // Check Safe Mode
  if (!isAllowedInSafeMode(action)) {
    return {
      allowed: false,
      reason: 'Blocked by Safe Mode. This operation is too destructive.'
    };
  }

  // Check if needs confirmation
  if (needsConfirmation(action)) {
    const pending = createPendingOperation(action);
    return {
      allowed: false,
      reason: 'This operation requires user confirmation.',
      pendingId: pending.id
    };
  }

  // Action is safe, allow immediately
  return { allowed: true };
}
