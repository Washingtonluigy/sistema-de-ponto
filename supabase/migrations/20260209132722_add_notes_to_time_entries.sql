/*
  # Adicionar campo de observações aos registros de ponto

  1. Modificações
    - Adiciona coluna `notes` à tabela `time_entries`
      - Tipo: text (opcional)
      - Permite que colaboradores adicionem observações sobre batidas de ponto
      - Útil para justificar atrasos, esquecimentos ou ajustes
    
  2. Notas
    - Campo opcional, não requer valor
    - Visível para administradores nos relatórios
    - Ajuda na transparência e gestão de frequência
*/

-- Adicionar coluna de observações
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'notes'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN notes text;
    COMMENT ON COLUMN time_entries.notes IS 'Observações do colaborador sobre o registro de ponto';
  END IF;
END $$;
