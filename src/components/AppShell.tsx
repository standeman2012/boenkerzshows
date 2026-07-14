import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Radio,
  CalendarDays,
  Users,
  Settings,
  UserCircle,
  LogOut,
  Menu,
  Bell,
  Search,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/date-utils";

const NAV_BASE = [
  { to: "/", label: "Startpagina", icon: Home },
  { to: "/programmas", label: "Programma's", icon: Radio },
  { to: "/programmagids", label: "Programmagids", icon: CalendarDays },
  { to: "/presentatoren", label: "Presentatoren", icon: Users },
  { to: "/instellingen", label: "Instellingen", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [settings, setSettings] = useState<{ logo_text: string; logo_url: string | null; use_logo: boolean; background_url: string | null } | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("logo_text,logo_url,use_logo,background_url").eq("id", 1).maybeSingle();
      if (!ignore) setSettings(data as any);
    };
    load();
    const ch = supabase
      .channel("app_settings-shell")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    return () => {
      ignore = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const nav = isAdmin
    ? [...NAV_BASE.slice(0, 4), { to: "/gebruikers", label: "Gebruikers", icon: UserCircle }, NAV_BASE[4]]
    : NAV_BASE;

  const bgStyle = settings?.background_url
    ? { backgroundImage: `url(${settings.background_url})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  return (
    <div className="min-h-screen flex bg-background" style={bgStyle}>
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-sidebar transition-all duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="h-14 flex items-center px-4 border-b border-border">
          {settings?.use_logo && settings.logo_url ? (
            <img src={settings.logo_url} alt="logo" className={cn("object-contain", collapsed ? "h-8 w-8" : "h-8")} />
          ) : (
            <span className={cn("font-bold text-lg tracking-tight", collapsed && "hidden")}>
              {settings?.logo_text ?? "boenkerz"}
            </span>
          )}
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
                {!collapsed && <span>{n.label}</span>}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 mx-2 mb-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-muted"
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Uitloggen</span>}
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card/95 backdrop-blur flex items-center gap-4 px-4">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-2 rounded-md hover:bg-muted"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Zoeken..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/50 border border-transparent focus:bg-background focus:border-border outline-none text-sm"
            />
          </div>
          <button className="p-2 rounded-md hover:bg-muted relative" aria-label="Notificaties">
            <Bell className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                {profile ? initials(profile.first_name, profile.last_name) : "?"}
              </div>
            )}
            <div className="text-sm leading-tight hidden sm:block">
              <div className="font-medium">{profile?.first_name} {profile?.last_name}</div>
              <div className="text-xs text-muted-foreground">{isAdmin ? "Admin" : "Presentator"}</div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
