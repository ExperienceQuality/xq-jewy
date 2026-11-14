import { describe, expect, it } from "vitest";
import {
  CONFIG_FILE_MAX_BYTES,
  decodeConfigBytes,
} from "../../src/config/read.js";
import { expectConfigError } from "../helpers/config-error.js";

describe("N-UNIT-02", () => {
  it("enforces byte size including BOM and strict UTF-8", () => {
    const under = new Uint8Array(CONFIG_FILE_MAX_BYTES - 1);
    expect(decodeConfigBytes(under).length).toBe(CONFIG_FILE_MAX_BYTES - 1);

    const exact = new Uint8Array(CONFIG_FILE_MAX_BYTES);
    expect(decodeConfigBytes(exact).length).toBe(CONFIG_FILE_MAX_BYTES);

    const over = new Uint8Array(CONFIG_FILE_MAX_BYTES + 1);
    try {
      decodeConfigBytes(over);
      throw new Error("expected too_large");
    } catch (error) {
      expectConfigError(error, "too_large");
    }

    const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x61]);
    expect(decodeConfigBytes(bom)).toBe("a");

    const invalid = new Uint8Array([0xff]);
    try {
      decodeConfigBytes(invalid);
      throw new Error("expected decode_error");
    } catch (error) {
      expectConfigError(error, "decode_error");
    }

    const utf16 = new Uint8Array([0xff, 0xfe, 0x00]);
    try {
      decodeConfigBytes(utf16);
      throw new Error("expected decode_error");
    } catch (error) {
      expectConfigError(error, "decode_error");
    }
  });
});
