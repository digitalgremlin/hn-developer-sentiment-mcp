import { describe, it, expect } from "vitest";
import { TtlLruCache } from "../src/cache.js";

describe("TtlLruCache", () => {
  it("expires entries after ttl and evicts at capacity", () => {
    let now = 0;
    const c = new TtlLruCache<string>({ capacity: 2, ttlMs: 1000, clock: () => now });
    c.set("a", "1"); c.set("b", "2");
    expect(c.get("a")).toBe("1");
    now = 1001;
    expect(c.get("a")).toBeUndefined();       // expired
    now = 0;
    const d = new TtlLruCache<string>({ capacity: 2, ttlMs: 1000, clock: () => now });
    d.set("a", "1"); d.set("b", "2"); d.get("a"); d.set("c", "3"); // b is LRU → evicted
    expect(d.get("b")).toBeUndefined();
    expect(d.get("a")).toBe("1");
  });
});
