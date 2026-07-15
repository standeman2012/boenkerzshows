
CREATE TABLE IF NOT EXISTS public.program_presenters (
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (program_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_presenters TO authenticated;
GRANT ALL ON public.program_presenters TO service_role;

ALTER TABLE public.program_presenters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_presenters_select_auth" ON public.program_presenters
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "program_presenters_admin_all" ON public.program_presenters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.program_presenters (program_id, user_id)
  SELECT id, presenter_id FROM public.programs WHERE presenter_id IS NOT NULL
  ON CONFLICT DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.program_presenters;
