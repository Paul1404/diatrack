import { Activity, Clock, FlaskConical, MoreHorizontal } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Progress } from "~/components/ui/progress";
import { formatDateTime, formatRemaining } from "~/lib/format";
import type { DeviceResponse } from "~/server/devices";

interface DeviceCardProps {
  device: DeviceResponse;
  onEnd: (device: DeviceResponse) => void;
  onFail: (device: DeviceResponse) => void;
  onEdit: (device: DeviceResponse) => void;
  onDelete: (device: DeviceResponse) => void;
}

function urgency(remainingHours: number | null) {
  if (remainingHours == null) return { indicator: "bg-primary", badge: "default" as const };
  if (remainingHours <= 6) return { indicator: "bg-destructive", badge: "destructive" as const };
  if (remainingHours <= 24) return { indicator: "bg-warning", badge: "warning" as const };
  return { indicator: "bg-success", badge: "success" as const };
}

export function DeviceCard({ device, onEnd, onFail, onEdit, onDelete }: DeviceCardProps) {
  const Icon = device.deviceType === "sensor" ? Activity : FlaskConical;
  const typeLabel = device.deviceType === "sensor" ? "Sensor" : "Katheter";
  const { indicator, badge } = urgency(device.remainingHours);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">{typeLabel}</p>
              <p className="text-sm text-muted-foreground">{device.bodyLocationLabel}</p>
              {device.deviceType === "sensor" && device.lotNumber && (
                <p className="truncate text-xs text-muted-foreground">Lot {device.lotNumber}</p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Aktionen">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEnd(device)}>
                Wechsel abschließen
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onFail(device)}>Fehler melden</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEdit(device)}>Gerät ändern</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(device)}
              >
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-4" />
              Verbleibend
            </span>
            <Badge variant={badge}>{formatRemaining(device.remainingHours)}</Badge>
          </div>
          <Progress value={device.progressPercent ?? 0} indicatorClassName={indicator} />
          <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            <p>Start: {formatDateTime(device.startTime)}</p>
            <p>Ende geplant: {formatDateTime(device.plannedEndTime)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
