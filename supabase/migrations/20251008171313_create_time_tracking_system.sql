/*
  # Sistema de Ponto Digital - Energia Solar

  ## 1. Tabelas Criadas
    - `profiles`
      - `id` (uuid, chave primária, referência a auth.users)
      - `full_name` (text, nome completo)
      - `phone` (text, telefone)
      - `role` (text, função: admin ou employee)
      - `job_position` (text, cargo)
      - `work_hours` (integer, horas diárias de trabalho)
      - `photo_url` (text, URL da foto opcional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `time_entries`
      - `id` (uuid, chave primária)
      - `user_id` (uuid, referência a profiles)
      - `clock_in` (timestamptz, entrada)
      - `clock_out` (timestamptz, saída)
      - `location_lat` (double precision, latitude)
      - `location_lng` (double precision, longitude)
      - `location_name` (text, nome do local)
      - `selfie_url` (text, URL da selfie)
      - `total_hours` (numeric, total de horas trabalhadas)
      - `created_at` (timestamp)

    - `overtime_hours`
      - `id` (uuid, chave primária)
      - `user_id` (uuid, referência a profiles)
      - `month` (integer, mês)
      - `year` (integer, ano)
      - `overtime_hours` (numeric, horas extras até 30h)
      - `hour_bank` (numeric, banco de horas acima de 30h)
      - `updated_at` (timestamp)

    - `active_sessions`
      - `id` (uuid, chave primária)
      - `user_id` (uuid, referência a profiles)
      - `clock_in_time` (timestamptz)
      - `current_lat` (double precision)
      - `current_lng` (double precision)
      - `last_updated` (timestamptz)

  ## 2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas para admin visualizar todos os dados
    - Políticas para colaboradores visualizarem apenas seus próprios dados
    - Políticas para inserção e atualização adequadas por role
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('admin', 'employee')),
  job_position text,
  work_hours integer DEFAULT 8,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR id = auth.uid()
  );

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Time entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  location_lat double precision,
  location_lng double precision,
  location_name text,
  selfie_url text,
  total_hours numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Employees can insert own time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Employees can update own time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Overtime hours table
CREATE TABLE IF NOT EXISTS overtime_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  overtime_hours numeric DEFAULT 0,
  hour_bank numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE overtime_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all overtime hours"
  ON overtime_hours FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "System can insert overtime hours"
  ON overtime_hours FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update overtime hours"
  ON overtime_hours FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Active sessions table
CREATE TABLE IF NOT EXISTS active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clock_in_time timestamptz NOT NULL,
  current_lat double precision,
  current_lng double precision,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all active sessions"
  ON active_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Employees can manage own sessions"
  ON active_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_created_at ON time_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_overtime_hours_user_id ON overtime_hours(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);