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
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  if (days > 0) return `${days} T ${remHours} Std`;
  return `${Math.round(hours)} Std`;
}
