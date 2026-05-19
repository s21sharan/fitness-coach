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
          athlete_identity: string | null;
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
          athlete_identity?: string | null;
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
          primary_goal: string | null;
          secondary_goals: string[] | null;
          goal_rank: string[] | null;
          aggressiveness: string | null;
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
          primary_goal?: string | null;
          secondary_goals?: string[] | null;
          goal_rank?: string[] | null;
          aggressiveness?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_goals"]["Insert"]>;
      };
      athlete_sports: {
        Row: {
          id: string;
          user_id: string;
          sport: "run" | "bike" | "swim" | "lift" | "other";
          enabled: boolean;
          is_planned: boolean;
          priority: number | null;
          is_primary: boolean;
          is_limiter: boolean;
          current_volume: Record<string, unknown> | null;
          target_peak: Record<string, unknown> | null;
          sport_specific: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sport: "run" | "bike" | "swim" | "lift" | "other";
          enabled?: boolean;
          is_planned?: boolean;
          priority?: number | null;
          is_primary?: boolean;
          is_limiter?: boolean;
          current_volume?: Record<string, unknown> | null;
          target_peak?: Record<string, unknown> | null;
          sport_specific?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_sports"]["Insert"]>;
      };
      athlete_events: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          sport_type: string | null;
          distance: string | null;
          event_date: string | null;
          priority: "A" | "B" | "C" | null;
          goal_type: string | null;
          goal_time: string | null;
          course_notes: string | null;
          travel: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          sport_type?: string | null;
          distance?: string | null;
          event_date?: string | null;
          priority?: "A" | "B" | "C" | null;
          goal_type?: string | null;
          goal_time?: string | null;
          course_notes?: string | null;
          travel?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_events"]["Insert"]>;
      };
      athlete_availability_windows: {
        Row: {
          id: string;
          user_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          max_duration_min: number | null;
          session_count: number | null;
          locations: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          max_duration_min?: number | null;
          session_count?: number | null;
          locations?: string[] | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_availability_windows"]["Insert"]>;
      };
      athlete_availability_rules: {
        Row: {
          id: string;
          user_id: string;
          rule_key: string;
          params: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rule_key: string;
          params?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_availability_rules"]["Insert"]>;
      };
      athlete_recovery: {
        Row: {
          user_id: string;
          avg_sleep_hours: number | null;
          sleep_consistency: string | null;
          work_stress: string | null;
          physical_job: boolean;
          has_readiness_data: boolean;
          sore_frequency: string | null;
          recovery_confidence: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          avg_sleep_hours?: number | null;
          sleep_consistency?: string | null;
          work_stress?: string | null;
          physical_job?: boolean;
          has_readiness_data?: boolean;
          sore_frequency?: string | null;
          recovery_confidence?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_recovery"]["Insert"]>;
      };
      athlete_injuries: {
        Row: {
          id: string;
          user_id: string;
          area: string;
          description: string | null;
          current_pain_level: number | null;
          history: boolean;
          triggers: string[] | null;
          affecting_training: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          area: string;
          description?: string | null;
          current_pain_level?: number | null;
          history?: boolean;
          triggers?: string[] | null;
          affecting_training?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_injuries"]["Insert"]>;
      };
      athlete_equipment: {
        Row: {
          id: string;
          user_id: string;
          sport: string;
          item: string;
          available: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sport: string;
          item: string;
          available?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_equipment"]["Insert"]>;
      };
      athlete_body_nutrition: {
        Row: {
          user_id: string;
          body_goal: string | null;
          goal_weight_lbs: number | null;
          target_rate_lbs_per_week: number | null;
          diet_style: string | null;
          protein_target_g: number | null;
          protein_tier: string | null;
          fuel_workouts_when_cutting: string | null;
          tracking_app: string | null;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          body_goal?: string | null;
          goal_weight_lbs?: number | null;
          target_rate_lbs_per_week?: number | null;
          diet_style?: string | null;
          protein_target_g?: number | null;
          protein_tier?: string | null;
          fuel_workouts_when_cutting?: string | null;
          tracking_app?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_body_nutrition"]["Insert"]>;
      };
      athlete_preferences: {
        Row: {
          user_id: string;
          motivation_drivers: string[] | null;
          common_derailers: string[] | null;
          enjoyed_workouts: string[] | null;
          dislikes: string[] | null;
          sacrifice_priority: string[] | null;
          protect_priority: string[] | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          motivation_drivers?: string[] | null;
          common_derailers?: string[] | null;
          enjoyed_workouts?: string[] | null;
          dislikes?: string[] | null;
          sacrifice_priority?: string[] | null;
          protect_priority?: string[] | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_preferences"]["Insert"]>;
      };
      athlete_coach_settings: {
        Row: {
          user_id: string;
          aggressiveness: string | null;
          explanation_level: string | null;
          missed_workout_behavior: string | null;
          plan_flexibility: string | null;
          tone_notes: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          aggressiveness?: string | null;
          explanation_level?: string | null;
          missed_workout_behavior?: string | null;
          plan_flexibility?: string | null;
          tone_notes?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_coach_settings"]["Insert"]>;
      };
      athlete_chat_notes: {
        Row: {
          id: string;
          user_id: string;
          insertion_point: "goals" | "availability" | "plan_preview" | "coach_style";
          raw_text: string;
          extracted: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          insertion_point: "goals" | "availability" | "plan_preview" | "coach_style";
          raw_text: string;
          extracted?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_chat_notes"]["Insert"]>;
      };
      athlete_derived_scores: {
        Row: {
          user_id: string;
          training_maturity: string | null;
          ramp_risk: string | null;
          recovery_capacity: string | null;
          goal_conflict: string | null;
          plan_flexibility: string | null;
          interference_score: string | null;
          computed_at: string;
        };
        Insert: {
          user_id: string;
          training_maturity?: string | null;
          ramp_risk?: string | null;
          recovery_capacity?: string | null;
          goal_conflict?: string | null;
          plan_flexibility?: string | null;
          interference_score?: string | null;
          computed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_derived_scores"]["Insert"]>;
      };
      onboarding_drafts: {
        Row: {
          user_id: string;
          payload: Record<string, unknown>;
          current_step: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          payload: Record<string, unknown>;
          current_step?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["onboarding_drafts"]["Insert"]>;
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
          targets: Record<string, unknown> | null;
          status: "scheduled" | "completed" | "skipped" | "moved";
          calendar_event_id: string | null;
          approved: boolean;
          synced_at: string | null;
          skip_reason: string | null;
          skipped_at: string | null;
          completion_note: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          plan_id: string;
          date: string;
          day_of_week: number;
          session_type: string;
          ai_notes?: string | null;
          targets?: Record<string, unknown> | null;
          status?: "scheduled" | "completed" | "skipped" | "moved";
          calendar_event_id?: string | null;
          approved?: boolean;
          synced_at?: string | null;
          skip_reason?: string | null;
          skipped_at?: string | null;
          completion_note?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["planned_workouts"]["Insert"]>;
      };
      athlete_facts: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          subject: string | null;
          predicate: string;
          value: Record<string, unknown> | null;
          summary: string;
          lifecycle: "chronic" | "standing" | "recent" | "ephemeral";
          confidence: number;
          status: "active" | "expired" | "superseded" | "archived";
          observed_at: string;
          expires_at: string | null;
          source: "chat" | "completion_note" | "skip_note" | "plan_acceptance" | "onboarding_recap" | "manual" | "derived";
          source_ref_table: string | null;
          source_ref_id: string | null;
          supersedes_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          subject?: string | null;
          predicate: string;
          value?: Record<string, unknown> | null;
          summary: string;
          lifecycle: "chronic" | "standing" | "recent" | "ephemeral";
          confidence?: number;
          status?: "active" | "expired" | "superseded" | "archived";
          observed_at?: string;
          expires_at?: string | null;
          source: "chat" | "completion_note" | "skip_note" | "plan_acceptance" | "onboarding_recap" | "manual" | "derived";
          source_ref_table?: string | null;
          source_ref_id?: string | null;
          supersedes_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_facts"]["Insert"]>;
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
