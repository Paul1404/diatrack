import { format } from "date-fns";

/** Display and input format used by every date and time field in the app. */
export const DATE_TIME_PATTERN = "dd.MM.yyyy, HH:mm";
export const DATE_TIME_PLACEHOLDER = "TT.MM.JJJJ, HH:MM";

const RELATIVE_DAYS: Record<string, number> = {
  heute: 0,
  gestern: -1,
  vorgestern: -2,
  morgen: 1,
};

/** Drop seconds and milliseconds so a picked value round-trips through the UI unchanged. */
export function toMinutePrecision(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  return next;
}

/** Keep the day of `base` and put the given wall-clock time on it. */
export function withTime(base: Date, hours: number, minutes: number): Date {
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

/** Keep the time of `base` and move it onto the day of `day`. */
export function withDay(base: Date, day: Date): Date {
  const next = new Date(day);
  next.setHours(base.getHours(), base.getMinutes(), 0, 0);
  return next;
}

export function clampDateTime(value: Date, min?: Date, max?: Date): Date {
  if (min && value.getTime() < min.getTime()) return toMinutePrecision(min);
  if (max && value.getTime() > max.getTime()) return toMinutePrecision(max);
  return toMinutePrecision(value);
}

export function formatDateTimeInput(date: Date): string {
  return format(date, DATE_TIME_PATTERN);
}

function buildDate(day: number, month: number, year: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month - 1, day);
  // Rejects impossible dates like 31.02. that JavaScript would silently roll over.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/**
 * Parse what a German user actually types into a date field.
 *
 * Accepts "04.09.2026, 14:30", "4.9.26 14:30", "4.9." (year from the reference),
 * "heute 8:00" and "gestern 22:00" (relative to today), "jetzt", and a bare
 * "14:30" that keeps the reference day.
 * Missing parts fall back to `reference`, so editing only the time or only the
 * date never resets the other half. Returns null when the input is not a date.
 */
export function parseDateTimeInput(input: string, reference: Date = new Date()): Date | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "jetzt") return toMinutePrecision(new Date());

  let day: Date | null = null;
  let hours: number | null = null;
  let minutes: number | null = null;

  for (const token of normalized.replace(/,/g, " ").split(/\s+/).filter(Boolean)) {
    const time = token.match(/^(\d{1,2})[:.](\d{2})$/);
    if (time && hours === null) {
      const h = Number(time[1]);
      const m = Number(time[2]);
      if (h > 23 || m > 59) return null;
      hours = h;
      minutes = m;
      continue;
    }

    if (token in RELATIVE_DAYS && day === null) {
      // Relative words are relative to today, never to the value in the field.
      const relative = new Date();
      relative.setDate(relative.getDate() + RELATIVE_DAYS[token]);
      day = relative;
      continue;
    }

    const date = token.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?\.?$/);
    if (date && day === null) {
      const parsed = buildDate(
        Number(date[1]),
        Number(date[2]),
        date[3] ? Number(date[3]) : reference.getFullYear(),
      );
      if (!parsed) return null;
      day = parsed;
      continue;
    }

    return null;
  }

  if (day === null && hours === null) return null;
  const base = day ?? reference;
  return withTime(base, hours ?? reference.getHours(), minutes ?? reference.getMinutes());
}
