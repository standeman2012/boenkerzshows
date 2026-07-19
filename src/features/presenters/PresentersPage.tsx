import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/date-utils";

type Profile = { id: string; first_name: string; last_name: string; avatar_url: string | null; is_presenter: boolean };

const ROTATIONS = ["rotate-tiny-1", "rotate-tiny-2", "rotate-tiny-3", "rotate-tiny-4"];
const BADGES = ["op de mic", "in de studio", "on air", "in de mix", "achter de knoppen", "aan het draaien"];

export function PresentersPage() {
  const [list, setList] = useState<Profile[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("is_presenter", true).order("first_name");
      setList((data as any) ?? []);
    };
    load();
    const ch = supabase.channel("presenters").on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="p-6 min-h-full paper-bg">
      <div className="mb-8">
        <span className="font-hand text-primary text-2xl">de crew</span>
        <h1 className="font-display text-4xl font-bold">Onze presentatoren</h1>
        <p className="text-sm text-muted-foreground mt-1">De stemmen die het radiostation elke week laten leven.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {list.map((p, i) => {
          const rot = ROTATIONS[i % ROTATIONS.length];
          const badge = BADGES[i % BADGES.length];
          return (
            <div
              key={p.id}
              className={`relative bg-white rounded-2xl p-5 pt-8 flex flex-col items-center text-center border border-black/5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.10)] transition-all hover:-translate-y-1 ${rot}`}
            >
              <span className="tape" />
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover mb-3 ring-4 ring-white shadow-md" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold mb-3 ring-4 ring-white shadow-md">
                  {initials(p.first_name, p.last_name)}
                </div>
              )}
              <div className="font-display text-lg font-semibold leading-tight">{p.first_name}</div>
              <div className="text-sm text-muted-foreground">{p.last_name}</div>
              <div className="mt-2 font-hand text-primary text-lg leading-none">{badge}</div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground font-hand text-xl">
            Nog geen presentatoren toegevoegd…
          </div>
        )}
      </div>
    </div>
  );
}
