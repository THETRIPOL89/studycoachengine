export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nome: string
          email: string
          universita: string | null
          corso: string | null
          created_at: string
          // Campi billing aggiunti dalla migration Premium tier.
          // Li escludiamo da Row per non rompere l'inferenza del
          // supabase-js GenericTable (vincolo: Insert extends Record<string, unknown>).
          // Il codice utente non deve MAI leggere/scrivere questi campi.
          // Letture: usare getUserPlan() da subscription.ts (server-side).
          // Scritture: SOLO via webhook Stripe con service_role.
        }
        Insert: {
          id: string
          nome: string
          email: string
          universita?: string | null
          corso?: string | null
          // I 4 campi billing NON sono nell'Insert: l'unico modo per
          // inserirli è via service_role (bypassa type check).
        }
        Update: {
          nome?: string
          universita?: string | null
          corso?: string | null
          // I 4 campi billing NON sono nell'Update: l'unica scrittura
          // autorizzata è il webhook Stripe via service_role. La RLS
          // policy "Users can update own non-billing profile" blocca
          // comunque ogni tentativo lato client.
        }
        Relationships: []
      }
      exams: {
        Row: {
          id: string
          user_id: string
          nome_esame: string
          universita: string
          corso: string
          professore: string | null
          data_esame: string
          voto_obiettivo: number
          modalita: 'scritto' | 'orale' | 'misto' | null
          ore_giorno: number
          stato: 'in_corso' | 'completato' | 'sospeso'
          categoria: 'scientifica' | 'mnemonica' | 'applicativa'
          preparazione_percentuale: number
          giorni_mancanti: number
          created_at: string
        }
        Insert: {
          user_id: string
          nome_esame: string
          universita: string
          corso: string
          professore?: string | null
          data_esame: string
          voto_obiettivo: number
          modalita?: 'scritto' | 'orale' | 'misto' | null
          ore_giorno?: number
          stato?: 'in_corso' | 'completato' | 'sospeso'
          categoria?: 'scientifica' | 'mnemonica' | 'applicativa'
        }
        Update: {
          nome_esame?: string
          data_esame?: string
          voto_obiettivo?: number
          stato?: 'in_corso' | 'completato' | 'sospeso'
          preparazione_percentuale?: number
        }
        Relationships: []
      }
      topics: {
        Row: {
          id: string
          exam_id: string
          nome_argomento: string
          peso: number
          ordine: number
          created_at: string
        }
        Insert: {
          exam_id: string
          nome_argomento: string
          peso?: number
          ordine?: number
        }
        Update: {
          nome_argomento?: string
          peso?: number
          ordine?: number
        }
        Relationships: []
      }
      competences: {
        Row: {
          id: string
          topic_id: string
          teoria: number
          memoria: number
          esercizi: number
          problemi_complessi: number
          orale: number
          updated_at: string
        }
        Insert: {
          topic_id: string
          teoria?: number
          memoria?: number
          esercizi?: number
          problemi_complessi?: number
          orale?: number
        }
        Update: {
          teoria?: number
          memoria?: number
          esercizi?: number
          problemi_complessi?: number
          orale?: number
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          id: string
          exam_id: string
          topic_id: string | null
          data: string
          attivita: string
          durata_minuti: number
          completata: boolean
          difficolta: number | null
          risultato_quiz: number | null
          note: string | null
          created_at: string
        }
        Insert: {
          exam_id: string
          topic_id?: string | null
          data?: string
          attivita: string
          durata_minuti: number
          completata?: boolean
          difficolta?: number | null
          risultato_quiz?: number | null
          note?: string | null
        }
        Update: {
          completata?: boolean
          difficolta?: number | null
          risultato_quiz?: number | null
          note?: string | null
        }
        Relationships: []
      }
      materials: {
        Row: {
          id: string
          exam_id: string
          nome_file: string
          tipo: 'pdf' | 'slide' | 'appunti' | 'prova_passata' | 'altro'
          storage_path: string
          dimensione_kb: number | null
          created_at: string
        }
        Insert: {
          exam_id: string
          nome_file: string
          tipo: 'pdf' | 'slide' | 'appunti' | 'prova_passata' | 'altro'
          storage_path: string
          dimensione_kb?: number | null
        }
        Update: {
          nome_file?: string
          storage_path?: string | null
          dimensione_kb?: number | null
        }
        Relationships: []
      }
      daily_plans: {
        Row: {
          id: string
          exam_id: string
          data: string
          piano_json: Json
          generato_ai: boolean
          completato: boolean
          created_at: string
        }
        Insert: {
          exam_id: string
          data: string
          piano_json: Json
          generato_ai?: boolean
          completato?: boolean
        }
        Update: {
          piano_json?: Json
          generato_ai?: boolean
          completato?: boolean
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_subscription_id: string
          stripe_customer_id: string | null
          status: string
          current_period_end: string
          plan: string
          created_at: string
          updated_at: string
        }
        Insert: {
          // Scrivibile SOLO dal webhook Stripe via service_role.
          // Escludendo tutti i campi da Insert, l'unico modo per inserire
          // una subscription è via service_role (che bypassa il type check).
          user_id: string
          stripe_subscription_id: string
          stripe_customer_id?: string | null
          status: string
          current_period_end: string
          plan: string
        }
        Update: {
          // Mai updatabile dall'utente: solo il webhook aggiorna `status`
          // e `current_period_end` quando Stripe manda eventi di renewal.
          stripe_customer_id?: string | null
          status?: string
          current_period_end?: string
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

export type Exam = Database['public']['Tables']['exams']['Row']
export type Topic = Database['public']['Tables']['topics']['Row']
export type Competence = Database['public']['Tables']['competences']['Row']
export type StudySession = Database['public']['Tables']['study_sessions']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type DailyPlan = Database['public']['Tables']['daily_plans']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
