/*
  # Add Admin Read Access Policy for Profiles

  1. New Policy
    - `Admins can read all profiles` policy on `profiles` table
    - Allows authenticated users with admin/super_admin roles to read all profiles
    - Uses existing `check_is_admin()` function for authorization

  2. Security
    - Only users with admin or super_admin roles can access all profiles
    - Regular users can still only access their own profile via existing policy
    - Maintains data security while enabling admin functionality
*/

-- Add policy for admins to read all profiles
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (check_is_admin());