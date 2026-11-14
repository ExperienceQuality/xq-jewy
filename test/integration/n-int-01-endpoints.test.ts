import { describe, expect, it } from "vitest";
import {
  resolveEndpointUrls,
  XQ_JEWY_API_BASE_URL_ENV,
  XQ_JEWY_WIREMOCK_BASE_URL_ENV,
} from "../../src/config/endpoints.js";
import { expectConfigError } from "../helpers/config-error.js";

describe("N-INT-01", () => {
  const stubsOnly = {
    stubs: true,
    rest: false,
    assertions: false,
    reporting: false,
  };

  it("validates optional values and precedence", () => {
    const urls = resolveEndpointUrls(
      {
        [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "http://127.0.0.1:8081",
      },
      stubsOnly,
    );
    expect(urls.apiBaseUrl).toBeNull();
    expect(urls.wiremockBaseUrl).toBe("http://127.0.0.1:8081");

    try {
      resolveEndpointUrls(
        {
          [XQ_JEWY_API_BASE_URL_ENV]: "not-a-url",
          [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "http://127.0.0.1:8081",
        },
        stubsOnly,
      );
      throw new Error("expected invalid_url on optional API");
    } catch (error) {
      expectConfigError(error, "invalid_url");
      expect((error as { location: { name: string } }).location.name).toBe(
        XQ_JEWY_API_BASE_URL_ENV,
      );
    }

    try {
      resolveEndpointUrls(
        { [XQ_JEWY_WIREMOCK_BASE_URL_ENV]: "not-a-url" },
        { stubs: false, rest: true, assertions: false, reporting: false },
      );
      throw new Error("expected missing API");
    } catch (error) {
      expectConfigError(error, "missing_env");
      expect((error as { location: { name: string } }).location.name).toBe(
        XQ_JEWY_API_BASE_URL_ENV,
      );
    }
  });
});
