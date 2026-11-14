# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- ConfigError messages come only from code + safe location (free-form message arg removed; F2 / #38).
- Reset repository to Node.js + TypeScript scaffold (Python/uv toolchain removed; see #33).
- CI Inspector smoke (N-CI-03) is mandatory and passes config via Inspector `-e` (#49).

### Added

- MCP stdio server entrypoint: load configuration, then `McpServer` + `serveStdio`; config failure and D5 internal-error gates (#49).
- `loadConfiguration` facade composing path → read → YAML → schema → endpoints (#47).
- Initial project scaffold: uv + ruff + ty + pytest, layered package layout
