import { describe, expect, it } from "vitest";
import {
  clampDateTime,
  formatDateTimeInput,
  parseDateTimeInput,
  toMinutePrecision,
  withDay,
  withTime,
} from "./date-time";

const reference = new Date(2026, 8, 4, 14, 30, 45, 123); // 04.09.2026, 14:30:45.123

describe("parseDateTimeInput", () => {
  it("parses the canonical format", () => {
    expect(parseDateTimeInput("04.09.2026, 14:30", reference)).toEqual(
      new Date(2026, 8, 4, 14, 30),
    );
  });

  it("parses sloppy input without leading zeros or a comma", () => {
    expect(parseDateTimeInput("4.9.2026 8:05", reference)).toEqual(new Date(2026, 8, 4, 8, 5));
  });

  it("expands two-digit years", () => {
    expect(parseDateTimeInput("04.09.26 09:00", reference)).toEqual(new Date(2026, 8, 4, 9, 0));
  });

  it("keeps the reference time when only a date is typed", () => {
    expect(parseDateTimeInput("01.09.", reference)).toEqual(new Date(2026, 8, 1, 14, 30));
  });

  it("keeps the reference day when only a time is typed", () => {
    expect(parseDateTimeInput("07:15", reference)).toEqual(new Date(2026, 8, 4, 7, 15));
  });

  it("resolves relative day words against today, not against the field value", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(parseDateTimeInput("gestern 22:00", reference)).toEqual(
      new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 22, 0),
    );

    const today = new Date();
    expect(parseDateTimeInput("heute", reference)).toEqual(
      new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 30),
    );
  });

  it("accepts a dot as time separator", () => {
    expect(parseDateTimeInput("04.09.2026 14.05", reference)).toEqual(new Date(2026, 8, 4, 14, 5));
  });

  it("never returns seconds or milliseconds", () => {
    const parsed = parseDateTimeInput("04.09.2026, 14:30", reference);
    expect(parsed?.getSeconds()).toBe(0);
    expect(parsed?.getMilliseconds()).toBe(0);
  });

  it("rejects impossible and malformed input", () => {
    expect(parseDateTimeInput("31.02.2026", reference)).toBeNull();
    expect(parseDateTimeInput("04.13.2026", reference)).toBeNull();
    expect(parseDateTimeInput("04.09.2026 25:00", reference)).toBeNull();
    expect(parseDateTimeInput("04.09.2026 12:75", reference)).toBeNull();
    expect(parseDateTimeInput("irgendwas", reference)).toBeNull();
    expect(parseDateTimeInput("   ", reference)).toBeNull();
  });

  it("round-trips its own formatted output", () => {
    const formatted = formatDateTimeInput(reference);
    expect(formatted).toBe("04.09.2026, 14:30");
    expect(parseDateTimeInput(formatted, reference)).toEqual(new Date(2026, 8, 4, 14, 30));
  });
});

describe("clampDateTime", () => {
  const min = new Date(2026, 8, 1, 8, 0);
  const max = new Date(2026, 8, 4, 14, 30, 45, 123);

  it("returns values inside the range at minute precision", () => {
    expect(clampDateTime(new Date(2026, 8, 2, 10, 15, 30), min, max)).toEqual(
      new Date(2026, 8, 2, 10, 15),
    );
  });

  it("clamps to the boundaries", () => {
    expect(clampDateTime(new Date(2026, 8, 4, 23, 0), min, max)).toEqual(
      new Date(2026, 8, 4, 14, 30),
    );
    expect(clampDateTime(new Date(2026, 7, 1, 0, 0), min, max)).toEqual(min);
  });

  it("works without bounds", () => {
    expect(clampDateTime(new Date(2026, 8, 4, 14, 30, 59))).toEqual(new Date(2026, 8, 4, 14, 30));
  });
});

describe("withTime / withDay / toMinutePrecision", () => {
  it("replaces only the time", () => {
    expect(withTime(reference, 6, 5)).toEqual(new Date(2026, 8, 4, 6, 5));
  });

  it("replaces only the day", () => {
    expect(withDay(reference, new Date(2026, 0, 31, 23, 59))).toEqual(
      new Date(2026, 0, 31, 14, 30),
    );
  });

  it("does not mutate its input", () => {
    const input = new Date(reference);
    toMinutePrecision(input);
    withTime(input, 1, 1);
    withDay(input, new Date(2020, 0, 1));
    expect(input).toEqual(reference);
  });
});
