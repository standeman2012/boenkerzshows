import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRESENTERS, ADMIN_EMAIL, accountEmail, defaultPassword } from "@/lib/accounts";
import { seedAccounts } from "@/lib/setup.functions";
import { initials } from "@/lib/date-utils";
import { Loader2, Shield, X } from "lucide-react";

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

type Account = { email: string; firstName: string; lastName: string; isAdmin: boolean };

function LoginPage() {
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(true);
  const [picked, setPicked] = useState<Account | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    seedAccounts()
      .then(() => setSeeded(true))
      .catch(() => setSeeded(true))
      .finally(() => setSeeding(false));
  }, []);

  const accounts: Account[] = [
    { email: ADMIN_EMAIL, firstName: "Admin", lastName: "", isAdmin: true },
    ...PRESENTERS.map((p) => ({
      email: accountEmail(p.firstName, p.lastName),
      firstName: p.firstName,
      lastName: p.lastName,
      isAdmin: false,
    })),
  ];

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    setLoading(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: picked.email, password: pw });
    setLoading(false);
    if (error) {
      setErr("Wachtwoord onjuist");
      return;
    }
    window.location.href = "/";
  };

  if (seeding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Accounts worden voorbereid...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <h1 className="text-3xl font-bold text-center mb-2">Welkom bij boenkerz</h1>
        <p className="text-center text-muted-foreground mb-8">Kies je account om in te loggen</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {accounts.map((a) => (
            <button
              key={a.email}
              onClick={() => {
                setPicked(a);
                setPw("");
                setErr("");
              }}
              className="group relative rounded-xl border border-border bg-card p-4 hover:border-primary hover:shadow-md transition-all text-left"
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`h-14 w-14 rounded-full flex items-center justify-center font-semibold text-lg ${
                    a.isAdmin ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {a.isAdmin ? <Shield className="h-6 w-6" /> : initials(a.firstName, a.lastName)}
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium">{a.firstName} {a.lastName}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {picked && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setPicked(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center font-semibold ${
                    picked.isAdmin ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {picked.isAdmin ? <Shield className="h-5 w-5" /> : initials(picked.firstName, picked.lastName)}
                </div>
                <div>
                  <div className="font-semibold">{picked.firstName} {picked.lastName}</div>
                  <div className="text-xs text-muted-foreground">Voer je wachtwoord in</div>
                </div>
              </div>
              <button onClick={() => setPicked(null)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={doLogin} className="space-y-3">
              <input
                type="password"
                autoFocus
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Wachtwoord"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background outline-none focus:border-primary"
              />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <button
                type="submit"
                disabled={loading || !pw}
                className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inloggen"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
