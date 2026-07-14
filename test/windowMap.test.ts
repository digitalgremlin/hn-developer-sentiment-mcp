import { describe, it, expect } from "vitest";
import { windowToBucket, withinWindow } from "../src/windowMap.js";

describe("windowToBucket", () => {
  it("maps days to the smallest covering bucket", () => {
    expect(windowToBucket(1)).toBe("day");
    expect(windowToBucket(7)).toBe("week");
    expect(windowToBucket(8)).toBe("month");
    expect(windowToBucket(30)).toBe("month");
    expect(windowToBucket(31)).toBe("year");
    expect(windowToBucket(90)).toBe("year");
  });
});

describe("withinWindow", () => {
  const now = 1_000_000; // epoch seconds
  it("includes items at the exact edge and excludes older", () => {
    expect(withinWindow(now - 1 * 86400, 1, now)).toBe(true);
    expect(withinWindow(now - 1 * 86400 - 1, 1, now)).toBe(false);
  });
});
