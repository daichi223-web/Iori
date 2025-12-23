/**
 * Test Agent
 * Generates test cases for implemented code
 */

import type { AgentDefinition } from '../types.js';

export const testAgent: AgentDefinition = {
  id: 'test',
  name: 'Test Generator',
  description: 'Creates comprehensive test suite for generated code',
  dependsOn: ['code'],

  async execute(context) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Get code from dependency
      const codeOutput = await context.getDependencyOutput('code');
      const codeContent = codeOutput.artifacts['CODE_GEN.md'];

      if (!codeContent) {
        throw new Error('CODE_GEN.md not found');
      }

      // Generate tests using LLM
      const testPrompt = `
You are a QA engineer specialized in test-driven development. Based on the following generated code, create comprehensive test suites.

Generated Code:
${codeContent}

Please generate tests with:

# TEST_SUITE.md

## 1. Test Strategy
- Unit tests
- Integration tests
- E2E tests (if applicable)

## 2. Test Files

For each source file, create corresponding test file:

### Test File: src/__tests__/index.test.ts
\`\`\`typescript
import { describe, it, expect } from 'vitest';

describe('ComponentName', () => {
  it('should...', () => {
    // Test implementation
  });
});
\`\`\`

## 3. Test Coverage Goals
- Target: 80%+ coverage
- Critical paths: 100% coverage

## 4. Test Data
- Mock data
- Fixtures
- Test utilities

Requirements:
- Use Vitest as testing framework
- Include edge cases
- Test error handling
- Mock external dependencies
- Clear test descriptions

Output complete, runnable test files.
`;

      const testContent = await context.callLLM(testPrompt, 'claude');

      // Write TEST_SUITE.md
      await context.writeFile('TEST_SUITE.md', testContent);

      return {
        agentId: 'test',
        status: 'success',
        artifacts: {
          'TEST_SUITE.md': testContent,
        },
        duration: Date.now() - startTime,
        timestamp,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        agentId: 'test',
        status: 'error',
        artifacts: {} as Record<string, string>,
        error: errorMessage,
        duration: Date.now() - startTime,
        timestamp,
      };
    }
  },

  retry: {
    maxAttempts: 2,
    backoffMs: 1500,
  },

  timeoutMs: 180000, // 3 minutes
};
