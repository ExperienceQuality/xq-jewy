import { FastMCP } from "fastmcp";
import { beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { isLoopback, main, USAGE } from "../src/cli.ts";
import { VERSION } from "../src/version.ts";

let start: MockInstance<FastMCP["start"]>;
let stderr: MockInstance<typeof console.error>;

beforeEach(() => {
  // Don't really start a server; just record how it would have been started.
  start = vi.spyOn(FastMCP.prototype, "start").mockResolvedValue();
  stderr = vi.spyOn(console, "error").mockImplementation(() => {});
});

const printed = () => stderr.mock.calls.map((call) => call.join(" ")).join("\n");

describe("main", () => {
  it("starts stdio by default", async () => {
    expect(await main([], {})).toBe(0);
    expect(start).toHaveBeenCalledWith({ transportType: "stdio" });
  });

  it("starts http with the given host and port", async () => {
    expect(await main(["--transport", "http", "--port", "9000"], {})).toBe(0);
    expect(start).toHaveBeenCalledWith({
      transportType: "httpStream",
      httpStream: { host: "127.0.0.1", port: 9000 },
    });
  });

  it("lets a valid flag override an invalid env var", async () => {
    expect(await main(["--transport=http", "--port=9100"], { XQ_JEWY_PORT: "0" })).toBe(0);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ httpStream: expect.objectContaining({ port: 9100 }) }),
    );
  });

  it.each(["0", "70000"])("rejects --port %s", async (port) => {
    expect(await main(["--port", port], {})).toBe(2);
    expect(printed()).toContain("invalid settings");
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects unknown flags", async () => {
    expect(await main(["--nope"], {})).toBe(2);
    expect(printed()).toContain("Unknown option");
  });

  it("prints the version even if the env is invalid", async () => {
    expect(await main(["--version"], { XQ_JEWY_PORT: "0" })).toBe(0);
    expect(printed()).toBe(`xq-jewy ${VERSION}`);
  });

  it("prints help even if the env is invalid", async () => {
    expect(await main(["--help"], { XQ_JEWY_PORT: "0" })).toBe(0);
    expect(printed()).toBe(USAGE);
  });

  it("warns when serving a public host without a token", async () => {
    await main(["--transport", "http", "--host", "0.0.0.0"], {});
    expect(printed()).toContain("without authentication");
  });

  it("does not warn on loopback", async () => {
    await main(["--transport", "http"], {});
    expect(printed()).not.toContain("without authentication");
  });

  it("does not warn when a token is set", async () => {
    await main(["--transport", "http", "--host", "0.0.0.0"], { XQ_JEWY_AUTH_TOKEN: "s3cret" });
    expect(printed()).not.toContain("without authentication");
  });
});

describe("isLoopback", () => {
  it.each([
    ["localhost", true],
    ["127.0.0.1", true],
    ["127.1.2.3", true],
    ["::1", true],
    ["0.0.0.0", false],
    ["192.168.1.10", false],
    ["example.com", false],
  ])("%s → %s", (host, expected) => {
    expect(isLoopback(host)).toBe(expected);
  });
});
