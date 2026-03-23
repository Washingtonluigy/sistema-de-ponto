/*
  # Add blocked column to profiles

  1. Modified Tables
    - `profiles`
      - Added `blocked` (boolean, default false) - Controls whether an employee can access their panel

  2. Notes
    - Blocked employees cannot log in but their data remains intact
    - Default is false (not blocked)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'blocked'
  ) THEN
    ALTER TABLE profiles ADD COLUMN blocked boolean DEFAULT false NOT NULL;
  END IF;
END $$;