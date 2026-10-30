#!/usr/bin/env node
// Entry point: `pnpm start`, `node src/main.ts`, or `xq-jewy` once built.
import { existsSync } from "node:fs";
import { main } from "./cli.ts";

// Real env vars win over .env (Node never overwrites an existing variable here).
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

process.exitCode = await main();
