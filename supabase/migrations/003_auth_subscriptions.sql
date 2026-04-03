-- FSM Drive: Authentication, Subscriptions & Sponsorship
-- Migration 003: Run after 001 and 002

-- ── Subscription Plans ───────────────────────────────────────────────────────
CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0,  -- cents
  price_yearly INTEGER NOT NULL DEFAULT 0,   -- cents
  features JSONB NOT NULL DEFAULT '{}',
  max_fsms INTEGER NOT NULL DEFAULT 3,
  max_collaborators INTEGER NOT NULL DEFAULT 1,
  can_use_chat BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  can_sponsor BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO subscription_plans (id, name, description, price_monthly, price_yearly, features, max_fsms, max_collaborators, can_use_chat, can_export, can_sponsor, sort_order) VALUES
  ('free', 'Explorer', 'Get started with FSM Drive. View and explore FSM specifications.',
    0, 0,
    '{"highlights": ["View & navigate FSMs", "Up to 3 FSM definitions", "Light & dark themes", "Process decomposition tree"]}',
    3, 1, false, false, false, 1),
  ('pro_monthly', 'Professional (Monthly)', 'Full editing and collaboration for serious FSM architects.',
    2900, 0,
    '{"highlights": ["Unlimited FSM definitions", "Real-time collaboration", "AI design assistant (Claude)", "Element-level locking", "Export/import registry", "Up to 5 collaborators"]}',
    -1, 5, true, true, false, 2),
  ('pro_yearly', 'Professional (Yearly)', 'Full editing and collaboration — save 17% with annual billing.',
    0, 28900,
    '{"highlights": ["Everything in Professional", "2 months free", "Priority support"]}',
    -1, 5, true, true, false, 3),
  ('enterprise_monthly', 'Enterprise (Monthly)', 'For teams building mission-critical workflows.',
    9900, 0,
    '{"highlights": ["Everything in Professional", "Unlimited collaborators", "Sponsorship privileges", "Immutable audit trail access", "Custom integrations (API)", "Transaction tree & hash verification", "Dedicated support"]}',
    -1, -1, true, true, true, 4),
  ('enterprise_yearly', 'Enterprise (Yearly)', 'Enterprise power — save 17% with annual billing.',
    0, 99900,
    '{"highlights": ["Everything in Enterprise", "2 months free", "SLA guarantee"]}',
    -1, -1, true, true, true, 5);

-- ── Enhanced User Profiles ───────────────────────────────────────────────────
-- Link to Supabase Auth and add subscription fields
ALTER TABLE fsm_users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE,           -- links to auth.users.id
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT REFERENCES subscription_plans(id) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active','past_due','cancelled','trialing')),
  ADD COLUMN IF NOT EXISTS subscription_period TEXT DEFAULT 'monthly' CHECK (subscription_period IN ('monthly','yearly')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS can_sponsor BOOLEAN DEFAULT false;

-- ── Sponsorship Tracking ─────────────────────────────────────────────────────
CREATE TABLE sponsorships (
  id SERIAL PRIMARY KEY,
  sponsor_id TEXT NOT NULL REFERENCES fsm_users(id),
  sponsored_email TEXT NOT NULL,
  sponsored_user_id TEXT REFERENCES fsm_users(id),  -- NULL until they register
  granted_role TEXT NOT NULL DEFAULT 'viewer' CHECK (granted_role IN ('editor','viewer')),
  granted_plan TEXT REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  invite_code TEXT UNIQUE NOT NULL,
  message TEXT,  -- personal message from sponsor
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days')
);

-- ── Subscription Events (Immutable) ─────────────────────────────────────────
CREATE TABLE subscription_events (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES fsm_users(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'plan_selected','plan_upgraded','plan_downgraded','plan_cancelled',
    'payment_succeeded','payment_failed',
    'trial_started','trial_ended',
    'sponsor_invited','sponsor_accepted','sponsor_revoked'
  )),
  old_plan TEXT,
  new_plan TEXT,
  metadata JSONB,
  stripe_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable
CREATE RULE no_update_sub_events AS ON UPDATE TO subscription_events DO INSTEAD NOTHING;
CREATE RULE no_delete_sub_events AS ON DELETE TO subscription_events DO INSTEAD NOTHING;

-- ── RLS for new tables ───────────────────────────────────────────────────────
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Plans are readable by everyone
CREATE POLICY "Anyone can read plans" ON subscription_plans FOR SELECT USING (true);

-- For now, allow all (will tighten with Supabase Auth later)
CREATE POLICY "Allow all on sponsorships" ON sponsorships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sub_events" ON subscription_events FOR ALL USING (true) WITH CHECK (true);

-- ── Helper function: Create user profile on auth signup ──────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_id_text TEXT;
  invite sponsorships%ROWTYPE;
BEGIN
  -- Generate a user ID from email prefix
  user_id_text := split_part(NEW.email, '@', 1) || '.' || substr(md5(NEW.id::text), 1, 4);
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  -- Check if they were sponsored
  SELECT * INTO invite FROM sponsorships
    WHERE sponsored_email = NEW.email AND status = 'pending' AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;

  -- Create the profile
  INSERT INTO fsm_users (id, auth_id, name, email, role, subscription_plan, sponsored_by, registered_at)
  VALUES (
    user_id_text,
    NEW.id,
    user_name,
    NEW.email,
    COALESCE(invite.granted_role, 'viewer'),
    COALESCE(invite.granted_plan, 'free'),
    invite.sponsor_id,
    now()
  );

  -- Update sponsorship if found
  IF invite.id IS NOT NULL THEN
    UPDATE sponsorships SET
      sponsored_user_id = user_id_text,
      status = 'accepted',
      accepted_at = now()
    WHERE id = invite.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Update existing users with default plans ─────────────────────────────────
UPDATE fsm_users SET subscription_plan = 'enterprise_monthly', can_sponsor = true WHERE id = 'ed.stull';
UPDATE fsm_users SET subscription_plan = 'pro_monthly' WHERE id = 'john.doe';
