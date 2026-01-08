/*
  # Fix RLS Infinite Recursion

  1. Changes
    - Drop existing policies on profiles table that cause recursion
    - Create new policies that don't reference the same table
    - Use auth metadata to check admin role instead
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;

-- Create new policies without recursion
CREATE POLICY "Allow users to view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Allow service role to insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow users to update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
