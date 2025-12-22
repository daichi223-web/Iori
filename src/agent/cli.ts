#!/usr/bin/env node
/**
 * Iori Agent Framework CLI
 * Command-line interface for running the multi-agent DAG system
 */

import { DAGRunner } from './runner.js';
import { allAgents } from './agents/index.js';
import fs from 'fs/promises';
import path from 'path';

interface CLIArgs {
  entry?: string;
  concurrency?: number;
  config?: string;
  help?: boolean;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): CLIArgs {
  const args: CLIArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--entry' || arg === '-e') {
      args.entry = argv[++i];
    } else if (arg === '--concurrency' || arg === '-c') {
      args.concurrency = parseInt(argv[++i], 10);
    } else if (arg === '--config') {
      args.config = argv[++i];
    }
  }

  return args;
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
🤖 Iori Agent Framework - Multi-Agent DAG Execution System

USAGE:
  npx tsx src/agent/cli.ts [OPTIONS]

OPTIONS:
  -e, --entry <agent>        Entry point agent (default: release)
  -c, --concurrency <num>    Max parallel agents (default: 3)
  --config <file>            Path to run.json config (default: ./run.json)
  -h, --help                 Show this help message

ENTRY POINTS:
  full            Run complete pipeline (spec → ui → code → test → proof → release)
  spec-only       Generate specification only
  code-gen        Generate code (requires spec)
  testing         Run tests (requires code)
  verification    Verify DoD (requires spec, code, test)

EXAMPLES:
  # Run full pipeline
  npx tsx src/agent/cli.ts --entry release --concurrency 3

  # Generate spec only
  npx tsx src/agent/cli.ts --entry spec

  # Generate code with high concurrency
  npx tsx src/agent/cli.ts --entry code --concurrency 5

AGENTS:
  1. spec      → Generates SPEC.md from user prompt
  2. ui        → Creates UI_MOCK.md from SPEC.md
  3. code      → Implements code from SPEC + UI_MOCK
  4. test      → Generates tests for code
  5. proof     → Verifies DoD and creates EVIDENCE.md
  6. release   → Builds and creates RELEASE.md

For more info: https://github.com/anthropics/iori
`);
}

/**
 * Load configuration from run.json
 */
async function loadConfig(configPath: string = './run.json') {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️  Could not load ${configPath}, using defaults`);
    return null;
  }
}

/**
 * Main CLI function
 */
async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log('🤖 Iori Agent Framework v3.0');
  console.log('━'.repeat(50));

  // Load configuration
  const config = await loadConfig(args.config);
  const entry = args.entry || config?.defaultEntry || 'release';
  const concurrency = args.concurrency || config?.defaultConcurrency || 3;

  console.log(`📍 Entry Point: ${entry}`);
  console.log(`⚡ Concurrency: ${concurrency}`);
  console.log(`🔧 Agents: ${allAgents.length}`);
  console.log('━'.repeat(50));

  // Create DAG runner
  const runner = new DAGRunner(allAgents);

  // Setup event listeners
  runner.on('statusChange', (status) => {
    console.log(`\n📊 Status: ${status.state}`);
    console.log(`   Completed: ${status.completedAgents}/${status.totalAgents}`);
    console.log(`   Running: ${status.runningAgents.join(', ') || 'None'}`);
  });

  runner.on('agentComplete', (output) => {
    const icon = output.status === 'success' ? '✅' : '❌';
    console.log(`${icon} ${output.agentId} completed (${output.duration}ms)`);

    if (output.status === 'success') {
      const artifactCount = Object.keys(output.artifacts).length;
      console.log(`   → Generated ${artifactCount} artifact(s)`);
    } else {
      console.log(`   → Error: ${output.error}`);
    }
  });

  runner.on('agentError', (output) => {
    console.error(`\n❌ Agent '${output.agentId}' failed:`);
    console.error(`   ${output.error}`);
  });

  runner.on('agentSkipped', (output) => {
    console.log(`⏭️  ${output.agentId} skipped: ${output.error}`);
  });

  // Run the DAG
  console.log(`\n🚀 Starting execution...\n`);

  const startTime = Date.now();

  try {
    const result = await runner.run({
      entry,
      concurrency,
      stopOnError: config?.globalConfig?.stopOnError ?? false,
    });

    const duration = Date.now() - startTime;

    console.log('\n━'.repeat(50));
    console.log(`\n✨ Execution ${result.state === 'completed' ? 'COMPLETED' : 'FAILED'}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Results:`);
    console.log(`   - Completed: ${result.completedAgents}`);
    console.log(`   - Failed: ${result.failedAgents}`);
    console.log(`   - Total: ${result.totalAgents}`);

    if (result.failedAgents > 0) {
      console.log('\n❌ Failed Agents:');
      for (const [id, output] of Object.entries(result.outputs)) {
        if (output.status === 'error') {
          console.log(`   - ${id}: ${output.error}`);
        }
      }
    }

    // Save output directory if configured
    if (config?.globalConfig?.saveArtifacts) {
      const outputDir = config.globalConfig.outputDir || './iori-generated';
      console.log(`\n📁 Artifacts saved to: ${outputDir}`);
    }

    console.log('\n━'.repeat(50));

    process.exit(result.state === 'completed' ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Fatal Error:', error.message);
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
