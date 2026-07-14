import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/date-utils";

type Profile = { id: string; first_name: string; last_name: string; avatar_url: string | null; is_presenter: boolean };

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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Presentatoren</h1>
      <p className="text-sm text-muted-foreground mb-6">Overzicht van alle presentatoren</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {list.map((p) => (
          <div key={p.id} className="bg-card border border-border rounded-xl p-5 flex flex-col items-center text-center hover:shadow-md transition-shadow">
            {p.avatar_url ? (
              <img src={p.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover mb-3" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold mb-3">
                {initials(p.first_name, p.last_name)}
              </div>
            )}
            <div className="font-semibold">{p.first_name} {p.last_name}</div>
            <div className="text-xs text-muted-foreground mt-1">Presentator</div>
          </div>
        ))}
      </div>
    </div>
  );
}
