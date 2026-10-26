# xq-jewy

An [MCP](https://modelcontextprotocol.io/) server built with
[FastMCP](https://gofastmcp.com/), and a repo designed to **teach you how a
modern Python project works** by doing.

| Tool | Job |
| --- | --- |
| [uv](https://docs.astral.sh/uv/) | Python versions, virtualenv, dependencies, running commands |
| [ruff](https://docs.astral.sh/ruff/) | Linting + formatting |
| [ty](https://docs.astral.sh/ty/) | Type checking (and the VS Code language server) |
| [FastMCP](https://gofastmcp.com/) | The MCP server framework |
| [pytest](https://docs.pytest.org/) | Tests (+ coverage, async support) |
| [pre-commit](https://pre-commit.com/) | Runs ruff + ty automatically on every `git commit` |

Work through the sections in order — each explains a concept, then has you do it.

## 0. What is MCP, in one minute

MCP (Model Context Protocol) is how an AI app (Claude, VS Code Copilot,
Cursor...) talks to *your* code. Your server offers three kinds of things:

| Kind | What it is | Example here |
| --- | --- | --- |
| **Tool** | A function the model can *call* | `greet(name)`, `add(a, b)` |
| **Resource** | Read-only data the app can *load* | `info://server`, `greeting://{name}` |
| **Prompt** | A reusable message template the *user* picks | `explain(topic, audience)` |

The app starts your server (usually as a subprocess talking over
stdin/stdout — the **stdio transport**) or connects to it over the network
(the **http transport**).

## 1. What all these files are

```
xq-jewy/
├── src/xq_jewy/
│   ├── core.py            # pure business logic — no MCP, easy to test
│   ├── components/        # the MCP layer: thin wrappers around core
│   │   ├── tools.py       #   @mcp.tool       functions
│   │   ├── resources.py   #   @mcp.resource   data
│   │   └── prompts.py     #   @mcp.prompt     templates
│   ├── server.py          # builds the FastMCP server (create_server / mcp)
│   ├── config.py          # settings from env vars / .env (pydantic-settings)
│   ├── cli.py             # the `xq-jewy` command (flags: --transport, --port...)
│   └── __main__.py        # makes `python -m xq_jewy` work
├── tests/                 # pytest; conftest.py gives every test an MCP client
├── pyproject.toml         # project ID card: deps, entry point, tool settings
├── uv.lock                # exact versions of every dependency (commit it!)
├── .python-version        # which Python uv uses (3.12)
├── .pre-commit-config.yaml# checks run on every commit
├── .github/workflows/     # CI: the same checks, on every push / PR
├── .vscode/               # editor setup: extensions, settings, debug, MCP
├── Dockerfile             # container image running the server over http
├── Makefile               # short aliases for the commands below
└── .env.example           # copy to .env to change settings locally
```

**The one design rule:** logic goes in `core.py` (plain Python); the files in
`components/` only translate between MCP and that logic. You can then test
the logic with plain function calls, and the MCP layer with a real client.

## 2. First-time setup

```bash
# install uv (one time, per machine)
curl -LsSf https://astral.sh/uv/install.sh | sh

git clone https://github.com/ExperienceQuality/xq-jewy.git
cd xq-jewy

uv sync                       # creates .venv (downloads Python 3.12 if needed), installs everything
uv run pre-commit install     # turn on the git hook (one time per clone)
```

`uv sync` installs your package in *editable* mode (your edits take effect
immediately) plus the dev tools. You never `pip install` or activate the venv
— `uv run <cmd>` runs `<cmd>` inside `.venv` for you.

## 3. Editor setup (VS Code)

1. `code .` from the repo root.
2. Accept "install the recommended extensions" (or `Ctrl+Shift+X` →
   `@recommended`).

| Extension | Why |
| --- | --- |
| Python (`ms-python.python`) | Runs/debugs Python, picks up `.venv` |
| ty (`astral-sh.ty`) | Completions, go-to-definition, live type errors |
| Ruff (`charliermarsh.ruff`) | Lint + format on save |
| Even Better TOML (`tamasfe.even-better-toml`) | Highlighting for `pyproject.toml` |

Already configured for you in `.vscode/`:

- **settings.json** — interpreter = `.venv`, format + fix imports on save,
  pytest in the Testing sidebar, ty as the language server (Pylance is
  turned off so you don't get every error twice).
- **launch.json** — `F5` → "xq-jewy (http)" runs the server under the
  debugger; set a breakpoint in `core.py` and call a tool.
- **mcp.json** — registers this server with VS Code's built-in MCP support,
  so Copilot Chat (agent mode) can call your tools. Open the file and click
  **Start** above the server name.

## 4. Run the server

```bash
uv run xq-jewy                                   # stdio — what MCP apps launch
uv run xq-jewy --transport http --port 8000      # http on http://127.0.0.1:8000/mcp
curl http://127.0.0.1:8000/health                # {"status":"ok",...}
uv run xq-jewy --help
```

Poke at it without an AI app:

```bash
uv run fastmcp list src/xq_jewy/server.py --resources --prompts
uv run fastmcp call src/xq_jewy/server.py add a=2 b=3
uv run fastmcp dev inspector src/xq_jewy/server.py   # web UI (needs Node.js)
```

Settings come from (highest wins): CLI flags → environment variables →
`.env` file → defaults in `config.py`. Every value is validated by
`Settings`, so e.g. `--port 0` is rejected with a clear error. Try `cp .env.example .env` and change
`XQ_JEWY_LOG_LEVEL=DEBUG`.

### Use it from Claude Desktop / Claude Code / Cursor

```bash
uv run fastmcp install claude-desktop src/xq_jewy/server.py --with-editable .
uv run fastmcp install claude-code    src/xq_jewy/server.py --with-editable .
uv run fastmcp install cursor         src/xq_jewy/server.py --with-editable .
```

Or add it by hand to any client's JSON config:

```json
{ "command": "uv", "args": ["run", "--directory", "/path/to/xq-jewy", "xq-jewy"] }
```

### Securing the http transport

On http, anyone who can reach the port can call your tools. Stay on
`127.0.0.1` (the default) or set a token, and clients must then send
`Authorization: Bearer <token>`:

```bash
XQ_JEWY_AUTH_TOKEN=change-me uv run xq-jewy --transport http
```

The server logs a warning if you bind a non-loopback host without a token.
`/health` stays public so load balancers and Docker can probe it.

### Docker

```bash
docker build -t xq-jewy .
docker run --rm -p 8000:8000 -e XQ_JEWY_AUTH_TOKEN=change-me xq-jewy   # http, /mcp and /health
```

## 5. The daily loop

```bash
uv run ruff format .    # 1. format
uv run ruff check .     # 2. lint (style + likely bugs); add --fix to auto-fix
uv run ty check         # 3. types
uv run pytest           # 4. tests + coverage report
```

Or just `make check` (lint + type + test). The pre-commit hook runs ruff and
ty on every commit, and CI (`.github/workflows/ci.yml`) runs all of it on
every PR — so if it passes locally, it passes in CI.

## 6. Your first change: add a `multiply` tool (do this now)

**a) Logic** — `src/xq_jewy/core.py`:

```python
def multiply(a: float, b: float) -> float:
    """Return the product of two numbers."""
    return a * b
```

**b) Unit test** — `tests/test_core.py` (add `multiply` to the import):

```python
def test_multiply():
    assert multiply(3, 4) == 12
```

**c) Expose it over MCP** — `src/xq_jewy/components/tools.py`, inside `register`:

```python
    @mcp.tool(annotations={"readOnlyHint": True, "idempotentHint": True})
    def multiply(a: float, b: float) -> float:
        """Multiply two numbers."""
        return core.multiply(a, b)
```

The **docstring becomes the tool description** the model reads, and the
**type hints become its input schema** — write both carefully.

**d) MCP test** — `tests/test_server.py`:

```python
async def test_multiply_tool(client: Client):
    result = await client.call_tool("multiply", {"a": 3, "b": 4})
    assert result.data == 12
```

and add `"multiply"` to the set in `test_lists_expected_tools`.

**e)** `make check`, then:

```bash
git checkout -b add-multiply
git add -A && git commit -m "Add multiply tool"   # pre-commit runs here
git push -u origin add-multiply                  # then open a PR on GitHub
```

That's the whole job: **logic → test → MCP wrapper → test → check → PR.**

## 7. Where things go

- **New logic** → `core.py`, or a new module like `src/xq_jewy/weather.py`.
- **New tool / resource / prompt** → the matching file in `components/`.
  A whole new area? Add `components/<area>.py` with a `register(mcp)` and
  call it from `server.py`.
- **New setting** → a field on `Settings` in `config.py`; it's instantly
  readable from `XQ_JEWY_<NAME>`.
- **Tool errors the model should see** → `raise ToolError("message")`.
- **Logging** → `logging.getLogger(__name__)`. Never `print()` in a stdio
  server: stdout *is* the protocol channel and printing corrupts it.
- **New library** → `uv add httpx`. **Dev-only** → `uv add --dev ipython`.
- **Upgrade deps** → `uv lock --upgrade` (or `--upgrade-package <name>`),
  run `make check`, commit `uv.lock`.

## 8. When things go wrong

| Symptom | Fix |
| --- | --- |
| `ModuleNotFoundError: xq_jewy` | Run `uv sync`; use `uv run ...` or the `.venv` interpreter. |
| `git commit` fails with ruff/ty output | The hook caught something. ruff often fixes it itself — `git add -A` and commit again. |
| ty complains | Types don't line up; the error names file + line. |
| MCP app shows no tools / server crashed | Run `uv run xq-jewy` yourself and read the error; check for stray `print()`s. |
| `async def test_...` is skipped | Make sure `pytest-asyncio` is installed (`uv sync`); `asyncio_mode = "auto"` is set in `pyproject.toml`. |
| Weird, stale behavior | `uv sync --reinstall`. |

## 9. Next concepts to learn (in order)

1. Type hints and docstrings — they *are* your tool's API (section 6).
2. `pytest.mark.parametrize` — see `tests/test_core.py`.
3. `async`/`await` — MCP tests are async; see `tests/conftest.py`.
4. Pydantic models as tool inputs/outputs for structured data.
5. FastMCP `Context` (progress, sampling, elicitation) and lifespans
   (open a DB/HTTP client once at startup) — <https://gofastmcp.com/>.
6. `pyproject.toml` top to bottom — it's the map of the repo.
