// examples/trinity-test.ts
// Iori 3.0 Trinity Architecture - Integration Test
// Tests the collaboration of Claude (Architect) + Gemini (Worker) + Codex (Logician)

import { think } from '../src/core/brain';
import chalk from 'chalk';

async function trinityTest() {
  console.log(chalk.cyan('\n🚀 Iori 3.0 Trinity Architecture Test\n'));
  console.log(chalk.gray('=' .repeat(60)));

  try {
    // --- Phase 1: Gemini analyzes the requirements ---
    console.log(chalk.yellow('\n📊 Phase 1: Gemini (Worker) - Requirements Analysis'));
    const requirements = await think(
      'Analyze this feature: "Create a TypeScript function to validate email addresses". List key requirements in 3 bullet points.',
      '',
      'GEMINI'
    );
    console.log(chalk.green('✓ Gemini Analysis:'));
    console.log(requirements);

    // --- Phase 2: Claude designs the architecture ---
    console.log(chalk.yellow('\n🏗️  Phase 2: Claude (Architect) - System Design'));
    const design = await think(
      'Design the architecture for an email validation function. Output a simple plan with function signature and approach.',
      `Requirements: ${requirements}`,
      'CLAUDE'
    );
    console.log(chalk.green('✓ Claude Design:'));
    console.log(design);

    // --- Phase 3: Codex implements the logic ---
    console.log(chalk.yellow('\n⚙️  Phase 3: Codex (Logician) - Implementation'));
    const implementation = await think(
      'Implement a TypeScript email validation function with proper types and regex.',
      `Design: ${design}\nRequirements: ${requirements}`,
      'CODEX'
    );
    console.log(chalk.green('✓ Codex Implementation:'));
    console.log(implementation);

    console.log(chalk.gray('\n' + '='.repeat(60)));
    console.log(chalk.cyan('✨ Trinity Test Complete!\n'));

  } catch (error) {
    console.error(chalk.red('\n💥 Trinity Test Failed:'), error);
    process.exit(1);
  }
}

// Run the test
trinityTest();
