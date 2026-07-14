import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useParams, useNavigate } from "@tanstack/react-router";
import { fmtDurationSeconds } from "@/lib/date-utils";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ArrowLeft, Plus, Trash2, Music, Radio, Sparkles, FileText, X, Loader2, GripVertical } from "lucide-react";

type Item = {
  id: string;
  schedule_entry_id: string;
  position: number;
  type: "item" | "song" | "jingle" | "other";
  title: string;
  artist: string | null;
  description: string | null;
  duration_seconds: number;
  content: string | null;
};

const TYPE_META = {
  item: { label: "Item", color: "var(--item-color)", icon: FileText },
  song: { label: "Song", color: "var(--song-color)", icon: Music },
  jingle: { label: "Jingle", color: "var(--jingle-color)", icon: Sparkles },
  other: { label: "Ander", color: "var(--other-color)", icon: Radio },
} as const;

export function RundownPage() {
  const params = useParams({ strict: false }) as { entryId?: string };
  const entryId = params.entryId!;
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();

  const [entry, setEntry] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [typers, setTypers] = useState<Record<string, string>>({});
  const channelRef = useRef<any>(null);

  const load = async () => {
    const { data: e } = await supabase
      .from("schedule_entries")
      .select("*, program:programs(id,name,type,presenter_id)")
      .eq("id", entryId).maybeSingle();
    setEntry(e);
    const { data: its } = await supabase.from("rundown_items").select("*").eq("schedule_entry_id", entryId).order("position");
    setItems((its as any) ?? []);
    if (its && its.length > 0 && !selectedId) setSelectedId(its[0].id);
    setLoading(false);
    if (e && profile) {
      if (isAdmin) setCanEdit(true);
      else {
        const { data: perm } = await supabase.from("program_permissions").select("can_edit").eq("user_id", profile.id).eq("program_id", e.program_id).maybeSingle();
        setCanEdit(!!perm?.can_edit);
      }
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`rundown-${entryId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rundown_items", filter: `schedule_entry_id=eq.${entryId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, isAdmin, profile?.id]);

  // Presence for typing indicator
  useEffect(() => {
    if (!profile || !selectedId) return;
    const ch = supabase.channel(`presence-${selectedId}`, { config: { presence: { key: profile.id } } });
    channelRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as any;
      const t: Record<string, string> = {};
      Object.entries(state).forEach(([k, v]: any) => { if (v[0]?.name && k !== profile.id) t[k] = v[0].name; });
      setTypers(t);
    });
    ch.subscribe(async (s) => { if (s === "SUBSCRIBED") await ch.track({ name: profile.first_name }); });
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, profile?.id, profile?.first_name]);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const addItem = async (type: Item["type"], patch: Partial<Item>) => {
    const position = items.length;
    const { data } = await supabase.from("rundown_items").insert({
      schedule_entry_id: entryId,
      position,
      type,
      title: patch.title ?? "",
      artist: patch.artist ?? null,
      description: patch.description ?? null,
      duration_seconds: patch.duration_seconds ?? 60,
      content: "",
    }).select().single();
    if (data) setSelectedId(data.id);
    setShowAdd(false);
  };

  const updateItem = async (id: string, patch: Partial<Item>) => {
    await supabase.from("rundown_items").update(patch).eq("id", id);
  };

  const removeItem = async (id: string) => {
    if (!confirm("Item verwijderen?")) return;
    await supabase.from("rundown_items").delete().eq("id", id);
    if (selectedId === id) setSelectedId(null);
  };

  const totalDur = items.reduce((s, i) => s + i.duration_seconds, 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!entry) return <div className="p-6">Uitzending niet gevonden.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/" })} className="p-2 rounded-md hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-lg font-bold">{entry.program?.name ?? "Draaiboek"}</h1>
            <div className="text-xs text-muted-foreground">
              {new Date(entry.start_at).toLocaleString("nl-BE", { dateStyle: "long", timeStyle: "short" })} · Totale duur: {fmtDurationSeconds(totalDur)}
            </div>
          </div>
        </div>
        {canEdit && items.length > 0 && (
          <button onClick={() => setShowAdd(true)} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
            <Plus className="h-4 w-4" />Item toevoegen
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Dit draaiboek is nog leeg</p>
            {canEdit ? (
              <button onClick={() => setShowAdd(true)} className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-lg">
                CREËER EERSTE ITEM
              </button>
            ) : <p className="text-sm text-muted-foreground">Je hebt geen bewerkrechten voor dit programma.</p>}
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] overflow-hidden">
          <aside className="border-r border-border overflow-auto bg-muted/20">
            <ul className="p-3 space-y-2">
              {items.map((it, i) => {
                const meta = TYPE_META[it.type];
                const Icon = meta.icon;
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => setSelectedId(it.id)}
                      className={`w-full text-left rounded-lg p-3 border transition-all bg-card ${selectedId === it.id ? "border-primary shadow-sm" : "border-border hover:border-primary/40"}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col items-center pt-0.5">
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                        </div>
                        <div className="h-6 w-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}>
                          <Icon className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs uppercase font-semibold" style={{ color: meta.color }}>{meta.label}</div>
                          <div className="text-sm font-medium truncate">
                            {it.type === "song" ? `${it.artist ?? ""} — ${it.title}` : it.title || "(zonder titel)"}
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtDurationSeconds(it.duration_seconds)}</div>
                        </div>
                        {canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); removeItem(it.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive opacity-60 hover:opacity-100">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="overflow-auto p-4">
            {selected ? (
              <ItemDetail
                key={selected.id}
                item={selected}
                canEdit={canEdit}
                typers={Object.values(typers)}
                onSave={(patch) => updateItem(selected.id, patch)}
              />
            ) : <div className="text-muted-foreground text-sm">Selecteer een item</div>}
          </section>
        </div>
      )}

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onAdd={addItem} />}
    </div>
  );
}

function ItemDetail({ item, canEdit, typers, onSave }: { item: Item; canEdit: boolean; typers: string[]; onSave: (p: Partial<Item>) => void }) {
  const [title, setTitle] = useState(item.title);
  const [artist, setArtist] = useState(item.artist ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [duration, setDuration] = useState(Math.round(item.duration_seconds / 60));
  const [content, setContent] = useState(item.content ?? "");

  useEffect(() => { setTitle(item.title); setArtist(item.artist ?? ""); setDescription(item.description ?? ""); setDuration(Math.round(item.duration_seconds / 60)); setContent(item.content ?? ""); }, [item.id]);

  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const showEditor = item.type === "item" || item.type === "other";

  const commit = (patch: Partial<Item>) => onSave(patch);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.color }}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold uppercase" style={{ color: meta.color }}>{meta.label}</span>
          {typers.length > 0 && <span className="ml-auto text-xs text-muted-foreground">Ook bezig: {typers.join(", ")}</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {item.type === "song" ? (
            <>
              <div>
                <label className="text-xs font-medium">Artiest</label>
                <input disabled={!canEdit} value={artist} onChange={(e) => { setArtist(e.target.value); commit({ artist: e.target.value }); }} className="w-full h-9 px-3 rounded-lg border border-border mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Titel</label>
                <input disabled={!canEdit} value={title} onChange={(e) => { setTitle(e.target.value); commit({ title: e.target.value }); }} className="w-full h-9 px-3 rounded-lg border border-border mt-1" />
              </div>
            </>
          ) : (
            <div className="col-span-2">
              <label className="text-xs font-medium">Titel</label>
              <input disabled={!canEdit} value={title} onChange={(e) => { setTitle(e.target.value); commit({ title: e.target.value }); }} className="w-full h-9 px-3 rounded-lg border border-border mt-1" />
            </div>
          )}
          {item.type === "other" && (
            <div className="col-span-2">
              <label className="text-xs font-medium">Beschrijving</label>
              <input disabled={!canEdit} value={description} onChange={(e) => { setDescription(e.target.value); commit({ description: e.target.value }); }} className="w-full h-9 px-3 rounded-lg border border-border mt-1" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium">Duur (minuten)</label>
            <input disabled={!canEdit} type="number" min={1} value={duration} onChange={(e) => { const v = Number(e.target.value) || 1; setDuration(v); commit({ duration_seconds: v * 60 }); }} className="w-full h-9 px-3 rounded-lg border border-border mt-1" />
          </div>
        </div>
      </div>

      {showEditor && (
        <div className="flex-1 min-h-[400px]">
          <RichTextEditor value={content} editable={canEdit} onChange={(html) => { setContent(html); commit({ content: html }); }} />
        </div>
      )}
    </div>
  );
}

function AddItemModal({ onClose, onAdd }: { onClose: () => void; onAdd: (type: Item["type"], patch: Partial<Item>) => void }) {
  const [type, setType] = useState<Item["type"] | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(1);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nieuw item</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        {!type ? (
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(TYPE_META) as [Item["type"], typeof TYPE_META[keyof typeof TYPE_META]][]).map(([k, m]) => {
              const Icon = m.icon;
              return (
                <button key={k} onClick={() => setType(k)} className="rounded-xl p-4 border-2 border-border hover:border-primary flex flex-col items-center gap-2 transition-colors">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: m.color }}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-sm font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={(e) => {
            e.preventDefault();
            onAdd(type, {
              title,
              artist: type === "song" ? artist : null,
              description: type === "other" ? description : null,
              duration_seconds: (type === "jingle" ? Math.max(duration, 1) : duration) * 60,
            });
          }} className="space-y-3">
            {type === "song" && (
              <div>
                <label className="text-sm font-medium">Artiest</label>
                <input required value={artist} onChange={(e) => setArtist(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border mt-1" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Titel</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border mt-1" />
            </div>
            {type === "other" && (
              <div>
                <label className="text-sm font-medium">Beschrijving</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border mt-1" />
              </div>
            )}
            {type !== "jingle" && (
              <div>
                <label className="text-sm font-medium">Duur (minuten)</label>
                <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 1)} className="w-full h-10 px-3 rounded-lg border border-border mt-1" />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setType(null)} className="flex-1 h-10 rounded-lg border border-border hover:bg-muted font-medium">Terug</button>
              <button className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">Opslaan</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
