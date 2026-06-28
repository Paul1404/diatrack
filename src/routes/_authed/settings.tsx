import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { EmailLogsPanel } from "~/components/email-logs-panel";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useSession } from "~/lib/auth-client";
import { orpc } from "~/lib/orpc";

export const Route = createFileRoute("/_authed/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Standardwerte und Benachrichtigungen.</p>
      </div>

      <UserSettingsCard />
      <DangerZoneCard />

      {isAdmin && (
        <>
          <SmtpCard />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">E-Mail-Protokoll</CardTitle>
              <CardDescription>Verlauf aller gesendeten Erinnerungen.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmailLogsPanel />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function UserSettingsCard() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(orpc.settings.get.queryOptions());

  const [sensorHours, setSensorHours] = useState("");
  const [catheterHours, setCatheterHours] = useState("");
  const [intervals, setIntervals] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setSensorHours(String(settingsQuery.data.sensorDefaultHours));
      setCatheterHours(String(settingsQuery.data.catheterDefaultHours));
      setIntervals(settingsQuery.data.reminderIntervalsHours.join(", "));
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.settings.key() });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    }),
  );

  function save(e: React.FormEvent) {
    e.preventDefault();
    const parsedIntervals = intervals
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0);
    updateMutation.mutate({
      sensorDefaultHours: Number(sensorHours),
      catheterDefaultHours: Number(catheterHours),
      reminderIntervalsHours: parsedIntervals,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Standardwerte</CardTitle>
        <CardDescription>Vorgaben für neue Geräte und Erinnerungen.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sensor-hours">Sensor-Laufzeit (Std)</Label>
              <Input
                id="sensor-hours"
                type="number"
                min={1}
                value={sensorHours}
                onChange={(e) => setSensorHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catheter-hours">Katheter-Laufzeit (Std)</Label>
              <Input
                id="catheter-hours"
                type="number"
                min={1}
                value={catheterHours}
                onChange={(e) => setCatheterHours(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="intervals">Erinnerungen vorher (Std, kommagetrennt)</Label>
            <Input
              id="intervals"
              value={intervals}
              placeholder="24, 6"
              onChange={(e) => setIntervals(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="animate-spin" />}
            {saved && <Check />}
            Speichern
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SmtpCard() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(orpc.admin.getSettings.queryOptions());

  const [form, setForm] = useState({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    smtpFrom: "",
    smtpTls: true,
    appUrl: "",
  });
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      const d = settingsQuery.data;
      setForm({
        smtpHost: d.smtpHost,
        smtpPort: String(d.smtpPort),
        smtpUser: d.smtpUser,
        smtpPassword: "",
        smtpFrom: d.smtpFrom,
        smtpTls: d.smtpTls,
        appUrl: d.appUrl,
      });
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation(
    orpc.admin.updateSettings.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.admin.getSettings.key() }),
    }),
  );

  const testMutation = useMutation(
    orpc.admin.testSmtp.mutationOptions({
      onSuccess: (r) => setTestResult(r.message),
      onError: (e) => setTestResult(e.message ?? "Fehler beim Senden"),
    }),
  );

  function save(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      smtpHost: form.smtpHost,
      smtpPort: Number(form.smtpPort),
      smtpUser: form.smtpUser,
      // Only send the password when the field was filled in.
      ...(form.smtpPassword ? { smtpPassword: form.smtpPassword } : {}),
      smtpFrom: form.smtpFrom,
      smtpTls: form.smtpTls,
      appUrl: form.appUrl,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SMTP (Admin)</CardTitle>
        <CardDescription>Konfiguration für den E-Mail-Versand.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">Host</Label>
              <Input
                id="smtp-host"
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-user">Benutzer</Label>
              <Input
                id="smtp-user"
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-pass">Passwort</Label>
              <Input
                id="smtp-pass"
                type="password"
                placeholder="unverändert"
                value={form.smtpPassword}
                onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-from">Absender</Label>
              <Input
                id="smtp-from"
                value={form.smtpFrom}
                onChange={(e) => setForm({ ...form, smtpFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-url">App-URL</Label>
              <Input
                id="app-url"
                value={form.appUrl}
                onChange={(e) => setForm({ ...form, appUrl: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="smtp-tls"
              checked={form.smtpTls}
              onCheckedChange={(v) => setForm({ ...form, smtpTls: v })}
            />
            <Label htmlFor="smtp-tls">STARTTLS verwenden</Label>
          </div>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="animate-spin" />}
            Speichern
          </Button>
        </form>

        <div className="mt-6 space-y-2 border-t pt-4">
          <Label htmlFor="test-email">Test-E-Mail senden an</Label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!testEmail || testMutation.isPending}
              onClick={() => {
                setTestResult(null);
                testMutation.mutate({ email: testEmail });
              }}
            >
              {testMutation.isPending && <Loader2 className="animate-spin" />}
              Testen
            </Button>
          </div>
          {testResult && <p className="text-sm text-muted-foreground">{testResult}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function DangerZoneCard() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const clearMutation = useMutation(
    orpc.devices.clearHistory.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.devices.key() });
        queryClient.invalidateQueries({ queryKey: orpc.stats.key() });
        setConfirming(false);
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verlauf löschen</CardTitle>
        <CardDescription>
          Entfernt alle abgeschlossenen und fehlgeschlagenen Geräte. Aktive Geräte bleiben erhalten.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {confirming ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="destructive"
              disabled={clearMutation.isPending}
              onClick={() => clearMutation.mutate({})}
            >
              {clearMutation.isPending && <Loader2 className="animate-spin" />}
              Wirklich löschen
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Abbrechen
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)}>
            Verlauf löschen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
