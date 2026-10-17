import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me } = await supabase
    .from("clinic_staff")
    .select("clinic_id, role, permissions")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!me || me.role !== "owner" && !me.permissions.includes("settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("clinic_staff")
    .select("*")
    .eq("clinic_id", me.clinic_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ staff: data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { email, password, fullName, role, doctorId } = body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("clinic_staff")
    .select("clinic_id, role")
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

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message ?? "Could not create user." },
      { status: 400 }
    );
  }

  // FIX: Ensure the role matches the DB check constraint exactly
  let dbRole = "receptionist";
  let perms = ["reception"];
  
  if (role === "doctor") {
    dbRole = "doctor";
    perms = ["doctor"];
  }

  const { error: staffErr } = await admin.from("clinic_staff").insert({
    user_id: created.user.id,
    clinic_id: me.clinic_id,
    role: dbRole,
    doctor_id: dbRole === "doctor" ? doctorId : null,
    permissions: perms,
  });

  if (staffErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: staffErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}