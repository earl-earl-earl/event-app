export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          name: string;
          date: string;
          location: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          date: string;
          location: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          date?: string;
          location?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      guests: {
        Row: {
          id: string;
          event_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone_number: string;
          qr_token: string;
          checked_in: boolean;
          checked_in_at: string | null;
          entry_count: number;
          max_entries: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone_number: string;
          qr_token: string;
          checked_in?: boolean;
          checked_in_at?: string | null;
          entry_count?: number;
          max_entries?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone_number?: string;
          qr_token?: string;
          checked_in?: boolean;
          checked_in_at?: string | null;
          entry_count?: number;
          max_entries?: number;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guests_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      scan_logs: {
        Row: {
          id: number;
          event_id: string | null;
          guest_id: string | null;
          scanned_at: string;
          success: boolean;
          reason: string;
          scanner_id: string | null;
          scanned_by: string | null;
          source_ip: string | null;
          token_hash: string | null;
          payload: Json;
        };
        Insert: {
          id?: number;
          event_id?: string | null;
          guest_id?: string | null;
          scanned_at?: string;
          success: boolean;
          reason: string;
          scanner_id?: string | null;
          scanned_by?: string | null;
          source_ip?: string | null;
          token_hash?: string | null;
          payload?: Json;
        };
        Update: {
          id?: number;
          event_id?: string | null;
          guest_id?: string | null;
          scanned_at?: string;
          success?: boolean;
          reason?: string;
          scanner_id?: string | null;
          scanned_by?: string | null;
          source_ip?: string | null;
          token_hash?: string | null;
          payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "scan_logs_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scan_logs_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["id"];
          },
        ];
      };
      verify_rate_limits: {
        Row: {
          identifier: string;
          window_started_at: string;
          request_count: number;
          updated_at: string;
        };
        Insert: {
          identifier: string;
          window_started_at: string;
          request_count?: number;
          updated_at?: string;
        };
        Update: {
          identifier?: string;
          window_started_at?: string;
          request_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      dispatch_queue: {
        Row: {
          id: number;
          guest_id: string;
          event_id: string;
          channel: "email" | "sms";
          destination: string;
          ticket_link: string;
          status: "pending" | "processing" | "sent" | "failed";
          attempts: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          guest_id: string;
          event_id: string;
          channel: "email" | "sms";
          destination: string;
          ticket_link: string;
          status?: "pending" | "processing" | "sent" | "failed";
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          guest_id?: string;
          event_id?: string;
          channel?: "email" | "sms";
          destination?: string;
          ticket_link?: string;
          status?: "pending" | "processing" | "sent" | "failed";
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_queue_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_queue_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_dispatch_jobs: {
        Args: {
          p_limit?: number;
        };
        Returns: {
          id: number;
          channel: "email" | "sms";
          destination: string;
          ticket_link: string;
          attempts: number;
          guest_first_name: string;
          guest_last_name: string;
          event_name: string;
          event_date: string;
          event_location: string;
        }[];
      };
      enforce_verify_rate_limit: {
        Args: {
          p_identifier: string;
          p_window_seconds: number;
          p_max_requests: number;
        };
        Returns: boolean;
      };
      log_scan_attempt: {
        Args: {
          p_success: boolean;
          p_reason: string;
          p_event_id?: string | null;
          p_guest_id?: string | null;
          p_token?: string | null;
          p_scanner_id?: string | null;
          p_scanned_by?: string | null;
          p_source_ip?: string | null;
          p_payload?: Json;
        };
        Returns: undefined;
      };
      verify_guest_check_in: {
        Args: {
          p_guest_id: string;
          p_event_id: string;
          p_token: string;
          p_scanner_id?: string | null;
          p_scanned_by?: string | null;
          p_source_ip?: string | null;
        };
        Returns: {
          success: boolean;
          code: string;
          message: string;
          guest_id: string | null;
          event_id: string | null;
          guest_name: string | null;
          metadata: Json;
          entry_count: number;
          max_entries: number;
          checked_in_at: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
