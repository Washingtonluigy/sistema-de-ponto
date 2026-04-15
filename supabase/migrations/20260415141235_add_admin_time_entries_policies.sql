/*
  # Add admin policies for time_entries management

  ## Changes
  - Add INSERT policy for admins to create time entries for any employee
  - Add UPDATE policy for admins to edit any employee's time entries
  - Add DELETE policy for admins to remove any employee's time entries

  ## Security
  - Policies check that the acting user has role = 'admin' in profiles table
  - Admins can fully manage all time entries to support manual corrections
*/

CREATE POLICY "Admins can insert time entries for any user"
  ON time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any time entry"
  ON time_entries
  FOR UPDATE
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

CREATE POLICY "Admins can delete any time entry"
  ON time_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
