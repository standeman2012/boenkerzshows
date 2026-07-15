import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Plus, Trash2, Radio, X } from "lucide-react";

type Program = { id: string; name: string; description: string | null; presenter_id: string | null; type: "live" | "non_stop" | "recorded" };
type Profile = { id: string; first_name: string; last_name: string; is_presenter: boolean };
type Link = { program_id: string; user_id: string };

const TYPES: { v: Program["type"]; label: string; cls: string }[] = [
  { v: "live", label: "Live", cls: "bg-[color:var(--show-live)] text-white" },
  { v: "non_stop", label: "Non-stop", cls: "bg-[color:var(--show-nonstop)] text-white" },
  { v: "recorded", label: "Opgenomen", cls: "bg-[color:var(--show-recorded)] text-white" },
];

export function ProgramsPage() {
  const { isAdmin } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [presenters, setPresenters] = useState<Profile[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);

  const load = async () => {
    const [{ data: p }, { data: pr }, { data: pp }] = await Promise.all([
      supabase.from("programs").select("*").order("name"),
      supabase.from("profiles").select("id,first_name,last_name,is_presenter").eq("is_presenter", true).order("first_name"),
      supabase.from("program_presenters").select("program_id,user_id"),
    ]);
    setPrograms((p as any) ?? []);
    setPresenters((pr as any) ?? []);
    setLinks((pp as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("programs")
      .on("postgres_changes", { event: "*", schema: "public", table: "programs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "program_presenters" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const remove = async (id: string) => {
    if (!confirm("Programma verwijderen?")) return;
    await supabase.from("programs").delete().eq("id", id);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Programma's</h1>
          <p className="text-sm text-muted-foreground">Beheer alle shows van het station</p>
        </div>
        {isAdmin && (
          <button onClick={() => setCreating(true)} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 flex items-center gap-2">
            <Plus className="h-4 w-4" />Nieuw programma
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : programs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Radio className="h-10 w-10 mx-auto mb-3 opacity-50" />
          Nog geen programma's{isAdmin && ". Maak er een aan."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((p) => {
            const type = TYPES.find((t) => t.v === p.type)!;
            const progPresenters = links.filter((l) => l.program_id === p.id).map((l) => presenters.find((x) => x.id === l.user_id)).filter(Boolean) as Profile[];
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.cls}`}>{type.label}</span>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(p)} className="text-xs px-2 py-1 rounded hover:bg-muted">Bewerken</button>
                      <button onClick={() => remove(p.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.description || "Geen beschrijving"}</p>
                <div className="mt-3 text-xs text-muted-foreground">
                  Presentator{progPresenters.length !== 1 ? "en" : ""}: <span className="font-medium text-foreground">{progPresenters.length > 0 ? progPresenters.map((x) => `${x.first_name} ${x.last_name}`).join(", ") : "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <ProgramForm
          initial={editing ?? undefined}
          presenters={presenters}
          initialPresenterIds={editing ? links.filter((l) => l.program_id === editing.id).map((l) => l.user_id) : []}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ProgramForm({ initial, presenters, initialPresenterIds, onClose }: { initial?: Program; presenters: Profile[]; initialPresenterIds: string[]; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [presenterIds, setPresenterIds] = useState<string[]>(initialPresenterIds);
  const [type, setType] = useState<Program["type"]>(initial?.type ?? "live");
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setPresenterIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { name, description, presenter_id: presenterIds[0] ?? null, type };
    let programId = initial?.id;
    if (initial) {
      await supabase.from("programs").update(payload).eq("id", initial.id);
    } else {
      const { data } = await supabase.from("programs").insert(payload).select().single();
      programId = (data as any)?.id;
    }
    if (programId) {
      await supabase.from("program_presenters").delete().eq("program_id", programId);
      if (presenterIds.length) {
        await supabase.from("program_presenters").insert(presenterIds.map((uid) => ({ program_id: programId!, user_id: uid })));
      }
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onSubmit={submit} className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? "Programma bewerken" : "Nieuw programma"}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Naam</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border mt-1 outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-sm font-medium">Beschrijving</label>
            <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-border mt-1 outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-sm font-medium">Presentator(en)</label>
            <div className="mt-1 border border-border rounded-lg p-2 max-h-48 overflow-auto space-y-1">
              {presenters.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                  <input type="checkbox" checked={presenterIds.includes(p.id)} onChange={() => toggle(p.id)} />
                  <span>{p.first_name} {p.last_name}</span>
                </label>
              ))}
            </div>
            {presenterIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {presenterIds.map((id) => {
                  const p = presenters.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {p.first_name}
                      <button type="button" onClick={() => toggle(id)}><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-2 mt-1">
              {TYPES.map((t) => (
                <button key={t.v} type="button" onClick={() => setType(t.v)} className={`flex-1 h-10 rounded-lg text-sm font-medium border-2 ${type === t.v ? t.cls + " border-transparent" : "border-border bg-background"}`}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg border border-border hover:bg-muted font-medium">Annuleren</button>
          <button disabled={saving} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">{saving ? "Opslaan..." : "Opslaan"}</button>
        </div>
      </form>
    </div>
  );
}
