import { supabase } from "../db.js";
import { config } from "../config.js";
import { MacroFactorClient } from "../integrations/macrofactor-client.js";
import { decrypt } from "../utils/encryption.js";
import { getActiveIntegrations, logSync, updateSyncTimestamp, markIntegrationError } from "./base.js";
import { logger } from "../utils/logger.js";

interface NutritionEntry {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export function normalizeNutrition(userId: string, entry: NutritionEntry) {
  return {
    user_id: userId,
    date: entry.date,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    fiber: entry.fiber,
    sugar: null,
    sodium: null,
    meals: null,
    synced_at: new Date().toISOString(),
  };
}

export async function syncMacroFactorForUser(
  userId: string,
  credentials: { email: string; password: string },
  since?: string,
): Promise<number> {
  const email = decrypt(credentials.email, config.encryptionKey);
  const password = decrypt(credentials.password, config.encryptionKey);

  const client = await MacroFactorClient.login(email, password, config.macrofactorFirebaseApiKey);

  const startDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);

  const nutrition = await client.getNutrition(startDate, endDate);
  const rows = nutrition.map((entry) => normalizeNutrition(userId, entry));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("nutrition_logs")
      .upsert(rows, { onConflict: "user_id,date" });

    if (error) throw error;
  }

  return rows.length;
}

export async function syncAllMacroFactor(): Promise<void> {
  const integrations = await getActiveIntegrations("macrofactor");

  for (const integration of integrations) {
    try {
      const creds = integration.credentials as { email: string; password: string };
      const since = integration.last_synced_at
        ? new Date(integration.last_synced_at).toISOString().slice(0, 10)
        : undefined;

      const count = await syncMacroFactorForUser(integration.user_id, creds, since);
      await updateSyncTimestamp(integration.user_id, "macrofactor");
      await logSync({ userId: integration.user_id, provider: "macrofactor", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "macrofactor", recordsSynced: 0, error });
      await markIntegrationError(integration.user_id, "macrofactor");
    }
  }
}
