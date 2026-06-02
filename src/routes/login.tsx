import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Activity, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { signIn, signUp } from "~/lib/auth-client";
import { fetchSession, registrationEnabled } from "~/lib/auth-server";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await fetchSession();
    if (session) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { data: canRegister } = useQuery({
    queryKey: ["registration-enabled"],
    queryFn: () => registrationEnabled(),
  });

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result =
      mode === "signin"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name: email.split("@")[0] });

    setPending(false);
    if (result.error) {
      setError(
        mode === "signin"
          ? "Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen."
          : (result.error.message ?? "Registrierung fehlgeschlagen."),
      );
      return;
    }
    await router.invalidate();
    router.navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Activity className="size-6 text-primary" />
          </div>
          <CardTitle>DiaTrack</CardTitle>
          <CardDescription>
            {mode === "signin" ? "Melde dich an, um fortzufahren." : "Erstelle ein neues Konto."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {mode === "signin" ? "Anmelden" : "Registrieren"}
            </Button>
          </form>

          {canRegister && (
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
            >
              {mode === "signin"
                ? "Noch kein Konto? Registrieren"
                : "Bereits registriert? Anmelden"}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
