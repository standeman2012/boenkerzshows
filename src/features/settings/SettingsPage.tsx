import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Upload, Loader2 } from "lucide-react";

export function SettingsPage() {
  const { user, profile, isAdmin, refresh } = useAuth();
  const [logoText, setLogoText] = useState("boenkerz");
  const [useLogo, setUseLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      if (data) {
        setLogoText(data.logo_text);
        setUseLogo(data.use_logo);
        setLogoUrl(data.logo_url);
        setBgUrl(data.background_url);
      }
    };
    load();
  }, []);

  const saveSettings = async () => {
    setBusy(true);
    await supabase.from("app_settings").update({ logo_text: logoText, use_logo: useLogo, logo_url: logoUrl, background_url: bgUrl }).eq("id", 1);
    setBusy(false);
    setMsg("Opgeslagen");
    setTimeout(() => setMsg(""), 2000);
  };

  const uploadBranding = async (file: File, kind: "logo" | "background") => {
    setBusy(true);
    const path = `${kind}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    if (error) { setBusy(false); setMsg("Upload mislukt"); return; }
    const { data: signed } = await supabase.storage.from("branding").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    const url = signed?.signedUrl ?? null;
    if (kind === "logo") setLogoUrl(url);
    else setBgUrl(url);
    setBusy(false);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setBusy(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { setBusy(false); setMsg("Upload mislukt"); return; }
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    await supabase.from("profiles").update({ avatar_url: signed?.signedUrl ?? null }).eq("id", user.id);
    await refresh();
    setBusy(false);
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Instellingen</h1>

      <section className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-4">Mijn profiel</h2>
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="h-16 w-16 rounded-full object-cover" alt="" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
              {profile ? `${profile.first_name[0]}${profile.last_name[0] || ""}` : "?"}
            </div>
          )}
          <div>
            <div className="font-medium">{profile?.first_name} {profile?.last_name}</div>
            <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            <button onClick={() => avatarInput.current?.click()} className="text-sm text-primary hover:underline mt-1 flex items-center gap-1">
              <Upload className="h-3.5 w-3.5" />Profielfoto uploaden
            </button>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Branding (admin)</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Weergave:</label>
              <div className="flex gap-2">
                <button onClick={() => setUseLogo(false)} className={`px-3 h-9 rounded-lg border text-sm ${!useLogo ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Tekst</button>
                <button onClick={() => setUseLogo(true)} className={`px-3 h-9 rounded-lg border text-sm ${useLogo ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Logo</button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Logo-tekst</label>
              <input value={logoText} onChange={(e) => setLogoText(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Logo-afbeelding</label>
              <div className="mt-1 flex items-center gap-3">
                {logoUrl && <img src={logoUrl} className="h-10 object-contain" alt="" />}
                <label className="text-sm cursor-pointer text-primary hover:underline">
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadBranding(e.target.files[0], "logo")} />
                  Uploaden
                </label>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Achtergrond</label>
              <div className="mt-1 flex items-center gap-3">
                {bgUrl && <img src={bgUrl} className="h-14 w-24 object-cover rounded" alt="" />}
                <label className="text-sm cursor-pointer text-primary hover:underline">
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadBranding(e.target.files[0], "background")} />
                  Uploaden
                </label>
                {bgUrl && <button onClick={() => setBgUrl(null)} className="text-sm text-destructive hover:underline">Verwijderen</button>}
              </div>
            </div>
            <button onClick={saveSettings} disabled={busy} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Opslaan
            </button>
            {msg && <p className="text-sm text-primary">{msg}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
