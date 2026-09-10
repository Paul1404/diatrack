import { isAfter, isBefore, isSameDay } from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  clampDateTime,
  DATE_TIME_PLACEHOLDER,
  formatDateTimeInput,
  parseDateTimeInput,
  toMinutePrecision,
  withDay,
  withTime,
} from "~/lib/date-time";
import { cn } from "~/lib/utils";

interface DateTimePickerProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Wired to the surrounding <Label htmlFor>. Generated when omitted. */
  id?: string;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n: number) => n.toString().padStart(2, "0");

export function DateTimePicker({
  value,
  onChange,
  id,
  min,
  max,
  disabled,
  clearable = true,
  placeholder = DATE_TIME_PLACEHOLDER,
}: DateTimePickerProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;

  const [open, setOpen] = useState(false);
  // While the field is being typed in, the draft wins over the committed value.
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const text = draft ?? (value ? formatDateTimeInput(value) : "");

  // The time controls always operate on a concrete day, even before a date was
  // picked, so the hour and minute options can be checked against min/max.
  const base = value ?? clampDateTime(new Date(), min, max);

  function commit(next: Date | null) {
    setDraft(null);
    setInvalid(false);
    onChange(next && clampDateTime(next, min, max));
  }

  function commitDraft() {
    if (draft === null) return;
    if (draft.trim() === "") {
      commit(null);
      return;
    }
    const parsed = parseDateTimeInput(draft, value ?? new Date());
    if (!parsed) {
      setInvalid(true);
      return;
    }
    commit(parsed);
  }

  function selectDay(day: Date | undefined) {
    if (!day) return;
    commit(withDay(base, day));
  }

  function hourDisabled(hour: number) {
    // An hour is unreachable only when even its best-case minute is out of range.
    return (
      (min != null && isBefore(withTime(base, hour, 59), min)) ||
      (max != null && isAfter(withTime(base, hour, 0), max))
    );
  }

  function minuteDisabled(minute: number) {
    const candidate = withTime(base, base.getHours(), minute);
    return (min != null && isBefore(candidate, min)) || (max != null && isAfter(candidate, max));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={invalid ? hintId : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Committing must not submit the surrounding dialog form.
              e.preventDefault();
              commitDraft();
            }
            if (e.key === "Escape" && draft !== null) {
              e.preventDefault();
              setDraft(null);
              setInvalid(false);
            }
          }}
          className={cn(
            "min-w-0 flex-1",
            invalid && "border-destructive focus-visible:ring-destructive",
          )}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label="Kalender und Uhrzeit öffnen"
              className="shrink-0"
            >
              <CalendarIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value ?? undefined}
              defaultMonth={value ?? base}
              startMonth={min}
              endMonth={max}
              onSelect={selectDay}
              disabled={(date) =>
                (min != null && !isSameDay(date, min) && isBefore(date, min)) ||
                (max != null && !isSameDay(date, max) && isAfter(date, max))
              }
            />
            <div className="flex items-center gap-2 border-t p-3">
              <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
              <Select
                value={value ? pad(value.getHours()) : undefined}
                onValueChange={(hour) => commit(withTime(base, Number(hour), base.getMinutes()))}
              >
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
              <Select
                value={value ? pad(value.getMinutes()) : undefined}
                onValueChange={(minute) => commit(withTime(base, base.getHours(), Number(minute)))}
              >
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
            <div className="flex items-center justify-between gap-2 border-t p-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => commit(toMinutePrecision(new Date()))}
              >
                Jetzt
              </Button>
              <div className="flex items-center gap-2">
                {clearable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!value}
                    onClick={() => commit(null)}
                  >
                    Löschen
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => setOpen(false)}>
                  Fertig
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {invalid && (
        <p id={hintId} className="text-xs text-destructive">
          Bitte im Format {DATE_TIME_PLACEHOLDER} eingeben.
        </p>
      )}
    </div>
  );
}
