import { format, isAfter, isBefore, isSameDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

interface DateTimePickerProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  placeholder?: string;
}

export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "Datum wählen",
}: DateTimePickerProps) {
  const timeId = useId();
  const timeValue = value ? format(value, "HH:mm") : "";

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
    const next = new Date(date);
    const base = value ?? new Date();
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    onChange(clamp(next));
  }

  function updateTime(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
    const next = new Date(value ?? new Date());
    next.setHours(hours, minutes, 0, 0);
    onChange(clamp(next));
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon />
            {value ? format(value, "dd.MM.yyyy") : placeholder}
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
        </PopoverContent>
      </Popover>
      <Input
        id={timeId}
        type="time"
        value={timeValue}
        disabled={disabled || !value}
        onChange={(e) => updateTime(e.target.value)}
      />
    </div>
  );
}
