
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'presenter');
CREATE TYPE public.program_type AS ENUM ('live', 'non_stop', 'recorded');
CREATE TYPE public.recurrence_type AS ENUM ('once', 'daily', 'weekly');
CREATE TYPE public.rundown_item_type AS ENUM ('item', 'song', 'jingle', 'other');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  is_presenter BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Policies profiles
CREATE POLICY "Everyone authenticated can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Programs (shows)
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  presenter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type program_type NOT NULL DEFAULT 'live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads programs" ON public.programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage programs" ON public.programs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Schedule entries
CREATE TABLE public.schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  recurrence recurrence_type NOT NULL DEFAULT 'once',
  recurrence_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_entries TO authenticated;
GRANT ALL ON public.schedule_entries TO service_role;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads schedule" ON public.schedule_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage schedule" ON public.schedule_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Program permissions (edit rights per user per program)
CREATE TABLE public.program_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  can_edit BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, program_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_permissions TO authenticated;
GRANT ALL ON public.program_permissions TO service_role;
ALTER TABLE public.program_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth reads permissions" ON public.program_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage permissions" ON public.program_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rundown items (per schedule entry)
CREATE TABLE public.rundown_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_entry_id UUID NOT NULL REFERENCES public.schedule_entries(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  type rundown_item_type NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  artist TEXT,
  description TEXT,
  duration_seconds INT NOT NULL DEFAULT 60,
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rundown_items TO authenticated;
GRANT ALL ON public.rundown_items TO service_role;
ALTER TABLE public.rundown_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads rundown items" ON public.rundown_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors manage rundown items" ON public.rundown_items FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.schedule_entries se
    JOIN public.program_permissions pp ON pp.program_id = se.program_id
    WHERE se.id = schedule_entry_id AND pp.user_id = auth.uid() AND pp.can_edit = true
  )
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.schedule_entries se
    JOIN public.program_permissions pp ON pp.program_id = se.program_id
    WHERE se.id = schedule_entry_id AND pp.user_id = auth.uid() AND pp.can_edit = true
  )
);

-- App settings (singleton)
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_text TEXT NOT NULL DEFAULT 'boenkerz',
  logo_url TEXT,
  use_logo BOOLEAN NOT NULL DEFAULT false,
  background_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT UPDATE, INSERT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins modify settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Presence for realtime typing indicator handled via supabase realtime presence (no table)

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_programs_upd BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_schedule_upd BEFORE UPDATE ON public.schedule_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_rundown_upd BEFORE UPDATE ON public.rundown_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.programs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rundown_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.program_permissions;
