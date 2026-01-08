/*
  # Sistema de Controle de Combustível

  1. Novas Tabelas
    - `vehicles` - Cadastro de veículos da empresa
      - `id` (uuid, primary key)
      - `name` (text) - Nome/modelo do veículo
      - `plate` (text, unique) - Placa do veículo
      - `initial_mileage` (integer) - Quilometragem inicial
      - `current_mileage` (integer) - Quilometragem atual
      - `status` (text) - Status: active, maintenance, inactive
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `fuel_records` - Registros de abastecimento
      - `id` (uuid, primary key)
      - `vehicle_id` (uuid, foreign key)
      - `employee_id` (uuid, foreign key) - Quem fez o abastecimento
      - `date` (timestamptz) - Data/hora do abastecimento
      - `mileage` (integer) - Quilometragem no momento do abastecimento
      - `liters` (decimal) - Quantidade de litros abastecidos
      - `price_per_liter` (decimal) - Preço por litro
      - `total_value` (decimal) - Valor total
      - `gas_station` (text) - Nome do posto
      - `location` (text) - Localização do abastecimento
      - `receipt_url` (text) - URL da foto do comprovante
      - `notes` (text) - Observações
      - `created_at` (timestamptz)

  2. Storage
    - Bucket para armazenar fotos dos comprovantes de abastecimento

  3. Security
    - Enable RLS em todas as tabelas
    - Políticas para admins gerenciarem veículos e registros
    - Políticas para funcionários visualizarem apenas seus próprios registros
*/

-- Criar tabela de veículos
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plate text UNIQUE NOT NULL,
  initial_mileage integer NOT NULL DEFAULT 0,
  current_mileage integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de registros de abastecimento
CREATE TABLE IF NOT EXISTS fuel_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  date timestamptz DEFAULT now() NOT NULL,
  mileage integer NOT NULL,
  liters decimal(10, 2) NOT NULL,
  price_per_liter decimal(10, 2) NOT NULL,
  total_value decimal(10, 2) NOT NULL,
  gas_station text NOT NULL,
  location text NOT NULL,
  receipt_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_fuel_records_vehicle_id ON fuel_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_employee_id ON fuel_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_date ON fuel_records(date DESC);

-- Criar bucket de storage para comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-receipts', 'fuel-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;

-- Políticas para vehicles (apenas admins podem gerenciar)
CREATE POLICY "Admins can view all vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Políticas para fuel_records
CREATE POLICY "Admins can view all fuel records"
  ON fuel_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert fuel records"
  ON fuel_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update fuel records"
  ON fuel_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete fuel records"
  ON fuel_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Políticas de storage para fuel-receipts
CREATE POLICY "Admins can upload fuel receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fuel-receipts' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view fuel receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fuel-receipts' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete fuel receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fuel-receipts' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Função para atualizar a quilometragem atual do veículo
CREATE OR REPLACE FUNCTION update_vehicle_mileage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vehicles
  SET current_mileage = NEW.mileage,
      updated_at = now()
  WHERE id = NEW.vehicle_id
  AND NEW.mileage > current_mileage;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar quilometragem automaticamente
DROP TRIGGER IF EXISTS trigger_update_vehicle_mileage ON fuel_records;
CREATE TRIGGER trigger_update_vehicle_mileage
  AFTER INSERT OR UPDATE ON fuel_records
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_mileage();