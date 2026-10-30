# xq-jewy

An [MCP](https://modelcontextprotocol.io/) server built with
[FastMCP for TypeScript](https://github.com/punkpeye/fastmcp), and a repo designed to
**teach you how a modern Node.js + TypeScript project works** by doing.

| Tool                                           | Job                                                            |
| ---------------------------------------------- | -------------------------------------------------------------- |
| [Node.js](https://nodejs.org/) 24              | Runs JavaScript — and, since v22.18, TypeScript files directly |
| [pnpm](https://pnpm.io/)                       | Installs dependencies, runs scripts (`pnpm <script>`)          |
| [TypeScript](https://www.typescriptlang.org/)  | Types; `tsc` checks them and builds `dist/`                    |
| [Biome](https://biomejs.dev/)                  | Linting + formatting + import sorting, in one fast tool        |
| [Vitest](https://vitest.dev/)                  | Tests (+ coverage)                                             |
| [FastMCP](https://github.com/punkpeye/fastmcp) | The MCP server framework                                       |
| [Zod](https://zod.dev/)                        | Validates tool inputs and settings at runtime                  |
| [Lefthook](https://lefthook.dev/)              | Runs Biome + `tsc` automatically on every `git commit`         |

Work through the sections in order — each explains a concept, then has you do it.

## 0. What is MCP, in one minute

MCP (Model Context Protocol) is how an AI app (Claude, VS Code Copilot,
Cursor...) talks to _your_ code. Your server offers three kinds of things:

| Kind         | What it is                                   | Example here                         |
| ------------ | -------------------------------------------- | ------------------------------------ |
| **Tool**     | A function the model can _call_              | `greet(name)`, `add(a, b)`           |
| **Resource** | Read-only data the app can _load_            | `info://server`, `greeting://{name}` |
| **Prompt**   | A reusable message template the _user_ picks | `explain(topic, audience)`           |

The app starts your server (usually as a subprocess talking over
stdin/stdout — the **stdio transport**) or connects to it over the network
(the **http transport**).

## 1. What all these files are

```
xq-jewy/
├── src/
│   ├── core.ts              # pure business logic — no MCP, easy to test
│   ├── components/          # the MCP layer: thin wrappers around core
│   │   ├── tools.ts         #   server.addTool(...)
│   │   ├── resources.ts     #   server.addResource(...) / addResourceTemplate(...)
│   │   └── prompts.ts       #   server.addPrompt(...)
│   ├── server.ts            # createServer(): builds FastMCP, auth, /health
│   ├── config.ts            # settings from env vars / .env, validated by Zod
│   ├── cli.ts               # the command line (--transport, --port, ...)
│   ├── logger.ts            # level-filtered logging to stderr
│   ├── version.ts           # reads the version from package.json
│   └── main.ts              # entry point: loads .env, runs the CLI
├── tests/                   # Vitest; helpers.ts gives tests a real MCP client
├── package.json             # project ID card: deps, scripts, Node version
├── pnpm-lock.yaml           # exact versions of every dependency (commit it!)
├── pnpm-workspace.yaml      # pnpm settings (which deps may run install scripts)
├── tsconfig.json            # TypeScript rules (tsconfig.build.json: build to dist/)
├── biome.json               # lint + format rules
├── vitest.config.ts         # test + coverage settings
├── lefthook.yml             # checks run on every commit
├── .nvmrc                   # which Node version to use (24)
├── .github/workflows/       # CI: the same checks, on every push / PR
├── .vscode/                 # editor setup: extensions, settings, debug, MCP
├── Dockerfile               # container image running the server over http
└── .env.example             # copy to .env to change settings locally
```

**The one design rule:** logic goes in `core.ts` (plain TypeScript); the files in
`components/` only translate between MCP and that logic. You can then test
the logic with plain function calls, and the MCP layer with a real client.

## 2. First-time setup

```bash
# 1. Node.js 24 (one time, per machine). Easiest: https://nodejs.org → LTS installer,
#    or with a version manager: `nvm install` (reads .nvmrc)
node --version            # v24.x (anything >= 22.18 works)

# 2. pnpm (one time, per machine)
npm install --global pnpm
pnpm --version

# 3. This project
git clone https://github.com/ExperienceQuality/xq-jewy.git
cd xq-jewy
pnpm install              # installs deps into node_modules/ and enables git hooks
pnpm check                # lint + types + tests: everything should be green
```

`node_modules/` is like Python's `.venv`: local to this project, never committed,
safe to delete and recreate with `pnpm install`.

## 3. Editor setup (VS Code)

Open the folder in VS Code and accept **"Install recommended extensions"**
(listed in `.vscode/extensions.json`):

- **Biome** (`biomejs.biome`) — formats on save, fixes lint issues, sorts imports.
- **Vitest** (`vitest.explorer`) — run/debug single tests from the Testing sidebar.

TypeScript support is built into VS Code, so there is nothing to install for it.
`.vscode/settings.json` makes Biome the formatter; `.vscode/launch.json` lets you press
**F5** to run the server under the debugger (set breakpoints in any `.ts` file).

## 4. Run the server

```bash
pnpm start                              # stdio — what MCP apps launch
pnpm start --transport http          # http on http://127.0.0.1:8000/mcp
pnpm dev                                # http + debug logs, restarts on file save
pnpm start --help                    # all flags
pnpm inspect                            # MCP Inspector: a web UI to click your tools
```

Settings come from, in order of priority: **CLI flags → `XQ_JEWY_*` env vars →
`.env` file → defaults** (see `src/config.ts`). Try it:

```bash
cp .env.example .env                    # then edit .env
XQ_JEWY_PORT=9000 pnpm start --transport http
```

Invalid values (e.g. `--port 0`) are rejected with a clear message before the
server starts.

### Use it from Claude Desktop / Claude Code / Cursor

Point the app at the entry file (use the absolute path on your machine):

```json
{
  "mcpServers": {
    "xq-jewy": { "command": "node", "args": ["/path/to/xq-jewy/src/main.ts"] }
  }
}
```

VS Code (Copilot Chat, agent mode) picks it up automatically from `.vscode/mcp.json`.

### Securing the http transport

On http, anyone who can reach the port can call your tools. Stay on
`127.0.0.1` (the default) or set a token, and clients must then send
`Authorization: Bearer <token>`:

```bash
XQ_JEWY_AUTH_TOKEN=change-me pnpm start --transport http
```

The server logs a warning if you bind a non-loopback host without a token.
`/health` stays public so load balancers and Docker can probe it.

### Docker

```bash
docker build -t xq-jewy .
docker run --rm -p 8000:8000 -e XQ_JEWY_AUTH_TOKEN=change-me xq-jewy
curl http://localhost:8000/health
```

## 5. The daily loop

```bash
pnpm fix          # 1. format + auto-fix lint + sort imports (Biome)
pnpm lint         # 2. what's left that Biome can't fix
pnpm typecheck    # 3. types (tsc)
pnpm test         # 4. tests   (pnpm test:watch re-runs on save; pnpm coverage for a report)
```

Or just `pnpm check` (lint + types + tests with coverage). Lefthook runs Biome and
`tsc` on every commit, and CI (`.github/workflows/ci.yml`) runs everything on every
PR on Node 22 and 24 — so if it passes locally, it passes in CI.

## 6. Your first change: add a `multiply` tool (do this now)

**a) Logic** — `src/core.ts`:

```ts
/** Return the product of two numbers. */
export function multiply(a: number, b: number): number {
  return a * b;
}
```

**b) Unit test** — `tests/core.test.ts` (add `multiply` to the import):

```ts
describe("multiply", () => {
  it("multiplies", () => {
    expect(multiply(3, 4)).toBe(12);
  });
});
```

**c) Expose it over MCP** — `src/components/tools.ts`, inside `register`:

```ts
server.addTool({
  name: "multiply",
  description: "Multiply two numbers.",
  parameters: z.object({ a: z.number(), b: z.number() }),
  annotations: { readOnlyHint: true, idempotentHint: true },
  execute: async ({ a, b }) => String(core.multiply(a, b)),
});
```

The **`description` is what the model reads** to decide when to call the tool, and the
**Zod schema becomes its input schema** (and validates every call) — write both carefully.

**d) MCP test** — `tests/server.test.ts`, inside `describe("tools", ...)`:

```ts
it("multiply returns the product", async () => {
  const result = await client.callTool({ name: "multiply", arguments: { a: 3, b: 4 } });
  expect(result.content).toEqual([{ type: "text", text: "12" }]);
});
```

and add `"multiply"` to the list in `"lists the example tools"`.

**e)** `pnpm check`, then:

```bash
git checkout -b add-multiply
git add -A && git commit -m "Add multiply tool"   # lefthook runs here
git push -u origin add-multiply                  # then open a PR on GitHub
```

That's the whole job: **logic → test → MCP wrapper → test → check → PR.**

## 7. Where things go

- **New logic** → `core.ts`, or a new module like `src/weather.ts`.
- **New tool / resource / prompt** → the matching file in `components/`.
  A whole new area? Add `components/<area>.ts` with a `register(server)` and
  call it from `server.ts`.
- **New setting** → a field on `SettingsSchema` and a line in `ENV_VARS` in `config.ts`.
- **Tool errors the model should see** → `throw new UserError("message")`.
- **Logging** → the `log` argument in `execute` (sent to the client), or `console.error`.
  Never `console.log` in a stdio server: stdout _is_ the protocol channel and printing
  corrupts it.
- **Imports between your files** use the `.ts` extension (`./core.ts`) — that's what lets
  Node run them without a build step. `tsc` rewrites them to `.js` in `dist/`.
- **New library** → `pnpm add <name>`. **Dev-only** → `pnpm add -D <name>`.
- **Upgrade deps** → `pnpm outdated`, then `pnpm update --latest`, run `pnpm check`,
  commit `pnpm-lock.yaml`.

## 8. When things go wrong

| Symptom                                       | Fix                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Cannot find module` / `ERR_MODULE_NOT_FOUND` | Run `pnpm install`. For your own files, check the import ends in `.ts`.                |
| `SyntaxError` on a type annotation            | Your Node is too old: `node --version` must be ≥ 22.18.                                |
| `git commit` fails with Biome/tsc output      | The hook caught something. Biome usually fixes it itself — `git add -A`, commit again. |
| `pnpm typecheck` complains                    | Types don't line up; the error names file + line.                                      |
| MCP app shows no tools / server crashed       | Run `pnpm start` yourself and read the error; check for stray `console.log`s.          |
| `` `pre-commit` not found `` on commit        | Old Python hook from before the switch: `pnpm exec lefthook install --force`.          |
| `Ignored build scripts` during install        | pnpm blocks install scripts by default; allow one in `pnpm-workspace.yaml` if needed.  |
| Weird, stale behavior                         | `rm -rf node_modules && pnpm install`.                                                 |

## 9. Next concepts to learn (in order)

1. `async`/`await` and Promises — every tool and test here is async.
2. Zod schemas — they _are_ your tool's API and your settings' rules (`config.ts`).
3. `it.each` — table-driven tests; see `tests/core.test.ts`.
4. `vi.spyOn` / mocking — see `tests/cli.test.ts`, which tests the CLI without a server.
5. FastMCP context: progress, streaming, sessions, elicitation —
   <https://github.com/punkpeye/fastmcp#core-concepts>.
6. `package.json` and `tsconfig.json` top to bottom — they're the map of the repo.
