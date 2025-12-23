/**
 * Iori Agent Definitions
 * Export all available agents for the DAG runner
 */

export { specAgent } from './spec.js';
export { uiAgent } from './ui.js';
export { codeAgent } from './code.js';
export { testAgent } from './test.js';
export { proofAgent } from './proof.js';
export { releaseAgent } from './release.js';

import { specAgent } from './spec.js';
import { uiAgent } from './ui.js';
import { codeAgent } from './code.js';
import { testAgent } from './test.js';
import { proofAgent } from './proof.js';
import { releaseAgent } from './release.js';

/**
 * All available agents
 */
export const allAgents = [
  specAgent,
  uiAgent,
  codeAgent,
  testAgent,
  proofAgent,
  releaseAgent,
];
