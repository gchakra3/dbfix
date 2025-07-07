/*
  # Class Assignments System

  1. New Tables
    - `class_assignments`
      - `id` (uuid, primary key)
      - `scheduled_class_id` (uuid, foreign key to scheduled_classes)
      - `instructor_id` (uuid, foreign key to users)
      - `assigned_by` (uuid, foreign key to users)
      - `payment_amount` (decimal)
      - `payment_status` (enum: pending, paid, cancelled)
      - `notes` (text)
      - `assigned_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `class_assignments` table
    - Add policies for admins, instructors, and yoga acharyas
    - Create indexes for performance
    - Add trigger for updated_at timestamp
*/

-- Create enum for payment status if it doesn't exist
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create class_assignments table if it doesn't exist
CREATE TABLE IF NOT EXISTS class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id uuid REFERENCES scheduled_classes(id) ON DELETE CASCADE,
  instructor_id uuid REFERENCES users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  payment_amount decimal(10,2) NOT NULL DEFAULT 0.00,
  payment_status payment_status DEFAULT 'pending',
  notes text,
  assigned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$ BEGIN
  ALTER TABLE class_assignments ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

-- Drop existing policies if they exist and recreate them
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage all class assignments" ON class_assignments;
  DROP POLICY IF EXISTS "Instructors can view their own assignments" ON class_assignments;
  DROP POLICY IF EXISTS "Yoga acharyas can view their own assignments" ON class_assignments;
  DROP POLICY IF EXISTS "Yoga acharyas can assign classes" ON class_assignments;
  DROP POLICY IF EXISTS "Yoga acharyas can view and manage assignments" ON class_assignments;
END $$;

-- Create comprehensive policy for admins
CREATE POLICY "Admins can manage all class assignments"
  ON class_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Create policy for instructors to view their own assignments
CREATE POLICY "Instructors can view their own assignments"
  ON class_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = instructor_id);

-- Create comprehensive policy for yoga acharyas
CREATE POLICY "Yoga acharyas can view and manage assignments"
  ON class_assignments
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = instructor_id OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name = 'yoga_acharya'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('yoga_acharya', 'admin', 'super_admin')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS class_assignments_instructor_id_idx ON class_assignments(instructor_id);
CREATE INDEX IF NOT EXISTS class_assignments_scheduled_class_id_idx ON class_assignments(scheduled_class_id);
CREATE INDEX IF NOT EXISTS class_assignments_payment_status_idx ON class_assignments(payment_status);
CREATE INDEX IF NOT EXISTS class_assignments_assigned_at_idx ON class_assignments(assigned_at);

-- Create or replace trigger function for updated_at
CREATE OR REPLACE FUNCTION update_class_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS update_class_assignments_updated_at ON class_assignments;
CREATE TRIGGER update_class_assignments_updated_at
  BEFORE UPDATE ON class_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_class_assignments_updated_at();

-- Add foreign key constraints with proper names for better management
DO $$ BEGIN
  ALTER TABLE class_assignments 
  ADD CONSTRAINT fk_class_assignments_instructor 
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE class_assignments 
  ADD CONSTRAINT fk_class_assignments_assigned_by 
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;