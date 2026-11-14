import { describe, expect, it } from "vitest";
import {
  ConfigError,
  createStartupConfiguration,
  type StartupConfiguration,
} from "../../src/config/index.js";

const reportingOnly = {
  stubs: false,
  rest: false,
  assertions: false,
  reporting: true,
} as const;

const stubsOnly = {
  stubs: true,
  rest: false,
  assertions: false,
  reporting: false,
} as const;

const restOnly = {
  stubs: false,
  rest: true,
  assertions: false,
  reporting: false,
} as const;

describe("N-UNIT-10", () => {
  it("throws TypeError (not ConfigError) for aggregate invariant violations", () => {
    try {
      createStartupConfiguration({
        configPath: "/tmp/cfg.yaml",
        capabilities: stubsOnly,
        enabledTags: ["stub"],
        apiBaseUrl: null,
        wiremockBaseUrl: null,
      });
      throw new Error("expected TypeError for missing wiremock");
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect(error).not.toBeInstanceOf(ConfigError);
    }

    try {
      createStartupConfiguration({
        configPath: "/tmp/cfg.yaml",
        capabilities: restOnly,
        enabledTags: ["rest"],
        apiBaseUrl: null,
        wiremockBaseUrl: null,
      });
      throw new Error("expected TypeError for missing api");
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect(error).not.toBeInstanceOf(ConfigError);
    }

    const optionalOk: StartupConfiguration = createStartupConfiguration({
      configPath: "/tmp/cfg.yaml",
      capabilities: reportingOnly,
      enabledTags: ["reporting"],
      apiBaseUrl: null,
      wiremockBaseUrl: null,
    });
    expect(optionalOk.apiBaseUrl).toBeNull();
    expect(optionalOk.wiremockBaseUrl).toBeNull();

    try {
      createStartupConfiguration({
        configPath: "/tmp/cfg.yaml",
        capabilities: reportingOnly,
        enabledTags: ["reporting"],
        apiBaseUrl: "not-a-url",
        wiremockBaseUrl: null,
      });
      throw new Error("expected TypeError for invalid URL grammar");
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect(error).not.toBeInstanceOf(ConfigError);
    }

    const happy: StartupConfiguration = createStartupConfiguration({
      configPath: "/tmp/cfg.yaml",
      capabilities: stubsOnly,
      enabledTags: ["stub"],
      apiBaseUrl: null,
      wiremockBaseUrl: "http://127.0.0.1:8081",
    });
    expect(
      typeof happy.apiBaseUrl === "string" || happy.apiBaseUrl === null,
    ).toBe(true);
    expect(
      typeof happy.wiremockBaseUrl === "string" ||
        happy.wiremockBaseUrl === null,
    ).toBe(true);
    expect(happy.wiremockBaseUrl).toBe("http://127.0.0.1:8081");
  });
});
