/*
  # Adicionar colunas de horas extras aos registros de ponto

  ## 1. Modificações em time_entries
    - `worked_hours` (numeric, horas efetivamente trabalhadas)
    - `overtime_hours` (numeric, horas extras calculadas)
    - `overtime_added_to_bank` (boolean, indica se as horas extras foram adicionadas ao banco)
  
  ## 2. Notas
    - Permite rastreamento detalhado de horas extras em cada registro de ponto
    - `worked_hours` armazena o total de horas trabalhadas calculadas
    - `overtime_hours` armazena apenas as horas que excedem a jornada normal
    - `overtime_added_to_bank` indica se o colaborador optou por adicionar ao banco de horas
*/

-- Adicionar coluna worked_hours
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'worked_hours'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN worked_hours numeric DEFAULT 0;
  END IF;
END $$;

-- Adicionar coluna overtime_hours
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'overtime_hours'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN overtime_hours numeric DEFAULT 0;
  END IF;
END $$;

-- Adicionar coluna overtime_added_to_bank
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'overtime_added_to_bank'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN overtime_added_to_bank boolean DEFAULT false;
  END IF;
END $$;