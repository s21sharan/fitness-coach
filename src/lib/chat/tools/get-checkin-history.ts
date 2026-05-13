import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getCheckinHistoryTool(userId: string) {
  return tool({
    description:
      "Check when the user's last physique check-in was and whether they have check-ins enabled. Use to decide whether to prompt for a new check-in.",
    inputSchema: z.object({}),
    execute: async () => {
      const supabase = createServerClient();

      const { data } = await supabase
        .from("physique_checkins")
        .select("date")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      const lastDate = data?.date || null;
      let daysSinceLast: number | null = null;

      if (lastDate) {
        const last = new Date(lastDate);
        const now = new Date();
        daysSinceLast = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        last_checkin_date: lastDate,
        days_since_last: daysSinceLast,
      };
    },
  });
}
