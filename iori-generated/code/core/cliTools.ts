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
    statusCommand: ["claude", "whoami"],
    installHint: "npm install -g @anthropics/claude-code"
  },
  codex: {
    name: "codex",
    displayName: "Codex",
    loginCommand: ["codex", "auth"],
    statusCommand: ["codex", "auth", "status"],
    installHint: "npm install -g @openai/codex-cli"
  },
  gemini: {
    name: "gemini",
    displayName: "Gemini CLI",
    loginCommand: ["gemini", "auth", "login"],
    statusCommand: ["gemini", "auth", "status"],
    installHint: "npm install -g @google/gemini-cli"
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
    // Try to run the status command
    await execPromise(spec.statusCommand.join(" "), {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });

    // If exit code is 0, tool is ready
    return {
      tool,
      status: "ready",
      message: "Authenticated"
    };
  } catch (error: any) {
    // Check if command not found (tool not installed)
    if (error.message && (
      error.message.includes("not found") ||
      error.message.includes("is not recognized") ||
      error.code === "ENOENT"
    )) {
      return {
        tool,
        status: "not_installed",
        message: spec.installHint || `Install ${spec.displayName}`
      };
    }

    // Non-zero exit code = not authenticated
    return {
      tool,
      status: "not_authenticated",
      message: "Not authenticated"
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
