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
          created_at: string
          created_by: string
          id: string
          industry: string | null
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          industry?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          industry?: string | null
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
      team_members: {
        Row: {
          created_at: string
          department: string | null
          display_name: string
          email: string
          id: string
          profile_id: string | null
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
          approx_size: number | null
          archived_at: string | null
          created_at: string
          created_by: string
          deadline_at: string | null
          department: string | null
          description: string
          id: string
          invite_token: string
          logo_url: string | null
          members_can_view_summary: boolean
          name: string
          organization_id: string
          results_named: boolean
          session_name: string | null
          team_code: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          approx_size?: number | null
          archived_at?: string | null
          created_at?: string
          created_by: string
          deadline_at?: string | null
          department?: string | null
          description?: string
          id?: string
          invite_token?: string
          logo_url?: string | null
          members_can_view_summary?: boolean
          name: string
          organization_id: string
          results_named?: boolean
          session_name?: string | null
          team_code: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          approx_size?: number | null
          archived_at?: string | null
          created_at?: string
          created_by?: string
          deadline_at?: string | null
          department?: string | null
          description?: string
          id?: string
          invite_token?: string
          logo_url?: string | null
          members_can_view_summary?: boolean
          name?: string
          organization_id?: string
          results_named?: boolean
          session_name?: string | null
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
      is_org_admin: { Args: { org: string }; Returns: boolean }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_team_admin: { Args: { team: string }; Returns: boolean }
      is_team_member: { Args: { team: string }; Returns: boolean }
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
      assignment_status: "invited" | "started" | "completed"
      campaign_status: "draft" | "scheduled" | "active" | "closed" | "archived"
      dimension: "D" | "I" | "S" | "C"
      export_kind: "individual_report" | "team_report" | "presentation"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      notification_status: "queued" | "sent" | "failed" | "skipped" | "logged"
      onboarding_intent:
        | "understand_myself"
        | "create_team"
        | "join_team"
        | "manage_clients"
        | "setup_organization"
      org_member_role: "member" | "coach" | "organization_admin"
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
      assignment_status: ["invited", "started", "completed"],
      campaign_status: ["draft", "scheduled", "active", "closed", "archived"],
      dimension: ["D", "I", "S", "C"],
      export_kind: ["individual_report", "team_report", "presentation"],
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
      session_status: ["in_progress", "completed", "abandoned"],
      team_member_role: ["member", "team_admin"],
    },
  },
} as const

