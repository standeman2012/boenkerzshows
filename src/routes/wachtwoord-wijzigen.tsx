import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/wachtwoord-wijzigen")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: ChangePw,
});

function ChangePw() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (pw.length < 6) return setErr("Minstens 6 tekens");
    if (pw !== pw2) return setErr("Wachtwoorden komen niet overeen");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (u.user) await supabase.from("profiles").update({ must_change_password: false }).eq("id", u.user.id);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl border border-border">
        <h1 className="text-xl font-bold mb-1">Nieuw wachtwoord</h1>
        <p className="text-sm text-muted-foreground mb-4">Stel je persoonlijke wachtwoord in.</p>
        <form onSubmit={submit} className="space-y-3">
          <input type="password" placeholder="Nieuw wachtwoord" value={pw} onChange={(e) => setPw(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border outline-none focus:border-primary" />
          <input type="password" placeholder="Herhaal wachtwoord" value={pw2} onChange={(e) => setPw2(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border outline-none focus:border-primary" />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button disabled={loading} className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">Opslaan</button>
        </form>
      </div>
    </div>
  );
}
