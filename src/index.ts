#!/usr/bin/env node

import {
  ConfigError,
  formatConfigErrorLine,
  loadConfiguration,
  type StartupConfiguration,
} from "./config/index.js";

const INTERNAL_ERROR_LINE = "xq-jewy: internal error";

let exiting = false;

function writeStderrLine(line: string): void {
  process.stderr.write(`${line}\n`);
}

function exitFailure(): never {
  exiting = true;
  process.exit(1);
}

/** D5: non-ConfigError crashes — fixed line, empty stdout, exit 1. */
function handleInternalError(): never {
  if (!exiting) {
    writeStderrLine(INTERNAL_ERROR_LINE);
  }
  exitFailure();
}

function handleConfigError(error: ConfigError): never {
  if (!exiting) {
    writeStderrLine(formatConfigErrorLine(error));
  }
  exitFailure();
}

function failFromUnknown(error: unknown): never {
  if (error instanceof ConfigError) {
    handleConfigError(error);
  }
  handleInternalError();
}

process.on("uncaughtException", (error: unknown) => {
  failFromUnknown(error);
});

process.on("unhandledRejection", (reason: unknown) => {
  failFromUnknown(reason);
});

async function main(): Promise<void> {
  // Test-only D5 injection (N-SYS-06). Not a product feature.
  if (process.env["XQ_JEWY_TEST_INJECT_REJECTION"] === "1") {
    void Promise.reject(new Error("injected"));
    return;
  }

  let config: StartupConfiguration;
  try {
    config = await loadConfiguration(process.env);
  } catch (error: unknown) {
    failFromUnknown(error);
  }

  const { startServer } = await import("./server.js");
  startServer(config);
}

main().catch((error: unknown) => {
  failFromUnknown(error);
});
