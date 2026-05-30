import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("profiles").select("user_id").limit(1);

  return NextResponse.json(
    {
      status: "ok",
      db: error ? "unreachable" : "reachable",
      db_error: error?.message,
      timestamp: new Date().toISOString(),
    },
    { status: error ? 503 : 200 },
  );
}
