import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { adminDeleteUser, adminResetPassword } from "@/lib/admin.functions";
import { Loader2, Trash2, KeyRound, Check, X } from "lucide-react";

type Profile = { id: string; first_name: string; last_name: string; is_presenter: boolean };
type Program = { id: string; name: string };
type Perm = { user_id: string; program_id: string; can_edit: boolean };

export function UsersPage() {
  const { isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: p }, { data: pg }, { data: pm }] = await Promise.all([
      supabase.from("profiles").select("id,first_name,last_name,is_presenter").eq("is_presenter", true).order("first_name"),
      supabase.from("programs").select("id,name").order("name"),
      supabase.from("program_permissions").select("user_id,program_id,can_edit"),
    ]);
    setProfiles((p as any) ?? []);
    setPrograms((pg as any) ?? []);
    setPerms((pm as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("users-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "program_permissions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (!isAdmin) return <div className="p-6">Alleen admin.</div>;

  const togglePerm = async (userId: string, programId: string, current: boolean) => {
    if (current) {
      await supabase.from("program_permissions").delete().eq("user_id", userId).eq("program_id", programId);
    } else {
      await supabase.from("program_permissions").upsert({ user_id: userId, program_id: programId, can_edit: true }, { onConflict: "user_id,program_id" });
    }
  };

  const del = async (userId: string) => {
    if (!confirm("Gebruiker verwijderen?")) return;
    await adminDeleteUser({ data: { userId } });
    load();
  };

  const reset = async (userId: string) => {
    const pw = prompt("Nieuw tijdelijk wachtwoord:");
    if (!pw) return;
    await adminResetPassword({ data: { userId, password: pw } });
    alert("Wachtwoord gereset. Gebruiker moet bij eerste login wijzigen.");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Gebruikers</h1>
      <p className="text-sm text-muted-foreground mb-6">Beheer accounts en bewerkrechten per programma</p>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <div className="overflow-x-auto border border-border rounded-xl bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 sticky left-0 bg-muted/50 z-10">Gebruiker</th>
                {programs.map((p) => (<th key={p.id} className="p-2 text-center min-w-[100px]"><div className="text-xs">{p.name}</div></th>))}
                <th className="p-3 text-right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3 font-medium sticky left-0 bg-card">{u.first_name} {u.last_name}</td>
                  {programs.map((p) => {
                    const has = perms.some((x) => x.user_id === u.id && x.program_id === p.id && x.can_edit);
                    return (
                      <td key={p.id} className="p-2 text-center">
                        <button onClick={() => togglePerm(u.id, p.id, has)} className={`h-7 w-7 rounded-md inline-flex items-center justify-center ${has ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                          {has ? <Check className="h-4 w-4" /> : <X className="h-3 w-3" />}
                        </button>
                      </td>
                    );
                  })}
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => reset(u.id)} className="p-1.5 rounded hover:bg-muted" title="Wachtwoord resetten"><KeyRound className="h-4 w-4" /></button>
                    <button onClick={() => del(u.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Verwijderen"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {programs.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">Nog geen programma's aangemaakt.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
