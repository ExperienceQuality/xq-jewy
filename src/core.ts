// Pure business logic. No MCP imports here, so it is trivial to unit test.

/** Return a greeting for the given name. */
export function greet(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("name must not be empty");
  }
  return `Hello, ${trimmed}!`;
}

/** Return the sum of two numbers. */
export function add(a: number, b: number): number {
  return a + b;
}
