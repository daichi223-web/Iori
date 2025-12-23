/**
 * Iori v3.0 Frontend Server
 * Apple-inspired Dashboard Backend
 * CLI-based AI execution (Claude/Gemini/Codex)
 */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// JSON body parser
app.use(express.json());

// CORS設定
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// 静的ファイル配信 (public ディレクトリ)
app.use(express.static(path.join(__dirname, "public")));

// Iori生成ファイル配信 (iori-generated/web ディレクトリ)
app.use("/iori", express.static(path.join(projectRoot, "iori-generated/web")));

// API: システムログ取得
app.get("/api/logs", async (_req, res) => {
  try {
    const logPath = path.join(projectRoot, "iori_system.log");
    const content = await fs.readFile(logPath, "utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    res.json({
      file: "iori_system.log",
      content,
      lines,
      count: lines.length
    });
  } catch (error) {
    res.json({
      file: "iori_system.log",
      content: "",
      lines: [],
      count: 0,
      error: "Log file not found"
    });
  }
});

// API: TODO取得
app.get("/api/todos", async (_req, res) => {
  try {
    const todoPath = path.join(projectRoot, "TODO.md");
    const content = await fs.readFile(todoPath, "utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    res.json({
      file: "TODO.md",
      content,
      lines,
      count: lines.length
    });
  } catch (error) {
    res.json({
      file: "TODO.md",
      content: "",
      lines: [],
      count: 0,
      error: "TODO file not found"
    });
  }
});

// API: DoD進捗率取得
app.get("/api/progress", async (_req, res) => {
  try {
    const dodPath = path.join(projectRoot, "DOD.md");
    const { parseDoDFile, getRecommendedWorkUnit } = await import("../utils/dodParser.js");

    const progress = await parseDoDFile(dodPath);
    const recommendedWU = getRecommendedWorkUnit(progress);

    res.json({
      ...progress,
      recommendedWorkUnit: recommendedWU
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to parse DOD.md",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: システムステータス (軽量版 - Node.js標準API使用)
app.get("/api/status", async (_req, res) => {
  try {
    const os = await import('os');
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    res.json({
      version: "3.0.0",
      status: "online",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      currentState: {
        mode: 'Idle' as 'Idle' | 'Planning' | 'Building' | 'Verifying' | 'Snapshotting' | 'Blocked' | 'Error',
        phase: 'Ready',
        target: 'Waiting for input'
      },
      cpu: {
        load: Math.round(os.loadavg()[0] * 10), // 1-minute load average * 10 for percentage-like value
        cores: os.cpus().length
      },
      memory: {
        total: totalMem,
        active: usedMem,
        available: freeMem,
        usedPercent: Math.round((usedMem / totalMem) * 100),
        process: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss
        }
      },
      os: {
        platform: os.platform(),
        distro: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname()
      }
    });
  } catch (error) {
    res.status(500).json({
      version: "3.0.0",
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ============================================
// SSE STREAMING API (リアルタイム出力)
// ============================================

/**
 * ANSIエスケープコードを除去するヘルパー関数
 */
function cleanAnsiOutput(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')   // All ANSI escape sequences
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07]*\x07/g, '')       // OSC sequences
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '') // Other control chars
    .replace(/\?25h/g, '')                    // Leftover cursor show command
    .replace(/\r\n/g, '\n')                   // Windows改行を正規化
    .replace(/\r/g, '');                      // 残りのCRを除去
}

/**
 * SSE ストリーミングエンドポイント
 * AIの出力をリアルタイムでクライアントに送信
 */
/**
 * AI CLI コマンドを取得
 * @param ai - "claude" | "gemini" | "codex"
 * @param prompt - ユーザーの指示
 */
function getAiCliCommand(ai: string, prompt: string): string {
  const escapedPrompt = prompt.replace(/'/g, "'\\''");

  switch (ai.toLowerCase()) {
    case "gemini":
      // Gemini CLI: gemini -p (print mode)
      return `gemini -p '${escapedPrompt}'`;
    case "codex":
      // Codex CLI: codex exec
      return `codex exec '${escapedPrompt}'`;
    case "claude":
    default:
      // Claude CLI: 高速モード（Sonnet）
      // ツールは無効化（回答のみ）- ツールが必要な場合は対話モードを使用
      return `claude -p '${escapedPrompt}' --model sonnet`;
  }
}

/**
 * SSE ストリーミングエンドポイント
 * シェルコマンド用（AIコマンドは/api/ai-execを使用）
 */
app.get("/api/stream", async (req, res) => {
  const command = req.query.command as string;
  const ai = (req.query.ai as string) || "claude";

  if (!command) {
    res.status(400).json({ error: "command query parameter is required" });
    return;
  }

  // SSEヘッダー設定
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const { spawn } = await import("child_process");

  // AI指示の自動判定
  const isAiCommand = command.startsWith("ai ") || /[^\x01-\x7E]/.test(command);
  const prompt = command.replace(/^ai\s+/, "");

  console.log(`[Stream] Starting (${ai.toUpperCase()}): ${prompt.slice(0, 50)}...`);

  // 開始イベント送信
  res.write(`data: ${JSON.stringify({ type: "start", prompt, isAi: isAiCommand, ai })}\n\n`);

  let child;

  if (isAiCommand) {
    // AI コマンド: execPromise で同期実行してからストリーミング
    const cliCommand = getAiCliCommand(ai, prompt);
    console.log(`[Stream] Executing AI: ${cliCommand.slice(0, 80)}...`);

    try {
      const result = await execPromise(cliCommand, {
        timeout: 300000, // 5分
        maxBuffer: 1024 * 1024 * 50,
        cwd: projectRoot,
        env: { ...process.env, TERM: "dumb", NO_COLOR: "1" }
      });

      const cleanOutput = cleanAnsiOutput(result.stdout).trim();
      if (cleanOutput) {
        res.write(`data: ${JSON.stringify({ type: "output", text: cleanOutput })}\n\n`);
      }
      if (result.stderr) {
        res.write(`data: ${JSON.stringify({ type: "error", text: cleanAnsiOutput(result.stderr) })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: "done", code: 0 })}\n\n`);
      res.end();
      console.log(`[Stream] AI completed successfully`);
      return;
    } catch (error) {
      const execError = error as Error & { stdout?: string; stderr?: string; code?: number };
      const errorOutput = cleanAnsiOutput(execError.stdout || "");
      if (errorOutput) {
        res.write(`data: ${JSON.stringify({ type: "output", text: errorOutput })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({
        type: "error",
        text: execError.message || "AI execution failed"
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", code: execError.code || 1 })}\n\n`);
      res.end();
      console.error(`[Stream] AI error:`, execError.message);
      return;
    }
  }

  // シェルコマンド: spawnでストリーミング
  child = spawn("bash", ["-c", command], {
    cwd: projectRoot,
    env: { ...process.env }
  });

  // タイムアウト設定 (5分)
  const timeout = setTimeout(() => {
    child.kill("SIGTERM");
    res.write(`data: ${JSON.stringify({ type: "error", message: "Timeout (5 minutes)" })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done", code: -1 })}\n\n`);
    res.end();
  }, 300000);

  // stdout をリアルタイム送信
  child.stdout?.on("data", (data: Buffer) => {
    const text = cleanAnsiOutput(data.toString());
    if (text.trim()) {
      res.write(`data: ${JSON.stringify({ type: "output", text })}\n\n`);
    }
  });

  // stderr をリアルタイム送信
  child.stderr?.on("data", (data: Buffer) => {
    const text = cleanAnsiOutput(data.toString());
    if (text.trim()) {
      res.write(`data: ${JSON.stringify({ type: "error", text })}\n\n`);
    }
  });

  // 終了イベント
  child.on("close", (code) => {
    clearTimeout(timeout);
    res.write(`data: ${JSON.stringify({ type: "done", code })}\n\n`);
    res.end();
    console.log(`[Stream] Shell completed with code: ${code}`);
  });

  // クライアント切断時のクリーンアップ
  req.on("close", () => {
    clearTimeout(timeout);
    child.kill("SIGTERM");
    console.log("[Stream] Client disconnected");
  });
});

// API: コマンド実行 (Neural Console) - 従来の同期API
// @enhancement Supports Deep Research Mode (参謀モード)
// @enhancement AI/Shell auto-detection (日本語 or "ai " prefix → AI指示)
app.post("/api/exec", async (req, res) => {
  try {
    const { command, deepResearch } = req.body;

    if (!command || typeof command !== "string") {
      res.status(400).json({
        error: "Command is required and must be a string"
      });
      return;
    }

    // ★ AI指示の自動判定: "ai " prefix または日本語が含まれる場合
    const isAiCommand = command.startsWith("ai ") || /[^\x01-\x7E]/.test(command);

    let finalCommand = command;

    if (isAiCommand) {
      // "ai " prefixを除去してプロンプトを抽出
      const prompt = command.replace(/^ai\s+/, "");
      console.log(`[Server] Routing to AI: ${prompt}`);

      // Claude CLIを使ってAI指示を実行
      // ★ 重要: Claude CLIはTTYが必要なため、scriptコマンドで疑似TTYを作成
      try {
        const AI_TIMEOUT = 300000; // 5分タイムアウト（長いタスク対応）
        // プロンプトのエスケープ（シングルクォート用）
        const escapedPrompt = prompt.replace(/'/g, "'\\''");
        // script -q -c: 疑似TTYを作成して実行
        const result = await execPromise(
          `script -q -c "claude --print '${escapedPrompt}'" /dev/null`,
          {
            timeout: AI_TIMEOUT,
            maxBuffer: 1024 * 1024 * 50, // 50MB（大きな出力対応）
            cwd: projectRoot,
            shell: '/bin/bash'
          }
        );
        // ANSIエスケープコードを除去
        const cleanOutput = cleanAnsiOutput(result.stdout).trim();

        res.json({
          command,
          stdout: cleanOutput,
          stderr: result.stderr || "",
          success: true,
          mode: "ai",
          originalPrompt: prompt
        });
      } catch (aiError: unknown) {
        // 詳細なエラー情報を取得
        const execError = aiError as Error & {
          stderr?: string;
          stdout?: string;
          code?: number;
          killed?: boolean;
          signal?: string;
        };
        const errorMessage = execError.message || "Unknown error";
        const errorStderr = execError.stderr || "";
        const errorStdout = execError.stdout || "";

        console.error(`[Server] AI Error:`, {
          message: errorMessage,
          stderr: errorStderr,
          stdout: errorStdout,
          code: execError.code,
          killed: execError.killed,
          signal: execError.signal
        });

        res.json({
          command,
          stdout: errorStdout,
          stderr: `AI呼び出しエラー: ${errorMessage}${errorStderr ? '\nstderr: ' + errorStderr : ''}`,
          success: false,
          mode: "ai",
          originalPrompt: prompt
        });
      }
      return;
    }

    // Deep Research Mode: Prepend strategist prompt
    if (deepResearch === true) {
      const strategistPrompt = `あなたは熟練のソリューションアーキテクトです。以下のユーザーの要望に対し、**いきなりコードを書かず、必ず以下の手順を踏んでください。**

Phase 1: Deep Research
- 必要な技術選定、ライブラリのベストプラクティス、最新のデザイントレンド、競合のアプローチなどを調査してください。
- Web検索が可能な場合は、積極的に活用してください。

Phase 2: Architecture
- 調査結果に基づき、プロジェクトルートに \`ARCHITECT.md\` を作成し、以下を定義してください：
  - ファイル構成（ディレクトリ構造）
  - 技術スタック（ライブラリとバージョン）
  - なぜその技術を選んだかの理由
  - 実装の優先順位

Phase 3: Implementation
- \`ARCHITECT.md\` の内容に沿って、実際にコードを実装してください。
- 各ファイルには、なぜこの実装にしたかのコメントを残してください。

[ユーザーの要望]: ${command}`;

      finalCommand = strategistPrompt;
    }

    // Execute shell command with timeout and buffer limits
    const { stdout, stderr } = await execPromise(finalCommand, {
      timeout: deepResearch ? 120000 : 30000, // Deep research: 2 min, Normal: 30 sec
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for research mode
      cwd: projectRoot // Execute in project root
    });

    res.json({
      command,
      stdout: stdout || "",
      stderr: stderr || "",
      success: true,
      mode: "shell",
      deepResearch: deepResearch || false
    });

  } catch (error) {
    res.status(200).json({
      command: req.body.command,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown error",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Cloud Actions (GitHub, Vercel, Firebase)
// @security Action-based allowlist - NO arbitrary commands
// @safety Destructive operations require user confirmation
// @rateLimit 10 requests per minute
app.post("/api/cloud/action", async (req, res) => {
  try {
    // Rate limiting check
    const { checkRateLimit, RATE_LIMITS } = await import("../core/rateLimit.js");
    const rateLimitResult = checkRateLimit('cloud:/api/cloud/action', RATE_LIMITS.cloud);

    if (!rateLimitResult.allowed) {
      res.status(429).json({
        error: rateLimitResult.message,
        retryAfter: rateLimitResult.resetAt ? Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000) : 60
      });
      return;
    }

    const { service, action, confirmationId } = req.body;

    if (!service || !action) {
      res.status(400).json({
        error: "Service and action are required",
        example: { service: "git", action: "status" }
      });
      return;
    }

    // Dynamic import for ES module
    const { buildCommand, getGitSyncCommands, isActionAllowed } = await import("../core/cloudActions.js");
    const { validateAction, confirmOperation } = await import("../core/safety.js");

    // Validate action is in allowlist
    if (!isActionAllowed(service, action)) {
      res.status(403).json({
        error: "Action not allowed",
        service,
        action,
        allowedActions: {
          git: ["status", "syncMain"],
          gh: ["login", "status"],
          vercel: ["deployProd", "whoami", "login"],
          firebase: ["deployFirestore", "deployFunctions", "projectsList", "login"]
        }
      });
      return;
    }

    // Safety validation: Check if action needs confirmation
    const cloudAction: any = { service, action };

    // If confirmationId is provided, verify it
    if (confirmationId) {
      const confirmed = confirmOperation(confirmationId);
      if (!confirmed) {
        res.status(400).json({
          error: "Invalid or expired confirmation ID",
          confirmationId
        });
        return;
      }
      // Confirmation verified, proceed with execution
    } else {
      // No confirmation ID, validate if one is needed
      const validation = validateAction(cloudAction);

      if (!validation.allowed) {
        // Action blocked or needs confirmation
        if (validation.pendingId) {
          // Needs user confirmation
          res.status(202).json({
            error: validation.reason,
            requiresConfirmation: true,
            pendingId: validation.pendingId,
            service,
            action,
            message: "This operation requires user confirmation. Please approve via /api/safety/confirm/:id"
          });
        } else {
          // Blocked by Safe Mode
          res.status(403).json({
            error: validation.reason,
            service,
            action,
            blockedBy: "SafeMode"
          });
        }
        return;
      }
      // Action is safe, proceed
    }

    // Special handling for git syncMain (sequential commands)
    if (service === "git" && action === "syncMain") {
      const commands = getGitSyncCommands();
      const results: string[] = [];

      for (const cmdSpec of commands) {
        try {
          const fullCmd = `${cmdSpec.cmd} ${cmdSpec.args.join(" ")}`;
          const { stdout, stderr } = await execPromise(fullCmd, {
            timeout: 60000,
            maxBuffer: 1024 * 1024 * 5,
            cwd: projectRoot
          });
          results.push(`[${cmdSpec.description}]\n${stdout || stderr || "OK"}`);
        } catch (error) {
          // Git commit may fail if no changes - this is OK
          if (cmdSpec.cmd === "git" && cmdSpec.args[0] === "commit") {
            results.push(`[${cmdSpec.description}] No changes to commit`);
          } else {
            throw error;
          }
        }
      }

      res.json({
        service,
        action,
        stdout: results.join("\n\n") + "\n\n✅ Branch pushed to GitHub!\n⚠️  [ACTION REQUIRED] Review changes and merge to main manually.",
        stderr: "",
        success: true
      });
      return;
    }

    // Build command from action
    const cmdSpec = buildCommand(cloudAction);

    // Special handling for login commands (interactive browser-based auth)
    if (action === "login") {
      const { spawn } = await import("child_process");

      // Launch login command in detached mode with inherited stdio
      // This allows the CLI tool to open a browser and interact with the user
      const child = spawn(cmdSpec.cmd, cmdSpec.args, {
        stdio: "inherit",  // ✅ User interacts directly with CLI
        detached: true,    // ✅ Process runs independently
        shell: true,       // ✅ Ensure command works on all platforms
        cwd: projectRoot
      });

      // Don't wait for completion - let it run in background
      child.unref();

      res.json({
        service,
        action,
        description: cmdSpec.description,
        message: `Login flow launched for ${service}. Please complete authentication in the opened window.`,
        success: true
      });
      return;
    }

    // For non-login commands, use execPromise
    const fullCmd = `${cmdSpec.cmd} ${cmdSpec.args.join(" ")}`;
    const { stdout, stderr } = await execPromise(fullCmd, {
      timeout: 120000, // 2 minutes for cloud operations
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      cwd: projectRoot
    });

    res.json({
      service,
      action,
      description: cmdSpec.description,
      stdout: stdout || "",
      stderr: stderr || "",
      success: true
    });

  } catch (error) {
    res.status(200).json({
      service: req.body.service,
      action: req.body.action,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown error",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: CLI Tools Status (Claude, Codex, Gemini)
app.get("/api/cli/status", async (_req, res) => {
  try {
    const { getAllToolsStatus } = await import("../core/cliTools.js");
    const statuses = await getAllToolsStatus();
    res.json({
      tools: statuses,
      success: true
    });
  } catch (error) {
    res.status(500).json({
      tools: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: CLI Login Launcher
// @philosophy Iori is a "command center", not an "authentication proxy"
// @security Iori launches CLI tools with stdio:inherit - does NOT handle credentials
app.post("/api/cli/login", async (req, res) => {
  try {
    const { tool } = req.body;

    if (!tool || typeof tool !== "string") {
      res.status(400).json({
        error: "Tool name is required",
        example: { tool: "claude" }
      });
      return;
    }

    const { CLI_TOOLS } = await import("../core/cliTools.js");
    const { spawn } = await import("child_process");

    const toolSpec = CLI_TOOLS[tool as keyof typeof CLI_TOOLS];
    if (!toolSpec) {
      res.status(400).json({
        error: `Unknown tool: ${tool}`,
        availableTools: Object.keys(CLI_TOOLS)
      });
      return;
    }

    // Launch CLI login in detached mode with inherited stdio
    // This hands off the authentication flow to the OS/terminal
    const [cmd, ...args] = toolSpec.loginCommand;
    const child = spawn(cmd, args, {
      stdio: "inherit",  // ✅ User interacts directly with CLI
      detached: true,    // ✅ Process runs independently
      shell: true        // ✅ Ensure command works on all platforms
    });

    // Don't wait for completion - let it run in background
    child.unref();

    res.json({
      tool,
      command: toolSpec.loginCommand.join(" "),
      message: `Login flow launched for ${toolSpec.displayName}. Please complete authentication in the opened window.`,
      success: true
    });

  } catch (error) {
    res.status(500).json({
      tool: req.body.tool,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Mock Snapshot作成
app.post("/api/snapshot/create", async (req, res) => {
  try {
    const { label, newFeatures, knownIssues } = req.body;

    if (!label) {
      res.status(400).json({ error: "Label is required" });
      return;
    }

    const { createSnapshot } = await import("../utils/snapshotManager.js");

    const snapshot = await createSnapshot(projectRoot, {
      label,
      newFeatures: newFeatures || [],
      knownIssues: knownIssues || []
    });

    res.json({
      success: true,
      snapshot
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Mock Snapshot一覧取得
app.get("/api/snapshot/list", async (_req, res) => {
  try {
    const { listSnapshots } = await import("../utils/snapshotManager.js");
    const snapshots = await listSnapshots(projectRoot);

    res.json({
      success: true,
      snapshots,
      count: snapshots.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: 特定のSnapshot取得
app.get("/api/snapshot/:id", async (req, res) => {
  try {
    const { getSnapshot } = await import("../utils/snapshotManager.js");
    const snapshot = await getSnapshot(projectRoot, req.params.id);

    if (!snapshot) {
      res.status(404).json({
        success: false,
        error: "Snapshot not found"
      });
      return;
    }

    res.json({
      success: true,
      snapshot
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ===============================================
// SAFETY SYSTEM API ENDPOINTS
// ===============================================

// API: Get all pending operations
app.get("/api/safety/pending", async (_req, res) => {
  try {
    const { getAllPendingOperations } = await import("../core/safety.js");
    const pending = getAllPendingOperations();

    res.json({
      success: true,
      pending,
      count: pending.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Confirm a pending operation
// @rateLimit 20 requests per minute
app.post("/api/safety/confirm/:id", async (req, res) => {
  try {
    // Rate limiting check
    const { checkRateLimit, RATE_LIMITS } = await import("../core/rateLimit.js");
    const rateLimitResult = checkRateLimit('safety:/api/safety/confirm', RATE_LIMITS.safety);

    if (!rateLimitResult.allowed) {
      res.status(429).json({
        success: false,
        error: rateLimitResult.message,
        retryAfter: rateLimitResult.resetAt ? Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000) : 60
      });
      return;
    }

    const { confirmOperation } = await import("../core/safety.js");
    const operation = confirmOperation(req.params.id);

    if (!operation) {
      res.status(404).json({
        success: false,
        error: "Operation not found or expired"
      });
      return;
    }

    res.json({
      success: true,
      operation,
      message: "Operation confirmed. You may now execute it."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Cancel a pending operation
app.post("/api/safety/cancel/:id", async (req, res) => {
  try {
    const { cancelOperation } = await import("../core/safety.js");
    const cancelled = cancelOperation(req.params.id);

    if (!cancelled) {
      res.status(404).json({
        success: false,
        error: "Operation not found"
      });
      return;
    }

    res.json({
      success: true,
      message: "Operation cancelled"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Get Safe Mode configuration
app.get("/api/safety/mode", async (_req, res) => {
  try {
    const { getSafeModeConfig } = await import("../core/safety.js");
    const config = getSafeModeConfig();

    res.json({
      success: true,
      config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Update Safe Mode configuration
app.put("/api/safety/mode", async (req, res) => {
  try {
    const { setSafeModeConfig } = await import("../core/safety.js");
    const config = setSafeModeConfig(req.body);

    res.json({
      success: true,
      config,
      message: "Safe Mode configuration updated"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ===============================================
// TRINITY LOGGER API ENDPOINTS
// ===============================================

// API: Get Trinity logs (all AI provider activities)
app.get("/api/trinity/logs", async (_req, res) => {
  try {
    const { trinityLogger } = await import("../core/trinityLogger.js");
    const history = trinityLogger.getHistory();

    res.json({
      success: true,
      logs: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Filter Trinity logs by provider
app.get("/api/trinity/logs/:provider", async (req, res) => {
  try {
    const { trinityLogger } = await import("../core/trinityLogger.js");
    const provider = req.params.provider.toUpperCase() as 'CLAUDE' | 'GEMINI' | 'CODEX' | 'SYSTEM';
    const logs = trinityLogger.filterByProvider(provider);

    res.json({
      success: true,
      provider,
      logs,
      count: logs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Run tests and log results (TDD visibility)
app.post("/api/trinity/test", async (_req, res) => {
  try {
    const { trinityLogger } = await import("../core/trinityLogger.js");

    // Log test start
    trinityLogger.log('SYSTEM', 'TEST', 'Running npm test...');

    const { stdout, stderr } = await execPromise("npm test -- --run", {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
      cwd: projectRoot
    });

    // Parse test results
    const passMatch = stdout.match(/(\d+) passed/);
    const failMatch = stdout.match(/(\d+) failed/);

    if (failMatch && parseInt(failMatch[1]) > 0) {
      trinityLogger.testFailed(`${failMatch[1]} tests failed`, 'npm test');
    }

    if (passMatch) {
      trinityLogger.testPassed(`${passMatch[1]} tests passed`);
    }

    res.json({
      success: true,
      stdout,
      stderr,
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0
    });
  } catch (error) {
    const { trinityLogger } = await import("../core/trinityLogger.js");
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    trinityLogger.testFailed(errorMessage, 'npm test');

    res.status(200).json({
      success: false,
      error: errorMessage
    });
  }
});

// ===============================================
// PROJECT RUNNER API ENDPOINTS
// ===============================================

// API: Get task queue status
app.get("/api/tasks/status", async (_req, res) => {
  try {
    const { getTaskStatus } = await import("../core/projectRunner.js");
    const status = await getTaskStatus(projectRoot);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Add a new task
app.post("/api/tasks/add", async (req, res) => {
  try {
    const { prompt, ai = "claude" } = req.body;

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
      return;
    }

    const validAi = ["claude", "gemini", "codex"].includes(ai) ? ai : "claude";

    const { addTask } = await import("../core/projectRunner.js");
    const task = await addTask(projectRoot, prompt, validAi);

    res.json({
      success: true,
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Cancel a task
app.post("/api/tasks/cancel/:id", async (req, res) => {
  try {
    const { cancelTask } = await import("../core/projectRunner.js");
    const cancelled = await cancelTask(projectRoot, req.params.id);

    if (!cancelled) {
      res.status(404).json({
        success: false,
        error: "Task not found or not pending"
      });
      return;
    }

    res.json({
      success: true,
      message: "Task cancelled"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Clear completed tasks
app.post("/api/tasks/clear", async (_req, res) => {
  try {
    const { clearCompletedTasks } = await import("../core/projectRunner.js");
    const count = await clearCompletedTasks(projectRoot);

    res.json({
      success: true,
      clearedCount: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Import tasks from TODO.md
app.post("/api/tasks/import", async (_req, res) => {
  try {
    const { importFromTodoMd } = await import("../core/projectRunner.js");
    const tasks = await importFromTodoMd(projectRoot);

    res.json({
      success: true,
      importedCount: tasks.length,
      tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Execute next pending task (single shot)
app.post("/api/tasks/execute-next", async (_req, res) => {
  try {
    const { getNextPendingTask, executeTask } = await import("../core/projectRunner.js");
    const task = await getNextPendingTask(projectRoot);

    if (!task) {
      res.json({
        success: true,
        message: "No pending tasks"
      });
      return;
    }

    const result = await executeTask(projectRoot, task);

    res.json({
      success: true,
      task: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ===============================================
// TRINITY PROTOCOL API ENDPOINTS
// ===============================================

// API: Start Trinity Meeting (SSE streaming)
app.get("/api/trinity/meeting", async (req, res) => {
  const topic = req.query.topic as string;

  if (!topic) {
    res.status(400).json({ error: "topic query parameter is required" });
    return;
  }

  // SSEヘッダー設定
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  console.log(`\n🧠 Trinity Protocol starting: ${topic}`);

  try {
    const { startMeeting } = await import("../agent/meeting/index.js");

    const result = await startMeeting(topic, projectRoot, {
      maxRounds: 3,
      timeout: 120000,
      onProgress: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    });

    // 最終結果を送信
    res.write(`data: ${JSON.stringify({
      type: "result",
      success: result.success,
      meetingId: result.meetingId,
      decisions: result.decisions,
      tasks: result.tasks,
      finalSpec: result.finalSpec
    })}\n\n`);

    res.end();

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`);
    res.end();
  }
});

// API: Start Trinity Meeting and auto-queue tasks
app.post("/api/trinity/meeting", async (req, res) => {
  try {
    const { topic, autoQueue = true } = req.body;

    if (!topic) {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    console.log(`\n🧠 Trinity Protocol starting: ${topic}`);

    const { startMeeting } = await import("../agent/meeting/index.js");
    const { addTask } = await import("../core/projectRunner.js");

    const result = await startMeeting(topic, projectRoot, {
      maxRounds: 3,
      timeout: 120000
    });

    // 自動でタスクをProjectRunnerに追加
    if (autoQueue && result.success && result.tasks.length > 0) {
      for (const task of result.tasks) {
        await addTask(projectRoot, task.title, "claude");
      }
      console.log(`📋 ${result.tasks.length} tasks queued to ProjectRunner`);
    }

    res.json({
      success: result.success,
      meetingId: result.meetingId,
      topic: result.topic,
      rounds: result.rounds,
      decisions: result.decisions,
      tasks: result.tasks,
      tasksQueued: autoQueue ? result.tasks.length : 0,
      finalSpec: result.finalSpec,
      error: result.error
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: List all meetings
app.get("/api/trinity/meetings", async (_req, res) => {
  try {
    const { listMeetings } = await import("../agent/meeting/index.js");
    const meetings = await listMeetings(projectRoot);

    res.json({
      success: true,
      meetings,
      count: meetings.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// API: Get meeting details
app.get("/api/trinity/meetings/:id", async (req, res) => {
  try {
    const { loadMinutes } = await import("../agent/meeting/index.js");
    const minutes = await loadMinutes(projectRoot, req.params.id);

    if (!minutes) {
      res.status(404).json({
        success: false,
        error: "Meeting not found"
      });
      return;
    }

    res.json({
      success: true,
      meeting: minutes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.listen(PORT, async () => {
  console.log(`\n🌐 Iori Dashboard Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   Status: Online\n`);

  // Cleanup expired rate limit entries every 5 minutes
  const { cleanupExpiredEntries } = await import("../core/rateLimit.js");
  setInterval(() => {
    const cleaned = cleanupExpiredEntries();
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired rate limit entries`);
    }
  }, 5 * 60 * 1000); // 5 minutes
});

export { app };
