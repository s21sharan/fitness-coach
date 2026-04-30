import { supabase } from "../db.js";
import { logger } from "../utils/logger.js";

export interface SyncResult {
  userId: string;
  provider: string;
  recordsSynced: number;
  error?: string;
}

export async function logSync(result: SyncResult): Promise<void> {
  await supabase.from("sync_logs").insert({
    user_id: result.userId,
    provider: result.provider,
    status: result.error ? "error" : "success",
    records_synced: result.recordsSynced,
    error_message: result.error || null,
    completed_at: new Date().toISOString(),
  });

  if (result.error) {
    logger.error("Sync failed", { userId: result.userId, provider: result.provider, error: result.error });
  } else {
    logger.info("Sync completed", { userId: result.userId, provider: result.provider, records: result.recordsSynced });
  }
}

export async function getActiveIntegrations(provider: string) {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("provider", provider)
    .eq("status", "active");

  if (error) throw error;
  return data || [];
}

export async function updateSyncTimestamp(userId: string, provider: string): Promise<void> {
  await supabase
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
}

export async function markIntegrationError(userId: string, provider: string): Promise<void> {
  await supabase
    .from("integrations")
    .update({ status: "error", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
}
