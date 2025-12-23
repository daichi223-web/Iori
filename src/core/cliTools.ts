/**
 * Iori v3.1 CLI Tool Management
 * AI Brain & Development Tool Login Launcher
 *
 * @philosophy "Iori is a command center, not an authentication proxy"
 * ✅ Iori CAN: Launch CLI login flows, check auth status
 * ❌ Iori CANNOT: Store credentials, handle tokens
 */

export type CLITool = "claude" | "codex" | "gemini";

export interface CLIToolSpec {
  name: string;
  displayName: string;
  loginCommand: string[];
  statusCommand: string[];
  installHint?: string;
}

/**
 * CLI Tool specifications
 * Each tool has a login command and a status check command
 */
export const CLI_TOOLS: Record<CLITool, CLIToolSpec> = {
  claude: {
    name: "claude",
    displayName: "Claude Code",
    loginCommand: ["claude", "login"],
    statusCommand: ["claude", "--version"], // Simpler check - just verify it's installed
    installHint: "npm install -g @anthropic-ai/claude-code"
  },
  codex: {
    name: "codex",
    displayName: "Codex CLI",
    loginCommand: ["codex", "auth"],
    statusCommand: ["codex", "--version"], // Simpler check
    installHint: "npm install -g @openai/codex"
  },
  gemini: {
    name: "gemini",
    displayName: "Gemini CLI",
    loginCommand: ["gemini", "auth", "login"],
    statusCommand: ["gemini", "--version"], // Simpler check
    installHint: "npm install -g @anthropic-ai/claude-code" // Gemini may need different setup
  }
};

export type ToolStatus = "ready" | "not_authenticated" | "not_installed" | "unknown";

export interface ToolStatusResult {
  tool: CLITool;
  status: ToolStatus;
  message?: string;
}

/**
 * Check if a CLI tool is installed and authenticated
 * @returns ToolStatusResult with current status
 */
export async function checkToolStatus(tool: CLITool): Promise<ToolStatusResult> {
  const spec = CLI_TOOLS[tool];
  if (!spec) {
    return {
      tool,
      status: "unknown",
      message: `Unknown tool: ${tool}`
    };
  }

  // Dynamic import to avoid circular dependency
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execPromise = promisify(exec);

  try {
    // Try to run the status command (--version)
    const { stdout } = await execPromise(spec.statusCommand.join(" "), {
      timeout: 10000, // Increased timeout
      maxBuffer: 1024 * 1024
    });

    // If we got output and exit code is 0, tool is ready
    if (stdout && stdout.trim().length > 0) {
      return {
        tool,
        status: "ready",
        message: stdout.trim().split('\n')[0] // First line of version output
      };
    }

    return {
      tool,
      status: "ready",
      message: "Installed"
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string }).code;

    // Check if command not found (tool not installed)
    if (
      errorMessage.includes("not found") ||
      errorMessage.includes("is not recognized") ||
      errorMessage.includes("ENOENT") ||
      errorCode === "ENOENT"
    ) {
      return {
        tool,
        status: "not_installed",
        message: spec.installHint || `Install ${spec.displayName}`
      };
    }

    // Timeout or other errors - still might be installed
    if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
      return {
        tool,
        status: "not_authenticated",
        message: "Check timed out - CLI may need login"
      };
    }

    // Non-zero exit code = not authenticated or other issue
    return {
      tool,
      status: "not_authenticated",
      message: "Not authenticated - run Login"
    };
  }
}

/**
 * Get all CLI tools status
 */
export async function getAllToolsStatus(): Promise<ToolStatusResult[]> {
  const tools: CLITool[] = ["claude", "codex", "gemini"];
  return Promise.all(tools.map(tool => checkToolStatus(tool)));
}
