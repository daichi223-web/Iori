/**
 * UI Agent
 * Generates UI mockup document (UI_MOCK.md) from SPEC.md
 */

import type { AgentDefinition } from '../types.js';

export const uiAgent: AgentDefinition = {
  id: 'ui',
  name: 'UI Mockup Designer',
  description: 'Creates UI/UX mockup document based on specifications',
  dependsOn: ['spec'],

  async execute(context) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Get spec from dependency
      const specOutput = await context.getDependencyOutput('spec');
      const specContent = specOutput.artifacts['SPEC.md'];

      if (!specContent) {
        throw new Error('SPEC.md not found in spec agent output');
      }

      // Generate UI mockup using LLM
      const uiPrompt = `
You are a UI/UX designer. Based on the following specification, create a detailed UI mockup document.

Specification:
${specContent}

Please generate a comprehensive UI_MOCK.md document with:

# UI_MOCK.md

## 1. Design System
- Color palette
- Typography
- Spacing and layout grid
- Component library

## 2. Page Layouts
For each major page/screen:
- Wireframe description (ASCII art or detailed text)
- Components used
- Layout structure

## 3. Component Specifications
For each UI component:
- Component name
- Props/Parameters
- States (default, hover, active, disabled)
- Variants

## 4. User Flows
- Step-by-step user journeys
- Screen transitions
- Interaction patterns

## 5. Responsive Design
- Mobile layout adaptations
- Tablet considerations
- Desktop optimizations

## 6. Accessibility
- ARIA labels
- Keyboard navigation
- Screen reader support

Output ONLY the markdown content, no additional commentary.
`;

      const uiMockContent = await context.callLLM(uiPrompt, 'claude');

      // Write UI_MOCK.md
      await context.writeFile('UI_MOCK.md', uiMockContent);

      return {
        agentId: 'ui',
        status: 'success',
        artifacts: {
          'UI_MOCK.md': uiMockContent,
        },
        duration: Date.now() - startTime,
        timestamp,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        agentId: 'ui',
        status: 'error',
        artifacts: {} as Record<string, string>,
        error: errorMessage,
        duration: Date.now() - startTime,
        timestamp,
      };
    }
  },

  retry: {
    maxAttempts: 3,
    backoffMs: 1000,
  },

  timeoutMs: 120000, // 2 minutes
};
