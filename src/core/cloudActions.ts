/**
 * Iori v3.1 Cloud Actions
 * Allowlist-based cloud service integrations
 *
 * @security CRITICAL SAFETY RULES:
 * ✅ Iori CAN do:
 *   - Create branches (git checkout -b evolve/*)
 *   - Add, commit, push to evolve/* branches
 *   - Deploy to Vercel/Firebase (non-destructive)
 *   - Check status, whoami
 *
 * ❌ Iori MUST NEVER do:
 *   - Push to main branch (git push origin main)
 *   - Force push (git push --force)
 *   - Hard reset (git reset --hard)
 *   - Delete branches (git branch -D)
 *   - Destructive operations on production
 *
 * 👤 ONLY HUMANS can:
 *   - Merge to main (after review)
 *   - Delete branches (local and remote)
 *   - Force operations
 *
 * @philosophy "main is the last refuge" - main branch is sacred
 */

export type CloudService = "git" | "vercel" | "firebase";

export type CloudAction =
  | { service: "git"; action: "status" }
  | { service: "git"; action: "syncMain" }
  | { service: "gh"; action: "login" }
  | { service: "gh"; action: "status" }
  | { service: "vercel"; action: "deployProd" }
  | { service: "vercel"; action: "whoami" }
  | { service: "vercel"; action: "login" }
  | { service: "firebase"; action: "deployFirestore" }
  | { service: "firebase"; action: "deployFunctions" }
  | { service: "firebase"; action: "projectsList" }
  | { service: "firebase"; action: "login" };

export interface CommandSpec {
  cmd: string;
  args: string[];
  description: string;
}

/**
 * Convert CloudAction to shell command specification
 * @security All commands are hardcoded - no user input interpolation
 */
export function buildCommand(action: CloudAction): CommandSpec {
  switch (action.service) {
    case "git":
      switch (action.action) {
        case "status":
          return {
            cmd: "git",
            args: ["status", "--porcelain=v1"],
            description: "Check git status"
          };
        case "syncMain":
          // For Windows compatibility, we'll execute commands sequentially
          // This will be handled by the caller
          return {
            cmd: "git",
            args: ["add", "."],
            description: "Git sync: add, commit, push"
          };
        default:
          throw new Error(`Unknown git action: ${(action as any).action}`);
      }

    case "gh":
      switch (action.action) {
        case "login":
          return {
            cmd: "gh",
            args: ["auth", "login", "--web"],
            description: "Login to GitHub via browser"
          };
        case "status":
          return {
            cmd: "gh",
            args: ["auth", "status"],
            description: "Check GitHub auth status"
          };
        default:
          throw new Error(`Unknown gh action: ${(action as any).action}`);
      }

    case "vercel":
      switch (action.action) {
        case "deployProd":
          return {
            cmd: "vercel",
            args: ["--prod", "--yes"],
            description: "Deploy to Vercel production"
          };
        case "whoami":
          return {
            cmd: "vercel",
            args: ["whoami"],
            description: "Check Vercel authentication"
          };
        case "login":
          return {
            cmd: "vercel",
            args: ["login"],
            description: "Login to Vercel via browser"
          };
        default:
          throw new Error(`Unknown vercel action: ${(action as any).action}`);
      }

    case "firebase":
      switch (action.action) {
        case "deployFirestore":
          return {
            cmd: "firebase",
            args: ["deploy", "--only", "firestore"],
            description: "Deploy Firestore rules and indexes"
          };
        case "deployFunctions":
          return {
            cmd: "firebase",
            args: ["deploy", "--only", "functions"],
            description: "Deploy Firebase Cloud Functions"
          };
        case "projectsList":
          return {
            cmd: "firebase",
            args: ["projects:list"],
            description: "List Firebase projects"
          };
        case "login":
          return {
            cmd: "firebase",
            args: ["login"],
            description: "Login to Firebase via browser"
          };
        default:
          throw new Error(`Unknown firebase action: ${(action as any).action}`);
      }

    default:
      throw new Error(`Unknown service: ${(action as any).service}`);
  }
}

/**
 * Get sequential commands for git sync (Windows-safe)
 * SAFE WORKFLOW: Creates branch instead of pushing to main
 * Returns multiple commands to be executed in order
 */
export function getGitSyncCommands(): CommandSpec[] {
  const timestamp = Date.now();
  const branchName = `evolve/run-${timestamp}`;
  const commitMessage = `evolve: Iori autonomous update at ${new Date().toISOString()}`;

  return [
    {
      cmd: "git",
      args: ["checkout", "-b", branchName],
      description: "Create evolve branch (safe - main untouched)"
    },
    {
      cmd: "git",
      args: ["add", "."],
      description: "Stage all changes"
    },
    {
      cmd: "git",
      args: ["commit", "-m", commitMessage],
      description: "Commit changes"
    },
    {
      cmd: "git",
      args: ["push", "origin", branchName],
      description: `Push to branch ${branchName} (NOT main)`
    }
  ];
}

/**
 * Validate that an action is allowed
 */
export function isActionAllowed(service: string, action: string): boolean {
  const allowedActions: Record<string, string[]> = {
    git: ["status", "syncMain"],
    gh: ["login", "status"],
    vercel: ["deployProd", "whoami", "login"],
    firebase: ["deployFirestore", "deployFunctions", "projectsList", "login"]
  };

  return allowedActions[service]?.includes(action) ?? false;
}
