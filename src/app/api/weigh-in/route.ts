import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end") ?? new Date().toISOString().slice(0, 10);

  const supabase = createServerClient();
  let q = supabase
    .from("weigh_ins")
    .select("date, weight_lbs, source")
    .eq("user_id", userId)
    .order("date", { ascending: true });

  if (start) q = q.gte("date", start);
  if (end) q = q.lte("date", end);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { date?: string; weight_lbs?: number };
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  const weight = Number(body.weight_lbs);
  if (!Number.isFinite(weight) || weight <= 0) {
    return NextResponse.json({ error: "weight_lbs required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("weigh_ins")
    .upsert(
      { user_id: userId, date, weight_lbs: weight, source: "manual" },
      { onConflict: "user_id,date" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase
    .from("weigh_ins")
    .delete()
    .eq("user_id", userId)
    .eq("date", date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
