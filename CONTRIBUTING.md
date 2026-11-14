# Contributing to xq-jewy

Node.js + TypeScript MCP server. Keep the surface small: config load → stdio MCP server → tools later.

## Design principle

Fewest moving parts that satisfy the requirement. No layers "for later".

## Toolchain

| Tool | Role |
|---|---|
| **npm** | Install and scripts (`npm ci`, `npm run …`) |
| **TypeScript (`tsc`)** | Build (`npm run build`) and typecheck (`npm run typecheck`) |
| **oxlint** | Lint with `--type-aware` (`npm run lint`) |
| **Prettier** | Format (`npm run format` / `format:check`) |
| **Vitest** | Tests in three projects: `unit`, `integration`, `system` |

Quality gate before commit:

```bash
npm run ci
```

That runs build, typecheck, lint, format check, and the full test suite.

## Layout (current)

| Path | Job |
|---|---|
| `src/index.ts` | Process entry: load config, start stdio MCP, failure gates |
| `src/server.ts` | `McpServer` + `serveStdio` wiring |
| `src/config/` | Path → read → YAML → schema → endpoints (`loadConfiguration`) |
| `test/unit/` | Pure unit tests |
| `test/integration/` | Loader / wiring against real fixtures |
| `test/system/` | Process + MCP stdio contracts (N-\* IDs) |
| `docs/config/` | Consumer mcp.json + YAML examples |
| `config.example.yaml` | Canonical full-capability YAML sample |

## Configuration

Canonical schema is `capabilities` / `enabled_tags` (see `config.example.yaml` and `docs/config/`). Legacy `tags` / `server` YAML is **rejected**.

### Env vars (exact names)

| Variable | Role |
|---|---|
| `XQ_JEWY_CONFIG` | **Required.** Absolute path to the YAML file. No default, no CWD-relative lookup, no `~` / `$VAR` expansion. |
| `XQ_JEWY_API_BASE_URL` | Required when the union of enabled capabilities needs the API. |
| `XQ_JEWY_WIREMOCK_BASE_URL` | Required when the union needs WireMock. |

MCP hosts give unpredictable working directories, so relative paths are refused. Put env in `mcp.json` `env` (see `docs/config/mcp.*.json`).

### Capability → tag → endpoint

| Capability | Tag | Endpoint(s) |
|---|---|---|
| `stubs` | `stub` | WireMock |
| `rest` | `rest` | API |
| `assertions` | `verification` | API + WireMock |
| `reporting` | `reporting` | none |

Required URL env vars are the **union** over enabled capabilities. Omit unused URL vars — a set URL is validated even when not needed.

### YAML rules

- YAML holds **no URLs and no secrets**.
- `enabled_tags` must be non-empty and covered by enabled capabilities.
- Validate before building the server.

### First-error order

path → file/parse → schema/tag coverage → required-set derivation → API →
WireMock → aggregate invariant → server construction and run.

## Testing

- `test/unit/` — config path/schema/errors and pure helpers.
- `test/integration/` — `loadConfiguration` against fixtures under `docs/config/`.
- `test/system/` — spawn built `dist/index.js`, MCP initialize / failure gates / docs contracts.

Run one project:

```bash
npm run test:unit
npm run test:integration
npm run test:system
```

System tests require a prior `npm run build` so `dist/index.js` exists.

## Issue / QA pairing (done rule)

Dev issues (J\*) pair with QA issues (QJ\*). An implementation issue closes only when its paired QJ\* test IDs pass on **both Node 24 and Node 26**, with Test Architect–reviewed evidence: commit SHA, `node -v`, a JUnit or JSON report naming each N-\* ID, CI run URL, coverage artifact, and Inspector output where applicable. A skipped test is not a pass.

## What NOT to do

- Do not print to stdout — stdout is the MCP transport. Log to stderr only.
- Do not put URLs or secrets in YAML.
- Do not rely on CWD or relative `XQ_JEWY_CONFIG` paths.
- Do not document removed legacy toolchains or invent a second install path beside npm.
