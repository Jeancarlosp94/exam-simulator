/**
 * Database type — hand-written to mirror supabase/migrations/0001_initial_schema.sql.
 *
 * Will be replaced by the output of `supabase gen types typescript --linked`
 * once the project is linked to a real Supabase instance.
 *
 * If you change the schema, update this type in the same commit.
 */

export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export type Difficulty = "easy" | "medium" | "hard";

export type QuestionOption = { label: string; text: string };

export type ThemePalette = "teal" | "forest" | "sunset" | "lavender";
export type ThemeMode = "focus" | "relax";
export type ThemeBrightness = "dark" | "light";
export type ThemeSettings = {
  palette: ThemePalette;
  mode: ThemeMode;
  brightness: ThemeBrightness;
};

export type KeyTerm = {
  term: string;
  definition: string;
  why_it_matters: string;
};

export type ConceptMapNode = { id: string; label: string };

export type ConceptMapEdge = {
  from: string; // node id
  to: string; // node id
  label: string;
};

export type RetrievalQuestion = {
  prompt: string;
  options: QuestionOption[];
  correct_label: string;
  explanation: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          theme_settings: ThemeSettings;
          email_reminder_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          theme_settings?: ThemeSettings;
          email_reminder_enabled?: boolean;
        };
        Update: {
          email?: string;
          display_name?: string | null;
          theme_settings?: ThemeSettings;
          email_reminder_enabled?: boolean;
        };
        Relationships: [];
      };
      daily_activity: {
        Row: {
          user_id: string;
          activity_date: string;
          reviews_completed: number;
          quizzes_completed: number;
          study_chunks_done: number;
        };
        Insert: {
          user_id: string;
          activity_date: string;
          reviews_completed?: number;
          quizzes_completed?: number;
          study_chunks_done?: number;
        };
        Update: {
          reviews_completed?: number;
          quizzes_completed?: number;
          study_chunks_done?: number;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          storage_path: string;
          size_bytes: number;
          page_count: number | null;
          status: "uploading" | "extracting" | "ready" | "failed";
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          storage_path: string;
          size_bytes: number;
          page_count?: number | null;
          status?: "uploading" | "extracting" | "ready" | "failed";
        };
        Update: {
          title?: string;
          page_count?: number | null;
          status?: "uploading" | "extracting" | "ready" | "failed";
          error_message?: string | null;
        };
        Relationships: [];
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          token_count: number | null;
          page_start: number | null;
          page_end: number | null;
          created_at: string;
        };
        Insert: {
          document_id: string;
          chunk_index: number;
          content: string;
          token_count?: number | null;
          page_start?: number | null;
          page_end?: number | null;
        };
        Update: never;
        Relationships: [];
      };
      quizzes: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          title: string;
          difficulty: "easy" | "mixed" | "hard";
          question_count: number;
          time_limit_minutes: number | null;
          generation_model: string | null;
          generation_tokens_input: number | null;
          generation_tokens_output: number | null;
          generation_cached_tokens: number | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          document_id: string;
          title: string;
          difficulty?: "easy" | "mixed" | "hard";
          question_count: number;
          time_limit_minutes?: number | null;
          generation_model?: string | null;
          generation_tokens_input?: number | null;
          generation_tokens_output?: number | null;
          generation_cached_tokens?: number | null;
        };
        Update: never;
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          quiz_id: string;
          position: number;
          prompt: string;
          options: QuestionOption[];
          correct_label: string;
          explanation: string;
          bloom_level: BloomLevel;
          difficulty: Difficulty;
          source_chunk_id: string | null;
          created_at: string;
        };
        Insert: {
          quiz_id: string;
          position: number;
          prompt: string;
          options: QuestionOption[];
          correct_label: string;
          explanation: string;
          bloom_level: BloomLevel;
          difficulty: Difficulty;
          source_chunk_id?: string | null;
        };
        // Regenerate-question updates these in place; id, quiz_id, position,
        // source_chunk_id are immutable to preserve attempt/SRS integrity.
        Update: {
          prompt?: string;
          options?: QuestionOption[];
          correct_label?: string;
          explanation?: string;
          bloom_level?: BloomLevel;
          difficulty?: Difficulty;
        };
        Relationships: [];
      };
      attempts: {
        Row: {
          id: string;
          user_id: string;
          quiz_id: string;
          mode: "practice" | "timed";
          started_at: string;
          completed_at: string | null;
          time_spent_seconds: number | null;
          score_correct: number | null;
          score_total: number | null;
        };
        Insert: {
          user_id: string;
          quiz_id: string;
          mode?: "practice" | "timed";
        };
        Update: {
          completed_at?: string | null;
          time_spent_seconds?: number | null;
          score_correct?: number | null;
          score_total?: number | null;
        };
        Relationships: [];
      };
      answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          selected_label: string | null;
          is_correct: boolean | null;
          flagged: boolean;
          answered_at: string | null;
        };
        Insert: {
          attempt_id: string;
          question_id: string;
          selected_label?: string | null;
          is_correct?: boolean | null;
          flagged?: boolean;
          answered_at?: string | null;
        };
        Update: {
          selected_label?: string | null;
          is_correct?: boolean | null;
          flagged?: boolean;
          answered_at?: string | null;
        };
        Relationships: [];
      };
      srs_cards: {
        Row: {
          id: string;
          user_id: string;
          // Nullable since flashcard cards leave it null; check constraint
          // in the migration enforces exactly one of question_id/flashcard_id.
          question_id: string | null;
          flashcard_id: string | null;
          source_type: "question" | "flashcard";
          ease_factor: number;
          interval_days: number;
          repetitions: number;
          next_review_at: string;
          last_reviewed_at: string | null;
        };
        Insert: {
          user_id: string;
          question_id?: string | null;
          flashcard_id?: string | null;
          source_type?: "question" | "flashcard";
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          next_review_at?: string;
          last_reviewed_at?: string | null;
        };
        Update: {
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          next_review_at?: string;
          last_reviewed_at?: string | null;
        };
        Relationships: [];
      };
      flashcards: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          front: string;
          back: string;
          bloom_level: BloomLevel;
          source_chunk_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          document_id: string;
          front: string;
          back: string;
          bloom_level: BloomLevel;
          source_chunk_id?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      study_sessions: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          mode: "pomodoro" | "deep_work" | "feynman" | "quick_review";
          status: "active" | "completed" | "abandoned";
          current_step: "pre_study" | "chunks" | "concept_map" | "completed";
          current_chunk_index: number;
          key_terms: KeyTerm[] | null;
          advance_organizer: string | null;
          schema_activation_answer: string | null;
          concept_map_nodes: ConceptMapNode[] | null;
          concept_map_edges: ConceptMapEdge[] | null;
          started_at: string;
          last_active_at: string;
          completed_at: string | null;
        };
        Insert: {
          user_id: string;
          document_id: string;
          mode: "pomodoro" | "deep_work" | "feynman" | "quick_review";
          status?: "active" | "completed" | "abandoned";
          current_step?: "pre_study" | "chunks" | "concept_map" | "completed";
          current_chunk_index?: number;
          key_terms?: KeyTerm[] | null;
          advance_organizer?: string | null;
          schema_activation_answer?: string | null;
          concept_map_nodes?: ConceptMapNode[] | null;
          concept_map_edges?: ConceptMapEdge[] | null;
        };
        Update: {
          status?: "active" | "completed" | "abandoned";
          current_step?: "pre_study" | "chunks" | "concept_map" | "completed";
          current_chunk_index?: number;
          key_terms?: KeyTerm[] | null;
          advance_organizer?: string | null;
          schema_activation_answer?: string | null;
          concept_map_nodes?: ConceptMapNode[] | null;
          concept_map_edges?: ConceptMapEdge[] | null;
          last_active_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      study_session_chunks: {
        Row: {
          session_id: string;
          chunk_index: number;
          document_chunk_id: string | null;
          elaborative_question: string | null;
          retrieval_question: RetrievalQuestion | null;
          elaborative_answer: string | null;
          self_explanation_answer: string | null;
          self_explanation_score: number | null;
          self_explanation_feedback: string | null;
          retrieval_selected_label: string | null;
          retrieval_is_correct: boolean | null;
          retrieval_attempts: number;
          visited_at: string;
          completed_at: string | null;
        };
        Insert: {
          session_id: string;
          chunk_index: number;
          document_chunk_id?: string | null;
          elaborative_question?: string | null;
          retrieval_question?: RetrievalQuestion | null;
          elaborative_answer?: string | null;
          self_explanation_answer?: string | null;
          self_explanation_score?: number | null;
          self_explanation_feedback?: string | null;
          retrieval_selected_label?: string | null;
          retrieval_is_correct?: boolean | null;
          retrieval_attempts?: number;
          completed_at?: string | null;
        };
        Update: {
          elaborative_answer?: string | null;
          self_explanation_answer?: string | null;
          self_explanation_score?: number | null;
          self_explanation_feedback?: string | null;
          retrieval_selected_label?: string | null;
          retrieval_is_correct?: boolean | null;
          retrieval_attempts?: number;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      public_quiz_shares: {
        Row: {
          slug: string;
          quiz_id: string;
          created_by: string;
          view_count: number;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          slug: string;
          quiz_id: string;
          created_by: string;
          view_count?: number;
          expires_at?: string | null;
        };
        Update: {
          view_count?: number;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string | null;
          status: "free" | "active" | "past_due" | "canceled" | "trialing";
          plan: "free" | "pro";
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          updated_at: string;
        };
        // Writes are server-only — RLS only permits SELECT for the owner.
        // The Stripe webhook is the only writer; opened up for service-role.
        Insert: {
          user_id: string;
          stripe_customer_id: string;
          stripe_subscription_id?: string | null;
          status?: "free" | "active" | "past_due" | "canceled" | "trialing";
          plan?: "free" | "pro";
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          updated_at?: string;
        };
        Update: {
          stripe_customer_id?: string;
          stripe_subscription_id?: string | null;
          status?: "free" | "active" | "past_due" | "canceled" | "trialing";
          plan?: "free" | "pro";
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_user_streak: {
        Args: { p_user_id: string };
        Returns: number;
      };
      increment_daily_activity: {
        Args: {
          p_user_id: string;
          p_activity_date: string;
          p_column: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
