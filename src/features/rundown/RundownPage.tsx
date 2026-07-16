import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useParams, useNavigate } from "@tanstack/react-router";

import { RichTextEditor, type RemoteCaret } from "@/components/RichTextEditor";
import { ArrowLeft, Plus, Trash2, Music, Radio, Sparkles, FileText, X, Loader2, GripVertical, Printer } from "lucide-react";

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
  item: { label: "Item", color: "var(--item-color)", hex: "#78B94A", icon: FileText },
  song: { label: "Song", color: "var(--song-color)", hex: "#5DA9E9", icon: Music },
  jingle: { label: "Jingle", color: "var(--jingle-color)", hex: "#E9C55D", icon: Sparkles },
  other: { label: "Ander", color: "var(--other-color)", hex: "#E9695D", icon: Radio },
} as const;

const CARET_COLORS = ["#e91e63", "#3f51b5", "#009688", "#ff9800", "#9c27b0", "#00bcd4", "#f44336", "#4caf50"];
function colorForUser(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CARET_COLORS[h % CARET_COLORS.length];
}

function formatDurSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

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
  const [presence, setPresence] = useState<Record<string, { name: string; itemId: string | null; pos: number }>>({});
  const channelRef = useRef<any>(null);
  const myStateRef = useRef<{ itemId: string | null; pos: number }>({ itemId: null, pos: 1 });

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const load = async () => {
    const { data: e } = await supabase
      .from("schedule_entries")
      .select("*, program:programs(id,name,type,presenter_id, program_presenters(user_id, profile:profiles(first_name,last_name)))")
      .eq("id", entryId).maybeSingle();
    setEntry(e);
    const { data: its } = await supabase.from("rundown_items").select("*").eq("schedule_entry_id", entryId).order("position");
    setItems((its as any) ?? []);
    if (its && its.length > 0 && !selectedIdRef.current) setSelectedId(its[0].id);
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

  // Presence per whole rundown (for live typing indicators across items)
  useEffect(() => {
    if (!profile) return;
    const ch = supabase.channel(`presence-rundown-${entryId}`, { config: { presence: { key: profile.id } } });
    channelRef.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as any;
      const t: Record<string, { name: string; itemId: string | null; pos: number }> = {};
      Object.entries(state).forEach(([k, v]: any) => {
        if (k === profile.id) return;
        const meta = v[0];
        if (meta?.name) t[k] = { name: meta.name, itemId: meta.itemId ?? null, pos: meta.pos ?? 1 };
      });
      setPresence(t);
    });
    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") await ch.track({ name: profile.first_name, itemId: myStateRef.current.itemId, pos: myStateRef.current.pos });
    });
    return () => { supabase.removeChannel(ch); };
  }, [entryId, profile?.id, profile?.first_name]);

  const trackPresence = (itemId: string | null, pos: number) => {
    myStateRef.current = { itemId, pos };
    channelRef.current?.track({ name: profile?.first_name ?? "?", itemId, pos });
  };

  useEffect(() => {
    trackPresence(selectedId, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

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

  const printDraaiboek = () => {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const dateStr = entry ? new Date(entry.start_at).toLocaleString("nl-BE", { dateStyle: "full", timeStyle: "short" }) : "";
    const rows = items.map((it, i) => {
      const meta = TYPE_META[it.type];
      const titleLine = it.type === "song" ? `${it.artist ?? ""} — ${it.title}` : (it.title || "(zonder titel)");
      const descLine = it.type === "other" && it.description ? `<div class="desc">${escapeHtml(it.description)}</div>` : "";
      const content = (it.type === "item" || it.type === "other") && it.content ? `<div class="content">${it.content}</div>` : "";
      return `
        <section class="item">
          <div class="row">
            <div class="num">${i + 1}</div>
            <div class="typebadge" style="background:${meta.hex}">${meta.label}</div>
            <div class="title">${escapeHtml(titleLine)}</div>
            <div class="dur">${formatDurSec(it.duration_seconds)}</div>
          </div>
          ${descLine}
          ${content}
        </section>
      `;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Draaiboek — ${escapeHtml(entry?.program?.name ?? "")}</title>
      <style>
        @page { size: A4; margin: 18mm; }
        body { font-family: 'Inter', -apple-system, Segoe UI, sans-serif; color:#111; }
        h1 { margin:0 0 4px; font-size: 22px; }
        .meta { color:#666; font-size:12px; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .item { page-break-inside: avoid; margin: 14px 0; padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 8px; }
        .row { display:flex; align-items:center; gap:10px; }
        .num { width:24px; height:24px; border-radius:50%; background:#f2f2f2; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; }
        .typebadge { color:white; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; text-transform:uppercase; }
        .title { flex:1; font-weight:600; }
        .dur { color:#666; font-size:12px; }
        .desc { margin-top:6px; color:#444; font-style: italic; font-size: 13px; }
        .content { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #eee; font-size: 13px; line-height: 1.5; }
        .content p { margin: 4px 0; }
        .content h1 { font-size:16px; margin: 8px 0 4px; }
        .content h2 { font-size:14px; margin: 8px 0 4px; }
        .content ul, .content ol { padding-left: 20px; }
        .footer { margin-top: 24px; color:#999; font-size:11px; text-align:right; }
        @media print { .noprint { display:none; } }
        .noprint { position: fixed; top: 10px; right: 10px; }
        .noprint button { padding: 8px 14px; border-radius: 8px; background:#78B94A; color:white; border:0; font-weight:600; cursor:pointer; }
      </style></head><body>
      <div class="noprint"><button onclick="window.print()">Afdrukken</button></div>
      <h1>${escapeHtml(entry?.program?.name ?? "Draaiboek")}</h1>
      <div class="meta">${escapeHtml(dateStr)} · Totale duur: ${formatDurSec(totalDur)} · ${items.length} items</div>
      ${rows || '<p>Nog geen items.</p>'}
      <div class="footer">Boenkerz Radio — draaiboek</div>
      </body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!entry) return <div className="p-6">Uitzending niet gevonden.</div>;

  const presenceList = Object.entries(presence);
  const remoteCarets: RemoteCaret[] = presenceList
    .filter(([, v]) => v.itemId === selectedId)
    .map(([uid, v]) => ({ userId: uid, name: v.name, pos: v.pos, color: colorForUser(uid) }));

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/" })} className="p-2 rounded-md hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-lg font-bold">{entry.program?.name ?? "Draaiboek"}</h1>
            <div className="text-xs text-muted-foreground">
              {new Date(entry.start_at).toLocaleString("nl-BE", { dateStyle: "long", timeStyle: "short" })} · Totale duur: {formatDurSec(totalDur)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {presenceList.length > 0 && (
            <div className="flex -space-x-2 mr-2">
              {presenceList.map(([uid, v]) => (
                <div key={uid} title={v.name} className="h-7 w-7 rounded-full border-2 border-card text-white text-xs font-semibold flex items-center justify-center" style={{ background: colorForUser(uid) }}>
                  {v.name.slice(0, 1).toUpperCase()}
                </div>
              ))}
            </div>
          )}
          <button onClick={printDraaiboek} className="h-9 px-3 rounded-lg border border-border hover:bg-muted text-sm font-medium flex items-center gap-2">
            <Printer className="h-4 w-4" />{canEdit ? "Bekijken" : "Afdrukken"}
          </button>
          {canEdit && items.length > 0 && (
            <button onClick={() => setShowAdd(true)} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
              <Plus className="h-4 w-4" />Item toevoegen
            </button>
          )}
        </div>
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
                const activeUsers = presenceList.filter(([, v]) => v.itemId === it.id);
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
                          <div className="text-xs text-muted-foreground">{formatDurSec(it.duration_seconds)}</div>
                        </div>
                        {activeUsers.length > 0 && (
                          <div className="flex -space-x-1">
                            {activeUsers.map(([uid, v]) => (
                              <div key={uid} title={v.name} className="h-4 w-4 rounded-full border border-card text-white text-[9px] flex items-center justify-center" style={{ background: colorForUser(uid) }}>
                                {v.name.slice(0, 1).toUpperCase()}
                              </div>
                            ))}
                          </div>
                        )}
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
                remoteCarets={remoteCarets}
                onSelectionChange={(pos) => trackPresence(selected.id, pos)}
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function DurationInput({ value, onChange, disabled }: { value: number; onChange: (s: number) => void; disabled?: boolean }) {
  const m = Math.floor(value / 60);
  const s = value % 60;
  return (
    <div className="flex gap-2 mt-1">
      <div className="flex-1">
        <input disabled={disabled} type="number" min={0} value={m} onChange={(e) => {
          const nm = Math.max(0, Number(e.target.value) || 0);
          onChange(Math.max(1, nm * 60 + s));
        }} className="w-full h-9 px-3 rounded-lg border border-border" />
        <div className="text-[10px] text-muted-foreground mt-0.5 text-center">min</div>
      </div>
      <div className="flex-1">
        <input disabled={disabled} type="number" min={0} max={59} value={s} onChange={(e) => {
          const ns = Math.min(59, Math.max(0, Number(e.target.value) || 0));
          onChange(Math.max(1, m * 60 + ns));
        }} className="w-full h-9 px-3 rounded-lg border border-border" />
        <div className="text-[10px] text-muted-foreground mt-0.5 text-center">sec</div>
      </div>
    </div>
  );
}

function ItemDetail({ item, canEdit, remoteCarets, onSelectionChange, onSave }: { item: Item; canEdit: boolean; remoteCarets: RemoteCaret[]; onSelectionChange: (pos: number) => void; onSave: (p: Partial<Item>) => void }) {
  const [title, setTitle] = useState(item.title);
  const [artist, setArtist] = useState(item.artist ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [duration, setDuration] = useState(item.duration_seconds);
  const [content, setContent] = useState(item.content ?? "");

  useEffect(() => {
    setTitle(item.title); setArtist(item.artist ?? ""); setDescription(item.description ?? "");
    setDuration(item.duration_seconds); setContent(item.content ?? "");
  }, [item.id]);

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
          {remoteCarets.length > 0 && <span className="ml-auto text-xs text-muted-foreground">Live: {remoteCarets.map((c) => c.name).join(", ")}</span>}
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
          <div className="col-span-2">
            <label className="text-xs font-medium">Duur (min : sec)</label>
            <DurationInput disabled={!canEdit} value={duration} onChange={(v) => { setDuration(v); commit({ duration_seconds: v }); }} />
          </div>
        </div>
      </div>

      {showEditor && (
        <div className="flex-1 min-h-[400px]">
          <RichTextEditor
            value={content}
            editable={canEdit}
            remoteCarets={remoteCarets}
            onSelection={(pos) => onSelectionChange(pos)}
            onLocalChange={(html) => setContent(html)}
            onChange={(html) => { setContent(html); commit({ content: html }); }}
          />
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
  const [duration, setDuration] = useState(60); // seconds, min 1

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
              duration_seconds: Math.max(1, duration),
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
            <div>
              <label className="text-sm font-medium">Duur (minimum 1 seconde)</label>
              <DurationInput value={duration} onChange={setDuration} />
            </div>
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
