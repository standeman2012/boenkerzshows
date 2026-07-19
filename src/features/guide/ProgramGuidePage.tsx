import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { addDays, DAY_LABELS_LONG, fmtDate, fmtTime, startOfWeek } from "@/lib/date-utils";
import { ChevronLeft, ChevronRight, Loader2, X, Trash2 } from "lucide-react";

type Program = { id: string; name: string; type: "live" | "non_stop" | "recorded" };
type Entry = { id: string; program_id: string; start_at: string; end_at: string; recurrence: "once" | "daily" | "weekly" | "biweekly"; recurrence_until: string | null };

const HOUR_HEIGHT = 48; // px per hour
const TOTAL_HEIGHT = HOUR_HEIGHT * 24;

function typeColor(t?: string) {
  if (t === "live") return "var(--show-live)";
  if (t === "non_stop") return "var(--show-nonstop)";
  return "var(--show-recorded)";
}

function snapMinutes(m: number) {
  return Math.round(m / 15) * 15;
}

type Instance = { entry: Entry; program?: Program; start: Date; end: Date; dayIdx: number };

function expand(entries: Entry[], programs: Program[], weekStart: Date): Instance[] {
  const weekEnd = addDays(weekStart, 7);
  const map = new Map(programs.map((p) => [p.id, p]));
  const out: Instance[] = [];
  for (const e of entries) {
    const s = new Date(e.start_at);
    const en = new Date(e.end_at);
    const dur = en.getTime() - s.getTime();
    const until = e.recurrence_until ? new Date(e.recurrence_until + "T23:59:59") : addDays(weekEnd, 30);
    const push = (st: Date) => {
      const nd = new Date(st.getTime() + dur);
      // clip to a single day column, but show whole span
      const dayIdx = Math.floor((st.getTime() - weekStart.getTime()) / 86400000);
      if (dayIdx >= 0 && dayIdx < 7) out.push({ entry: e, program: map.get(e.program_id), start: st, end: nd, dayIdx });
    };
    if (e.recurrence === "once") {
      if (s >= weekStart && s < weekEnd) push(s);
    } else {
      const step = e.recurrence === "daily" ? 1 : e.recurrence === "biweekly" ? 14 : 7;
      let cur = new Date(s);
      while (cur < weekStart) cur = addDays(cur, step);
      while (cur < weekEnd && cur <= until) { push(new Date(cur)); cur = addDays(cur, step); }
    }
  }
  return out;
}

export function ProgramGuidePage() {
  const { isAdmin } = useAuth();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [programs, setPrograms] = useState<Program[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag state
  const [drag, setDrag] = useState<{ dayIdx: number; startMin: number; endMin: number } | null>(null);
  const [showForm, setShowForm] = useState<{ dayIdx: number; startMin: number; endMin: number } | null>(null);
  const dragRef = useRef<{ dayIdx: number; startY: number } | null>(null);

  const load = async () => {
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from("programs").select("id,name,type").order("name"),
      supabase.from("schedule_entries").select("*"),
    ]);
    setPrograms((p as any) ?? []);
    setEntries((e as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("guide")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "programs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const instances = useMemo(() => expand(entries, programs, weekStart), [entries, programs, weekStart]);

  const onColMouseDown = (dayIdx: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAdmin) return;
    if ((e.target as HTMLElement).closest("[data-instance]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = snapMinutes((y / HOUR_HEIGHT) * 60);
    dragRef.current = { dayIdx, startY: min };
    setDrag({ dayIdx, startMin: min, endMin: min + 60 });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (ev: MouseEvent) => {
      const container = document.getElementById(`col-${drag.dayIdx}`);
      if (!container || !dragRef.current) return;
      const rect = container.getBoundingClientRect();
      const y = Math.min(Math.max(ev.clientY - rect.top, 0), TOTAL_HEIGHT);
      const min = snapMinutes((y / HOUR_HEIGHT) * 60);
      const a = Math.min(dragRef.current.startY, min);
      const b = Math.max(dragRef.current.startY, min);
      setDrag({ dayIdx: drag.dayIdx, startMin: a, endMin: Math.max(b, a + 15) });
    };
    const up = () => {
      if (drag && drag.endMin > drag.startMin) setShowForm(drag);
      setDrag(null);
      dragRef.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag]);

  const deleteEntry = async (id: string) => {
    if (!confirm("Deze planning verwijderen?")) return;
    await supabase.from("schedule_entries").delete().eq("id", id);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Programmagids</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Sleep in een dag om een show te plannen" : "Overzicht van alle planningen"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-border hover:bg-muted" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></button>
          <div className="px-3 h-9 rounded-lg border border-border text-sm flex items-center min-w-[180px] justify-center">
            {fmtDate(weekStart)} — {fmtDate(addDays(weekStart, 6))}
          </div>
          <button className="p-2 rounded-lg border border-border hover:bg-muted" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></button>
          <button className="px-3 h-9 rounded-lg border border-border hover:bg-muted text-sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Vandaag</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
            <div className="border-b border-border h-12"></div>
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => (
              <div key={i} className="border-b border-l border-border h-12 flex flex-col items-center justify-center">
                <div className="text-xs text-muted-foreground">{DAY_LABELS_LONG[i]}</div>
                <div className="text-sm font-semibold">{fmtDate(d)}</div>
              </div>
            ))}
          </div>
          <div className="grid overflow-auto" style={{ gridTemplateColumns: `56px repeat(7, 1fr)`, maxHeight: "70vh" }}>
            <div className="relative" style={{ height: TOTAL_HEIGHT }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ height: HOUR_HEIGHT }} className="text-[10px] text-muted-foreground text-right pr-1 -translate-y-1">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {Array.from({ length: 7 }, (_, dayIdx) => (
              <div
                key={dayIdx}
                id={`col-${dayIdx}`}
                onMouseDown={(e) => onColMouseDown(dayIdx, e)}
                className="relative border-l border-border select-none"
                style={{ height: TOTAL_HEIGHT }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="border-b border-border/60" style={{ height: HOUR_HEIGHT }}></div>
                ))}
                {instances.filter((x) => x.dayIdx === dayIdx).map((x, idx) => {
                  const startMin = x.start.getHours() * 60 + x.start.getMinutes();
                  const dur = (x.end.getTime() - x.start.getTime()) / 60000;
                  const color = typeColor(x.program?.type);
                  return (
                    <div
                      key={idx}
                      data-instance
                      onClick={(e) => { e.stopPropagation(); if (isAdmin) deleteEntry(x.entry.id); }}
                      className="absolute left-1 right-1 rounded-md px-2 py-1 text-white text-xs shadow-sm cursor-pointer hover:brightness-110"
                      style={{
                        top: (startMin / 60) * HOUR_HEIGHT,
                        height: Math.max((dur / 60) * HOUR_HEIGHT - 2, 20),
                        backgroundColor: color,
                      }}
                      title={isAdmin ? "Klik om te verwijderen" : ""}
                    >
                      <div className="font-semibold truncate">{x.program?.name ?? "?"}</div>
                      <div className="opacity-90 text-[10px]">{fmtTime(x.start)} - {fmtTime(x.end)}</div>
                    </div>
                  );
                })}
                {drag && drag.dayIdx === dayIdx && (
                  <div
                    className="absolute left-1 right-1 rounded-md bg-primary/40 border-2 border-primary text-primary-foreground text-xs px-2 py-1 pointer-events-none"
                    style={{
                      top: (drag.startMin / 60) * HOUR_HEIGHT,
                      height: ((drag.endMin - drag.startMin) / 60) * HOUR_HEIGHT,
                    }}
                  >
                    <div className="font-semibold text-primary">
                      {String(Math.floor(drag.startMin / 60)).padStart(2, "0")}:{String(drag.startMin % 60).padStart(2, "0")} - {String(Math.floor(drag.endMin / 60)).padStart(2, "0")}:{String(drag.endMin % 60).padStart(2, "0")}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <ScheduleForm
          weekStart={weekStart}
          init={showForm}
          programs={programs}
          onClose={() => setShowForm(null)}
        />
      )}
    </div>
  );
}

function ScheduleForm({ weekStart, init, programs, onClose }: { weekStart: Date; init: { dayIdx: number; startMin: number; endMin: number }; programs: Program[]; onClose: () => void }) {
  const [programId, setProgramId] = useState<string>(programs[0]?.id ?? "");
  const [recurrence, setRecurrence] = useState<"once" | "daily" | "weekly" | "biweekly">("once");
  const [until, setUntil] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const day = addDays(weekStart, init.dayIdx);
  const start = new Date(day); start.setHours(0, 0, 0, 0); start.setMinutes(init.startMin);
  const end = new Date(day); end.setHours(0, 0, 0, 0); end.setMinutes(init.endMin);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programId) return;
    setSaving(true);
    await supabase.from("schedule_entries").insert({
      program_id: programId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      recurrence,
      recurrence_until: recurrence === "once" ? null : (until || null),
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Show plannen</h2>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {DAY_LABELS_LONG[init.dayIdx]} {fmtDate(day)} · {fmtTime(start)} - {fmtTime(end)}
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Programma</label>
            <select required value={programId} onChange={(e) => setProgramId(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border mt-1 bg-background">
              {programs.length === 0 && <option value="">Geen programma's — maak er eerst aan</option>}
              {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Herhaling</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["once", "daily", "weekly", "biweekly"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRecurrence(r)} className={`h-9 rounded-lg border text-sm ${recurrence === r ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                  {r === "once" ? "Eenmalig" : r === "daily" ? "Dagelijks" : r === "weekly" ? "Wekelijks" : "Om de 2 weken"}
                </button>
              ))}
            </div>
          </div>
          {recurrence !== "once" && (
            <div>
              <label className="text-sm font-medium">Einddatum (optioneel)</label>
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border mt-1" />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg border border-border hover:bg-muted font-medium">Annuleren</button>
          <button disabled={saving || !programId} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">{saving ? "Opslaan..." : "Plannen"}</button>
        </div>
      </form>
    </div>
  );
}
