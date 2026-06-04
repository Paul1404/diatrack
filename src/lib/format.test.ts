import { describe, expect, it } from "vitest";
import { formatDuration, formatRemaining } from "~/lib/format";

describe("formatRemaining", () => {
  it("handles null and expired", () => {
    expect(formatRemaining(null)).toBe("-");
    expect(formatRemaining(0)).toBe("Abgelaufen");
    expect(formatRemaining(-5)).toBe("Abgelaufen");
  });

  it("formats days and hours", () => {
    expect(formatRemaining(50)).toBe("2 T 2 Std");
  });

  it("formats sub-day durations", () => {
    expect(formatRemaining(5.5)).toBe("5 Std 30 Min");
  });
});

describe("formatDuration", () => {
  it("handles null", () => {
    expect(formatDuration(null)).toBe("-");
  });

  it("formats hours into days", () => {
    expect(formatDuration(72)).toBe("3 T 0 Std");
    expect(formatDuration(10)).toBe("10 Std");
  });

  it("never rolls remainder up to 24 hours", () => {
    // 47.6h rounds to 48h -> 2 days 0h, not "1 T 24 Std".
    expect(formatDuration(47.6)).toBe("2 T 0 Std");
    expect(formatDuration(23.6)).toBe("1 T 0 Std");
  });
});
