# xq-jewy

FastMCP server exposing XQ tools to MCP-compatible LLM hosts (Devin, Claude Code, etc.).

## Consume (no install needed)

Add to your MCP client config. `XQ_JEWY_CONFIG` must be an **absolute** path
to your YAML file. API and WireMock base URLs come from env vars — never from
YAML. Include only the URL vars your enabled capabilities need (union over
enabled capabilities; see [docs/config/](docs/config/README.md)).

```json
{
  "mcpServers": {
    "xq-jewy": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/ExperienceQuality/xq-jewy", "xq-jewy"],
      "env": {
        "XQ_JEWY_CONFIG": "/absolute/path/to/xq.yaml",
        "XQ_JEWY_API_BASE_URL": "http://127.0.0.1:8080",
        "XQ_JEWY_WIREMOCK_BASE_URL": "http://127.0.0.1:8081"
      }
    }
  }
}
```

`uvx` clones the repo into an isolated env and runs the `xq-jewy` script (stdio transport). Requires [uv](https://docs.astral.sh/uv/).

Pin a release instead of tracking main:

```json
"args": ["--from", "git+https://github.com/ExperienceQuality/xq-jewy@v0.1.0", "xq-jewy"]
```

Or install the release wheel directly (attached to each GitHub Release):

```json
"args": ["--from", "https://github.com/ExperienceQuality/xq-jewy/releases/download/v0.1.0/xq_jewy-0.1.0-py3-none-any.whl", "xq-jewy"]
```

For a persistent install instead of per-run fetch:

```bash
uv tool install git+https://github.com/ExperienceQuality/xq-jewy@v0.1.0
# then: "command": "xq-jewy"
```

Minimal one-capability mcp.json + YAML examples live under
[`docs/config/`](docs/config/README.md). Root [`config.example.yaml`](config.example.yaml)
shows the canonical `capabilities` / `enabled_tags` schema.

## Develop

```bash
uv sync          # install deps
make             # list commands
make check       # lint + typecheck
make test        # pytest
uv run xq-jewy   # run MCP server on stdio
```
