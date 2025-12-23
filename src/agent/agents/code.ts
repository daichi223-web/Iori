/**
 * Code Agent
 * Generates implementation code from SPEC.md and UI_MOCK.md
 */

import type { AgentDefinition } from '../types.js';

export const codeAgent: AgentDefinition = {
  id: 'code',
  name: 'Code Generator',
  description: 'Implements features based on spec and UI mockups',
  dependsOn: ['spec', 'ui'],

  async execute(context) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Get inputs from dependencies
      const specOutput = await context.getDependencyOutput('spec');
      const uiOutput = await context.getDependencyOutput('ui');

      const specContent = specOutput.artifacts['SPEC.md'];
      const uiMockContent = uiOutput.artifacts['UI_MOCK.md'];

      if (!specContent) {
        throw new Error('SPEC.md not found');
      }

      // Generate code structure using LLM
      const codePrompt = `
You are an expert software engineer. Based on the following specification and UI mockup, generate implementation code.

Specification:
${specContent}

UI Mockup:
${uiMockContent || 'No UI mockup provided'}

Please generate code with the following structure:

1. **File Structure**: List all files to create with their paths
2. **Implementation**: For each file, provide complete, production-ready code
3. **Dependencies**: List of npm/pip packages needed

Requirements:
- Use TypeScript/JavaScript (ES Modules)
- Follow best practices and design patterns
- Include error handling
- Add JSDoc comments
- Make code type-safe
- Organize into logical modules

Output format:
## File Structure
\`\`\`
src/
  index.ts
  components/
    ...
\`\`\`

## Dependencies
\`\`\`json
{
  "dependencies": { ... }
}
\`\`\`

## Implementation

### File: src/index.ts
\`\`\`typescript
// code here
\`\`\`

### File: src/components/...
\`\`\`typescript
// code here
\`\`\`

Generate complete, working code for ALL files needed.
`;

      const codeContent = await context.callLLM(codePrompt, 'claude');

      // Write CODE_GEN.md with all generated code
      await context.writeFile('CODE_GEN.md', codeContent);

      // Parse and extract individual files (simplified - in real implementation, parse the markdown)
      // For now, just store the combined output
      const artifacts: Record<string, string> = {
        'CODE_GEN.md': codeContent,
      };

      // TODO: Parse markdown and create actual files
      // This would require:
      // 1. Parse CODE_GEN.md
      // 2. Extract code blocks
      // 3. Create files at specified paths
      // 4. Update package.json with dependencies

      return {
        agentId: 'code',
        status: 'success',
        artifacts,
        duration: Date.now() - startTime,
        timestamp,
      };
    } catch (error: any) {
      return {
        agentId: 'code',
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
    backoffMs: 2000,
  },

  timeoutMs: 300000, // 5 minutes - code generation takes longer
};
