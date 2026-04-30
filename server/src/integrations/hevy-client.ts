const BASE_URL = "https://api.hevyapp.com/v1";

interface HevySet {
  index: number;
  type: "warmup" | "normal" | "failure" | "dropset";
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
}

interface HevyExercise {
  index: number;
  title: string;
  exercise_template_id: string;
  notes: string | null;
  supersets_id: number | null;
  sets: HevySet[];
}

export interface HevyWorkout {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  updated_at: string;
  created_at: string;
  exercises: HevyExercise[];
}

export interface HevyWorkoutEvent {
  type: "updated" | "deleted";
  workout?: HevyWorkout;
  id?: string;
  deleted_at?: string;
}

export class HevyClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: { "api-key": this.apiKey },
    });

    if (!res.ok) throw new Error(`Hevy API ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async validate(): Promise<boolean> {
    try {
      await this.get("/workouts", { page: "1", pageSize: "1" });
      return true;
    } catch {
      return false;
    }
  }

  async getWorkouts(maxPages = 100): Promise<HevyWorkout[]> {
    const all: HevyWorkout[] = [];
    let page = 1;

    while (page <= maxPages) {
      const res = await this.get<{ page: number; page_count: number; workouts: HevyWorkout[] }>(
        "/workouts",
        { page: String(page), pageSize: "10" },
      );
      all.push(...res.workouts);
      if (page >= res.page_count) break;
      page++;
    }

    return all;
  }

  async getWorkoutEvents(since: string): Promise<HevyWorkoutEvent[]> {
    const all: HevyWorkoutEvent[] = [];
    let page = 1;

    while (true) {
      const res = await this.get<{ page: number; page_count: number; events: HevyWorkoutEvent[] }>(
        "/workouts/events",
        { page: String(page), pageSize: "10", since },
      );
      all.push(...res.events);
      if (page >= res.page_count) break;
      page++;
    }

    return all;
  }

  async getWorkout(workoutId: string): Promise<HevyWorkout> {
    return this.get<HevyWorkout>(`/workouts/${workoutId}`);
  }
}
