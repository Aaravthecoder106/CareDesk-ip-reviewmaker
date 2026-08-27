/**
 * Typed Supabase schema for CareDesk.
 *
 * Shape follows the Supabase codegen convention (Row/Insert/Update per table,
 * Enums, Functions) — the same structure the legacy app used in
 * `_legacy/src/integrations/supabase/types.ts` — adapted to the repaired
 * Phase 0 schema (Clerk TEXT ids, users/patients/doctors, user_role enum, the
 * two family-sharing RPCs).
 *
 * When the live database exists, this file can be regenerated with:
 *   supabase gen types typescript --project-id <ref> --schema public
 * Until then it is maintained by hand to match supabase/migrations/*.sql.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          role: Database["public"]["Enums"]["user_role"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          date_of_birth: string | null;
          gender: string | null;
          blood_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          date_of_birth?: string | null;
          gender?: string | null;
          blood_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date_of_birth?: string | null;
          gender?: string | null;
          blood_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patients_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      doctors: {
        Row: {
          id: string;
          clinic_name: string | null;
          specialty: string | null;
          npi_number: string | null;
          is_verified: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          clinic_name?: string | null;
          specialty?: string | null;
          npi_number?: string | null;
          is_verified?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_name?: string | null;
          specialty?: string | null;
          npi_number?: string | null;
          is_verified?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "doctors_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_doctor_relations: {
        Row: {
          id: string;
          patient_id: string;
          doctor_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          doctor_id: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          doctor_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          patient_id: string;
          title: string;
          file_path: string;
          mime_type: string | null;
          ai_summary: string | null;
          status: Database["public"]["Enums"]["report_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          title: string;
          file_path: string;
          mime_type?: string | null;
          ai_summary?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          title?: string;
          file_path?: string;
          mime_type?: string | null;
          ai_summary?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      report_embeddings: {
        Row: {
          id: string;
          report_id: string;
          patient_id: string;
          content: string;
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          patient_id: string;
          content: string;
          embedding?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          patient_id?: string;
          content?: string;
          embedding?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      lab_results: {
        Row: {
          id: string;
          report_id: string;
          patient_id: string;
          test_name: string;
          value: number | null;
          unit: string | null;
          flag: string | null;
          test_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          patient_id: string;
          test_name: string;
          value?: number | null;
          unit?: string | null;
          flag?: string | null;
          test_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          patient_id?: string;
          test_name?: string;
          value?: number | null;
          unit?: string | null;
          flag?: string | null;
          test_date?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      medications: {
        Row: {
          id: string;
          patient_id: string;
          name: string;
          dose: string | null;
          frequency: string | null;
          status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          name: string;
          dose?: string | null;
          frequency?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          name?: string;
          dose?: string | null;
          frequency?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conditions: {
        Row: {
          id: string;
          patient_id: string;
          name: string;
          status: string | null;
          diagnosed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          name: string;
          status?: string | null;
          diagnosed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          name?: string;
          status?: string | null;
          diagnosed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      analytics_snapshots: {
        Row: {
          user_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          data?: Json;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          data?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      family_members: {
        Row: {
          id: string;
          owner_id: string;
          member_id: string;
          relation: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          member_id: string;
          relation?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          member_id?: string;
          relation?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      family_invites: {
        Row: {
          id: string;
          owner_id: string;
          email: string;
          relation: string | null;
          token: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          email: string;
          relation?: string | null;
          token: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          email?: string;
          relation?: string | null;
          token?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      library_settings: {
        Row: {
          user_id: string;
          password_hash: string;
          salt: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          password_hash: string;
          salt: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          password_hash?: string;
          salt?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string;
          action: string;
          table_name: string;
          record_id: string;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          action: string;
          table_name: string;
          record_id: string;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          action?: string;
          table_name?: string;
          record_id?: string;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      deleted_users: {
        Row: {
          id: string;
          deleted_at: string;
        };
        Insert: {
          id: string;
          deleted_at?: string;
        };
        Update: {
          id?: string;
          deleted_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          would_use: string;
          liked: string | null;
          missing: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email?: string | null;
          would_use: string;
          liked?: string | null;
          missing?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string | null;
          would_use?: string;
          liked?: string | null;
          missing?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      clerk_user_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      accept_family_invite: {
        Args: { _token: string };
        Returns: Json;
      };
      confirm_family_member: {
        Args: { _member_id: string };
        Returns: Json;
      };
    };
    Enums: {
      user_role: "patient" | "doctor" | "admin";
      report_status: "pending" | "processing" | "ready" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
