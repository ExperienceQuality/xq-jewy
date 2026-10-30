import { readFileSync } from "node:fs";

// package.json is the single source of truth for the version.
// The relative path works from both src/ (dev) and dist/ (build).
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: `${number}.${number}.${number}`;
};

export const VERSION = pkg.version;
