# Squad Memory

This file holds canonical, human-readable knowledge for the repository. Update it during memory maintenance when durable conventions, architecture, or decisions are discovered.

## Repository map

* Node.js + TypeScript config/MCP scaffold. Config modules under `src/config/` (`path`, `read`, `yaml`, `schema`, `endpoints`, `errors`); facade in `index.ts` owns `loadConfiguration` and `createStartupConfiguration`.
* Process entrypoint: `src/index.ts` (bootstrap + error gates) and `src/server.ts` (`startServer` → `McpServer` + `serveStdio`).
* QA IDs live under `test/unit/`, `test/integration/`, and `test/system/` (e.g. N-UNIT-01/08/10, N-INT-02, N-ACC-09, N-SYS-02/03/05/06/07, N-CI-01/03/06/07/08).
* Consumer examples: four single-mode mcp.json + YAML pairs under `docs/config/` (`stubs-only`, `rest-only`, `assertions-only`, `reporting-only`).
* `.github/workflows/ci.yml` — 4-leg Node matrix + JUnit/coverage artifacts + ungated N-CI-03.
* `docs/adr/` — Architecture Decision Records (start with ADR-0001).
* `.squad/` — XQ Squad contracts, workflows, and durable memory (this file + `memory/*.ndjson`).

## Conventions

* **Node:** `engines.node` `>=24.22.1`; team default `.nvmrc` is `26`. Install with `npm ci` (lockfile committed).
* **Toolchain:** TypeScript 7 (`tsc` only), `"type": "module"`, `nodenext`, strict TS flags per ADR-0001. Lint/format: oxlint (+ type-aware) with `--deny-warnings`, Prettier. No ESLint.
* **Types:** `@types/node` tracks the engines floor (`^24`).
* **Local gate:** `npm run ci` = build + typecheck + lint + format:check + test.
* **Gitignore:** ignore `.squad/worktrees/` (not a broader `.squad/` pattern that would hide claims/memory). Also ignore `artifacts/`, `coverage/`, `dist/`, `config.yaml`.
* `ConfigError` is constructed as `new ConfigError(code, location)` only. Do not pass a free-form message; `Error.message` is always produced by `defaultMessage(code, location)`.
* Stderr rendering for config failures uses `formatConfigErrorLine` (`code` + safe location).
* Aggregate startup invariant failures from `createStartupConfiguration` throw `TypeError`, never `ConfigError`.
* Process startup gates: `ConfigError` → one `formatConfigErrorLine` stderr line + exit 1; any other failure (D5) → fixed `xq-jewy: internal error` + exit 1 (empty stdout).
* `XQ_JEWY_TEST_INJECT_REJECTION=1` is a test-only D5 hook (N-SYS-06), not a product feature.
* Documented mcp.json launch is `command: node` with `args: [<absolute path to dist/index.js>]`. Owned docs must not use `uvx` / Python toolchain leftovers. `npx -y github:ExperienceQuality/xq-jewy` is residual risk / untested.

## Architecture

* Stack decision: `docs/adr/0001-node-typescript-stack.md` (Accepted; amended 2026-11-14 for 4-leg CI matrix).
* Validation/YAML: Zod 4 + eemeli `yaml` 2.x (Wave 2 / Feature 1).
* Previous Python/FastMCP layout is retired; Node scripts are the only gate.
* Approved config error surface: fixed `CONFIG_ERROR_CODES` (15 codes) and location kinds `env` | `path` | `line`. Message text must not carry secrets or raw URLs beyond what the typed location intentionally exposes (paths may appear; env *values* must not).
* `loadConfiguration` first-error order: path → file/parse → schema → union → API → WireMock → aggregate. Import-time pure until the facade runs.
* Successful startup order: `loadConfiguration` then `startServer` / `serveStdio`. `server.ts` stays import-time pure until `startServer` runs. Empty tools capability / empty `tools/list` is valid.

## Testing strategy

* Vitest 5 projects: `unit`, `integration`, `system`. Coverage (`@vitest/coverage-v8`) is report-only (no % thresholds), unit+integration only; `autoAttachSubprocess` is false.
* **CI matrix (F1):** `24.22.1`, `24.x`, `26.12.1`, `26.x` on `ubuntu-latest`, `fail-fast: false`. Exact pins prove Inspector floors; floating majors prove current line heads.
* **Test evidence:** each matrix leg uploads JUnit (`artifacts/junit-*.xml` → artifact `junit-node-<version>`) and coverage JSON. Named checks include N-CI-01 (unit fs guard), N-CI-06 (tree hygiene), N-CI-08 (coverage config).
* N-UNIT-01 (path resolution), N-UNIT-08 (ConfigError shape/redaction), and N-ACC-09 (single-line stderr) are hardened with **value-fed** redaction: feed secret-like strings through real failure APIs (`resolveConfigPath`, etc.), then assert both `message` and `formatConfigErrorLine` omit those values. Prefer this over constructing `ConfigError` alone when covering secrecy.
* N-INT-02 covers adjacent first-error pairs via `loadConfiguration`; N-UNIT-10 asserts aggregate `TypeError` (not `ConfigError`); N-UNIT-06 redacts secrets through the facade.
* N-CI-03 Inspector smoke is ungated: pass absolute config via Inspector `-e XQ_JEWY_CONFIG=...`; empty `tools/list` is OK.
* N-SYS-07 extracts `docs/config/` mcp.json + YAML pairs, starts each with only the listed env keys, and asserts owned docs contain no `uvx` / Python leftovers.

## Lessons

* Prefer exact Node pins **and** floating majors in CI when both floor compliance and current-line freshness matter.
* Keep machine-readable JUnit per leg so TA can map named `N-*` checks without re-running locally.
* Do not gitignore all of `.squad/`; concurrent delivery needs `.squad/worktrees/` ignored while claims/memory stay visible.
* F2 (`f2/error-path-hardening`, merged as #57 / `381dccf`) removed the free-form ConfigError message arg and landed on main before #47. Delivery records: `.squad/memory/deliveries/f2-error-path-hardening.ndjson`.
* #47 (`j1-t8/load-configuration`) owns the `loadConfiguration` facade and aggregate `TypeError` boundary. Delivery records: `.squad/memory/deliveries/j1-t8-load-configuration.ndjson`.
* #49 (`j1-t9/server-entrypoint`) owns MCP stdio entrypoint, ConfigError/D5 process gates, and ungated N-CI-03. Delivery records: `.squad/memory/deliveries/j1-t9-server-entrypoint.ndjson`.
* #51 (`j1-t10/docs-node-config`) owns Node consumer docs: `node` + `dist/index.js` mcp.json form, four `docs/config/` pairs, N-SYS-07, no `uvx`. Delivery records: `.squad/memory/deliveries/j1-t10-docs-node-config.ndjson`.
* F1 (`f1/ci-test-evidence` / #56) owns 4-leg CI matrix, per-leg JUnit evidence, N-CI-06/08, stronger N-CI-01, ADR-0001, `@types/node` ^24, and lint `--deny-warnings`.
