import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const front = formData.get("front") as File | null;
  const side = formData.get("side") as File | null;
  const back = formData.get("back") as File | null;
  const notes = formData.get("notes") as string | null;

  if (!front || !side || !back) {
    return NextResponse.json({ error: "All three photos required" }, { status: 400 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const urls: Record<string, string> = {};

  for (const [angle, file] of [["front", front], ["side", side], ["back", back]] as const) {
    const path = `${userId}/${date}/${angle}.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("physique-checkins")
      .upload(path, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed for ${angle}: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("physique-checkins")
      .getPublicUrl(path);

    urls[angle] = urlData.publicUrl;
  }

  const { data: checkin, error: dbError } = await supabase
    .from("physique_checkins")
    .upsert({
      user_id: userId,
      date,
      front_url: urls.front,
      side_url: urls.side,
      back_url: urls.back,
      notes: notes || null,
    }, { onConflict: "user_id,date" })
    .select("id, date, front_url, side_url, back_url, notes")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, checkin });
}
