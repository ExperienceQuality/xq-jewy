# Configuration examples

Canonical consumer config uses `capabilities` / `enabled_tags` in YAML.
Base URLs never appear in YAML; they come from mcp.json `env` (or the
process environment). Legacy `tags` / `server` YAML is rejected.

## Capability → tag → endpoint

| Capability   | Tag            | Endpoint(s)        |
|--------------|----------------|--------------------|
| `stubs`      | `stub`         | WireMock           |
| `rest`       | `rest`         | API                |
| `assertions` | `verification` | API + WireMock     |
| `reporting`  | `reporting`    | none               |

Required URL env vars are the **union** over enabled capabilities.
Example: enabling both `stubs` and `rest` requires WireMock **and** API.

Env var names (exact):

- `XQ_JEWY_CONFIG` — absolute path to the YAML file (always required)
- `XQ_JEWY_API_BASE_URL` — when the union includes API
- `XQ_JEWY_WIREMOCK_BASE_URL` — when the union includes WireMock

A URL that is **set** is validated even when the enabled set does not
need it. Prefer omitting unused URL vars.

YAML holds **no URLs and no secrets**.

## First-error order

Startup fails on the first error in this order:

1. path
2. file/parse
3. schema/tag coverage
4. required-set derivation
5. API
6. WireMock
7. aggregate invariant
8. server construction and run

## Minimal examples (one capability each)

| Mode              | YAML                         | mcp.json                      | `env` keys                                      |
|-------------------|------------------------------|-------------------------------|-------------------------------------------------|
| stubs-only        | `xq.stubs-only.yaml`         | `mcp.stubs-only.json`         | `XQ_JEWY_CONFIG`, `XQ_JEWY_WIREMOCK_BASE_URL`   |
| rest-only         | `xq.rest-only.yaml`          | `mcp.rest-only.json`          | `XQ_JEWY_CONFIG`, `XQ_JEWY_API_BASE_URL`        |
| assertions-only   | `xq.assertions-only.yaml`    | `mcp.assertions-only.json`    | `XQ_JEWY_CONFIG`, `XQ_JEWY_API_BASE_URL`, `XQ_JEWY_WIREMOCK_BASE_URL` |
| reporting-only    | `xq.reporting-only.yaml`     | `mcp.reporting-only.json`     | `XQ_JEWY_CONFIG`                                |

Each mcp.json `env` object holds **only** the variables that setup needs.
Replace `/absolute/path/to/xq.yaml` with the real absolute path to your
YAML file.

Root `config.example.yaml` shows all four capabilities enabled.
`src/xq_jewy/config_example.yaml` is an **invalid** legacy fixture for
negative tests — do not copy it.
