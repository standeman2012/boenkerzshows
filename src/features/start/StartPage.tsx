import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { addDays, DAY_LABELS_LONG, fmtDate, startOfWeek } from "@/lib/date-utils";
import { ChevronLeft, ChevronRight, Loader2, Coffee, Sun, Moon } from "lucide-react";

type Entry = {
  id: string;
  program_id: string;
  start_at: string;
  end_at: string;
  recurrence: "once" | "daily" | "weekly";
  recurrence_until: string | null;
  program?: { id: string; name: string; type: "live" | "non_stop" | "recorded"; presenter_id: string | null };
};

function typeClass(t: string) {
  if (t === "live") return "bg-[color:var(--show-live)]/15 border-l-4 border-[color:var(--show-live)] text-[color:var(--show-live)]";
  if (t === "non_stop") return "bg-[color:var(--show-nonstop)]/15 border-l-4 border-[color:var(--show-nonstop)] text-[color:var(--show-nonstop)]";
  return "bg-[color:var(--show-recorded)]/15 border-l-4 border-[color:var(--show-recorded)] text-[color:var(--show-recorded)]";
}

// Expand recurring entries to concrete instances (with parent entry id for rundown navigation)
function expandEntries(entries: Entry[], weekStart: Date): { entry: Entry; start: Date; end: Date; instanceKey: string }[] {
  const weekEnd = addDays(weekStart, 7);
  const out: { entry: Entry; start: Date; end: Date; instanceKey: string }[] = [];
  for (const e of entries) {
    const s = new Date(e.start_at);
    const en = new Date(e.end_at);
    const durMs = en.getTime() - s.getTime();
    const until = e.recurrence_until ? new Date(e.recurrence_until + "T23:59:59") : addDays(weekEnd, 30);
    if (e.recurrence === "once") {
      if (s >= weekStart && s < weekEnd) out.push({ entry: e, start: s, end: en, instanceKey: e.id });
      continue;
    }
    const stepDays = e.recurrence === "daily" ? 1 : 7;
    // Fast-forward to weekStart
    let cur = new Date(s);
    while (cur < weekStart) cur = addDays(cur, stepDays);
    while (cur < weekEnd && cur <= until) {
      const st = new Date(cur);
      const nd = new Date(cur.getTime() + durMs);
      out.push({ entry: e, start: st, end: nd, instanceKey: `${e.id}_${st.toISOString().slice(0, 10)}` });
      cur = addDays(cur, stepDays);
    }
  }
  return out;
}

export function StartPage() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("schedule_entries")
        .select("id,program_id,start_at,end_at,recurrence,recurrence_until,program:programs(id,name,type,presenter_id)");
      if (!ignore) {
        setEntries((data as any) ?? []);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel("start-schedule")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "programs" }, load)
      .subscribe();
    return () => {
      ignore = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const instances = expandEntries(entries, weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Startpagina</h1>
          <p className="text-sm text-muted-foreground">Klik op een uitzending voor het draaiboek</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-border hover:bg-muted" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></button>
          <button className="px-3 h-9 rounded-lg border border-border hover:bg-muted text-sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Deze week</button>
          <button className="p-2 rounded-lg border border-border hover:bg-muted" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {days.map((d, i) => {
            const dayInstances = instances
              .filter((x) => x.start.toDateString() === d.toDateString())
              .sort((a, b) => a.start.getTime() - b.start.getTime());
            return (
              <div key={i} className="bg-muted/30 rounded-xl p-3 min-h-[400px]">
                <div className="text-center mb-3">
                  <div className="text-xs font-medium text-muted-foreground">{DAY_LABELS_LONG[i]}</div>
                  <div className="text-lg font-bold">{fmtDate(d)}</div>
                </div>
                <div className="space-y-2">
                  {dayInstances.length === 0 && <div className="text-xs text-center text-muted-foreground py-6">Geen shows</div>}
                  {dayInstances.map((x) => (
                    <button
                      key={x.instanceKey}
                      onClick={() =>
                        navigate({
                          to: "/draaiboek/$entryId",
                          params: { entryId: x.entry.id },
                          search: { d: x.start.toISOString().slice(0, 10) } as any,
                        })
                      }
                      className={`w-full text-left rounded-lg p-3 bg-card hover:shadow-md transition-all ${typeClass(x.entry.program?.type ?? "live")}`}
                    >
                      <div className="text-sm font-semibold truncate">{x.entry.program?.name ?? "Onbekend"}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
