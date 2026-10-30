import type { Logger } from "fastmcp";
import type { LogLevel } from "./config.ts";

const SEVERITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * A tiny level-filtered logger. Everything goes to stderr because, on the stdio
 * transport, stdout carries the MCP protocol itself — never `console.log` there.
 */
export function createLogger(level: LogLevel): Logger {
  const at =
    (messageLevel: LogLevel) =>
    (...args: unknown[]): void => {
      if (SEVERITY[messageLevel] >= SEVERITY[level]) {
        console.error(`[${messageLevel}]`, ...args);
      }
    };
  return {
    debug: at("debug"),
    info: at("info"),
    log: at("info"),
    warn: at("warn"),
    error: at("error"),
  };
}
