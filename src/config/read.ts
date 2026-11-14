import { open } from "node:fs/promises";
import { constants } from "node:fs";

import { ConfigError } from "./errors.js";

/** Maximum config file size (1 MiB); BOM bytes count toward the cap. */
export const CONFIG_FILE_MAX_BYTES = 1024 * 1024;

/** Bounded read size to detect growth past the cap (+1 byte). */
export const CONFIG_FILE_READ_LIMIT = CONFIG_FILE_MAX_BYTES + 1;

const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

const fatalDecoder = new TextDecoder("utf-8", { fatal: true });

/** UTF-8 decode with optional BOM strip and size cap (N-UNIT-02). */
export function decodeConfigBytes(bytes: Uint8Array): string {
  if (bytes.length > CONFIG_FILE_READ_LIMIT) {
    throw new ConfigError("too_large", { kind: "path", path: "<bytes>" });
  }
  if (bytes.length > CONFIG_FILE_MAX_BYTES) {
    throw new ConfigError("too_large", { kind: "path", path: "<bytes>" });
  }
  if (bytes.length === 0) {
    return "";
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    throw new ConfigError("decode_error", {
      kind: "path",
      path: "<bytes>",
    });
  }

  let start = 0;
  if (
    bytes.length >= 3 &&
    bytes[0] === UTF8_BOM[0] &&
    bytes[1] === UTF8_BOM[1] &&
    bytes[2] === UTF8_BOM[2]
  ) {
    start = 3;
  }

  const body = bytes.subarray(start);
  try {
    return fatalDecoder.decode(body);
  } catch {
    throw new ConfigError("decode_error", {
      kind: "path",
      path: "<bytes>",
    });
  }
}

async function readBoundedFile(
  absolutePath: string,
  handle: Awaited<ReturnType<typeof open>>,
): Promise<Uint8Array> {
  const stats = await handle.stat();
  if (stats.isDirectory() || !stats.isFile()) {
    throw new ConfigError("not_a_file", { kind: "path", path: absolutePath });
  }

  if (stats.size > CONFIG_FILE_MAX_BYTES) {
    throw new ConfigError("too_large", { kind: "path", path: absolutePath });
  }

  const toRead = Math.min(stats.size, CONFIG_FILE_READ_LIMIT);
  const buffer = Buffer.alloc(toRead);
  const { bytesRead } = await handle.read(buffer, 0, toRead, 0);
  const slice = buffer.subarray(0, bytesRead);

  if (slice.length > CONFIG_FILE_MAX_BYTES) {
    throw new ConfigError("too_large", { kind: "path", path: absolutePath });
  }

  if (bytesRead < stats.size && stats.size > CONFIG_FILE_MAX_BYTES) {
    throw new ConfigError("too_large", { kind: "path", path: absolutePath });
  }

  return new Uint8Array(slice);
}

function errnoCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = Reflect.get(error, "code");
  return typeof code === "string" ? code : undefined;
}

/** Read and decode a config file from a resolved absolute path (J1-T4). */
export async function readConfigFile(absolutePath: string): Promise<string> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(
      absolutePath,
      constants.O_RDONLY | constants.O_NONBLOCK,
    );
  } catch (error: unknown) {
    const code = errnoCode(error);
    if (code === "ENOENT") {
      throw new ConfigError("not_found", {
        kind: "path",
        path: absolutePath,
      });
    }
    if (code === "EACCES" || code === "EPERM") {
      throw new ConfigError("unreadable", {
        kind: "path",
        path: absolutePath,
      });
    }
    throw error;
  }

  try {
    const bytes = await readBoundedFile(absolutePath, handle);
    return decodeConfigBytes(bytes);
  } catch (error) {
    if (error instanceof ConfigError) {
      if (error.location.kind === "path" && error.location.path === "<bytes>") {
        throw new ConfigError(error.code, {
          kind: "path",
          path: absolutePath,
        });
      }
      throw error;
    }
    throw error;
  } finally {
    await handle.close();
  }
}
