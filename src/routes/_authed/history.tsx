import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatDateTime, formatDuration } from "~/lib/format";
import { orpc } from "~/lib/orpc";

export const Route = createFileRoute("/_authed/history")({
  component: HistoryPage,
});

const STATUS_META: Record<
  string,
  { label: string; variant: "success" | "destructive" | "default" }
> = {
  active: { label: "Aktiv", variant: "default" },
  completed: { label: "Abgeschlossen", variant: "success" },
  failed: { label: "Fehlgeschlagen", variant: "destructive" },
};

function HistoryPage() {
  const [deviceType, setDeviceType] = useState<"all" | "sensor" | "catheter">("all");
  const [days, setDays] = useState<number>(90);

  const historyQuery = useQuery(
    orpc.stats.history.queryOptions({
      input: { days, deviceType: deviceType === "all" ? undefined : deviceType },
    }),
  );

  const entries = historyQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verlauf</h1>
          <p className="text-sm text-muted-foreground">Alle Geräte der letzten Zeit.</p>
        </div>
        <div className="flex gap-2">
          <Select value={deviceType} onValueChange={(v) => setDeviceType(v as typeof deviceType)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              <SelectItem value="sensor">Sensor</SelectItem>
              <SelectItem value="catheter">Katheter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 Tage</SelectItem>
              <SelectItem value="90">90 Tage</SelectItem>
              <SelectItem value="180">180 Tage</SelectItem>
              <SelectItem value="365">1 Jahr</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {historyQuery.isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">Keine Einträge im Zeitraum.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Körperstelle</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Geplant</TableHead>
                  <TableHead>Tatsächlich</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const status = STATUS_META[e.status] ?? STATUS_META.active;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.deviceType === "sensor" ? "Sensor" : "Katheter"}
                      </TableCell>
                      <TableCell>{e.bodyLocationLabel}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(e.startTime)}
                      </TableCell>
                      <TableCell>{formatDuration(e.plannedDurationHours)}</TableCell>
                      <TableCell>{formatDuration(e.actualDurationHours)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
