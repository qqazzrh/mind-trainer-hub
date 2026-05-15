export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      coaching_prompts: {
        Row: {
          ask: string
          created_at: string
          id: string
          pattern: string
          tip: string
        }
        Insert: {
          ask: string
          created_at?: string
          id?: string
          pattern: string
          tip: string
        }
        Update: {
          ask?: string
          created_at?: string
          id?: string
          pattern?: string
          tip?: string
        }
        Relationships: []
      }
      facilitators: {
        Row: {
          created_at: string
          facilitator_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          facilitator_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          facilitator_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      participant_scores: {
        Row: {
          dimension: string | null
          id: string
          participant_id: string
          recorded_at: string
          round_number: number | null
          score: number | null
          session_id: string | null
        }
        Insert: {
          dimension?: string | null
          id?: string
          participant_id: string
          recorded_at?: string
          round_number?: number | null
          score?: number | null
          session_id?: string | null
        }
        Update: {
          dimension?: string | null
          id?: string
          participant_id?: string
          recorded_at?: string
          round_number?: number | null
          score?: number | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          id: string
          name: string
          participant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          participant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          participant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          created_at: string
          data: Json
          difficulty: number
          id: string
          round_number: number
          scores: Json
          session_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          difficulty: number
          id?: string
          round_number: number
          scores?: Json
          session_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          difficulty?: number
          id?: string
          round_number?: number
          scores?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          config: Json
          created_at: string
          ended_at: string | null
          facilitator_id: string | null
          game_type: string
          id: string
          started_at: string
          state: Json
          status: string
        }
        Insert: {
          config?: Json
          created_at?: string
          ended_at?: string | null
          facilitator_id?: string | null
          game_type: string
          id?: string
          started_at?: string
          state?: Json
          status?: string
        }
        Update: {
          config?: Json
          created_at?: string
          ended_at?: string | null
          facilitator_id?: string | null
          game_type?: string
          id?: string
          started_at?: string
          state?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "facilitators"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          answer_keys: Json
          created_at: string
          difficulty_level: number
          full_text: string
          id: string
          segments: Json
          title: string | null
        }
        Insert: {
          answer_keys?: Json
          created_at?: string
          difficulty_level: number
          full_text: string
          id?: string
          segments: Json
          title?: string | null
        }
        Update: {
          answer_keys?: Json
          created_at?: string
          difficulty_level?: number
          full_text?: string
          id?: string
          segments?: Json
          title?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
