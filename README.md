# Iori v4.0 - Autonomous AI Development OS

Electron ベースの並列自律開発システム。Claude, Gemini, Codex を統合し、Trinity Meeting による協調開発を実現します。

## Features

- **Trinity Meeting**: Claude, Gemini, Codex の3つのAIを並列実行
- **VSCode-style Architecture**: Electron + IPC による堅牢なプロセス分離
- **DoD Tracking**: Definition of Done ベースの進捗管理
- **Git Integration**: GitHub CLI (gh) との連携
- **Real-time Logging**: セッションログの永続化と検索

## Requirements

- Node.js 18+
- npm 9+
- Claude CLI (`npm install -g @anthropic-ai/claude-code`)
- Gemini CLI (`npm install -g @google/gemini-cli`)
- Codex CLI (`npm install -g @openai/codex`)

## Installation

```bash
# Clone repository
git clone https://github.com/your-org/iori.git
cd iori

# Install dependencies
npm install

# Build
npm run build
npm run build:electron
```

## Usage

### Electron App (推奨)

```bash
# Production
npm run electron

# Development (with hot reload)
npm run electron:dev
```

### CLI Runner

```bash
# Start autonomous development
npm run runner:start

# Dashboard
npm run dashboard
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Iori v4.0                      │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │           Electron Main Process          │   │
│  │  ┌───────────────────────────────────┐  │   │
│  │  │         IPC Handlers               │  │   │
│  │  │  • cli:*   (CLIBridge)            │  │   │
│  │  │  • state:* (StateManager)         │  │   │
│  │  │  • log:*   (LogManager)           │  │   │
│  │  │  • dod:*   (DoDManager)           │  │   │
│  │  │  • git:*   (GitManager)           │  │   │
│  │  │  • worker:*(WorkerPool)           │  │   │
│  │  └───────────────────────────────────┘  │   │
│  └─────────────────────────────────────────┘   │
│                      │                          │
│               contextBridge                     │
│                      │                          │
│  ┌─────────────────────────────────────────┐   │
│  │           Renderer Process              │   │
│  │           (Dashboard UI)                 │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run electron` | Start Electron app |
| `npm run electron:dev` | Development mode |
| `npm run build` | Build TypeScript |
| `npm run build:electron` | Build Electron modules |
| `npm test` | Run tests (Vitest) |
| `npm run typecheck` | Type checking |
| `npm run dashboard` | Start web dashboard |

## Project Structure

```
iori/
├── electron/           # Electron main process
│   ├── main.ts         # Entry point
│   ├── preload.ts      # contextBridge API
│   ├── cli-bridge.ts   # AI CLI communication
│   ├── state-manager.ts# Project state
│   ├── log-manager.ts  # Logging system
│   ├── dod-manager.ts  # DoD tracking
│   ├── git-manager.ts  # Git operations
│   └── worker-pool.ts  # Parallel workers
├── src/
│   ├── core/           # Kernel, Brain, Shell
│   ├── frontend/       # Dashboard server
│   ├── cli/            # CLI runner
│   └── __tests__/      # Test files
├── .iori/              # Runtime data
│   ├── project.json    # Project state
│   └── logs/           # Session logs
├── DOD.md              # Definition of Done
├── CLAUDE.md           # Development guidelines
└── REQUIREMENTS_ELECTRON.md  # v4.0 specifications
```

## Trinity Meeting

3つのAIを並列実行して最適な結果を得る機能です。

```typescript
// Example usage via IPC
const result = await window.iori.worker.trinity('Implement user auth');
console.log(result.workers.claude.output);
console.log(result.workers.gemini.output);
console.log(result.workers.codex.output);
```

## Development

### TDD Workflow

1. **RED**: Write failing test
2. **GREEN**: Implement minimum code
3. **REFACTOR**: Clean up

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Type check
npm run typecheck
```

### Sub-Agents

| Agent | Role |
|-------|------|
| @kernel | Logic & Brain |
| @shell | System & IO |
| @ui | Frontend & Design |
| @qa | Quality Assurance |
| @strategist | Product Manager |
| @sentinel | Security |
| @ghost | Refactor & Optimize |
| @scribe | Documentation |

See `CLAUDE.md` for detailed guidelines.

## License

MIT
