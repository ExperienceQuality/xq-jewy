import { describe, expect, it } from "vitest";
import { add, greet } from "../src/core.ts";

describe("greet", () => {
  it("greets by name", () => {
    expect(greet("Ada")).toBe("Hello, Ada!");
  });

  it("trims whitespace", () => {
    expect(greet("  Ada  ")).toBe("Hello, Ada!");
  });

  it.each(["", "   "])("rejects empty name %j", (name) => {
    expect(() => greet(name)).toThrow("name must not be empty");
  });
});

describe("add", () => {
  it.each([
    [2, 3, 5],
    [-1, 1, 0],
    [0.5, 0.25, 0.75],
  ])("add(%d, %d) = %d", (a, b, expected) => {
    expect(add(a, b)).toBe(expected);
  });
});
