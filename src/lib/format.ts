import { format } from "date-fns";
import { de } from "date-fns/locale";

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "dd.MM.yyyy HH:mm", { locale: de });
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "dd.MM.yyyy", { locale: de });
}

/** Human-readable remaining time, e.g. "2 T 4 Std" or "5 Std" or "Abgelaufen". */
export function formatRemaining(hours: number | null): string {
  if (hours == null) return "-";
  if (hours <= 0) return "Abgelaufen";
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const remHours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return `${days} T ${remHours} Std`;
  if (remHours > 0) return `${remHours} Std ${mins} Min`;
  return `${mins} Min`;
}

export function formatDuration(hours: number | null): string {
  if (hours == null) return "-";
  // Round to whole hours first, then split, so we never produce "1 T 24 Std".
  const total = Math.round(hours);
  const days = Math.floor(total / 24);
  const remHours = total % 24;
  if (days > 0) return `${days} T ${remHours} Std`;
  return `${total} Std`;
}

/** Format a date as a value for an <input type="datetime-local"> (local time). */
export function toDatetimeLocal(date: Date | string): string {
  return format(new Date(date), "yyyy-MM-dd'T'HH:mm");
}
