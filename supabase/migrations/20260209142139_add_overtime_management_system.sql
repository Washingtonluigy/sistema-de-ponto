/*
  # Sistema de Gerenciamento de Horas Extras e Pagamentos

  ## 1. Novas Tabelas

  ### `overtime_adjustments`
    - `id` (uuid, chave primária)
    - `user_id` (uuid, referência a profiles)
    - `admin_id` (uuid, referência ao admin que fez o ajuste)
    - `hours` (numeric, horas ajustadas - positivo para adicionar, negativo para remover)
    - `reason` (text, motivo do ajuste)
    - `created_at` (timestamp)
    - Permite ajustes manuais de horas extras por admins
    - Histórico completo de todas as alterações

  ### `overtime_payments`
    - `id` (uuid, chave primária)
    - `user_id` (uuid, referência a profiles)
    - `admin_id` (uuid, referência ao admin que processou)
    - `hours_paid` (numeric, quantidade de horas pagas)
    - `payment_date` (date, data do pagamento)
    - `notes` (text, observações sobre o pagamento)
    - `created_at` (timestamp)
    - Registra pagamentos de horas extras realizados

  ## 2. Segurança
    - RLS habilitado em todas as tabelas
    - Apenas admins podem inserir registros
    - Admins podem visualizar todos os registros
    - Colaboradores podem visualizar apenas seus próprios registros
    - Histórico imutável (sem UPDATE ou DELETE)
*/

-- Cria tabela para ajustes manuais de horas extras
CREATE TABLE IF NOT EXISTS overtime_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  hours numeric NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Cria tabela para registrar pagamentos de horas extras
CREATE TABLE IF NOT EXISTS overtime_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  hours_paid numeric NOT NULL CHECK (hours_paid > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_overtime_adjustments_user_id ON overtime_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_adjustments_created_at ON overtime_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_overtime_payments_user_id ON overtime_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_payments_payment_date ON overtime_payments(payment_date DESC);

-- Habilita RLS
ALTER TABLE overtime_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_payments ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Políticas para overtime_adjustments
-- ========================================

-- Admins podem visualizar todos os ajustes
CREATE POLICY "Admins can view all overtime adjustments"
  ON overtime_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Colaboradores podem visualizar apenas seus próprios ajustes
CREATE POLICY "Employees can view own overtime adjustments"
  ON overtime_adjustments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Apenas admins podem inserir ajustes
CREATE POLICY "Admins can insert overtime adjustments"
  ON overtime_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ========================================
-- Políticas para overtime_payments
-- ========================================

-- Admins podem visualizar todos os pagamentos
CREATE POLICY "Admins can view all overtime payments"
  ON overtime_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Colaboradores podem visualizar apenas seus próprios pagamentos
CREATE POLICY "Employees can view own overtime payments"
  ON overtime_payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Apenas admins podem inserir pagamentos
CREATE POLICY "Admins can insert overtime payments"
  ON overtime_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );