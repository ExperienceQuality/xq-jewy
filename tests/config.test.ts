import { describe, expect, it } from "vitest";
import { loadSettings, settingsFromEnv } from "../src/config.ts";

describe("loadSettings", () => {
  it("uses defaults when nothing is set", () => {
    expect(loadSettings({}, {})).toEqual({
      transport: "stdio",
      host: "127.0.0.1",
      port: 8000,
      logLevel: "info",
    });
  });

  it("reads XQ_JEWY_* env vars", () => {
    const settings = loadSettings(
      {},
      {
        XQ_JEWY_TRANSPORT: "http",
        XQ_JEWY_PORT: "9000",
        XQ_JEWY_LOG_LEVEL: "debug",
        XQ_JEWY_AUTH_TOKEN: "s3cret",
      },
    );
    expect(settings).toMatchObject({
      transport: "http",
      port: 9000,
      logLevel: "debug",
      authToken: "s3cret",
    });
  });

  it("lets overrides (CLI flags) win over env vars", () => {
    expect(loadSettings({ port: "9100" }, { XQ_JEWY_PORT: "9000" }).port).toBe(9100);
  });

  it("lets a valid override replace an invalid env value", () => {
    expect(loadSettings({ port: "9100" }, { XQ_JEWY_PORT: "0" }).port).toBe(9100);
  });

  it("treats empty values as unset", () => {
    expect(loadSettings({ host: "" }, { XQ_JEWY_AUTH_TOKEN: "" })).not.toHaveProperty("authToken");
  });

  it.each(["0", "65536", "abc", "80.5"])("rejects port %j", (port) => {
    expect(() => loadSettings({ port }, {})).toThrow();
  });

  it("rejects unknown transports", () => {
    expect(() => loadSettings({ transport: "carrier-pigeon" }, {})).toThrow();
  });
});

describe("settingsFromEnv", () => {
  it("ignores unrelated variables", () => {
    expect(settingsFromEnv({ PATH: "/bin", XQ_JEWY_HOST: "0.0.0.0" })).toEqual({ host: "0.0.0.0" });
  });
});
