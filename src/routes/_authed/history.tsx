import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clipboard, Loader2 } from "lucide-react";
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
import type { HistoryEntry } from "~/server/orpc/procedures/stats";

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

const FAILURE_REASON_LABELS: Record<string, string> = {
  clogged: "Verstopft",
  fell_off: "Abgefallen",
  sensor_error: "Sensorfehler",
  skin_reaction: "Hautreaktion",
  other: "Sonstiges",
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
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Select value={deviceType} onValueChange={(v) => setDeviceType(v as typeof deviceType)}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              <SelectItem value="sensor">Sensor</SelectItem>
              <SelectItem value="catheter">Katheter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-full sm:w-32">
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
            <>
              <div className="divide-y md:hidden">
                {entries.map((e) => {
                  const status = STATUS_META[e.status] ?? STATUS_META.active;
                  return <HistoryCard key={e.id} entry={e} status={status} />;
                })}
              </div>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Körperstelle</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Ende geplant</TableHead>
                    <TableHead>Ende/Ausfall</TableHead>
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
                        <TableCell className="max-w-[9rem] truncate text-muted-foreground">
                          {e.lotNumber ?? "-"}
                        </TableCell>
                        <TableCell>{e.bodyLocationLabel}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(e.startTime)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(e.plannedEndTime)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {e.endedAt ? formatDateTime(e.endedAt) : "-"}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryCard({
  entry,
  status,
}: {
  entry: HistoryEntry;
  status: { label: string; variant: "success" | "destructive" | "default" };
}) {
  const [copied, setCopied] = useState(false);
  const failureReason = entry.failureReason ? FAILURE_REASON_LABELS[entry.failureReason] : null;

  async function copy() {
    await navigator.clipboard.writeText(historyReportText(entry, failureReason));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{entry.deviceType === "sensor" ? "Sensor" : "Katheter"}</p>
          <p className="text-sm text-muted-foreground">{entry.bodyLocationLabel}</p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-x-3 gap-y-2 text-sm">
        <HistoryRow label="Lot" value={entry.lotNumber ?? "-"} />
        <HistoryRow label="Start" value={formatDateTime(entry.startTime)} />
        <HistoryRow label="Ende geplant" value={formatDateTime(entry.plannedEndTime)} />
        <HistoryRow
          label="Ende/Ausfall"
          value={entry.endedAt ? formatDateTime(entry.endedAt) : "-"}
        />
        <HistoryRow label="Geplant" value={formatDuration(entry.plannedDurationHours)} />
        <HistoryRow label="Tatsächlich" value={formatDuration(entry.actualDurationHours)} />
        {failureReason && <HistoryRow label="Grund" value={failureReason} />}
      </dl>

      {entry.deviceType === "sensor" && (
        <Button variant="outline" size="sm" className="w-full" onClick={copy}>
          <Clipboard />
          {copied ? "Kopiert" : "Meldedaten kopieren"}
        </Button>
      )}
    </article>
  );
}

function HistoryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}

function historyReportText(entry: HistoryEntry, failureReason: string | null): string {
  const lines = [
    `${entry.deviceType === "sensor" ? "Sensor" : "Katheter"}-Protokoll`,
    `Lotnummer: ${entry.lotNumber || "-"}`,
    `Start: ${formatDateTime(entry.startTime)}`,
    `Geplantes Ende: ${formatDateTime(entry.plannedEndTime)}`,
    `Ende/Ausfall: ${entry.endedAt ? formatDateTime(entry.endedAt) : "-"}`,
    `Körperstelle: ${entry.bodyLocationLabel}`,
    `Status: ${(STATUS_META[entry.status] ?? STATUS_META.active).label}`,
  ];
  if (failureReason) lines.push(`Grund: ${failureReason}`);
  return lines.join("\n");
}
