/**
 * Proof Agent
 * Verifies DoD completion and generates evidence document
 */

import type { AgentDefinition } from '../types.js';

export const proofAgent: AgentDefinition = {
  id: 'proof',
  name: 'DoD Proof Generator',
  description: 'Checks Definition of Done and creates EVIDENCE.md',
  dependsOn: ['spec', 'code', 'test'],

  async execute(context) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Read DOD.md if exists
      let dodContent = '';
      try {
        dodContent = await context.readFile('DOD.md');
      } catch {
        dodContent = `
# Definition of Done

## Required Items
- [ ] Specification document created
- [ ] Code implemented
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No critical bugs
`;
      }

      // Get outputs from dependencies
      const specOutput = await context.getDependencyOutput('spec');
      const codeOutput = await context.getDependencyOutput('code');
      const testOutput = await context.getDependencyOutput('test');

      // Generate evidence document
      const evidencePrompt = `
You are a QA auditor. Based on the Definition of Done and the artifacts produced, create an EVIDENCE.md document showing completion status.

Definition of Done:
${dodContent}

Artifacts Created:
- Specification: ${specOutput.artifacts['SPEC.md'] ? '✅ Yes' : '❌ No'}
- Code: ${codeOutput.artifacts['CODE_GEN.md'] ? '✅ Yes' : '❌ No'}
- Tests: ${testOutput.artifacts['TEST_SUITE.md'] ? '✅ Yes' : '❌ No'}

Create EVIDENCE.md with:

# EVIDENCE.md

## DoD Checklist

For each DoD item:
- [ ] Item description
  - Status: ✅ Complete / ⚠️ Partial / ❌ Not Done
  - Evidence: Link to artifact or explanation
  - Notes: Any relevant details

## Artifact Summary

| Artifact | Status | Location | Notes |
|----------|--------|----------|-------|
| SPEC.md | ✅ | ./SPEC.md | ... |
| CODE_GEN.md | ✅ | ./CODE_GEN.md | ... |
| TEST_SUITE.md | ✅ | ./TEST_SUITE.md | ... |

## Overall Progress

- Completion: X%
- Remaining Items: List
- Blockers: None / List
- Ready for Release: Yes / No

## Recommendations

- Next steps
- Improvements needed
- Risk assessment
`;

      const evidenceContent = await context.callLLM(evidencePrompt, 'gemini');

      // Write EVIDENCE.md
      await context.writeFile('EVIDENCE.md', evidenceContent);

      return {
        agentId: 'proof',
        status: 'success',
        artifacts: {
          'EVIDENCE.md': evidenceContent,
        },
        duration: Date.now() - startTime,
        timestamp,
      };
    } catch (error: any) {
      return {
        agentId: 'proof',
        status: 'error',
        artifacts: {},
        error: error.message,
        duration: Date.now() - startTime,
        timestamp,
      };
    }
  },

  retry: {
    maxAttempts: 2,
    backoffMs: 1000,
  },

  timeoutMs: 120000, // 2 minutes
};
