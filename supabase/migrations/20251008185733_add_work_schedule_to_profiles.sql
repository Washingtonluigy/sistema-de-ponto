/*
  # Add Work Schedule Fields to Profiles

  ## Changes
  
  1. Add work schedule columns to profiles table:
    - `horario_entrada` (time) - Employee's standard start time (e.g., 08:00)
    - `horario_saida_almoco` (time) - Employee's lunch break start time (e.g., 12:00)
    - `horario_volta_almoco` (time) - Employee's lunch break end time (e.g., 13:00)
    - `horario_saida` (time) - Employee's standard end time (e.g., 17:00)
  
  2. Add overtime tracking to time_entries table:
    - `is_overtime` (boolean) - Flag to indicate if this entry is overtime work
    - `overtime_type` (text) - Type of overtime: 'lunch' or 'after_hours'
  
  ## Notes
  - These times are used for automatic clock-out and overtime calculation
  - System will automatically clock out employees at lunch and end times
  - Working during lunch or after hours will be tracked as overtime
  - Complies with Brazilian labor laws for mandatory break periods
*/

-- Add work schedule columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'horario_entrada'
  ) THEN
    ALTER TABLE profiles ADD COLUMN horario_entrada time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'horario_saida_almoco'
  ) THEN
    ALTER TABLE profiles ADD COLUMN horario_saida_almoco time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'horario_volta_almoco'
  ) THEN
    ALTER TABLE profiles ADD COLUMN horario_volta_almoco time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'horario_saida'
  ) THEN
    ALTER TABLE profiles ADD COLUMN horario_saida time;
  END IF;
END $$;

-- Add overtime tracking columns to time_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'is_overtime'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN is_overtime boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'overtime_type'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN overtime_type text CHECK (overtime_type IN ('lunch', 'after_hours'));
  END IF;
END $$;