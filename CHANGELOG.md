# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Docs and examples for Node config setup: README, CONTRIBUTING, `docs/config/` mcp.json launches use `node` + `dist/index.js` (no `uvx` / Python leftovers; #51).
- ConfigError messages come only from code + safe location (free-form message arg removed; F2 / #38).
- Reset repository to Node.js + TypeScript scaffold (Python/uv toolchain removed; see #33).
- CI Inspector smoke (N-CI-03) is mandatory and passes config via Inspector `-e` (#49).

### Added

- Node.js + TypeScript scaffold: TypeScript 7, Vitest 5 (unit/integration/system), oxlint + Prettier, Node engines `>=24.22.1`.
- F1 CI test-evidence: 4-leg Node matrix (24.22.1, 24.x, 26.12.1, 26.x), per-leg JUnit artifacts, named N-CI-06/N-CI-08 checks, stronger N-CI-01 unit fs guard.
- MCP stdio server entrypoint: load configuration, then `McpServer` + `serveStdio`; config failure and D5 internal-error gates (#49).
- `loadConfiguration` facade composing path → read → YAML → schema → endpoints (#47).
