/**
 * Spec Agent
 * Generates specification document (SPEC.md) from user prompt
 */

import type { AgentDefinition } from '../types.js';

export const specAgent: AgentDefinition = {
  id: 'spec',
  name: 'Specification Generator',
  description: 'Analyzes user requirements and generates detailed SPEC.md',
  dependsOn: [],

  async execute(context) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Read user prompt from input file or use default
      let userPrompt = '';
      try {
        userPrompt = await context.readFile('USER_PROMPT.md');
      } catch {
        // If no USER_PROMPT.md exists, create a default one
        userPrompt = 'Create a simple TODO application with CRUD operations';
      }

      // Generate specification using LLM
      const specPrompt = `
You are a technical specification writer. Based on the following user requirements, create a detailed SPEC.md document.

User Requirements:
${userPrompt}

Please generate a comprehensive specification document with the following sections:

# SPEC.md

## 1. Overview
- Brief description of the project
- Goals and objectives

## 2. Functional Requirements
- List of features and capabilities
- User stories

## 3. Technical Requirements
- Tech stack
- Architecture decisions
- Dependencies

## 4. Data Models
- Database schema
- Entity relationships

## 5. API Endpoints (if applicable)
- REST/GraphQL endpoints
- Request/Response formats

## 6. UI/UX Requirements
- User interface components
- User flows

## 7. Non-Functional Requirements
- Performance requirements
- Security requirements
- Scalability considerations

## 8. Constraints and Assumptions
- Technical constraints
- Business constraints

Output ONLY the markdown content, no additional commentary.
`;

      const specContent = await context.callLLM(specPrompt, 'gemini');

      // Write SPEC.md
      await context.writeFile('SPEC.md', specContent);

      // Also write the original prompt for reference
      await context.writeFile('USER_PROMPT.md', userPrompt);

      return {
        agentId: 'spec',
        status: 'success',
        artifacts: {
          'SPEC.md': specContent,
          'USER_PROMPT.md': userPrompt,
        },
        duration: Date.now() - startTime,
        timestamp,
      };
    } catch (error: any) {
      return {
        agentId: 'spec',
        status: 'error',
        artifacts: {},
        error: error.message,
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
