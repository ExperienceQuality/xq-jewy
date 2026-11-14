# Squad Memory

This file holds canonical, human-readable knowledge for the repository. Update it during memory maintenance when durable conventions, architecture, or decisions are discovered.

## Repository map

* Node.js + TypeScript config/MCP scaffold. Config modules under `src/config/` (`path`, `read`, `yaml`, `schema`, `endpoints`, `errors`); facade in `index.ts` owns `loadConfiguration` and `createStartupConfiguration`.
* Process entrypoint: `src/index.ts` (bootstrap + error gates) and `src/server.ts` (`startServer` → `McpServer` + `serveStdio`).
* QA IDs live under `test/unit/`, `test/integration/`, and `test/system/` (e.g. N-UNIT-01/08/10, N-INT-02, N-ACC-09, N-SYS-02/03/05/06, N-CI-03/07).

## Conventions

* `ConfigError` is constructed as `new ConfigError(code, location)` only. Do not pass a free-form message; `Error.message` is always produced by `defaultMessage(code, location)`.
* Stderr rendering for config failures uses `formatConfigErrorLine` (`code` + safe location).
* Aggregate startup invariant failures from `createStartupConfiguration` throw `TypeError`, never `ConfigError`.
* Process startup gates: `ConfigError` → one `formatConfigErrorLine` stderr line + exit 1; any other failure (D5) → fixed `xq-jewy: internal error` + exit 1 (empty stdout).
* `XQ_JEWY_TEST_INJECT_REJECTION=1` is a test-only D5 hook (N-SYS-06), not a product feature.

## Architecture

* Approved config error surface: fixed `CONFIG_ERROR_CODES` (15 codes) and location kinds `env` | `path` | `line`. Message text must not carry secrets or raw URLs beyond what the typed location intentionally exposes (paths may appear; env *values* must not).
* `loadConfiguration` first-error order: path → file/parse → schema → union → API → WireMock → aggregate. Import-time pure until the facade runs.
* Successful startup order: `loadConfiguration` then `startServer` / `serveStdio`. `server.ts` stays import-time pure until `startServer` runs. Empty tools capability / empty `tools/list` is valid.

## Testing strategy

* N-UNIT-01 (path resolution), N-UNIT-08 (ConfigError shape/redaction), and N-ACC-09 (single-line stderr) are hardened with **value-fed** redaction: feed secret-like strings through real failure APIs (`resolveConfigPath`, etc.), then assert both `message` and `formatConfigErrorLine` omit those values. Prefer this over constructing `ConfigError` alone when covering secrecy.
* N-INT-02 covers adjacent first-error pairs via `loadConfiguration`; N-UNIT-10 asserts aggregate `TypeError` (not `ConfigError`); N-UNIT-06 redacts secrets through the facade.
* N-CI-03 Inspector smoke is ungated: pass absolute config via Inspector `-e XQ_JEWY_CONFIG=...`; empty `tools/list` is OK.

## Lessons

* F2 (`f2/error-path-hardening`, merged as #57 / `381dccf`) removed the free-form ConfigError message arg and landed on main before #47. Delivery records: `.squad/memory/deliveries/f2-error-path-hardening.ndjson`.
* #47 (`j1-t8/load-configuration`) owns the `loadConfiguration` facade and aggregate `TypeError` boundary. Delivery records: `.squad/memory/deliveries/j1-t8-load-configuration.ndjson`.
* #49 (`j1-t9/server-entrypoint`) owns MCP stdio entrypoint, ConfigError/D5 process gates, and ungated N-CI-03. Delivery records: `.squad/memory/deliveries/j1-t9-server-entrypoint.ndjson`.
* F1 PR #56 (`f1/ci-test-evidence`) was rebased onto main+F2 and force-pushed; its shared `lessons.ndjson` / `delivery-events.ndjson` are not on main until #56 merges.
