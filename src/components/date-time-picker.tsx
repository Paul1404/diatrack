import { format, isAfter, isBefore, isSameDay } from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

interface DateTimePickerProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n: number) => n.toString().padStart(2, "0");

function atTime(base: Date, hours: number, minutes: number) {
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "Datum wählen",
}: DateTimePickerProps) {
  // Constrain the time controls against the day currently in view so the user
  // can't pick a time that violates min/max (rather than silently snapping).
  const day = value ?? new Date();

  function clamp(next: Date) {
    if (min && isBefore(next, min)) return min;
    if (max && isAfter(next, max)) return max;
    return next;
  }

  function updateDate(date: Date | undefined) {
    if (!date) {
      onChange(null);
      return;
    }
    const base = value ?? new Date();
    onChange(clamp(atTime(date, base.getHours(), base.getMinutes())));
  }

  function updateHour(hour: string) {
    onChange(clamp(atTime(day, Number(hour), day.getMinutes())));
  }

  function updateMinute(minute: string) {
    onChange(clamp(atTime(day, day.getHours(), Number(minute))));
  }

  function hourDisabled(hour: number) {
    // The hour is unreachable only if even its best-case minute is out of range.
    return (
      (min != null && isBefore(atTime(day, hour, 59), min)) ||
      (max != null && isAfter(atTime(day, hour, 0), max))
    );
  }

  function minuteDisabled(minute: number) {
    if (!value) return false;
    const candidate = atTime(day, day.getHours(), minute);
    return (min != null && isBefore(candidate, min)) || (max != null && isAfter(candidate, max));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full min-w-0 justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon />
          {value ? format(value, "dd.MM.yyyy, HH:mm") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={updateDate}
          disabled={(date) =>
            (min != null && !isSameDay(date, min) && isBefore(date, min)) ||
            (max != null && !isSameDay(date, max) && isAfter(date, max))
          }
        />
        <div className="flex items-center gap-2 border-t p-3">
          <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
          <Select value={value ? pad(value.getHours()) : undefined} onValueChange={updateHour}>
            <SelectTrigger className="flex-1" aria-label="Stunde">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((hour) => (
                <SelectItem key={hour} value={pad(hour)} disabled={hourDisabled(hour)}>
                  {pad(hour)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select value={value ? pad(value.getMinutes()) : undefined} onValueChange={updateMinute}>
            <SelectTrigger className="flex-1" aria-label="Minute">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((minute) => (
                <SelectItem key={minute} value={pad(minute)} disabled={minuteDisabled(minute)}>
                  {pad(minute)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
