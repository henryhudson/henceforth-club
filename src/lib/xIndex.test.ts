import { describe, expect, it } from "vitest";
import { setXTxids } from "./xIndex";

describe("setXTxids", () => {
  it("returns false when Redis is unconfigured, never throwing", async () => {
    // No KV_REST_API_URL in the test environment -> getRedis() is null.
    await expect(setXTxids("henryhudson6", ["a".repeat(64)])).resolves.toBe(false);
  });
});
