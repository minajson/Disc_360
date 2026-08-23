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
      ai_insight_narratives: {
        Row: {
          created_at: string
          edited_at: string | null
          edited_by: string | null
          fell_back: string[]
          generated_at: string
          generated_by: string | null
          id: string
          model: string | null
          narrative: Json
          population_size: number
          sample_size: number
          shared_at: string | null
          shared_by: string | null
          source: Database["public"]["Enums"]["ai_narrative_source"]
          status: Database["public"]["Enums"]["ai_narrative_status"]
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          fell_back?: string[]
          generated_at?: string
          generated_by?: string | null
          id?: string
          model?: string | null
          narrative?: Json
          population_size?: number
          sample_size?: number
          shared_at?: string | null
          shared_by?: string | null
          source?: Database["public"]["Enums"]["ai_narrative_source"]
          status?: Database["public"]["Enums"]["ai_narrative_status"]
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          fell_back?: string[]
          generated_at?: string
          generated_by?: string | null
          id?: string
          model?: string | null
          narrative?: Json
          population_size?: number
          sample_size?: number
          shared_at?: string | null
          shared_by?: string | null
          source?: Database["public"]["Enums"]["ai_narrative_source"]
          status?: Database["public"]["Enums"]["ai_narrative_status"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insight_narratives_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insight_narratives_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insight_narratives_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insight_narratives_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
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
          assessment_version: number | null
          attempt_number: number | null
          created_at: string
          department_at_completion: string | null
          id: string
          intensity: Json
          net: Json
          organization_id: string | null
          organization_name_at_completion: string | null
          primary_dimension: Database["public"]["Enums"]["dimension"]
          profile_id: string
          raw_least: Json
          raw_most: Json
          retake_note: string | null
          retake_reason: Database["public"]["Enums"]["retake_reason"] | null
          role_at_completion: string | null
          score_c: number
          score_d: number
          score_i: number
          score_s: number
          scoring_version: string | null
          secondary_dimension: Database["public"]["Enums"]["dimension"] | null
          session_id: string
          share_token: string
          team_id: string | null
          team_name_at_completion: string | null
          team_series_id: string | null
        }
        Insert: {
          archetype_code: Database["public"]["Enums"]["archetype_code"]
          assessment_version?: number | null
          attempt_number?: number | null
          created_at?: string
          department_at_completion?: string | null
          id?: string
          intensity: Json
          net: Json
          organization_id?: string | null
          organization_name_at_completion?: string | null
          primary_dimension: Database["public"]["Enums"]["dimension"]
          profile_id: string
          raw_least: Json
          raw_most: Json
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
          role_at_completion?: string | null
          score_c: number
          score_d: number
          score_i: number
          score_s: number
          scoring_version?: string | null
          secondary_dimension?: Database["public"]["Enums"]["dimension"] | null
          session_id: string
          share_token?: string
          team_id?: string | null
          team_name_at_completion?: string | null
          team_series_id?: string | null
        }
        Update: {
          archetype_code?: Database["public"]["Enums"]["archetype_code"]
          assessment_version?: number | null
          attempt_number?: number | null
          created_at?: string
          department_at_completion?: string | null
          id?: string
          intensity?: Json
          net?: Json
          organization_id?: string | null
          organization_name_at_completion?: string | null
          primary_dimension?: Database["public"]["Enums"]["dimension"]
          profile_id?: string
          raw_least?: Json
          raw_most?: Json
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
          role_at_completion?: string | null
          score_c?: number
          score_d?: number
          score_i?: number
          score_s?: number
          scoring_version?: string | null
          secondary_dimension?: Database["public"]["Enums"]["dimension"] | null
          session_id?: string
          share_token?: string
          team_id?: string | null
          team_name_at_completion?: string | null
          team_series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "assessment_results_team_series_id_fkey"
            columns: ["team_series_id"]
            isOneToOne: false
            referencedRelation: "team_series"
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
          retake_note: string | null
          retake_reason: Database["public"]["Enums"]["retake_reason"] | null
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
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
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
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
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
          retake_note: string | null
          retake_reason: Database["public"]["Enums"]["retake_reason"] | null
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
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
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
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
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
          assessment_version: number | null
          attempt_number: number | null
          automaticity: number
          created_at: string
          department_at_completion: string | null
          distraction: number
          energy_pattern: string
          id: string
          mental_load: number
          notification_pattern: string
          organization_id: string | null
          organization_name_at_completion: string | null
          pattern_code: string
          preferred_reset: string
          primary_loop: string
          profile_id: string
          raw: Json
          recovery: number
          retake_note: string | null
          retake_reason: Database["public"]["Enums"]["retake_reason"] | null
          role_at_completion: string | null
          scoring_version: string | null
          session_id: string
          team_id: string | null
          team_name_at_completion: string | null
          team_series_id: string | null
        }
        Insert: {
          assessment_version?: number | null
          attempt_number?: number | null
          automaticity: number
          created_at?: string
          department_at_completion?: string | null
          distraction: number
          energy_pattern: string
          id?: string
          mental_load: number
          notification_pattern: string
          organization_id?: string | null
          organization_name_at_completion?: string | null
          pattern_code: string
          preferred_reset: string
          primary_loop: string
          profile_id: string
          raw?: Json
          recovery: number
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
          role_at_completion?: string | null
          scoring_version?: string | null
          session_id: string
          team_id?: string | null
          team_name_at_completion?: string | null
          team_series_id?: string | null
        }
        Update: {
          assessment_version?: number | null
          attempt_number?: number | null
          automaticity?: number
          created_at?: string
          department_at_completion?: string | null
          distraction?: number
          energy_pattern?: string
          id?: string
          mental_load?: number
          notification_pattern?: string
          organization_id?: string | null
          organization_name_at_completion?: string | null
          pattern_code?: string
          preferred_reset?: string
          primary_loop?: string
          profile_id?: string
          raw?: Json
          recovery?: number
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
          role_at_completion?: string | null
          scoring_version?: string | null
          session_id?: string
          team_id?: string | null
          team_name_at_completion?: string | null
          team_series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "focus_results_team_series_id_fkey"
            columns: ["team_series_id"]
            isOneToOne: false
            referencedRelation: "team_series"
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
          retake_note: string | null
          retake_reason: Database["public"]["Enums"]["retake_reason"] | null
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
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
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
          retake_note?: string | null
          retake_reason?: Database["public"]["Enums"]["retake_reason"] | null
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
      identity_reconciliations: {
        Row: {
          action: string
          canonical_profile_id: string
          completed_at: string | null
          conflicts_resolved: Json
          counts_after: Json
          counts_before: Json
          created_at: string
          id: string
          new_email: string | null
          note: string | null
          old_email: string | null
          performed_by: string
          retired_profile_id: string | null
          status: string
        }
        Insert: {
          action: string
          canonical_profile_id: string
          completed_at?: string | null
          conflicts_resolved?: Json
          counts_after?: Json
          counts_before?: Json
          created_at?: string
          id?: string
          new_email?: string | null
          note?: string | null
          old_email?: string | null
          performed_by: string
          retired_profile_id?: string | null
          status?: string
        }
        Update: {
          action?: string
          canonical_profile_id?: string
          completed_at?: string | null
          conflicts_resolved?: Json
          counts_after?: Json
          counts_before?: Json
          created_at?: string
          id?: string
          new_email?: string | null
          note?: string | null
          old_email?: string | null
          performed_by?: string
          retired_profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_reconciliations_canonical_profile_id_fkey"
            columns: ["canonical_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_reconciliations_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_reconciliations_retired_profile_id_fkey"
            columns: ["retired_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      participant_identity_aliases: {
        Row: {
          changed_by: string | null
          created_at: string
          email: string
          first_seen_at: string
          id: string
          profile_id: string
          provider: string
          reason: string | null
          retired_at: string | null
          source: string
          source_profile_id: string | null
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          email: string
          first_seen_at?: string
          id?: string
          profile_id: string
          provider?: string
          reason?: string | null
          retired_at?: string | null
          source?: string
          source_profile_id?: string | null
          status?: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          email?: string
          first_seen_at?: string
          id?: string
          profile_id?: string
          provider?: string
          reason?: string | null
          retired_at?: string | null
          source?: string
          source_profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_identity_aliases_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_identity_aliases_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_identity_aliases_source_profile_id_fkey"
            columns: ["source_profile_id"]
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
          wellbeing_result_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["export_kind"]
          profile_id: string
          result_id?: string | null
          team_id?: string | null
          wellbeing_result_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["export_kind"]
          profile_id?: string
          result_id?: string | null
          team_id?: string | null
          wellbeing_result_id?: string | null
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
          {
            foreignKeyName: "report_exports_wellbeing_result_id_fkey"
            columns: ["wellbeing_result_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_results"
            referencedColumns: ["id"]
          },
        ]
      }
      result_corrections: {
        Row: {
          corrected_by: string
          created_at: string
          id: string
          new_values: Json
          previous_values: Json
          reason: string
          result_id: string
        }
        Insert: {
          corrected_by: string
          created_at?: string
          id?: string
          new_values: Json
          previous_values: Json
          reason: string
          result_id: string
        }
        Update: {
          corrected_by?: string
          created_at?: string
          id?: string
          new_values?: Json
          previous_values?: Json
          reason?: string
          result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_corrections_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "assessment_results"
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
      team_series: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_series_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          parent_team_id: string | null
          presentation_access: Database["public"]["Enums"]["presentation_access"]
          results_named: boolean
          session_mode: Database["public"]["Enums"]["session_mode"]
          session_name: string | null
          session_state: Database["public"]["Enums"]["session_state"]
          team_code: string
          team_series_id: string | null
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
          parent_team_id?: string | null
          presentation_access?: Database["public"]["Enums"]["presentation_access"]
          results_named?: boolean
          session_mode?: Database["public"]["Enums"]["session_mode"]
          session_name?: string | null
          session_state?: Database["public"]["Enums"]["session_state"]
          team_code: string
          team_series_id?: string | null
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
          parent_team_id?: string | null
          presentation_access?: Database["public"]["Enums"]["presentation_access"]
          results_named?: boolean
          session_mode?: Database["public"]["Enums"]["session_mode"]
          session_name?: string | null
          session_state?: Database["public"]["Enums"]["session_state"]
          team_code?: string
          team_series_id?: string | null
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
          {
            foreignKeyName: "teams_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_team_series_id_fkey"
            columns: ["team_series_id"]
            isOneToOne: false
            referencedRelation: "team_series"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_departments: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          organization_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_item_options: {
        Row: {
          bimodal_score: number
          created_at: string
          id: string
          item_id: string
          label: string | null
          likert_score: number
          position: number
        }
        Insert: {
          bimodal_score: number
          created_at?: string
          id?: string
          item_id: string
          label?: string | null
          likert_score: number
          position: number
        }
        Update: {
          bimodal_score?: number
          created_at?: string
          id?: string
          item_id?: string
          label?: string | null
          likert_score?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_item_options_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_items: {
        Row: {
          created_at: string
          external_id: string
          id: string
          position: number
          prompt: string | null
          version_id: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          position: number
          prompt?: string | null
          version_id: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          position?: number
          prompt?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_items_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_office_locations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          organization_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_office_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_policies: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          min_cohort_size: number
          organization_id: string | null
          rationale: string
          scoring_method: string
          screening_threshold: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          min_cohort_size?: number
          organization_id?: string | null
          rationale?: string
          scoring_method?: string
          screening_threshold?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          min_cohort_size?: number
          organization_id?: string | null
          rationale?: string
          scoring_method?: string
          screening_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_report_deliveries: {
        Row: {
          created_at: string
          error: string | null
          id: string
          masked_recipient: string
          notification_log_id: string | null
          profile_id: string
          requested_at: string
          resolved_at: string | null
          result_id: string
          status: Database["public"]["Enums"]["wellbeing_delivery_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          masked_recipient: string
          notification_log_id?: string | null
          profile_id: string
          requested_at?: string
          resolved_at?: string | null
          result_id: string
          status?: Database["public"]["Enums"]["wellbeing_delivery_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          masked_recipient?: string
          notification_log_id?: string | null
          profile_id?: string
          requested_at?: string
          resolved_at?: string | null
          result_id?: string
          status?: Database["public"]["Enums"]["wellbeing_delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_report_deliveries_notification_log_id_fkey"
            columns: ["notification_log_id"]
            isOneToOne: false
            referencedRelation: "notification_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_report_deliveries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_report_deliveries_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_results"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_responses: {
        Row: {
          answered_at: string
          created_at: string
          id: string
          item_id: string
          option_position: number
          session_id: string
          updated_at: string
        }
        Insert: {
          answered_at?: string
          created_at?: string
          id?: string
          item_id: string
          option_position: number
          session_id: string
          updated_at?: string
        }
        Update: {
          answered_at?: string
          created_at?: string
          id?: string
          item_id?: string
          option_position?: number
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_results: {
        Row: {
          at_or_above_threshold: boolean
          attempt_number: number | null
          completed_at: string
          created_at: string
          department_at_completion: string | null
          id: string
          item_positions: number[]
          job_title_at_completion: string | null
          likert_score: number
          office_location_at_completion: string | null
          organization_id: string | null
          organization_name_at_completion: string | null
          profile_id: string
          questionnaire_version: number
          scoring_method: string
          scoring_version: string
          session_id: string
          team_id: string | null
          team_name_at_completion: string | null
          team_series_id: string | null
          threshold_at_completion: number
          total_score: number
          version_id: string
          work_location_at_completion:
            | Database["public"]["Enums"]["wellbeing_work_location"]
            | null
        }
        Insert: {
          at_or_above_threshold: boolean
          attempt_number?: number | null
          completed_at?: string
          created_at?: string
          department_at_completion?: string | null
          id?: string
          item_positions: number[]
          job_title_at_completion?: string | null
          likert_score: number
          office_location_at_completion?: string | null
          organization_id?: string | null
          organization_name_at_completion?: string | null
          profile_id: string
          questionnaire_version: number
          scoring_method?: string
          scoring_version: string
          session_id: string
          team_id?: string | null
          team_name_at_completion?: string | null
          team_series_id?: string | null
          threshold_at_completion: number
          total_score: number
          version_id: string
          work_location_at_completion?:
            | Database["public"]["Enums"]["wellbeing_work_location"]
            | null
        }
        Update: {
          at_or_above_threshold?: boolean
          attempt_number?: number | null
          completed_at?: string
          created_at?: string
          department_at_completion?: string | null
          id?: string
          item_positions?: number[]
          job_title_at_completion?: string | null
          likert_score?: number
          office_location_at_completion?: string | null
          organization_id?: string | null
          organization_name_at_completion?: string | null
          profile_id?: string
          questionnaire_version?: number
          scoring_method?: string
          scoring_version?: string
          session_id?: string
          team_id?: string | null
          team_name_at_completion?: string | null
          team_series_id?: string | null
          threshold_at_completion?: number
          total_score?: number
          version_id?: string
          work_location_at_completion?:
            | Database["public"]["Enums"]["wellbeing_work_location"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_results_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "wellbeing_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_results_team_series_id_fkey"
            columns: ["team_series_id"]
            isOneToOne: false
            referencedRelation: "team_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_results_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_role_grants: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string
          id: string
          note: string
          organization_id: string
          profile_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["wellbeing_access_role"]
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by: string
          id?: string
          note?: string
          organization_id: string
          profile_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role: Database["public"]["Enums"]["wellbeing_access_role"]
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string
          id?: string
          note?: string
          organization_id?: string
          profile_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["wellbeing_access_role"]
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_role_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_role_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_role_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_role_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_sessions: {
        Row: {
          completed_at: string | null
          consent_at: string | null
          consent_given: boolean
          contact_email: string | null
          created_at: string
          current_index: number
          department_id: string | null
          department_name: string | null
          email_opt_in: boolean
          id: string
          job_title: string | null
          office_location_id: string | null
          office_location_name: string | null
          organization_id: string | null
          profile_id: string
          self_reported_first_time: boolean | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          team_id: string | null
          updated_at: string
          version_id: string
          work_location:
            | Database["public"]["Enums"]["wellbeing_work_location"]
            | null
        }
        Insert: {
          completed_at?: string | null
          consent_at?: string | null
          consent_given?: boolean
          contact_email?: string | null
          created_at?: string
          current_index?: number
          department_id?: string | null
          department_name?: string | null
          email_opt_in?: boolean
          id?: string
          job_title?: string | null
          office_location_id?: string | null
          office_location_name?: string | null
          organization_id?: string | null
          profile_id: string
          self_reported_first_time?: boolean | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          team_id?: string | null
          updated_at?: string
          version_id: string
          work_location?:
            | Database["public"]["Enums"]["wellbeing_work_location"]
            | null
        }
        Update: {
          completed_at?: string | null
          consent_at?: string | null
          consent_given?: boolean
          contact_email?: string | null
          created_at?: string
          current_index?: number
          department_id?: string | null
          department_name?: string | null
          email_opt_in?: boolean
          id?: string
          job_title?: string | null
          office_location_id?: string | null
          office_location_name?: string | null
          organization_id?: string | null
          profile_id?: string
          self_reported_first_time?: boolean | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          team_id?: string | null
          updated_at?: string
          version_id?: string
          work_location?:
            | Database["public"]["Enums"]["wellbeing_work_location"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_sessions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_sessions_office_location_id_fkey"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellbeing_sessions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "wellbeing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_versions: {
        Row: {
          content_status: Database["public"]["Enums"]["wellbeing_content_status"]
          created_at: string
          id: string
          is_active: boolean
          item_count: number
          licence_expires_at: string | null
          licence_granted_at: string | null
          licence_holder: string | null
          licence_note: string
          licence_reference: string | null
          name: string
          questionnaire_code: string
          updated_at: string
          version: number
        }
        Insert: {
          content_status?: Database["public"]["Enums"]["wellbeing_content_status"]
          created_at?: string
          id?: string
          is_active?: boolean
          item_count?: number
          licence_expires_at?: string | null
          licence_granted_at?: string | null
          licence_holder?: string | null
          licence_note?: string
          licence_reference?: string | null
          name: string
          questionnaire_code?: string
          updated_at?: string
          version: number
        }
        Update: {
          content_status?: Database["public"]["Enums"]["wellbeing_content_status"]
          created_at?: string
          id?: string
          is_active?: boolean
          item_count?: number
          licence_expires_at?: string | null
          licence_granted_at?: string | null
          licence_holder?: string | null
          licence_note?: string
          licence_reference?: string | null
          name?: string
          questionnaire_code?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_complete_reconciliation: {
        Args: {
          p_actor: string
          p_note?: string
          p_reconciliation: string
          p_status: string
        }
        Returns: undefined
      }
      admin_preflight_identity_reconciliation: {
        Args: { p_actor: string; p_canonical: string; p_retiring: string }
        Returns: Json
      }
      admin_reconcile_identity: {
        Args: {
          p_actor: string
          p_canonical: string
          p_note?: string
          p_retiring: string
        }
        Returns: Json
      }
      admin_record_email_change: {
        Args: {
          p_actor: string
          p_new_email: string
          p_profile: string
          p_status?: string
        }
        Returns: string
      }
      apply_super_admin_bootstrap: { Args: never; Returns: number }
      can_read_wellbeing_lookup: { Args: { org: string }; Returns: boolean }
      has_any_wellbeing_role: { Args: { org: string }; Returns: boolean }
      has_wellbeing_role: {
        Args: {
          org: string
          required: Database["public"]["Enums"]["wellbeing_access_role"]
        }
        Returns: boolean
      }
      identity_summary: { Args: { p_profile: string }; Returns: Json }
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
      wellbeing_active_policy: {
        Args: { org: string }
        Returns: {
          min_cohort_size: number
          screening_threshold: number
        }[]
      }
    }
    Enums: {
      ai_narrative_source: "model" | "rules" | "edited"
      ai_narrative_status: "draft" | "shared"
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
      assessment_type: "disc" | "focus" | "combined" | "wellbeing"
      assignment_status: "invited" | "started" | "completed"
      campaign_status: "draft" | "scheduled" | "active" | "closed" | "archived"
      dimension: "D" | "I" | "S" | "C"
      export_kind:
        | "individual_report"
        | "team_report"
        | "presentation"
        | "wellbeing_report"
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
      retake_reason:
        | "first_attempt"
        | "new_role"
        | "new_team"
        | "annual_reassessment"
        | "leadership_programme"
        | "personal_review"
        | "other"
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
      wellbeing_access_role: "wellbeing_governance" | "wellbeing_analyst"
      wellbeing_content_status: "structure_only" | "licensed" | "retired"
      wellbeing_delivery_status:
        | "requested"
        | "sent"
        | "failed"
        | "not_delivered"
      wellbeing_work_location: "field_based" | "office_based"
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
      ai_narrative_source: ["model", "rules", "edited"],
      ai_narrative_status: ["draft", "shared"],
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
      assessment_type: ["disc", "focus", "combined", "wellbeing"],
      assignment_status: ["invited", "started", "completed"],
      campaign_status: ["draft", "scheduled", "active", "closed", "archived"],
      dimension: ["D", "I", "S", "C"],
      export_kind: [
        "individual_report",
        "team_report",
        "presentation",
        "wellbeing_report",
      ],
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
      retake_reason: [
        "first_attempt",
        "new_role",
        "new_team",
        "annual_reassessment",
        "leadership_programme",
        "personal_review",
        "other",
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
      wellbeing_access_role: ["wellbeing_governance", "wellbeing_analyst"],
      wellbeing_content_status: ["structure_only", "licensed", "retired"],
      wellbeing_delivery_status: [
        "requested",
        "sent",
        "failed",
        "not_delivered",
      ],
      wellbeing_work_location: ["field_based", "office_based"],
    },
  },
} as const

