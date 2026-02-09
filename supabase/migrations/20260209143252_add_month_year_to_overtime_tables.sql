/*
  # Adiciona campos de mês e ano nas tabelas de gerenciamento de horas extras

  ## 1. Modificações em Tabelas Existentes
    - `overtime_adjustments`
      - Adiciona `month` (integer, mês do ajuste, 1-12)
      - Adiciona `year` (integer, ano do ajuste)
      - Permite registrar em qual mês/ano o ajuste se aplica
    
    - `overtime_payments`
      - Adiciona `month` (integer, mês do pagamento, 1-12)
      - Adiciona `year` (integer, ano do pagamento)
      - Permite registrar em qual mês/ano o pagamento se aplica
    
    - `hour_bank_adjustments`
      - Adiciona `month` (integer, mês do ajuste, 1-12)
      - Adiciona `year` (integer, ano do ajuste)
      - Permite registrar em qual mês/ano o ajuste se aplica

  ## 2. Notas
    - Os campos usam o mês/ano atual como padrão
    - Permite ajustes retroativos ou futuros
    - Facilita relatórios por período
*/

-- Adiciona campos de mês e ano em overtime_adjustments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overtime_adjustments' AND column_name = 'month'
  ) THEN
    ALTER TABLE overtime_adjustments ADD COLUMN month integer NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overtime_adjustments' AND column_name = 'year'
  ) THEN
    ALTER TABLE overtime_adjustments ADD COLUMN year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
END $$;

-- Adiciona campos de mês e ano em overtime_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overtime_payments' AND column_name = 'month'
  ) THEN
    ALTER TABLE overtime_payments ADD COLUMN month integer NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overtime_payments' AND column_name = 'year'
  ) THEN
    ALTER TABLE overtime_payments ADD COLUMN year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
END $$;

-- Adiciona campos de mês e ano em hour_bank_adjustments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hour_bank_adjustments' AND column_name = 'month'
  ) THEN
    ALTER TABLE hour_bank_adjustments ADD COLUMN month integer NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hour_bank_adjustments' AND column_name = 'year'
  ) THEN
    ALTER TABLE hour_bank_adjustments ADD COLUMN year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
END $$;

-- Índices para melhorar performance de consultas por mês/ano
CREATE INDEX IF NOT EXISTS idx_overtime_adjustments_month_year ON overtime_adjustments(year, month);
CREATE INDEX IF NOT EXISTS idx_overtime_payments_month_year ON overtime_payments(year, month);
CREATE INDEX IF NOT EXISTS idx_hour_bank_adjustments_month_year ON hour_bank_adjustments(year, month);