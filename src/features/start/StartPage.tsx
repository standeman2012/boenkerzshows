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
  const { profile } = useAuth();

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

  const hour = new Date().getHours();
  const { greet, GreetIcon, note } =
    hour < 6
      ? { greet: "Nog wakker", GreetIcon: Moon, note: "de nacht is van jou" }
      : hour < 12
      ? { greet: "Goeiemorgen", GreetIcon: Coffee, note: "een frisse kop koffie erbij?" }
      : hour < 18
      ? { greet: "Hey", GreetIcon: Sun, note: "de middag knalt door" }
      : { greet: "Goeieavond", GreetIcon: Moon, note: "tijd om te schitteren" };

  const rotations = ["rotate-tiny-1", "rotate-tiny-2", "rotate-tiny-3", "rotate-tiny-4"];

  return (
    <div className="p-6 min-h-full paper-bg">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <GreetIcon className="h-5 w-5" />
            <span className="font-hand text-2xl">{note}</span>
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">
            {greet}{profile?.first_name ? `, ${profile.first_name}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Klik op een uitzending om het draaiboek te openen.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-border hover:bg-muted bg-card" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></button>
          <button className="px-3 h-9 rounded-lg border border-border hover:bg-muted text-sm bg-card" onClick={() => setWeekStart(startOfWeek(new Date()))}>Deze week</button>
          <button className="p-2 rounded-lg border border-border hover:bg-muted bg-card" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((d, i) => {
            const dayInstances = instances
              .filter((x) => x.start.toDateString() === d.toDateString())
              .sort((a, b) => a.start.getTime() - b.start.getTime());
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={i} className={`bg-white/70 backdrop-blur rounded-2xl p-3 min-h-[400px] border ${isToday ? "border-primary/50 shadow-md" : "border-black/5"}`}>
                <div className="text-center mb-3">
                  <div className="text-xs font-medium text-muted-foreground">{DAY_LABELS_LONG[i]}</div>
                  <div className={`font-display text-2xl ${isToday ? "text-primary" : ""}`}>{fmtDate(d)}</div>
                  {isToday && <div className="font-hand text-primary text-sm -mt-1">vandaag</div>}
                </div>
                <div className="space-y-2">
                  {dayInstances.length === 0 && <div className="font-hand text-center text-muted-foreground py-6 text-lg">…rust</div>}
                  {dayInstances.map((x, idx) => (
                    <button
                      key={x.instanceKey}
                      onClick={() =>
                        navigate({
                          to: "/draaiboek/$entryId",
                          params: { entryId: x.entry.id },
                          search: { d: x.start.toISOString().slice(0, 10) } as any,
                        })
                      }
                      className={`w-full text-left rounded-lg p-3 bg-card hover:shadow-md hover:-translate-y-0.5 transition-all ${typeClass(x.entry.program?.type ?? "live")} ${rotations[idx % rotations.length]}`}
                    >
                      <div className="text-sm font-semibold truncate">{x.entry.program?.name ?? "Onbekend"}</div>
                      <div className="text-[11px] opacity-75 font-hand text-base leading-tight mt-0.5">
                        {x.start.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                      </div>
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
