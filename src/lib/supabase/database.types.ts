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
      activities: {
        Row: {
          body: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          done: boolean
          due_at: string | null
          id: string
          kind: string
        }
        Insert: {
          body: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done?: boolean
          due_at?: string | null
          id?: string
          kind?: string
        }
        Update: {
          body?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done?: boolean
          due_at?: string | null
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          amount: number
          budget_id: string
          category: string
          id: string
          notes: string | null
        }
        Insert: {
          amount: number
          budget_id: string
          category: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          budget_id?: string
          category?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          created_by: string | null
          decision_id: string | null
          id: string
          month: string
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          id?: string
          month: string
          notes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          id?: string
          month?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: true
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          location: string | null
          name: string
          notes: string | null
          segment: string | null
          size: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name: string
          notes?: string | null
          segment?: string | null
          size?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          segment?: string | null
          size?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          linkedin: string | null
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          linkedin?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          linkedin?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          id: string
          owner_id: string | null
          publish_date: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          owner_id?: string | null
          publish_date?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          owner_id?: string | null
          publish_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          expected_close: string | null
          id: string
          notes: string | null
          owner_id: string | null
          pipeline_id: string
          position: number
          stage_id: string
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          expected_close?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id: string
          position?: number
          stage_id: string
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          expected_close?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string
          position?: number
          stage_id?: string
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_votes: {
        Row: {
          choice: Database["public"]["Enums"]["vote_choice"]
          comment: string | null
          created_at: string
          decision_id: string
          updated_at: string
          voter_id: string
        }
        Insert: {
          choice: Database["public"]["Enums"]["vote_choice"]
          comment?: string | null
          created_at?: string
          decision_id: string
          updated_at?: string
          voter_id?: string
        }
        Update: {
          choice?: Database["public"]["Enums"]["vote_choice"]
          comment?: string | null
          created_at?: string
          decision_id?: string
          updated_at?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_votes_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          description: string | null
          id: string
          idea_id: string | null
          jev_analysis: Json | null
          jev_analyzed_at: string | null
          jev_focus: string | null
          jev_verdict: Json | null
          options_considered: string | null
          outcome_notes: string | null
          status: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          description?: string | null
          id?: string
          idea_id?: string | null
          jev_analysis?: Json | null
          jev_analyzed_at?: string | null
          jev_focus?: string | null
          jev_verdict?: Json | null
          options_considered?: string | null
          outcome_notes?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          description?: string | null
          id?: string
          idea_id?: string | null
          jev_analysis?: Json | null
          jev_analyzed_at?: string | null
          jev_focus?: string | null
          jev_verdict?: Json | null
          options_considered?: string | null
          outcome_notes?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          body_html: string
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          content: Json
          created_at: string
          created_by: string | null
          id: string
          idea_id: string | null
          template_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_folders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "file_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_questions: {
        Row: {
          ai_suggested_at: string | null
          ai_suggestion: string | null
          ai_tips: string[]
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          created_at: string
          created_by: string | null
          id: string
          idea_id: string
          position: number
          question: string
          required: boolean
          source: string
          stage: number
          updated_at: string
        }
        Insert: {
          ai_suggested_at?: string | null
          ai_suggestion?: string | null
          ai_tips?: string[]
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id: string
          position?: number
          question: string
          required?: boolean
          source?: string
          stage: number
          updated_at?: string
        }
        Update: {
          ai_suggested_at?: string | null
          ai_suggestion?: string | null
          ai_tips?: string[]
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id?: string
          position?: number
          question?: string
          required?: boolean
          source?: string
          stage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_questions_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_questions_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_stage_reviews: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          idea_id: string
          notes: string | null
          stage: number
          verdict: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id: string
          notes?: string | null
          stage: number
          verdict: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id?: string
          notes?: string | null
          stage?: number
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_stage_reviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_stage_reviews_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          assumptions: string | null
          created_at: string
          created_by: string | null
          id: string
          outcome: string | null
          problem: string | null
          solution: string | null
          stage: number
          status: Database["public"]["Enums"]["idea_status"]
          target_customer: string | null
          title: string
          updated_at: string
          why_pay: string | null
          why_us: string | null
        }
        Insert: {
          assumptions?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          outcome?: string | null
          problem?: string | null
          solution?: string | null
          stage?: number
          status?: Database["public"]["Enums"]["idea_status"]
          target_customer?: string | null
          title: string
          updated_at?: string
          why_pay?: string | null
          why_us?: string | null
        }
        Update: {
          assumptions?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          outcome?: string | null
          problem?: string | null
          solution?: string | null
          stage?: number
          status?: Database["public"]["Enums"]["idea_status"]
          target_customer?: string | null
          title?: string
          updated_at?: string
          why_pay?: string | null
          why_us?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ideas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      key_results: {
        Row: {
          created_at: string
          current_value: number
          id: string
          objective_id: string
          start_value: number
          target_value: number
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          objective_id: string
          start_value?: number
          target_value: number
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          objective_id?: string
          start_value?: number
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_searches: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          finished_at: string | null
          id: string
          lead_count: number
          query: string
          seed_urls: string[]
          segment: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          lead_count?: number
          query: string
          seed_urls?: string[]
          segment: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          lead_count?: number
          query?: string
          seed_urls?: string[]
          segment?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_searches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company_id: string | null
          company_name: string
          created_at: string
          fit_score: number | null
          id: string
          industry: string | null
          location: string | null
          pain_signals: string[]
          search_id: string | null
          segment: string | null
          source_url: string | null
          status: string
          suggested_offer: string | null
          summary: string | null
          website: string | null
        }
        Insert: {
          company_id?: string | null
          company_name: string
          created_at?: string
          fit_score?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          pain_signals?: string[]
          search_id?: string | null
          segment?: string | null
          source_url?: string | null
          status?: string
          suggested_offer?: string | null
          summary?: string | null
          website?: string | null
        }
        Update: {
          company_id?: string | null
          company_name?: string
          created_at?: string
          fit_score?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          pain_signals?: string[]
          search_id?: string | null
          segment?: string | null
          source_url?: string | null
          status?: string
          suggested_offer?: string | null
          summary?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "lead_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      network_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          last_contacted: string | null
          linkedin: string | null
          next_follow_up: string | null
          notes: string | null
          organization: string | null
          relationship: string
          role: string | null
          strength: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_contacted?: string | null
          linkedin?: string | null
          next_follow_up?: string | null
          notes?: string | null
          organization?: string | null
          relationship?: string
          role?: string | null
          strength?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_contacted?: string | null
          linkedin?: string | null
          next_follow_up?: string | null
          notes?: string | null
          organization?: string | null
          relationship?: string
          role?: string | null
          strength?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          key: string
          profile_id: string
          read_at: string
        }
        Insert: {
          key: string
          profile_id?: string
          read_at?: string
        }
        Update: {
          key?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string
          description: string | null
          id: string
          owner_id: string | null
          period: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          period: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          period?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          key: string
          label: string
          module: string
          position: number
        }
        Insert: {
          key: string
          label: string
          module: string
          position?: number
        }
        Update: {
          key?: string
          label?: string
          module?: string
          position?: number
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          id: string
          kind: string
          name: string
          pipeline_id: string
          position: number
          probability: number
        }
        Insert: {
          id?: string
          kind?: string
          name: string
          pipeline_id: string
          position?: number
          probability?: number
        }
        Update: {
          id?: string
          kind?: string
          name?: string
          pipeline_id?: string
          position?: number
          probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      problems: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          evidence: string | null
          frequency: number | null
          id: string
          idea_id: string | null
          screenshot_path: string | null
          screenshot_taken_at: string | null
          severity: number | null
          source_title: string | null
          source_type: string
          source_url: string | null
          status: string
          title: string
          updated_at: string
          who_has_it: string | null
          willingness_to_pay: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence?: string | null
          frequency?: number | null
          id?: string
          idea_id?: string | null
          screenshot_path?: string | null
          screenshot_taken_at?: string | null
          severity?: number | null
          source_title?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
          who_has_it?: string | null
          willingness_to_pay?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence?: string | null
          frequency?: number | null
          id?: string
          idea_id?: string | null
          screenshot_path?: string | null
          screenshot_taken_at?: string | null
          severity?: number | null
          source_title?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          who_has_it?: string | null
          willingness_to_pay?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "problems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problems_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          idea_id: string | null
          key: string
          name: string
          owner_id: string | null
          start_date: string | null
          status: string
          task_seq: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          idea_id?: string | null
          key: string
          name: string
          owner_id?: string | null
          start_date?: string | null
          status?: string
          task_seq?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          idea_id?: string | null
          key?: string
          name?: string
          owner_id?: string | null
          start_date?: string | null
          status?: string
          task_seq?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
          upload_id: string | null
          url: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
          upload_id?: string | null
          url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
          upload_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_attachments: {
        Row: {
          created_at: string
          id: string
          item_id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_attachments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_items: {
        Row: {
          body: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          idea_id: string | null
          lane: string
          owner_id: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          idea_id?: string | null
          lane?: string
          owner_id?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          idea_id?: string | null
          lane?: string
          owner_id?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_items_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          kind: string
          label: string
          note: string | null
          target_id: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          kind: string
          label: string
          note?: string | null
          target_id?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          kind?: string
          label?: string
          note?: string | null
          target_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_links_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_milestones: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          item_id: string
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          item_id: string
          position?: number
          title: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          item_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_milestones_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_updates: {
        Row: {
          author_id: string
          body: Json
          body_html: string
          created_at: string
          id: string
          item_id: string
        }
        Insert: {
          author_id?: string
          body: Json
          body_html: string
          created_at?: string
          id?: string
          item_id: string
        }
        Update: {
          author_id?: string
          body?: Json
          body_html?: string
          created_at?: string
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_updates_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: string
          role: string
        }
        Insert: {
          permission: string
          role: string
        }
        Update: {
          permission?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_fkey"
            columns: ["permission"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          is_system: boolean
          key: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      sprints: {
        Row: {
          committed_points: number | null
          completed_at: string | null
          completed_points: number | null
          created_at: string
          end_date: string | null
          goal: string | null
          id: string
          name: string
          project_id: string
          start_date: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          committed_points?: number | null
          completed_at?: string | null
          completed_points?: number | null
          created_at?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          name: string
          project_id: string
          start_date?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          committed_points?: number | null
          completed_at?: string | null
          completed_points?: number | null
          created_at?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          name?: string
          project_id?: string
          start_date?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          id: string
          kind: string
          options: string[]
          position: number
          prompt: string
          required: boolean
          survey_id: string
        }
        Insert: {
          id?: string
          kind?: string
          options?: string[]
          position?: number
          prompt: string
          required?: boolean
          survey_id: string
        }
        Update: {
          id?: string
          kind?: string
          options?: string[]
          position?: number
          prompt?: string
          required?: boolean
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          respondent_email: string | null
          respondent_name: string | null
          survey_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          survey_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          idea_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idea_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          idea_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          id: number
          project_id: string
          task_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          project_id: string
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          project_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          profile_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notes: {
        Row: {
          author_id: string
          body: Json
          body_html: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id?: string
          body: Json
          body_html: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: Json
          body_html?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          body: Json | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          frequency: string
          id: string
          kind: string
          number: number
          parent_id: string | null
          position: number
          priority: string
          progress: number
          project_id: string
          reporting_period: string | null
          sprint_id: string | null
          start_date: string | null
          started_at: string | null
          status: string
          story_points: number | null
          teams: string[]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          body?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          frequency?: string
          id?: string
          kind?: string
          number?: number
          parent_id?: string | null
          position?: number
          priority?: string
          progress?: number
          project_id: string
          reporting_period?: string | null
          sprint_id?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: string
          story_points?: number | null
          teams?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          body?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          frequency?: string
          id?: string
          kind?: string
          number?: number
          parent_id?: string | null
          position?: number
          priority?: string
          progress?: number
          project_id?: string
          reporting_period?: string | null
          sprint_id?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: string
          story_points?: number | null
          teams?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          kind: string
          occurred_on: string
          project_id: string | null
          recurring: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          kind: string
          occurred_on?: string
          project_id?: string | null
          recurring?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          kind?: string
          occurred_on?: string
          project_id?: string | null
          recurring?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          idea_id: string | null
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          tags: string[]
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          idea_id?: string | null
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          tags?: string[]
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          idea_id?: string | null
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          tags?: string[]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploads_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "file_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploads_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_sprint: {
        Args: { p_move_to?: string; p_sprint: string }
        Returns: undefined
      }
      has_permission: { Args: { p: string }; Returns: boolean }
      idea_open_questions: {
        Args: { p_idea: string; p_through_stage: number }
        Returns: number
      }
      is_active_member: { Args: never; Returns: boolean }
      log_task_activity: {
        Args: { p_action: string; p_detail?: Json; p_task: string }
        Returns: undefined
      }
      my_permissions: { Args: never; Returns: string[] }
      project_key_from_name: { Args: { p_name: string }; Returns: string }
      recount_decision: { Args: { d_id: string }; Returns: undefined }
      role_has_permission: {
        Args: { p: string; p_role: string }
        Returns: boolean
      }
      save_jev_review: {
        Args: {
          p_briefing: Json
          p_decision: string
          p_focus: string
          p_verdict: Json
        }
        Returns: undefined
      }
      start_sprint: { Args: { p_sprint: string }; Returns: undefined }
      voting_member_count: { Args: never; Returns: number }
      voting_members: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
    }
    Enums: {
      decision_status: "open" | "approved" | "rejected" | "withdrawn"
      idea_status: "active" | "parked" | "killed" | "scaled"
      vote_choice: "approve" | "reject" | "abstain"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      decision_status: ["open", "approved", "rejected", "withdrawn"],
      idea_status: ["active", "parked", "killed", "scaled"],
      vote_choice: ["approve", "reject", "abstain"],
    },
  },
} as const

