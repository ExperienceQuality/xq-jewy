# XQ-Jewy Coding Guidelines

FastMCP server for backend testing tools. Small codebase — keep it that way.

## Design principle

Fewest moving parts that satisfy the requirement. No layers "for later".
A tool file + a config loader + a bootstrapper is the whole app until proven otherwise.

## Files and their jobs

| File | Job | Max size (guideline) |
|---|---|---|
| `server.py` | Read env, load config, build server, `mcp.run()` | ~15 lines |
| `configuration.py` | Load YAML, validate with Pydantic, return config | ~40 lines |
| `bootstrap.py` | Build FileSystemProviders + `mcp.enable()` tags | ~25 lines |
| `tools/<cap>/<file>.py` | `@tool` functions — validate input, call helper, return dict | thin |
| `services/*.py` | Plain functions doing the real work | as needed |
| `infrastructure/*.py` | External HTTP calls only | as needed |
| `domain/` | Pydantic models only when a shared shape exists | optional |

## Configuration

- `XQ_JEWY_CONFIG` env var is **required** and must be an **absolute path**.
  No default, no CWD-relative lookup — MCP servers inherit unpredictable
  working directories depending on the host (desktop app vs CLI vs agent).
- Missing or relative path → raise immediately with a clear message telling
  the consumer what to set.
- No secrets, tokens, or base URLs in YAML. Secrets come from env vars only.
- `enabled_tags` must be non-empty and covered by enabled capabilities.
  Validate before building anything.

## Tools

- Standalone `from fastmcp.tools import tool` decorator. Never `@mcp.tool`,
  never instantiate `FastMCP` inside tool modules.
- Every tool: type hints on all params, docstring describing the tool for the
  LLM (it reads the docstring to decide when to call), at least one capability
  tag (`stub`, `rest`, `verification`, `reporting`) plus qualifier tags.
- Tools stay thin: parse args, call a service function, return a plain dict.
  No business logic inside `@tool` functions.

## Imports and lifecycle

- Absolute imports only (`from xq_jewy.services.x import y`). FileSystemProvider
  may load files outside package context — relative imports break.
- No side effects at import time: no network calls, no file reads, no client
  construction at module top level. Discovery imports every tool file — it
  must be cheap.
- Expensive objects (HTTP clients): module-level `functools.lru_cache` getter
  is enough. No singleton classes, no globals-with-init-function ceremony.

  ```python
  @lru_cache
  def http_client() -> httpx.Client:
      return httpx.Client(timeout=30)
  ```

- Prefer plain functions over classes. Use a class only when you need to hold
  stateful resources (and even then, `lru_cache` + function usually wins).

## Adding a tool (checklist)

1. Create `tools/<capability>/<name>.py` with `@tool(tags={...})` functions.
2. Add the logic to `services/` as a plain function.
3. Add the capability's tags to the tag universe in `configuration.py` if new.
4. Done — provider discovery picks it up. No central registry edits.

## Adding a capability (checklist)

1. `mkdir src/xq_jewy/tools/<name>` + `__init__.py` + tool files.
2. Register its tags in `CAPABILITY_TAGS`.
3. Consumer enables it in their YAML.

## Testing

- `tests/unit/` — config validation, service logic (pure functions, easy).
- `tests/architecture/` — discovery, tag filtering, disabled-capability
  behavior. Build servers in-test against the real `tools/` tree.
- `tests/integration/` — real HTTP flows; only when external services exist.
- Every new tool needs at least one test proving it is discovered and tagged.

## Quality gate

`make ci` must pass before commit: ruff lint, ruff format --check, ty, pytest.

## What NOT to do

- No custom tool registries or decorators — FileSystemProvider already does it.
- No dependency-injection framework. Pass the dependency or use `lru_cache`.
- No class-per-function wrappers. `class XService` holding only functions = noise.
- No relative imports, ever.
- No printing to stdout — stdout is the MCP transport. Log to stderr only.
