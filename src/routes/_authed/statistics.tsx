import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatDuration } from "~/lib/format";
import { orpc } from "~/lib/orpc";

export const Route = createFileRoute("/_authed/statistics")({
  component: StatisticsPage,
});

const REASON_COLORS = ["#0052CC", "#FF991F", "#DE350B", "#00875A", "#6554C0"];

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatisticsPage() {
  const overview = useQuery(orpc.stats.overview.queryOptions());
  const failures = useQuery(orpc.stats.failures.queryOptions());

  if (overview.isLoading || failures.isLoading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const o = overview.data;
  const f = failures.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Statistik</h1>
        <p className="text-sm text-muted-foreground">Auswertung deiner Geräte.</p>
      </div>

      {o && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Gesamt" value={o.totalDevices} />
          <StatTile label="Aktiv" value={o.activeDevices} />
          <StatTile label="Abgeschlossen" value={o.completedDevices} />
          <StatTile label="Fehlgeschlagen" value={o.failedDevices} />
        </div>
      )}

      {o && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fehlerrate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sensor</span>
                <span className="font-medium">{o.sensorFailureRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Katheter</span>
                <span className="font-medium">{o.catheterFailureRate}%</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Durchschnittliche Tragedauer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sensor</span>
                <span className="font-medium">{formatDuration(o.avgSensorDurationHours)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Katheter</span>
                <span className="font-medium">{formatDuration(o.avgCatheterDurationHours)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {f && f.byReason.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fehler nach Grund</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={f.byReason} margin={{ left: -16 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="reasonLabel"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-popover-foreground)",
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {f.byReason.map((entry, i) => (
                    <Cell key={entry.reason} fill={REASON_COLORS[i % REASON_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {f && f.byDeviceType.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {f.byDeviceType.map((mtbf) => (
            <Card key={mtbf.deviceType}>
              <CardHeader>
                <CardTitle className="text-base">
                  {mtbf.deviceType === "sensor" ? "Sensor" : "Katheter"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ø Laufzeit (abgeschlossen)</span>
                  <span className="font-medium">{formatDuration(mtbf.mtbfHours)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abgeschlossen</span>
                  <span className="font-medium">{mtbf.totalCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fehlgeschlagen</span>
                  <span className="font-medium">{mtbf.totalFailures}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {f && f.byLocation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fehlerrate nach Körperstelle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {f.byLocation.map((loc) => (
              <div key={loc.bodyLocation} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{loc.bodyLocationLabel}</span>
                <span className="font-medium">
                  {loc.failureRate}% ({loc.failedDevices}/{loc.totalDevices})
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
