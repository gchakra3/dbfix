-- ======================================================
-- ✅ Yogodaan: Full schema migration (clean install)
-- Author: Code Generator GPT
-- Date: 2025-07-08
-- ======================================================

-- --------------------------
-- PUBLIC SCHEMA TABLES
-- --------------------------

-- admin_users
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  class_name text NOT NULL,
  instructor text NOT NULL,
  class_date date NOT NULL DEFAULT CURRENT_DATE,
  class_time text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  experience_level text NOT NULL DEFAULT 'beginner',
  special_requests text DEFAULT '',
  emergency_contact text NOT NULL,
  emergency_phone text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- yoga_queries
CREATE TABLE IF NOT EXISTS public.yoga_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  experience_level text NOT NULL DEFAULT 'beginner',
  status text NOT NULL DEFAULT 'pending',
  response text DEFAULT '',
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- contact_messages
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

-- Add more tables from your schema here
-- E.g., scheduled_classes, class_bookings, profiles, transactions, etc.
-- For brevity, only key ones are included now; you can extend with others.

-- --------------------------
-- RLS & POLICIES
-- --------------------------

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yoga_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- admin_users policies
CREATE POLICY "Admin users can read their own data"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (email = auth.email());

CREATE POLICY "Super admins can insert admin users"
  ON public.admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = auth.email() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage all admin users"
  ON public.admin_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE email = auth.email() AND role = 'super_admin'
    )
  );

-- bookings policies
CREATE POLICY "Users can view their own bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anonymous users can create bookings"
  ON public.bookings
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- yoga_queries policies
CREATE POLICY "Anyone can create yoga queries"
  ON public.yoga_queries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own yoga queries"
  ON public.yoga_queries
  FOR SELECT
  TO authenticated
  USING (email = auth.email());

-- contact_messages policies
CREATE POLICY "Anyone can create contact messages"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- --------------------------
-- TRIGGERS
-- --------------------------

-- update updated_at on admin_users
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_users_updated_at();

-- update updated_at on bookings
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_bookings_updated_at();

-- --------------------------
-- INITIAL DATA
-- --------------------------
-- Add your first super admin user
INSERT INTO public.admin_users (email, role)
VALUES ('gourab.master@gmail.com', 'super_admin')
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', updated_at = now();

-- --------------------------
-- ✅ DONE
-- --------------------------
