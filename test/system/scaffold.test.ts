import { describe, expect, it } from "vitest";

describe("scaffold", () => {
  it("system project runs", () => {
    expect(process.env).toBeDefined();
  });
});
