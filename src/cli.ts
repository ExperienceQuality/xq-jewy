import { isIPv4 } from "node:net";
import { parseArgs } from "node:util";
import { z } from "zod";
import { LOG_LEVELS, loadSettings, type Settings, TRANSPORTS } from "./config.ts";
import { createLogger } from "./logger.ts";
import { createServer } from "./server.ts";
import { VERSION } from "./version.ts";

export const USAGE = `Usage: xq-jewy [options]

Run the xq-jewy MCP server. Flags override XQ_JEWY_* env vars and .env.

Options:
  --transport <${TRANSPORTS.join("|")}>   default: stdio
  --host <host>                default: 127.0.0.1 (http only)
  --port <1-65535>             default: 8000 (http only)
  --log-level <${LOG_LEVELS.join("|")}>
  -v, --version                print the version
  -h, --help                   print this help`;

export function isLoopback(host: string): boolean {
  return host === "localhost" || host === "::1" || (isIPv4(host) && host.startsWith("127."));
}

/** Parse flags, validate settings, start the server. Returns a process exit code. */
export async function main(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  let values: ReturnType<typeof parse>["values"];
  try {
    ({ values } = parse(argv));
  } catch (error) {
    console.error(`xq-jewy: ${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (values.help) {
    console.error(USAGE);
    return 0;
  }
  if (values.version) {
    console.error(`xq-jewy ${VERSION}`);
    return 0;
  }

  let settings: Settings;
  try {
    settings = loadSettings(
      {
        transport: values.transport,
        host: values.host,
        port: values.port,
        logLevel: values["log-level"],
      },
      env,
    );
  } catch (error) {
    console.error(`xq-jewy: invalid settings\n${z.prettifyError(error as z.ZodError)}`);
    return 2;
  }

  const server = createServer(settings);
  if (settings.transport === "http") {
    if (!settings.authToken && !isLoopback(settings.host)) {
      createLogger(settings.logLevel).warn(
        `Serving on ${settings.host} without authentication; set XQ_JEWY_AUTH_TOKEN.`,
      );
    }
    await server.start({
      transportType: "httpStream",
      httpStream: { host: settings.host, port: settings.port },
    });
  } else {
    await server.start({ transportType: "stdio" });
  }
  return 0;
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      transport: { type: "string" },
      host: { type: "string" },
      port: { type: "string" },
      "log-level": { type: "string" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });
}
