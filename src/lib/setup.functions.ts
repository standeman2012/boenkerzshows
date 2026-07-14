import { createServerFn } from "@tanstack/react-start";
import { PRESENTERS, ADMIN_EMAIL, accountEmail, defaultPassword } from "./accounts";

export const seedAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Check if admin exists
  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role", "admin")
    .limit(1);
  if (existing && existing.length > 0) return { ok: true, seeded: false };

  async function ensureUser(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    isAdmin: boolean,
  ) {
    // Try create
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    let userId = created?.user?.id;
    if (createErr && !userId) {
      // Already exists — look up
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200, page: 1 });
      userId = list?.users.find((u) => u.email === email)?.id;
    }
    if (!userId) return;
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      must_change_password: true,
      is_presenter: !isAdmin,
    });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: isAdmin ? "admin" : "presenter" }, { onConflict: "user_id,role" });
  }

  await ensureUser(ADMIN_EMAIL, "ikbenadmin", "Admin", "", true);
  for (const p of PRESENTERS) {
    await ensureUser(
      accountEmail(p.firstName, p.lastName),
      defaultPassword(p.firstName),
      p.firstName,
      p.lastName,
      false,
    );
  }
  return { ok: true, seeded: true };
});
