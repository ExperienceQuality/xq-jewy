import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["text", "json", "json-summary"],
      reportsDirectory: "coverage",
      autoAttachSubprocess: false,
    },
    projects: [
      defineProject({
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          environment: "node",
        },
      }),
      defineProject({
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          environment: "node",
        },
      }),
      defineProject({
        test: {
          name: "system",
          include: ["test/system/**/*.test.ts"],
          environment: "node",
        },
      }),
    ],
  },
});
