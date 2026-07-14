
-- Fix search_path
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

-- Storage policies
CREATE POLICY "Auth read avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth read branding" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'branding');
CREATE POLICY "Admins write branding" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update branding" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete branding" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
