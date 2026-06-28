import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clipboard, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DateTimePicker } from "~/components/date-time-picker";
import { DeviceCard } from "~/components/device-card";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatDateTime, formatDuration } from "~/lib/format";
import { orpc } from "~/lib/orpc";
import type { DeviceResponse } from "~/server/devices";

export const Route = createFileRoute("/_authed/")({
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const devicesQuery = useQuery({
    ...orpc.devices.list.queryOptions({ input: { activeOnly: true } }),
    // Keep the countdown timers fresh without a manual refresh.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: orpc.devices.key() });
    queryClient.invalidateQueries({ queryKey: orpc.stats.key() });
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [failTarget, setFailTarget] = useState<DeviceResponse | null>(null);
  const [editTarget, setEditTarget] = useState<DeviceResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceResponse | null>(null);

  const endMutation = useMutation(orpc.devices.end.mutationOptions({ onSuccess: invalidate }));

  const devices = devicesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aktive Geräte</h1>
          <p className="text-sm text-muted-foreground">Sensoren und Katheter im Überblick.</p>
        </div>
        <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus />
          Neues Gerät
        </Button>
      </div>

      {devicesQuery.isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-muted-foreground">Keine aktiven Geräte.</p>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus />
              Erstes Gerät anlegen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onEnd={(d) => endMutation.mutate({ id: d.id })}
              onFail={setFailTarget}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <CreateDeviceDialog open={createOpen} onOpenChange={setCreateOpen} onDone={invalidate} />
      <FailDialog device={failTarget} onClose={() => setFailTarget(null)} onDone={invalidate} />
      <EditDialog device={editTarget} onClose={() => setEditTarget(null)} onDone={invalidate} />
      <DeleteDialog
        device={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDone={invalidate}
      />
    </div>
  );
}

function CreateDeviceDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const locationsQuery = useQuery(orpc.enums.bodyLocations.queryOptions());
  const settingsQuery = useQuery(orpc.settings.get.queryOptions());
  const [deviceType, setDeviceType] = useState<"sensor" | "catheter">("sensor");
  const [bodyLocation, setBodyLocation] = useState<string>("");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [lotNumber, setLotNumber] = useState<string>("");

  useEffect(() => {
    if (open && !startTime) setStartTime(new Date());
  }, [open, startTime]);

  const plannedDurationHours =
    deviceType === "sensor"
      ? (settingsQuery.data?.sensorDefaultHours ?? 240)
      : (settingsQuery.data?.catheterDefaultHours ?? 72);
  const plannedEndTime = startTime
    ? new Date(startTime.getTime() + plannedDurationHours * 3_600_000)
    : null;

  const createMutation = useMutation(
    orpc.devices.create.mutationOptions({
      onSuccess: () => {
        onDone();
        onOpenChange(false);
        setBodyLocation("");
        setStartTime(null);
        setLotNumber("");
      },
    }),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bodyLocation || !startTime) return;
    createMutation.mutate({
      deviceType,
      bodyLocation: bodyLocation as DeviceResponse["bodyLocation"],
      lotNumber: lotNumber || undefined,
      startTime,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Gerät</DialogTitle>
          <DialogDescription>Lege einen neuen Sensor oder Katheter an.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Typ</Label>
            <Select
              value={deviceType}
              onValueChange={(v) => setDeviceType(v as "sensor" | "catheter")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sensor">Sensor</SelectItem>
                <SelectItem value="catheter">Katheter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Körperstelle</Label>
            <Select value={bodyLocation} onValueChange={setBodyLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Bitte wählen" />
              </SelectTrigger>
              <SelectContent>
                {(locationsQuery.data ?? []).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {deviceType === "sensor" && (
            <div className="space-y-2">
              <Label htmlFor="lot-number">Sensor-Lotnummer</Label>
              <Input
                id="lot-number"
                value={lotNumber}
                autoComplete="off"
                onChange={(e) => setLotNumber(e.target.value)}
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Startdatum und Startzeit</Label>
              <DateTimePicker value={startTime} onChange={setStartTime} max={new Date()} />
            </div>
            <div className="space-y-2">
              <Label>Enddatum und Endzeit geplant</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">
                  {plannedEndTime ? formatDateTime(plannedEndTime) : "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(plannedDurationHours)} aus deinen Einstellungen
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={!bodyLocation || !startTime || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="animate-spin" />}
              Anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FailDialog({
  device,
  onClose,
  onDone,
}: {
  device: DeviceResponse | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const reasonsQuery = useQuery(orpc.enums.failureReasons.queryOptions());
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [failedAt, setFailedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (device) setFailedAt(new Date());
  }, [device]);

  const failMutation = useMutation(
    orpc.devices.reportFailure.mutationOptions({
      onSuccess: () => {
        onDone();
        onClose();
        setReason("");
        setNotes("");
        setFailedAt(null);
        setCopied(false);
      },
    }),
  );

  const failureDate = failedAt ?? new Date();
  const reportText = device ? sensorReportText(device, failureDate, reason, notes) : "";

  async function copyReport() {
    if (!reportText) return;
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Dialog open={device != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fehler melden</DialogTitle>
          <DialogDescription>Warum musste das Gerät vorzeitig gewechselt werden?</DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-12rem)] space-y-4 overflow-y-auto pr-1">
          {device?.deviceType === "sensor" && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Meldedaten</p>
                <Button type="button" variant="outline" size="sm" onClick={copyReport}>
                  <Clipboard />
                  {copied ? "Kopiert" : "Kopieren"}
                </Button>
              </div>
              <ReportRows device={device} failedAt={failureDate} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Grund</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Bitte wählen" />
              </SelectTrigger>
              <SelectContent>
                {(reasonsQuery.data ?? []).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Zeitpunkt des Fehlers</Label>
            <DateTimePicker value={failedAt} onChange={setFailedAt} max={new Date()} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notiz (optional)</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            disabled={!reason || !device || failMutation.isPending}
            onClick={() =>
              device &&
              reason &&
              failMutation.mutate({
                id: device.id,
                reason: reason as DeviceResponse["failureReason"] & string,
                notes: notes || undefined,
                failedAt: failedAt ?? undefined,
              })
            }
          >
            {failMutation.isPending && <Loader2 className="animate-spin" />}
            Fehler melden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  device,
  onClose,
  onDone,
}: {
  device: DeviceResponse | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [lotNumber, setLotNumber] = useState<string>("");

  // Pre-fill the field with the device's current start time so the user adjusts
  // it instead of re-entering the whole timestamp.
  useEffect(() => {
    if (device) {
      setStartTime(new Date(device.startTime));
      setLotNumber(device.lotNumber ?? "");
    }
  }, [device]);

  const plannedEndTime =
    device && startTime
      ? new Date(startTime.getTime() + device.plannedDurationHours * 3_600_000)
      : null;

  const editMutation = useMutation(
    orpc.devices.update.mutationOptions({
      onSuccess: () => {
        onDone();
        onClose();
      },
    }),
  );

  return (
    <Dialog open={device != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerät ändern</DialogTitle>
          <DialogDescription>Korrigiere Startzeit oder Sensor-Lotnummer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {device?.deviceType === "sensor" && (
            <div className="space-y-2">
              <Label htmlFor="edit-lot-number">Sensor-Lotnummer</Label>
              <Input
                id="edit-lot-number"
                value={lotNumber}
                autoComplete="off"
                onChange={(e) => setLotNumber(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Startdatum und Startzeit</Label>
            <DateTimePicker value={startTime} onChange={setStartTime} max={new Date()} />
          </div>
          <div className="space-y-2">
            <Label>Enddatum und Endzeit geplant</Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">{plannedEndTime ? formatDateTime(plannedEndTime) : "-"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDuration(device?.plannedDurationHours ?? null)} gespeicherte Laufzeit
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={!startTime || !device || editMutation.isPending}
            onClick={() =>
              device &&
              startTime &&
              editMutation.mutate({
                id: device.id,
                startTime,
                lotNumber: device.deviceType === "sensor" ? lotNumber : undefined,
              })
            }
          >
            {editMutation.isPending && <Loader2 className="animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportRows({ device, failedAt }: { device: DeviceResponse; failedAt: Date }) {
  const rows = [
    ["Sensor-Lotnummer", device.lotNumber || "-"],
    ["Start", formatDateTime(device.startTime)],
    ["Geplantes Ende", formatDateTime(device.plannedEndTime)],
    ["Ausfall", formatDateTime(failedAt)],
  ];

  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-x-3 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-words font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function sensorReportText(
  device: DeviceResponse,
  failedAt: Date,
  reason: string,
  notes: string,
): string {
  const lines = [
    "Sensor-Ausfall",
    `Lotnummer: ${device.lotNumber || "-"}`,
    `Start: ${formatDateTime(device.startTime)}`,
    `Geplantes Ende: ${formatDateTime(device.plannedEndTime)}`,
    `Ausfall: ${formatDateTime(failedAt)}`,
    `Körperstelle: ${device.bodyLocationLabel}`,
  ];
  if (reason) lines.push(`Grund: ${reason}`);
  if (notes) lines.push(`Notiz: ${notes}`);
  return lines.join("\n");
}

function DeleteDialog({
  device,
  onClose,
  onDone,
}: {
  device: DeviceResponse | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const deleteMutation = useMutation(
    orpc.devices.remove.mutationOptions({
      onSuccess: () => {
        onDone();
        onClose();
      },
    }),
  );

  return (
    <Dialog open={device != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerät löschen</DialogTitle>
          <DialogDescription>
            Das Gerät wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            disabled={!device || deleteMutation.isPending}
            onClick={() => device && deleteMutation.mutate({ id: device.id })}
          >
            {deleteMutation.isPending && <Loader2 className="animate-spin" />}
            Löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
