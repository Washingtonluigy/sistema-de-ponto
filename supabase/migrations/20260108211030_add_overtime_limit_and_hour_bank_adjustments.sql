/*
  # Adiciona Limite de Horas Extras Configurável e Sistema de Baixa de Banco de Horas

  ## 1. Modificações em Tabelas Existentes
    - `profiles`
      - Adiciona `overtime_limit` (integer, limite de horas extras configurável, padrão 30)
      - Permite flexibilidade para cada colaborador ter seu próprio limite

  ## 2. Nova Tabela
    - `hour_bank_adjustments`
      - `id` (uuid, chave primária)
      - `user_id` (uuid, referência a profiles)
      - `admin_id` (uuid, referência ao admin que fez o ajuste)
      - `adjustment_type` (text, tipo: 'hours' ou 'days')
      - `hours_deducted` (numeric, horas descontadas)
      - `reason` (text, motivo da baixa)
      - `created_at` (timestamp, data da baixa)
      - Registra histórico completo de todas as baixas de banco de horas

  ## 3. Segurança
    - RLS habilitado em `hour_bank_adjustments`
    - Admins podem inserir e visualizar todos os ajustes
    - Colaboradores podem visualizar apenas seus próprios ajustes
    - Histórico imutável para auditoria
*/

-- Adiciona campo overtime_limit na tabela profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'overtime_limit'
  ) THEN
    ALTER TABLE profiles ADD COLUMN overtime_limit integer DEFAULT 30 NOT NULL;
  END IF;
END $$;

-- Cria tabela para registrar ajustes de banco de horas
CREATE TABLE IF NOT EXISTS hour_bank_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('hours', 'days')),
  hours_deducted numeric NOT NULL CHECK (hours_deducted > 0),
  reason text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_hour_bank_adjustments_user_id ON hour_bank_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_hour_bank_adjustments_created_at ON hour_bank_adjustments(created_at DESC);

-- Habilita RLS
ALTER TABLE hour_bank_adjustments ENABLE ROW LEVEL SECURITY;

-- Políticas para hour_bank_adjustments

-- Admins podem visualizar todos os ajustes
CREATE POLICY "Admins can view all hour bank adjustments"
  ON hour_bank_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Colaboradores podem visualizar apenas seus próprios ajustes
CREATE POLICY "Employees can view own hour bank adjustments"
  ON hour_bank_adjustments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Apenas admins podem inserir ajustes
CREATE POLICY "Admins can insert hour bank adjustments"
  ON hour_bank_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Ninguém pode atualizar ou deletar ajustes (histórico imutável)
-- Não criamos políticas de UPDATE ou DELETE para manter o histórico intacto