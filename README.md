# Iori v3.0 - Autonomous AI Development OS

**Iori** is a complete autonomous development system powered by multi-brain AI architecture. It tracks progress via Definition of Done (DoD), creates versioned snapshots, and safely executes cloud operations with comprehensive safety features.

---

## Features

### Progress Tracking
- **DoD Parser**: Parses `DOD.md` to calculate completion percentage across multiple sections
- **Mock Snapshots**: Git-based versioning system with metadata tracking
- **Automatic Snapshots**: Creates snapshots when DoD progress increases by 20%+

### Safety System
- **Confirmation Prompts**: Destructive operations (deployments, git sync) require explicit user approval
- **Safe Mode**: Blocks all destructive operations when enabled (default: ON)
- **Rate Limiting**: Prevents abuse with configurable limits per endpoint
  - Cloud operations: 10/minute
  - API calls: 100/minute
  - Safety confirmations: 20/minute

### Cloud Actions
Allowlist-based integrations with:
- **Git**: Status, branch creation, commits (evolve/* branches only)
- **GitHub**: Authentication, status checking
- **Vercel**: Production deployments, authentication
- **Firebase**: Firestore/Functions deployment, project management

### Apple-Style Dashboard
- Real-time system monitoring (CPU, memory, uptime)
- DoD progress visualization
- Mock snapshot gallery
- Interactive Neural Console

---

## Installation

```bash
# Install dependencies
npm install

# Setup .env file
cp .env.example .env

# Edit .env with your API keys
# GOOGLE_API_KEY=your-gemini-key
# ANTHROPIC_API_KEY=your-claude-key
```

---

## Quick Start

### Start Dashboard Server
```bash
npm run dashboard
```

Dashboard runs at `http://localhost:3000`

### Run Tests
```bash
# All tests
npm test

# Type checking
npm run typecheck

# Test coverage
npm test -- --coverage
```

---

## Project Structure

```
src/
├── core/               # Core systems
│   ├── brain.ts        # Multi-AI orchestration
│   ├── kernel.ts       # Iori Kernel v2.0
│   ├── safety.ts       # Confirmation prompts & Safe Mode
│   ├── rateLimit.ts    # Rate limiting system
│   ├── cloudActions.ts # Cloud service integrations
│   └── cliTools.ts     # CLI tool management
├── frontend/           # Dashboard server
│   ├── server.ts       # Express API server
│   └── public/         # HTML/CSS/JS assets
├── utils/              # Utilities
│   ├── dodParser.ts    # DOD.md parser
│   ├── snapshotManager.ts  # Mock snapshot system
│   └── weather.ts      # Weather API tool
└── __tests__/          # Unit tests (129 total)
```

---

## API Endpoints

### Progress & Status

#### `GET /api/progress`
Get DoD progress with section breakdown
```json
{
  "overall": { "percentage": 55, "completed": 11, "total": 20 },
  "sections": {
    "Spec": { "percentage": 75, "completed": 3, "total": 4 },
    "Functionality": { "percentage": 80, "completed": 4, "total": 5 }
  },
  "recommendedWorkUnit": "WU-05: Add tests and improve coverage"
}
```

#### `GET /api/status`
System status (CPU, memory, uptime)

### Mock Snapshots

#### `POST /api/snapshot/create`
Create a new snapshot
```json
{
  "label": "Authentication Complete",
  "newFeatures": ["OAuth login", "JWT tokens"],
  "knownIssues": ["Rate limiting needed"]
}
```

#### `GET /api/snapshot/list`
List all snapshots sorted by creation date

#### `GET /api/snapshot/:id`
Get specific snapshot by ID

### Cloud Actions

#### `POST /api/cloud/action`
Execute cloud operation (requires confirmation for destructive actions)
```json
{
  "service": "vercel",
  "action": "deployProd",
  "confirmationId": "op-1234567890-abc123" // Optional, from pending operation
}
```

**Response (if confirmation needed):**
```json
{
  "requiresConfirmation": true,
  "pendingId": "op-1234567890-abc123",
  "message": "This operation requires user confirmation."
}
```

### Safety System

#### `GET /api/safety/pending`
Get all pending operations awaiting confirmation

#### `POST /api/safety/confirm/:id`
Confirm a pending operation
```json
{
  "success": true,
  "operation": { "service": "vercel", "action": "deployProd" },
  "message": "Operation confirmed. You may now execute it."
}
```

#### `POST /api/safety/cancel/:id`
Cancel a pending operation

#### `GET /api/safety/mode`
Get Safe Mode configuration

#### `PUT /api/safety/mode`
Update Safe Mode settings
```json
{
  "enabled": false,
  "blockDestructive": true,
  "allowedServices": ["git", "gh", "vercel", "firebase"]
}
```

---

## Safety Features

### Confirmation Workflow

1. **Attempt Destructive Operation**
   ```bash
   POST /api/cloud/action
   { "service": "vercel", "action": "deployProd" }
   ```

2. **Receive Pending ID**
   ```json
   {
     "requiresConfirmation": true,
     "pendingId": "op-1234567890-abc123",
     "error": "This operation requires user confirmation."
   }
   ```

3. **Confirm Operation**
   ```bash
   POST /api/safety/confirm/op-1234567890-abc123
   ```

4. **Execute with Confirmation ID**
   ```bash
   POST /api/cloud/action
   {
     "service": "vercel",
     "action": "deployProd",
     "confirmationId": "op-1234567890-abc123"
   }
   ```

### Risk Levels

- **Safe**: Read-only operations (status, whoami, list)
- **Caution**: Git operations (syncMain creates evolve/* branch, commits, pushes)
- **Destructive**: Production deployments (vercel/firebase deploy)

### Safe Mode

When enabled (default):
- Blocks all **destructive** operations completely
- Allows **safe** and **caution** operations with confirmation
- Prevents accidental production deployments

---

## Development Guidelines

### TDD Workflow

This project follows strict Test-Driven Development:

1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Improve without changing behavior

**Quality Requirements:**
- TypeScript strict mode
- Test coverage ≥80%
- Files ≤300 lines
- No `any` types
- JSDoc comments on public methods

See `CLAUDE.md` for detailed guidelines.

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- dodParser.test.ts

# Run with coverage
npm test -- --coverage

# Type checking
npm run typecheck
```

**Test Files:**
- `hello.test.ts` (4 tests) - Basic functionality
- `dodParser.test.ts` (14 tests) - DoD parsing
- `cloudActions.test.ts` (40 tests) - Cloud command building
- `snapshotManager.test.ts` (14 tests) - Snapshot system
- `safety.test.ts` (36 tests) - Safety & confirmation system
- `rateLimit.test.ts` (21 tests) - Rate limiting

**Total: 129 tests passing**

---

## Architecture

### Multi-Brain System

Iori coordinates three AI models for optimal task execution:

1. **Gemini** (Google): Analysis, planning, research
2. **Claude** (Anthropic): Design, implementation, code generation
3. **Codex** (OpenAI): File operations, final verification

### State Machine (Planned)

7 states for autonomous operation:
- Idle → Planning → Building → Verifying → Snapshotting → Blocked → Error

### Safety Philosophy

> **"main is the last refuge"** - Main branch is sacred

- AI can only push to `evolve/*` branches
- All merges to main require human review
- Destructive operations require explicit confirmation
- Safe Mode enabled by default

---

## Troubleshooting

### Firebase/GitHub/Vercel Authentication Fails

**Problem**: Login commands don't open browser

**Solution**: The authentication fix in `server.ts` (lines 297-320) uses `spawn()` with `stdio: 'inherit'` for interactive browser-based auth.

If still failing:
1. Check CLI tool is installed (`gh --version`, `vercel --version`, `firebase --version`)
2. Try manual login: `gh auth login --web`
3. Check logs in `iori_system.log`

### Rate Limit Exceeded

**Error**: `429 Too Many Requests`

**Solution**:
- Wait for rate limit window to reset (shown in `retryAfter` seconds)
- Or reset manually: `DELETE /api/safety/reset` (if implemented)
- Or disable in Safe Mode settings

### Safe Mode Blocking Operations

**Problem**: All deployments blocked

**Solution**:
1. Check Safe Mode status: `GET /api/safety/mode`
2. Disable if needed: `PUT /api/safety/mode { "enabled": false }`
3. Or disable only destructive blocking: `{ "blockDestructive": false }`

---

## Logs

System events are logged to `iori_system.log` in the project root.

View logs:
```bash
# Real-time
tail -f iori_system.log

# Via API
GET http://localhost:3000/api/logs
```

---

## Contributing

See `CLAUDE.md` for development rules and agent personas:
- @kernel - Logic & type safety
- @shell - System operations
- @ui - Frontend & Apple-style design
- @qa - Testing & quality
- @sentinel - Security reviews
- @ghost - Refactoring

---

## License

MIT

---

## Version History

### v3.0.0 (Current)
- ✅ Safety system (confirmation prompts, Safe Mode, rate limiting)
- ✅ Mock Snapshot system
- ✅ DoD progress tracking
- ✅ Cloud actions (git, gh, vercel, firebase)
- ✅ 129 unit tests passing
- ✅ 0 type errors

### v2.0.0
- Multi-brain architecture
- Iori Kernel v2.0
- Apple-style dashboard

### v1.0.0
- Initial TDD project structure

---

**End of README**
