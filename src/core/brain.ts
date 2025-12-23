// src/core/brain.ts
import { exec, spawn } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import { trinityLogger } from "./trinityLogger.js";

const execPromise = util.promisify(exec);

/** AI Provider Types */
export type BrainProvider = 'CLAUDE' | 'CODEX' | 'GEMINI';

/** Configuration for brain operations */
export interface BrainConfig {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  streaming?: boolean;
}

const DEFAULT_CONFIG: Required<BrainConfig> = {
  timeout: 120000,      // 2分（短縮）
  maxRetries: 2,
  retryDelay: 1000,
  cacheEnabled: true,
  cacheTTL: 300000,     // 5分
  streaming: false
};

/** Simple in-memory cache for responses */
interface CacheEntry {
  response: string;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();

/**
 * Generate cache key from prompt
 */
function getCacheKey(instruction: string, context: string, provider: BrainProvider): string {
  const content = `${provider}:${instruction}:${context.slice(0, 1000)}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  return `brain_${hash}`;
}

/**
 * Check cache for existing response
 */
function checkCache(key: string, ttl: number): string | null {
  const entry = responseCache.get(key);
  if (entry && (Date.now() - entry.timestamp) < ttl) {
    return entry.response;
  }
  if (entry) {
    responseCache.delete(key);
  }
  return null;
}

/**
 * Save response to cache
 */
function saveToCache(key: string, response: string): void {
  responseCache.set(key, { response, timestamp: Date.now() });
  // Keep cache size manageable
  if (responseCache.size > 100) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
}

/**
 * Execute with retry logic
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  retryDelay: number,
  provider: BrainProvider
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const retryEntry = trinityLogger.log(provider, 'WARN',
          `Attempt ${attempt + 1} failed. Retrying in ${retryDelay}ms...`);
        console.log(trinityLogger.formatForConsole(retryEntry));
        await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Build CLI command for provider
 */
function buildCommand(provider: BrainProvider, tempFile: string): string {
  const catCommand = process.platform === 'win32' ? 'type' : 'cat';

  switch (provider) {
    case 'CLAUDE':
      return `${catCommand} "${tempFile}" | claude --print`;
    case 'GEMINI':
      return `${catCommand} "${tempFile}" | gemini`;
    case 'CODEX':
      return `${catCommand} "${tempFile}" | codex exec --skip-git-repo-check -`;
  }
}

/**
 * Execute streaming response (faster first-byte time)
 */
async function executeStreaming(
  tempFile: string,
  provider: BrainProvider,
  timeout: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const catCommand = process.platform === 'win32' ? 'type' : 'cat';
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const shellFlag = process.platform === 'win32' ? '/c' : '-c';

    let cliCmd: string;
    switch (provider) {
      case 'CLAUDE':
        cliCmd = `${catCommand} "${tempFile}" | claude --print`;
        break;
      case 'GEMINI':
        cliCmd = `${catCommand} "${tempFile}" | gemini`;
        break;
      case 'CODEX':
        cliCmd = `${catCommand} "${tempFile}" | codex exec --skip-git-repo-check -`;
        break;
    }

    const child = spawn(shell, [shellFlag, cliCmd], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Timeout after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || stdout.length > 0) {
        if (stderr) {
          const warnEntry = trinityLogger.log(provider, 'WARN', stderr.slice(0, 200));
          console.log(trinityLogger.formatForConsole(warnEntry));
        }
        resolve(stdout.trim());
      } else {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Main think function with improved performance
 */
export async function think(
  instruction: string,
  context: string = "",
  provider: BrainProvider = 'CLAUDE',
  config: BrainConfig = {}
): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Check cache first
  if (cfg.cacheEnabled) {
    const cacheKey = getCacheKey(instruction, context, provider);
    const cached = checkCache(cacheKey, cfg.cacheTTL);
    if (cached) {
      const cacheHit = trinityLogger.log(provider, 'INFO', 'Cache hit - returning cached response');
      console.log(trinityLogger.formatForConsole(cacheHit));
      return cached;
    }
  }

  const entry = trinityLogger.log(provider, 'INFO', `Invoking ${provider} CLI...`);
  console.log(trinityLogger.formatForConsole(entry));

  // Prepare prompt with truncated context
  const safeContext = context.slice(0, 50000);
  const fullPrompt = `${instruction}\n\n[CONTEXT]\n${safeContext}\n\nOutput raw code only.`;

  // Create temp file
  const tempDir = path.join(process.cwd(), '.iori_temp');
  await fs.mkdir(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, `prompt_${Date.now()}_${provider}.txt`);
  await fs.writeFile(tempFile, fullPrompt, 'utf-8');

  try {
    const result = await executeWithRetry(
      async () => {
        if (cfg.streaming) {
          return executeStreaming(tempFile, provider, cfg.timeout);
        }

        const command = buildCommand(provider, tempFile);
        const { stdout, stderr } = await execPromise(command, {
          timeout: cfg.timeout,
          maxBuffer: 1024 * 1024 * 20
        });

        if (stderr) {
          const warnEntry = trinityLogger.log(provider, 'WARN', stderr.slice(0, 200));
          console.log(trinityLogger.formatForConsole(warnEntry));
        }

        return stdout.trim();
      },
      cfg.maxRetries,
      cfg.retryDelay,
      provider
    );

    // Cache successful response
    if (cfg.cacheEnabled && result) {
      const cacheKey = getCacheKey(instruction, context, provider);
      saveToCache(cacheKey, result);
    }

    const successEntry = trinityLogger.log(provider, 'SUCCESS', `Response received (${result.length} chars)`);
    console.log(trinityLogger.formatForConsole(successEntry));

    return result;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorEntry = trinityLogger.log(provider, 'ERROR', `CLI Failed: ${errorMessage}`);
    console.log(trinityLogger.formatForConsole(errorEntry));

    // Automatic failover
    if (provider === 'GEMINI') {
      const failoverEntry = trinityLogger.log('CLAUDE', 'INFO', 'Gemini failed. Escalating to Claude...');
      console.log(trinityLogger.formatForConsole(failoverEntry));
      return think(instruction, context, 'CLAUDE', config);
    }

    if (provider === 'CODEX') {
      const failoverEntry = trinityLogger.log('CLAUDE', 'INFO', 'Codex failed. Escalating to Claude...');
      console.log(trinityLogger.formatForConsole(failoverEntry));
      return think(instruction, context, 'CLAUDE', config);
    }

    return `// Error: ${provider} could not generate response.`;
  } finally {
    await fs.unlink(tempFile).catch(() => {});
  }
}

/**
 * Execute multiple prompts in parallel
 */
export async function thinkParallel(
  tasks: Array<{
    instruction: string;
    context?: string;
    provider?: BrainProvider;
  }>,
  config: BrainConfig = {}
): Promise<string[]> {
  const entry = trinityLogger.log('CLAUDE', 'INFO', `Starting ${tasks.length} parallel tasks...`);
  console.log(trinityLogger.formatForConsole(entry));

  const results = await Promise.allSettled(
    tasks.map(task =>
      think(task.instruction, task.context || "", task.provider || 'CLAUDE', config)
    )
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const errEntry = trinityLogger.log(tasks[i].provider || 'CLAUDE', 'ERROR',
      `Task ${i} failed: ${result.reason}`);
    console.log(trinityLogger.formatForConsole(errEntry));
    return `// Error in task ${i}: ${result.reason}`;
  });
}

/**
 * Race multiple providers for fastest response
 */
export async function thinkRace(
  instruction: string,
  context: string = "",
  providers: BrainProvider[] = ['CLAUDE', 'GEMINI'],
  config: BrainConfig = {}
): Promise<{ response: string; provider: BrainProvider }> {
  const entry = trinityLogger.log('CLAUDE', 'INFO',
    `Racing ${providers.length} providers: ${providers.join(', ')}`);
  console.log(trinityLogger.formatForConsole(entry));

  const racePromises = providers.map(async (provider) => {
    const response = await think(instruction, context, provider, config);
    return { response, provider };
  });

  return Promise.race(racePromises);
}

/**
 * Clear response cache
 */
export function clearBrainCache(): void {
  responseCache.clear();
  const entry = trinityLogger.log('CLAUDE', 'INFO', 'Brain cache cleared');
  console.log(trinityLogger.formatForConsole(entry));
}
