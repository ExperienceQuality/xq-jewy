# ADR-0001: Node.js + TypeScript stack

- Status: Accepted (amended 2026-11-14)
- Date: 2026-11-13

## Context

xq-jewy is an MCP server for XQ backend-testing tools. The previous Python/FastMCP stack is superseded. The runtime must support MCP Inspector engine floors, a lockfile-reproducible npm install, and a small TypeScript-first toolchain that emits ESM + declarations without relying on Node type-stripping.

## Decision

- **Runtime:** Node.js `engines.node` `>=24.22.1`; team default `.nvmrc` is `26`. Package manager is npm with a committed lockfile (`npm ci`).
- **Language / emit:** TypeScript 7 (`tsc` only). Package `"type": "module"`; `module` / `moduleResolution` `nodenext`; strict options including `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and `exactOptionalPropertyTypes`. Emit JS, `.d.ts`, and source maps to `dist/`.
- **Lint / format:** oxlint + oxlint-tsgolint (`--type-aware`) + Prettier. No ESLint.
- **Tests:** Vitest 5 with projects `unit`, `integration`, and `system`. Coverage via `@vitest/coverage-v8` is report-only (no percentage thresholds) and scoped to unit+integration; `autoAttachSubprocess` is false.
- **Validation / YAML:** Zod 4 and eemeli `yaml` 2.x (Feature 1).
- **CI matrix (original):** Node `24.x` and `26.x` on `ubuntu-latest`, `fail-fast: false`, both legs always report.

### Amendment 2026-11-14 — 4-leg matrix

Keep exact pins **and** floating majors so CI proves both the Inspector floors and current line heads:

| Leg | Purpose |
|-----|---------|
| `24.22.1` | Exact Node 24 floor (Inspector) |
| `24.x` | Current Node 24 line |
| `26.12.1` | Exact Node 26 floor (Inspector) |
| `26.x` | Current Node 26 line |

`fail-fast` remains `false`. This amends the original ADR matrix of `24.x` / `26.x` only.

## Consequences

- Python artefacts (uv/ruff/ty/pytest layout) are removed; Node scripts are the gate (`npm run ci`).
- `@types/node` tracks the engines floor (`^24`).
- Inspector smoke (N-CI-03) stays gated until a real MCP stdio server exists (J1-T9).
- Machine-readable per-leg JUnit reports are required for TA evidence of named `N-*` checks.
