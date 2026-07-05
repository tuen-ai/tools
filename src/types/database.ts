// Hand-written stub mirroring supabase/migrations/0001_init.sql.
// Replace with `npm run gen:types` output once the Supabase project is linked.
//
// Shape conforms to GenericSchema in @supabase/supabase-js so that the
// generic-parameterised client gets full inference (Tables, Functions, etc).

export type MediaStatus = "visible" | "hidden" | "deleted";
export type AdminRole = "owner" | "editor";

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          slug: string;
          couple_names: string;
          event_date: string | null;
          welcome_message: string | null;
          cover_image_path: string | null;
          theme: Record<string, unknown>;
          upload_enabled: boolean;
          max_uploads_per_guest: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          couple_names: string;
          event_date?: string | null;
          welcome_message?: string | null;
          cover_image_path?: string | null;
          theme?: Record<string, unknown>;
          upload_enabled?: boolean;
          max_uploads_per_guest?: number;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      guests: {
        Row: {
          id: string;
          event_id: string;
          display_name: string | null;
          client_fingerprint: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          display_name?: string | null;
          client_fingerprint: string;
        };
        Update: Partial<Database["public"]["Tables"]["guests"]["Insert"]>;
        Relationships: [];
      };
      media: {
        Row: {
          id: string;
          event_id: string;
          guest_id: string | null;
          table_id: string | null;
          challenge_id: string | null;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          width: number | null;
          height: number | null;
          taken_at: string | null;
          status: MediaStatus;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          guest_id?: string | null;
          table_id?: string | null;
          challenge_id?: string | null;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          width?: number | null;
          height?: number | null;
          taken_at?: string | null;
          status?: MediaStatus;
        };
        Update: Partial<Database["public"]["Tables"]["media"]["Insert"]>;
        Relationships: [];
      };
      tables: {
        Row: {
          id: string;
          event_id: string;
          label: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["tables"]["Insert"]>;
        Relationships: [];
      };
      challenges: {
        Row: {
          id: string;
          event_id: string;
          prompt: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          prompt: string;
        };
        Update: Partial<Database["public"]["Tables"]["challenges"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          event_id: string;
          guest_id: string | null;
          body: string | null;
          audio_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          guest_id?: string | null;
          body?: string | null;
          audio_path?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "messages_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_event_access: {
        Row: {
          event_id: string;
          user_id: string;
          role: AdminRole;
          created_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          role?: AdminRole;
        };
        Update: Partial<
          Database["public"]["Tables"]["admin_event_access"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_event_by_slug: {
        Args: { p_slug: string };
        Returns: Array<{
          id: string;
          slug: string;
          couple_names: string;
          event_date: string | null;
          welcome_message: string | null;
          cover_image_path: string | null;
          theme: Record<string, unknown>;
          upload_enabled: boolean;
          max_uploads_per_guest: number;
        }>;
      };
      get_table_by_slug_label: {
        Args: { p_slug: string; p_label: string };
        Returns: Array<{
          id: string;
          event_id: string;
          label: string;
        }>;
      };
    };
    Enums: {
      media_status: MediaStatus;
      admin_role: AdminRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type PublicEvent =
  Database["public"]["Functions"]["get_event_by_slug"]["Returns"][number];
