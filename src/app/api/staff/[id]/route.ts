import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { data: me } = await supabase
    .from("clinic_staff")
    .select("clinic_id, role, user_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!me || me.role !== "owner") {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: target } = await admin
    .from("clinic_staff")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.user_id === me.user_id) {
    return NextResponse.json(
      { error: "You can't remove yourself." },
      { status: 400 }
    );
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(target.user_id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}