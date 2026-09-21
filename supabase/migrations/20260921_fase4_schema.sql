-- ==============================================================================
-- SALAMACODE FASE 4: SUPABASE DATABASE MIGRATION
-- Local-First AI Coding Agent Schema: Auth, Profiles, Projects, Devices, Usage,
-- Provider Preferences, Plans, Subscriptions, Admin Roles, and Audit Logs.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PLANS TABLE (Basic Quota & Capability tiers)
CREATE TABLE IF NOT EXISTS public.plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_projects INT NOT NULL DEFAULT 5,
  daily_requests INT NOT NULL DEFAULT 100,
  monthly_requests INT NOT NULL DEFAULT 3000,
  max_devices INT NOT NULL DEFAULT 3,
  features JSONB NOT NULL DEFAULT '{"byok": true, "cloud_sync": true, "auto_fallback": true}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default Plans
INSERT INTO public.plans (id, name, description, max_projects, daily_requests, monthly_requests, max_devices, features)
VALUES 
  ('free', 'Free Community', 'Local-first coding agent with standard cloud sync metadata and BYOK', 5, 100, 3000, 3, '{"byok": true, "cloud_sync": true, "auto_fallback": true, "analytics": false}'),
  ('pro', 'SalamaCode Pro', 'Enhanced quota with multi-device synchronization and priority routing', 25, 500, 15000, 10, '{"byok": true, "cloud_sync": true, "auto_fallback": true, "analytics": true}'),
  ('enterprise', 'Enterprise / Team', 'Unlimited project metadata and organization audit logs', 999, 10000, 300000, 50, '{"byok": true, "cloud_sync": true, "auto_fallback": true, "analytics": true, "priority_support": true}')
ON CONFLICT (id) DO NOTHING;

-- 3. PROFILES TABLE (Linked with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  display_name VARCHAR(255),
  avatar_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, suspended, disabled
  plan_id VARCHAR(50) NOT NULL DEFAULT 'free' REFERENCES public.plans(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 4. ADMIN ROLES TABLE
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'admin', -- admin, super_admin
  granted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_role UNIQUE (user_id, role)
);

-- 5. PROJECTS TABLE (Metadata only - Source code is NEVER uploaded!)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  local_project_id VARCHAR(255), -- client side identifier or path hash
  language VARCHAR(100),         -- TypeScript, JavaScript, Python, PHP, Go, etc.
  framework VARCHAR(100),        -- React, Vite, Laravel, Next.js, FastAPI, etc.
  git_repository TEXT,           -- Metadata only (e.g. origin URL)
  git_branch VARCHAR(100),       -- Current branch name
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  total_files INT DEFAULT 0,
  total_lines INT DEFAULT 0,
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PROJECT SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.project_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  primary_provider VARCHAR(50) DEFAULT 'gemini',
  fallback_provider VARCHAR(50) DEFAULT 'openrouter',
  preferred_model VARCHAR(100),
  auto_fallback BOOLEAN DEFAULT true,
  task_mode VARCHAR(50) DEFAULT 'coding',
  custom_instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. USER SETTINGS TABLE (Cloud-synced general preferences; NO API Keys stored here!)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'light',
  language VARCHAR(20) DEFAULT 'id',
  default_provider VARCHAR(50) DEFAULT 'gemini',
  default_model VARCHAR(100) DEFAULT 'gemini-3.8-flash',
  auto_fallback BOOLEAN DEFAULT true,
  ask_before_fallback BOOLEAN DEFAULT true,
  safety_mode VARCHAR(50) DEFAULT 'balanced',
  agent_max_iterations INT DEFAULT 30,
  ask_before_file_changes BOOLEAN DEFAULT true,
  sync_project_metadata BOOLEAN DEFAULT true,
  sync_conversation_metadata BOOLEAN DEFAULT false,
  send_anonymous_diagnostics BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. PROVIDER PREFERENCES (Cloud stores provider priority & model; NEVER secrets!)
CREATE TABLE IF NOT EXISTS public.provider_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id VARCHAR(50) NOT NULL, -- gemini, openrouter, custom
  enabled BOOLEAN NOT NULL DEFAULT true,
  preferred_model VARCHAR(100),
  priority INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_provider UNIQUE (user_id, provider_id)
);

-- 9. DEVICES TABLE (Desktop, Laptop, etc.)
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL, -- Machine GUID or browser persistent ID
  device_name VARCHAR(255) NOT NULL,
  platform VARCHAR(100) NOT NULL,  -- Windows, macOS, Linux, Web
  app_version VARCHAR(50) NOT NULL,
  is_current BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

-- 10. USAGE LOGS TABLE (Aggregated token usage and request stats; sanitized)
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  request_type VARCHAR(50) DEFAULT 'chat',
  requests INT NOT NULL DEFAULT 1,
  successful_requests INT NOT NULL DEFAULT 1,
  failed_requests INT NOT NULL DEFAULT 0,
  input_tokens INT,
  output_tokens INT,
  duration_ms INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL, -- SUCCESS, RATE_LIMIT, ERROR
  error_type VARCHAR(100),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. AUDIT LOGS TABLE (Security and activity audit trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  -- USER_REGISTERED, USER_LOGIN, USER_LOGOUT, PROJECT_CREATED, PROJECT_DELETED,
  -- DEVICE_ADDED, DEVICE_REMOVED, PROVIDER_ENABLED, SETTINGS_CHANGED, ADMIN_ACTION
  entity_type VARCHAR(50),
  entity_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = user_uuid AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Plans policies (Readable by everyone)
CREATE POLICY "Plans are viewable by everyone" ON public.plans
  FOR SELECT USING (true);

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Projects policies (Strictly isolation: User A CANNOT see User B projects!)
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Project settings policies
CREATE POLICY "Users manage own project settings" ON public.project_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_settings.project_id AND user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

-- User settings policies
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can upsert own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id);

-- Provider preferences policies
CREATE POLICY "Users can manage own provider preferences" ON public.provider_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Devices policies
CREATE POLICY "Users can manage own devices" ON public.devices
  FOR ALL USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Usage logs policies
CREATE POLICY "Users can view own usage logs" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert own usage logs" ON public.usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Audit logs policies
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admin roles policies
CREATE POLICY "Admins can view admin roles" ON public.admin_roles
  FOR SELECT USING (public.is_admin(auth.uid()));

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, display_name, status, plan_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'active',
    'free'
  );

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  INSERT INTO public.audit_logs (user_id, event_type, entity_type, entity_id, details)
  VALUES (
    NEW.id,
    'USER_REGISTERED',
    'profile',
    NEW.id::text,
    jsonb_build_object('email', NEW.email)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
