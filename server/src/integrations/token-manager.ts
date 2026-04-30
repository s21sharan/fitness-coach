import { supabase } from "../db.js";
import { logger } from "../utils/logger.js";

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export class StravaTokenManager {
  private userId: string;
  private clientId: string;
  private clientSecret: string;

  constructor(userId: string, clientId: string, clientSecret: string) {
    this.userId = userId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async getValidToken(): Promise<string> {
    const { data: integration } = await supabase
      .from("integrations")
      .select("access_token, refresh_token, credentials")
      .eq("user_id", this.userId)
      .eq("provider", "strava")
      .single();

    if (!integration) throw new Error("No Strava integration found");

    const expiresAt = (integration.credentials as { expires_at?: number })?.expires_at ?? 0;

    if (Date.now() / 1000 > expiresAt - 300) {
      return this.refreshToken(integration.refresh_token!);
    }

    return integration.access_token!;
  }

  private async refreshToken(refreshToken: string): Promise<string> {
    const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);

    const data: TokenData = await res.json();

    await supabase
      .from("integrations")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        credentials: { expires_at: data.expires_at },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", this.userId)
      .eq("provider", "strava");

    logger.info("Strava token refreshed", { userId: this.userId });
    return data.access_token;
  }
}
