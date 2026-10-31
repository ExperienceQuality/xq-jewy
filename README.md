# xq-jewy

FastMCP server exposing XQ tools to MCP-compatible LLM hosts (Devin, Claude Code, etc.).

## Consume (no install needed)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "xq-jewy": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/ExperienceQuality/xq-jewy", "xq-jewy"]
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

## Develop

```bash
uv sync          # install deps
make             # list commands
make check       # lint + typecheck
make test        # pytest
uv run xq-jewy   # run MCP server on stdio
```

## Tools

| Tool | Description |
|------|-------------|
| `hello` | Say hello to someone by name |
