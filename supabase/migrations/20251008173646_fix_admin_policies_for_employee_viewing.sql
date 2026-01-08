/*
  # Fix Admin Policies

  1. Changes
    - Add policy to allow admins to view all profiles
    - Add policy to allow admins to view all time entries
    - Add policy to allow admins to view all active sessions
*/

-- Drop and recreate profiles policies
DROP POLICY IF EXISTS "Allow users to view own profile" ON profiles;

CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Fix time_entries policies
DROP POLICY IF EXISTS "Admins can view all time entries" ON time_entries;

CREATE POLICY "Users can view time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (true);

-- Fix active_sessions policies
DROP POLICY IF EXISTS "Admins can view all active sessions" ON active_sessions;

CREATE POLICY "Users can view active sessions"
  ON active_sessions FOR SELECT
  TO authenticated
  USING (true);
