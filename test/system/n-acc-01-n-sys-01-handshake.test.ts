import { describe, expect, it } from "vitest";

import {
  closeMcpSession,
  connectMcpSession,
} from "../helpers/mcp-stdio-client.js";
import { isPidAlive, reportingOnlyConfigPath } from "../helpers/spawn-bin.js";

describe("N-ACC-01 / N-SYS-01", () => {
  it("starts with a valid config and completes initialize + tools/list", async () => {
    const cfg = reportingOnlyConfigPath();
    const session = await connectMcpSession({
      xqEnv: { XQ_JEWY_CONFIG: cfg },
    });
    const pid = session.pid;

    try {
      const version = session.client.getServerVersion();
      expect(version?.name).toBe("xq-jewy");
      expect(version?.version).toBe("0.2.0");

      const listed = await session.client.listTools();
      expect(listed.tools).toEqual([]);

      // Diagnostics belong on stderr only; empty is fine on success.
      expect(session.stderr).not.toMatch(/\bFATAL\b/i);
    } finally {
      await closeMcpSession(session);
      if (pid !== null && pid !== undefined) {
        expect(isPidAlive(pid)).toBe(false);
      }
    }
  });
});
