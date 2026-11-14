# Squad Memory

This file holds canonical, human-readable knowledge for the repository. Update it during memory maintenance when durable conventions, architecture, or decisions are discovered.

## Repository map

* Node.js + TypeScript config/MCP scaffold. Config entry points under `src/config/` (`path`, `read`, `yaml`, `schema`, `endpoints`, `errors`).
* QA IDs live under `test/unit/` and `test/integration/` (e.g. N-UNIT-01/08, N-ACC-09).

## Conventions

* `ConfigError` is constructed as `new ConfigError(code, location)` only. Do not pass a free-form message; `Error.message` is always produced by `defaultMessage(code, location)`.
* Stderr rendering for config failures uses `formatConfigErrorLine` (`code` + safe location).

## Architecture

* Approved config error surface: fixed `CONFIG_ERROR_CODES` (15 codes) and location kinds `env` | `path` | `line`. Message text must not carry secrets or raw URLs beyond what the typed location intentionally exposes (paths may appear; env *values* must not).

## Testing strategy

* N-UNIT-01 (path resolution), N-UNIT-08 (ConfigError shape/redaction), and N-ACC-09 (single-line stderr) are hardened with **value-fed** redaction: feed secret-like strings through real failure APIs (`resolveConfigPath`, etc.), then assert both `message` and `formatConfigErrorLine` omit those values. Prefer this over constructing `ConfigError` alone when covering secrecy.

## Lessons

* F2 (`f2/error-path-hardening`, commit `afa9a1b`) removed the free-form ConfigError message arg and landed before #47 so #38 T3-scope can close after evidence. Structured records: `.squad/memory/lessons.ndjson`, `.squad/memory/delivery-events.ndjson`, `.squad/memory/deliveries/f2-error-path-hardening.ndjson`.
