/**
 * Iori v3.0 Frontend Server
 * Apple-inspired Dashboard Backend
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

// API: コマンド実行 (Neural Console)
// @enhancement Supports Deep Research Mode (参謀モード)
app.post("/api/exec", async (req, res) => {
  try {
    const { command, deepResearch } = req.body;

    if (!command || typeof command !== "string") {
      res.status(400).json({
        error: "Command is required and must be a string"
      });
      return;
    }

    let finalCommand = command;

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

    // Execute command with timeout and buffer limits
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
