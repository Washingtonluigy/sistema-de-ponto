import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ahpdojlajtfejmtjtwvr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocGRvamxhanRmZWptdGp0d3ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTQ2MjgsImV4cCI6MjA4MzQ3MDYyOH0.3EHVvsPFnDLm3AZVAm8AdpLIaW9IxLJ5at6VQNT82qk';

const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'ponto-digital-auth',
    storage: getStorage() as any,
  },
});

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'admin' | 'employee';
  job_position: string | null;
  work_hours: number;
  overtime_limit: number;
  photo_url: string | null;
  horario_entrada?: string;
  horario_saida_almoco?: string;
  horario_volta_almoco?: string;
  horario_saida?: string;
  created_at: string;
  updated_at: string;
};

export type TimeEntry = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  selfie_url: string | null;
  total_hours: number;
  is_overtime: boolean;
  overtime_type: 'lunch' | 'after_hours' | null;
  created_at: string;
};

export type OvertimeHours = {
  id: string;
  user_id: string;
  month: number;
  year: number;
  overtime_hours: number;
  hour_bank: number;
  updated_at: string;
};

export type ActiveSession = {
  id: string;
  user_id: string;
  clock_in_time: string;
  current_lat: number | null;
  current_lng: number | null;
  last_updated: string;
};
