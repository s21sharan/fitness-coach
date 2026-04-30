import { StravaTokenManager } from "./token-manager.js";

const BASE_URL = "https://www.strava.com/api/v3";

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  start_date: string;
  start_date_local: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  has_heartrate: boolean;
  calories?: number;
}

interface GetActivitiesParams {
  after?: number;
  before?: number;
  page?: number;
  per_page?: number;
}

export class StravaClient {
  private tokenManager: StravaTokenManager;

  constructor(tokenManager: StravaTokenManager) {
    this.tokenManager = tokenManager;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.tokenManager.getValidToken();
    const url = new URL(`${BASE_URL}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) throw new Error("Strava rate limit exceeded");
    if (!res.ok) throw new Error(`Strava API ${path} failed: ${res.status}`);

    return res.json() as Promise<T>;
  }

  async getActivities(params: GetActivitiesParams): Promise<StravaActivity[]> {
    const queryParams: Record<string, string> = {};
    if (params.after) queryParams.after = String(params.after);
    if (params.before) queryParams.before = String(params.before);
    queryParams.page = String(params.page || 1);
    queryParams.per_page = String(params.per_page || 30);

    return this.get<StravaActivity[]>("/athlete/activities", queryParams);
  }

  async getAllActivitiesSince(afterEpoch: number): Promise<StravaActivity[]> {
    const all: StravaActivity[] = [];
    let page = 1;

    while (true) {
      const batch = await this.getActivities({ after: afterEpoch, page, per_page: 30 });
      if (batch.length === 0) break;
      all.push(...batch);
      page++;
    }

    return all;
  }

  async getActivity(activityId: number): Promise<StravaActivity> {
    return this.get<StravaActivity>(`/activities/${activityId}`);
  }
}
