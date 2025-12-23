# Changelog

All notable changes to Iori will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2025-12-23

### Added
- **Electron Architecture**: VSCode-style main/renderer process separation
- **CLI Bridge**: Direct communication with Claude, Gemini, Codex CLIs via child_process
- **State Manager**: Persistent project state in `.iori/project.json`
- **Log Manager**: Session logging with JSON Lines format in `.iori/logs/`
- **DoD Manager**: Definition of Done tracking with auto-reload
- **Git Manager**: Git/GitHub CLI integration for version control
- **Worker Pool**: Parallel AI agent execution with event-driven lifecycle
- **Trinity Meeting**: Simultaneous execution of all three AI providers
- **IPC Handlers**: Full API for cli, state, log, dod, git, worker operations
- **Preload API**: Secure contextBridge exposure of window.iori API
- **37 new tests**: Comprehensive testing for Electron modules

### Changed
- Architecture migrated from subprocess-based to Electron main process
- CLI communication now uses child_process.spawn instead of node-pty
- Project structure reorganized with electron/ directory

### Fixed
- Claude CLI subprocess restriction bypassed via Electron architecture
- Process zombie prevention with proper cleanup

## [3.0.0] - 2025-12-22

### Added
- Quality improvements and UI refresh
- Sub-agent system (@kernel, @shell, @ui, @qa, @strategist, @sentinel, @ghost, @scribe)
- Apple-style UI guidelines
- TDD workflow enforcement

## [2.0.0] - 2025-12-21

### Added
- Autonomous AI Development System
- Three-brain architecture (Gemini/Claude/Codex)
- TODO.md-based autonomous task execution
- System logging (iori_system.log)
- Self-healing error recovery
- Weather API utility
- System info tool
- Multi-AI control engine (brain.ts)

## [1.0.0] - 2025-12-20

### Added
- Initial TDD TypeScript project setup
- Basic API endpoints
- Vitest testing framework
- Express server
