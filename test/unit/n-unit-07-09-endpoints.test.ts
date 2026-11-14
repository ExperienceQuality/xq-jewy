import { describe, expect, it } from "vitest";
import {
  capabilityUnionTruth,
  validateHttpBaseUrl,
  XQ_JEWY_API_BASE_URL_ENV,
} from "../../src/config/endpoints.js";
import { CAPABILITY_NAMES } from "../../src/config/schema.js";
import { expectConfigError } from "../helpers/config-error.js";

describe("N-UNIT-07", () => {
  const accept = [
    "http://127.0.0.1:8080",
    "https://example.test",
    "https://example.test/",
    "https://example.test/path",
    "https://[::1]:8443/x",
    "https://host.test/path%20",
  ];
  const reject = [
    "ftp://x",
    "http://",
    "http://:8080",
    "http://host:0",
    "http://host:65536",
    "http://host:",
    "http://user@host",
    "http://host?",
    "http://host#",
    "http://host path",
    "http://host/\t",
    "http://host/%",
    "http://host/%zz",
  ];

  it.each(accept)("accepts $raw", (raw) => {
    expect(validateHttpBaseUrl(raw, XQ_JEWY_API_BASE_URL_ENV)).toBe(raw);
  });

  it.each(reject)("rejects $raw", (raw) => {
    try {
      validateHttpBaseUrl(raw, XQ_JEWY_API_BASE_URL_ENV);
      throw new Error("expected invalid_url");
    } catch (error) {
      expectConfigError(error, "invalid_url");
    }
  });
});

describe("N-UNIT-09", () => {
  it("matches 16-subset endpoint truth table", () => {
    for (let mask = 0; mask < 1 << CAPABILITY_NAMES.length; mask++) {
      const flags = {
        stubs: (mask & 1) !== 0,
        rest: (mask & 2) !== 0,
        assertions: (mask & 4) !== 0,
        reporting: (mask & 8) !== 0,
      };
      const truth = capabilityUnionTruth(flags);
      expect(truth.api).toBe(flags.rest || flags.assertions);
      expect(truth.wiremock).toBe(flags.stubs || flags.assertions);
    }
  });
});
