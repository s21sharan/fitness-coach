export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          onboarding_completed: boolean;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
          onboarding_completed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          height: number | null;
          weight: number | null;
          age: number | null;
          sex: "M" | "F" | "Other" | null;
          activity_level: number | null;
          training_experience: "beginner" | "intermediate" | "advanced" | null;
          timezone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          height?: number | null;
          weight?: number | null;
          age?: number | null;
          sex?: "M" | "F" | "Other" | null;
          activity_level?: number | null;
          training_experience?: "beginner" | "intermediate" | "advanced" | null;
          timezone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
      };
      user_goals: {
        Row: {
          id: string;
          user_id: string;
          body_goal: "gain_muscle" | "lose_weight" | "maintain" | "other";
          body_goal_other: string | null;
          emphasis: "shoulders" | "chest" | "back" | "arms" | "legs" | "glutes" | "none" | null;
          training_for_race: boolean;
          race_type:
            | "5k"
            | "10k"
            | "half_marathon"
            | "marathon"
            | "ultra"
            | "sprint_tri"
            | "olympic_tri"
            | "half_ironman"
            | "ironman"
            | "other"
            | null;
          race_type_other: string | null;
          race_date: string | null;
          goal_time: string | null;
          does_cardio: boolean;
          cardio_types: string[] | null;
          days_per_week: number;
          lifting_days: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          body_goal: "gain_muscle" | "lose_weight" | "maintain" | "other";
          body_goal_other?: string | null;
          emphasis?: "shoulders" | "chest" | "back" | "arms" | "legs" | "glutes" | "none" | null;
          training_for_race?: boolean;
          race_type?:
            | "5k"
            | "10k"
            | "half_marathon"
            | "marathon"
            | "ultra"
            | "sprint_tri"
            | "olympic_tri"
            | "half_ironman"
            | "ironman"
            | "other"
            | null;
          race_type_other?: string | null;
          race_date?: string | null;
          goal_time?: string | null;
          does_cardio?: boolean;
          cardio_types?: string[] | null;
          days_per_week?: number;
          lifting_days?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_goals"]["Insert"]>;
      };
      integrations: {
        Row: {
          id: string;
          user_id: string;
          provider: "macrofactor" | "hevy" | "strava" | "garmin" | "google_calendar";
          access_token: string | null;
          refresh_token: string | null;
          provider_user_id: string | null;
          credentials: Record<string, unknown> | null;
          last_synced_at: string | null;
          status: "active" | "expired" | "error";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "macrofactor" | "hevy" | "strava" | "garmin" | "google_calendar";
          access_token?: string | null;
          refresh_token?: string | null;
          provider_user_id?: string | null;
          credentials?: Record<string, unknown> | null;
          last_synced_at?: string | null;
          status?: "active" | "expired" | "error";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Insert"]>;
      };
      nutrition_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          calories: number | null;
          protein: number | null;
          carbs: number | null;
          fat: number | null;
          fiber: number | null;
          sugar: number | null;
          sodium: number | null;
          meals: Record<string, unknown> | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          calories?: number | null;
          protein?: number | null;
          carbs?: number | null;
          fat?: number | null;
          fiber?: number | null;
          sugar?: number | null;
          sodium?: number | null;
          meals?: Record<string, unknown> | null;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["nutrition_logs"]["Insert"]>;
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          workout_id: string | null;
          name: string | null;
          duration_minutes: number | null;
          exercises: Record<string, unknown> | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          workout_id?: string | null;
          name?: string | null;
          duration_minutes?: number | null;
          exercises?: Record<string, unknown> | null;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workout_logs"]["Insert"]>;
      };
      cardio_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          activity_id: string | null;
          type: "run" | "bike" | "swim" | "other" | null;
          distance: number | null;
          duration: number | null;
          avg_hr: number | null;
          calories: number | null;
          pace_or_speed: number | null;
          elevation: number | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          activity_id?: string | null;
          type?: "run" | "bike" | "swim" | "other" | null;
          distance?: number | null;
          duration?: number | null;
          avg_hr?: number | null;
          calories?: number | null;
          pace_or_speed?: number | null;
          elevation?: number | null;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cardio_logs"]["Insert"]>;
      };
      recovery_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          resting_hr: number | null;
          hrv: number | null;
          sleep_hours: number | null;
          sleep_score: number | null;
          body_battery: number | null;
          stress_level: number | null;
          steps: number | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          resting_hr?: number | null;
          hrv?: number | null;
          sleep_hours?: number | null;
          sleep_score?: number | null;
          body_battery?: number | null;
          stress_level?: number | null;
          steps?: number | null;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recovery_logs"]["Insert"]>;
      };
      training_plans: {
        Row: {
          id: string;
          user_id: string;
          split_type:
            | "full_body"
            | "upper_lower"
            | "ppl"
            | "arnold"
            | "phul"
            | "bro_split"
            | "hybrid_upper_lower"
            | "hybrid_nick_bare";
          body_goal: string | null;
          race_type: string | null;
          status: "active" | "paused" | "completed";
          plan_config: Record<string, unknown> | null;
          last_adjusted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          split_type:
            | "full_body"
            | "upper_lower"
            | "ppl"
            | "arnold"
            | "phul"
            | "bro_split"
            | "hybrid_upper_lower"
            | "hybrid_nick_bare";
          body_goal?: string | null;
          race_type?: string | null;
          status?: "active" | "paused" | "completed";
          plan_config?: Record<string, unknown> | null;
          last_adjusted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_plans"]["Insert"]>;
      };
      planned_workouts: {
        Row: {
          id: string;
          plan_id: string;
          date: string;
          day_of_week: number;
          session_type: string;
          ai_notes: string | null;
          status: "scheduled" | "completed" | "skipped" | "moved";
          calendar_event_id: string | null;
          approved: boolean;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          plan_id: string;
          date: string;
          day_of_week: number;
          session_type: string;
          ai_notes?: string | null;
          status?: "scheduled" | "completed" | "skipped" | "moved";
          calendar_event_id?: string | null;
          approved?: boolean;
          synced_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["planned_workouts"]["Insert"]>;
      };
      chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_conversations"]["Insert"]>;
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          tool_calls: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          tool_calls?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
      };
      weekly_checkins: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          weight_trend: number | null;
          avg_calories: number | null;
          training_volume: number | null;
          training_compliance: number | null;
          ai_summary: string | null;
          plan_adjustments: Record<string, unknown> | null;
          user_approved: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          weight_trend?: number | null;
          avg_calories?: number | null;
          training_volume?: number | null;
          training_compliance?: number | null;
          ai_summary?: string | null;
          plan_adjustments?: Record<string, unknown> | null;
          user_approved?: boolean | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_checkins"]["Insert"]>;
      };
    };
  };
};
