export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assessment_campaigns: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          deadline_at: string | null
          id: string
          invitation_message: string
          name: string
          starts_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          team_id: string
          updated_at: string
          version_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          deadline_at?: string | null
          id?: string
          invitation_message?: string
          name: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          team_id: string
          updated_at?: string
          version_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          deadline_at?: string | null
          id?: string
          invitation_message?: string
          name?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          team_id?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_campaigns_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_campaigns_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "assessment_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_responses: {
        Row: {
          answered_at: string
          created_at: string
          id: string
          least_option_id: string
          most_option_id: string
          question_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          answered_at?: string
          created_at?: string
          id?: string
          least_option_id: string
          most_option_id: string
          question_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          answered_at?: string
          created_at?: string
          id?: string
          least_option_id?: string
          most_option_id?: string
          question_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_least_option_id_fkey"
            columns: ["least_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_most_option_id_fkey"
            columns: ["most_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_results: {
        Row: {
          archetype_code: Database["public"]["Enums"]["archetype_code"]
          created_at: string
          id: string
          intensity: Json
          net: Json
          primary_dimension: Database["public"]["Enums"]["dimension"]
          profile_id: string
          raw_least: Json
          raw_most: Json
          score_c: number
          score_d: number
          score_i: number
          score_s: number
          secondary_dimension: Database["public"]["Enums"]["dimension"] | null
          session_id: string
          share_token: string
          team_id: string | null
        }
        Insert: {
          archetype_code: Database["public"]["Enums"]["archetype_code"]
          created_at?: string
          id?: string
          intensity: Json
          net: Json
          primary_dimension: Database["public"]["Enums"]["dimension"]
          profile_id: string
          raw_least: Json
          raw_most: Json
          score_c: number
          score_d: number
          score_i: number
          score_s: number
          secondary_dimension?: Database["public"]["Enums"]["dimension"] | null
          session_id: string
          share_token?: string
          team_id?: string | null
        }
        Update: {
          archetype_code?: Database["public"]["Enums"]["archetype_code"]
          created_at?: string
          id?: string
          intensity?: Json
          net?: Json
          primary_dimension?: Database["public"]["Enums"]["dimension"]
          profile_id?: string
          raw_least?: Json
          raw_most?: Json
          score_c?: number
          score_d?: number
          score_i?: number
          score_s?: number
          secondary_dimension?: Database["public"]["Enums"]["dimension"] | null
          session_id?: string
          share_token?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          campaign_id: string | null
          completed_at: string | null
          created_at: string
          current_index: number
          id: string
          profile_id: string
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          team_id: string | null
          updated_at: string
          version_id: string
        }
        Insert: {
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_index?: number
          id?: string
          profile_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          team_id?: string | null
          updated_at?: string
          version_id: string
        }
        Update: {
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_index?: number
          id?: string
          profile_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          team_id?: string | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "assessment_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "assessment_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          version?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_assignments: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          reminded_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          team_member_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          reminded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          team_member_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          reminded_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "assessment_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_assignments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_profiles: {
        Row: {
          banner_path: string | null
          bio: string
          created_at: string
          credentials: string[]
          expertise: string[]
          linkedin: string | null
          location: string | null
          logo_path: string | null
          organization: string | null
          phone: string | null
          photo_path: string | null
          profile_id: string
          show_in_presentation: boolean
          specialties: string[]
          title: string | null
          updated_at: string
          website: string | null
          years_experience: number | null
        }
        Insert: {
          banner_path?: string | null
          bio?: string
          created_at?: string
          credentials?: string[]
          expertise?: string[]
          linkedin?: string | null
          location?: string | null
          logo_path?: string | null
          organization?: string | null
          phone?: string | null
          photo_path?: string | null
          profile_id: string
          show_in_presentation?: boolean
          specialties?: string[]
          title?: string | null
          updated_at?: string
          website?: string | null
          years_experience?: number | null
        }
        Update: {
          banner_path?: string | null
          bio?: string
          created_at?: string
          credentials?: string[]
          expertise?: string[]
          linkedin?: string | null
          location?: string | null
          logo_path?: string | null
          organization?: string | null
          phone?: string | null
          photo_path?: string | null
          profile_id?: string
          show_in_presentation?: boolean
          specialties?: string[]
          title?: string | null
          updated_at?: string
          website?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      combined_sessions: {
        Row: {
          campaign_id: string | null
          created_at: string
          disc_session_id: string | null
          focus_session_id: string | null
          id: string
          profile_id: string
          status: Database["public"]["Enums"]["session_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          disc_session_id?: string | null
          focus_session_id?: string | null
          id?: string
          profile_id: string
          status?: Database["public"]["Enums"]["session_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          disc_session_id?: string | null
          focus_session_id?: string | null
          id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["session_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "combined_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "assessment_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combined_sessions_disc_session_id_fkey"
            columns: ["disc_session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combined_sessions_focus_session_id_fkey"
            columns: ["focus_session_id"]
            isOneToOne: false
            referencedRelation: "focus_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combined_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combined_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          product: string
          purchased_at: string
          purchaser_id: string
          simulated: boolean
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          product?: string
          purchased_at?: string
          purchaser_id: string
          simulated?: boolean
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          product?: string
          purchased_at?: string
          purchaser_id?: string
          simulated?: boolean
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_purchaser_id_fkey"
            columns: ["purchaser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_options: {
        Row: {
          external_id: string
          id: string
          label: string
          position: number
          question_id: string
        }
        Insert: {
          external_id: string
          id?: string
          label: string
          position: number
          question_id: string
        }
        Update: {
          external_id?: string
          id?: string
          label?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "focus_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_questions: {
        Row: {
          external_id: string
          id: string
          kind: Database["public"]["Enums"]["focus_question_kind"]
          position: number
          prompt: string
          scale_max: number | null
          scale_min: number | null
          version_id: string
        }
        Insert: {
          external_id: string
          id?: string
          kind?: Database["public"]["Enums"]["focus_question_kind"]
          position: number
          prompt: string
          scale_max?: number | null
          scale_min?: number | null
          version_id: string
        }
        Update: {
          external_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["focus_question_kind"]
          position?: number
          prompt?: string
          scale_max?: number | null
          scale_min?: number | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_questions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "focus_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_responses: {
        Row: {
          answered_at: string
          id: string
          option_id: string | null
          question_id: string
          scale_value: number | null
          session_id: string
        }
        Insert: {
          answered_at?: string
          id?: string
          option_id?: string | null
          question_id: string
          scale_value?: number | null
          session_id: string
        }
        Update: {
          answered_at?: string
          id?: string
          option_id?: string | null
          question_id?: string
          scale_value?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_responses_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "focus_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "focus_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "focus_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_results: {
        Row: {
          automaticity: number
          created_at: string
          distraction: number
          energy_pattern: string
          id: string
          mental_load: number
          notification_pattern: string
          pattern_code: string
          preferred_reset: string
          primary_loop: string
          profile_id: string
          raw: Json
          recovery: number
          session_id: string
          team_id: string | null
        }
        Insert: {
          automaticity: number
          created_at?: string
          distraction: number
          energy_pattern: string
          id?: string
          mental_load: number
          notification_pattern: string
          pattern_code: string
          preferred_reset: string
          primary_loop: string
          profile_id: string
          raw?: Json
          recovery: number
          session_id: string
          team_id?: string | null
        }
        Update: {
          automaticity?: number
          created_at?: string
          distraction?: number
          energy_pattern?: string
          id?: string
          mental_load?: number
          notification_pattern?: string
          pattern_code?: string
          preferred_reset?: string
          primary_loop?: string
          profile_id?: string
          raw?: Json
          recovery?: number
          session_id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_results_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "focus_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_sessions: {
        Row: {
          campaign_id: string | null
          completed_at: string | null
          created_at: string
          current_index: number
          id: string
          profile_id: string
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          team_id: string | null
          updated_at: string
          version_id: string
        }
        Insert: {
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_index?: number
          id?: string
          profile_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          team_id?: string | null
          updated_at?: string
          version_id: string
        }
        Update: {
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_index?: number
          id?: string
          profile_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          team_id?: string | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "assessment_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_sessions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "focus_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          version?: number
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          last_sent_at: string
          message: string | null
          send_count: number
          status: Database["public"]["Enums"]["invitation_status"]
          team_id: string
          team_member_id: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          last_sent_at?: string
          message?: string | null
          send_count?: number
          status?: Database["public"]["Enums"]["invitation_status"]
          team_id: string
          team_member_id?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          last_sent_at?: string
          message?: string | null
          send_count?: number
          status?: Database["public"]["Enums"]["invitation_status"]
          team_id?: string
          team_member_id?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string
          email: string
          error: string | null
          id: string
          profile_id: string | null
          provider_id: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
          template: string
        }
        Insert: {
          created_at?: string
          email: string
          error?: string | null
          id?: string
          profile_id?: string | null
          provider_id?: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
          template: string
        }
        Update: {
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          profile_id?: string | null
          provider_id?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          assessment_reminders: boolean
          created_at: string
          id: string
          product_updates: boolean
          profile_id: string
          report_notifications: boolean
          team_updates: boolean
          updated_at: string
        }
        Insert: {
          assessment_reminders?: boolean
          created_at?: string
          id?: string
          product_updates?: boolean
          profile_id: string
          report_notifications?: boolean
          team_updates?: boolean
          updated_at?: string
        }
        Update: {
          assessment_reminders?: boolean
          created_at?: string
          id?: string
          product_updates?: boolean
          profile_id?: string
          report_notifications?: boolean
          team_updates?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          profile_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          profile_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          cover_path: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          industry: string | null
          logo_path: string | null
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          cover_path?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          industry?: string | null
          logo_path?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          industry?: string | null
          logo_path?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          communications_opt_in: boolean
          consented_at: string | null
          country: string | null
          created_at: string
          deactivated_at: string | null
          deletion_requested_at: string | null
          email: string
          full_name: string
          id: string
          is_super_admin: boolean
          onboarded_at: string | null
          onboarding_intent:
            | Database["public"]["Enums"]["onboarding_intent"]
            | null
          preferred_name: string
          profession: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          communications_opt_in?: boolean
          consented_at?: string | null
          country?: string | null
          created_at?: string
          deactivated_at?: string | null
          deletion_requested_at?: string | null
          email: string
          full_name?: string
          id: string
          is_super_admin?: boolean
          onboarded_at?: string | null
          onboarding_intent?:
            | Database["public"]["Enums"]["onboarding_intent"]
            | null
          preferred_name?: string
          profession?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          communications_opt_in?: boolean
          consented_at?: string | null
          country?: string | null
          created_at?: string
          deactivated_at?: string | null
          deletion_requested_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_super_admin?: boolean
          onboarded_at?: string | null
          onboarding_intent?:
            | Database["public"]["Enums"]["onboarding_intent"]
            | null
          preferred_name?: string
          profession?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      question_options: {
        Row: {
          dimension: Database["public"]["Enums"]["dimension"]
          external_id: string
          id: string
          label: string
          position: number
          question_id: string
        }
        Insert: {
          dimension: Database["public"]["Enums"]["dimension"]
          external_id: string
          id?: string
          label: string
          position: number
          question_id: string
        }
        Update: {
          dimension?: Database["public"]["Enums"]["dimension"]
          external_id?: string
          id?: string
          label?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          external_id: string
          id: string
          position: number
          prompt: string
          version_id: string
        }
        Insert: {
          external_id: string
          id?: string
          position: number
          prompt: string
          version_id: string
        }
        Update: {
          external_id?: string
          id?: string
          position?: number
          prompt?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "assessment_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      report_exports: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["export_kind"]
          profile_id: string
          result_id: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["export_kind"]
          profile_id: string
          result_id?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["export_kind"]
          profile_id?: string
          result_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_exports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_exports_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "assessment_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_exports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      result_insights: {
        Row: {
          created_at: string
          id: string
          insight_snapshot: Json
          result_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insight_snapshot: Json
          result_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insight_snapshot?: Json
          result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_insights_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: true
            referencedRelation: "assessment_results"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_bootstrap: {
        Row: {
          created_at: string
          email: string
          note: string
        }
        Insert: {
          created_at?: string
          email: string
          note?: string
        }
        Update: {
          created_at?: string
          email?: string
          note?: string
        }
        Relationships: []
      }
      team_creation_drafts: {
        Row: {
          approximate_size: number | null
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          created_at: string
          deadline_at: string | null
          department: string | null
          draft_token: string
          expires_at: string
          id: string
          members_can_view_summary: boolean
          organization_name: string
          owner_profile_id: string | null
          participant_limit: number | null
          results_named: boolean
          session_name: string | null
          status: string
          team_name: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          approximate_size?: number | null
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          created_at?: string
          deadline_at?: string | null
          department?: string | null
          draft_token?: string
          expires_at?: string
          id?: string
          members_can_view_summary?: boolean
          organization_name?: string
          owner_profile_id?: string | null
          participant_limit?: number | null
          results_named?: boolean
          session_name?: string | null
          status?: string
          team_name?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          approximate_size?: number | null
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          created_at?: string
          deadline_at?: string | null
          department?: string | null
          draft_token?: string
          expires_at?: string
          id?: string
          members_can_view_summary?: boolean
          organization_name?: string
          owner_profile_id?: string | null
          participant_limit?: number | null
          results_named?: boolean
          session_name?: string | null
          status?: string
          team_name?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_creation_drafts_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          department: string | null
          display_name: string
          email: string
          id: string
          profile_id: string | null
          reference_id: string | null
          role: Database["public"]["Enums"]["team_member_role"]
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          display_name: string
          email: string
          id?: string
          profile_id?: string | null
          reference_id?: string | null
          role?: Database["public"]["Enums"]["team_member_role"]
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          display_name?: string
          email?: string
          id?: string
          profile_id?: string | null
          reference_id?: string | null
          role?: Database["public"]["Enums"]["team_member_role"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          active_slide: number | null
          approx_size: number | null
          archived_at: string | null
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          client_organization: string | null
          cover_path: string | null
          created_at: string
          created_by: string
          deadline_at: string | null
          department: string | null
          description: string
          engagement_starts_at: string | null
          facilitator_name: string | null
          id: string
          invite_token: string
          join_enabled: boolean
          logo_url: string | null
          members_can_view_summary: boolean
          name: string
          organization_id: string
          presentation_access: Database["public"]["Enums"]["presentation_access"]
          results_named: boolean
          session_mode: Database["public"]["Enums"]["session_mode"]
          session_name: string | null
          session_state: Database["public"]["Enums"]["session_state"]
          team_code: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          active_slide?: number | null
          approx_size?: number | null
          archived_at?: string | null
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          client_organization?: string | null
          cover_path?: string | null
          created_at?: string
          created_by: string
          deadline_at?: string | null
          department?: string | null
          description?: string
          engagement_starts_at?: string | null
          facilitator_name?: string | null
          id?: string
          invite_token?: string
          join_enabled?: boolean
          logo_url?: string | null
          members_can_view_summary?: boolean
          name: string
          organization_id: string
          presentation_access?: Database["public"]["Enums"]["presentation_access"]
          results_named?: boolean
          session_mode?: Database["public"]["Enums"]["session_mode"]
          session_name?: string | null
          session_state?: Database["public"]["Enums"]["session_state"]
          team_code: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          active_slide?: number | null
          approx_size?: number | null
          archived_at?: string | null
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          client_organization?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string
          deadline_at?: string | null
          department?: string | null
          description?: string
          engagement_starts_at?: string | null
          facilitator_name?: string | null
          id?: string
          invite_token?: string
          join_enabled?: boolean
          logo_url?: string | null
          members_can_view_summary?: boolean
          name?: string
          organization_id?: string
          presentation_access?: Database["public"]["Enums"]["presentation_access"]
          results_named?: boolean
          session_mode?: Database["public"]["Enums"]["session_mode"]
          session_name?: string | null
          session_state?: Database["public"]["Enums"]["session_state"]
          team_code?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_super_admin_bootstrap: { Args: never; Returns: number }
      is_org_admin: { Args: { org: string }; Returns: boolean }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_team_admin: { Args: { team: string }; Returns: boolean }
      is_team_member: { Args: { team: string }; Returns: boolean }
      resolve_join_token: {
        Args: { p_token: string }
        Returns: {
          assessment_type: string
          client_organization: string
          cover_path: string
          deadline_at: string
          invited_email: string
          organization_name: string
          presenter_name: string
          presenter_title: string
          session_mode: string
          session_name: string
          state: string
          team_id: string
          team_name: string
        }[]
      }
      resolve_team_code: {
        Args: { p_code: string }
        Returns: {
          invite_token: string
          state: string
          team_name: string
        }[]
      }
    }
    Enums: {
      archetype_code:
        | "D"
        | "DI"
        | "ID"
        | "I"
        | "IS"
        | "SI"
        | "S"
        | "SC"
        | "CS"
        | "C"
        | "CD"
        | "DC"
        | "BAL"
      assessment_type: "disc" | "focus" | "combined"
      assignment_status: "invited" | "started" | "completed"
      campaign_status: "draft" | "scheduled" | "active" | "closed" | "archived"
      dimension: "D" | "I" | "S" | "C"
      export_kind: "individual_report" | "team_report" | "presentation"
      focus_question_kind: "single" | "scale"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      notification_status: "queued" | "sent" | "failed" | "skipped" | "logged"
      onboarding_intent:
        | "understand_myself"
        | "create_team"
        | "join_team"
        | "manage_clients"
        | "setup_organization"
      org_member_role: "member" | "coach" | "organization_admin"
      presentation_access:
        | "live_only"
        | "live_and_review"
        | "review_after_session"
      session_mode: "self_paced" | "facilitator_led"
      session_state:
        | "draft"
        | "presentation"
        | "assessment_open"
        | "assessment_closed"
        | "results"
        | "ended"
      session_status: "in_progress" | "completed" | "abandoned"
      team_member_role: "member" | "team_admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      archetype_code: [
        "D",
        "DI",
        "ID",
        "I",
        "IS",
        "SI",
        "S",
        "SC",
        "CS",
        "C",
        "CD",
        "DC",
        "BAL",
      ],
      assessment_type: ["disc", "focus", "combined"],
      assignment_status: ["invited", "started", "completed"],
      campaign_status: ["draft", "scheduled", "active", "closed", "archived"],
      dimension: ["D", "I", "S", "C"],
      export_kind: ["individual_report", "team_report", "presentation"],
      focus_question_kind: ["single", "scale"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      notification_status: ["queued", "sent", "failed", "skipped", "logged"],
      onboarding_intent: [
        "understand_myself",
        "create_team",
        "join_team",
        "manage_clients",
        "setup_organization",
      ],
      org_member_role: ["member", "coach", "organization_admin"],
      presentation_access: [
        "live_only",
        "live_and_review",
        "review_after_session",
      ],
      session_mode: ["self_paced", "facilitator_led"],
      session_state: [
        "draft",
        "presentation",
        "assessment_open",
        "assessment_closed",
        "results",
        "ended",
      ],
      session_status: ["in_progress", "completed", "abandoned"],
      team_member_role: ["member", "team_admin"],
    },
  },
} as const

