# xq-jewy

MCP server for XQ backend-testing tools (Node.js + TypeScript).

## Prerequisites

- Node.js `>=24.22.1` (`engines.node` in `package.json`)
- Team default: Node **26** (see `.nvmrc`)

## Install and scripts

```bash
npm ci
npm run build        # tsc → dist/
npm start            # node dist/index.js
npm run typecheck    # tsc --noEmit
npm run lint         # oxlint --type-aware
npm run format       # Prettier write
npm run format:check # Prettier check
npm run test:unit
npm run test:integration
npm run test:system
npm run ci           # build + typecheck + lint + format:check + test
```

## Consumer launch (mcp.json)

Two supported launch forms:

### 1. Local built binary (documented examples)

```json
{
  "mcpServers": {
    "xq-jewy": {
      "command": "node",
      "args": ["/absolute/path/to/xq-jewy/dist/index.js"],
      "env": {
        "XQ_JEWY_CONFIG": "/absolute/path/to/xq.yaml"
      }
    }
  }
}
```

Replace both absolute paths with real paths on your machine. Build first (`npm run build`) so `dist/index.js` exists.

### 2. `npx` from GitHub

```json
{
  "mcpServers": {
    "xq-jewy": {
      "command": "npx",
      "args": ["-y", "github:ExperienceQuality/xq-jewy"],
      "env": {
        "XQ_JEWY_CONFIG": "/absolute/path/to/xq.yaml"
      }
    }
  }
}
```

`npx -y github:ExperienceQuality/xq-jewy` is a **residual risk / untested** launch path. Prefer the local `node …/dist/index.js` form for verified setups.

## Configuration env vars

Set env in `mcp.json` (or the process environment). YAML holds **no URLs and no secrets**.

| Variable                    | Role                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `XQ_JEWY_CONFIG`            | **Required.** Raw absolute path to the YAML file. No default, no CWD-relative lookup, no `~` / `$VAR` expansion. |
| `XQ_JEWY_API_BASE_URL`      | Required when the enabled capability union needs the API.                                                        |
| `XQ_JEWY_WIREMOCK_BASE_URL` | Required when the union needs WireMock.                                                                          |

Required URL vars are the **union** over enabled capabilities. A URL that is set is validated even when unused — **omit unused URL vars**.

| Capability   | Tag            | Endpoint(s)    |
| ------------ | -------------- | -------------- |
| `stubs`      | `stub`         | WireMock       |
| `rest`       | `rest`         | API            |
| `assertions` | `verification` | API + WireMock |
| `reporting`  | `reporting`    | none           |

Worked **single-mode** examples (mcp.json + YAML pairs): see [`docs/config/`](docs/config/). Root [`config.example.yaml`](config.example.yaml) shows all four capabilities enabled.
