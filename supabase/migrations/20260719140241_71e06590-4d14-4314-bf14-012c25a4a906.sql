
-- 1. Profiles: restrict SELECT
DROP POLICY IF EXISTS "Everyone authenticated can read profiles" ON public.profiles;
CREATE POLICY "Read own, presenters, or admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR is_presenter = true
    OR public.has_role(auth.uid(), 'admin')
  );

-- 2. Program permissions: restrict SELECT
DROP POLICY IF EXISTS "Auth reads permissions" ON public.program_permissions;
CREATE POLICY "Read own permissions or admin"
  ON public.program_permissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 3. User roles: explicit admin-only write policies
CREATE POLICY "Admins insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Revoke direct EXECUTE on has_role from client roles.
-- RLS policies invoke it as SECURITY DEFINER via the postgres role, so policies keep working.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
