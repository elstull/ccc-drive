-- OrchestraIQ FSM Editor Schema
-- Separate project from PickleIQ

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE fsm_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','editor','viewer')),
  sponsored_by TEXT REFERENCES fsm_users(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed users
INSERT INTO fsm_users (id, name, email, role, registered_at) VALUES
  ('ed.stull', 'Ed Stull', 'edstull@elstull.com', 'owner', '2025-01-15T08:00:00-05:00'),
  ('john.doe', 'John Doe', 'john.doe@example.com', 'editor', '2026-03-04T12:00:00-05:00');

-- ── FSM Registry ─────────────────────────────────────────────────────────────
CREATE TABLE fsm_registry (
  name TEXT PRIMARY KEY,
  definition JSONB NOT NULL,  -- { states: [...], transitions: [...] }
  owners TEXT[] NOT NULL DEFAULT '{}',
  editors TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT REFERENCES fsm_users(id)
);

-- ── Element Locks ────────────────────────────────────────────────────────────
CREATE TABLE fsm_locks (
  id SERIAL PRIMARY KEY,
  fsm_name TEXT NOT NULL REFERENCES fsm_registry(name) ON DELETE CASCADE,
  element_id TEXT NOT NULL,
  element_type TEXT NOT NULL CHECK (element_type IN ('state','transition')),
  locked_by TEXT NOT NULL REFERENCES fsm_users(id),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fsm_name, element_id)
);

-- Auto-expire locks older than 2 minutes (safety net)
CREATE OR REPLACE FUNCTION expire_stale_locks() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM fsm_locks WHERE locked_at < now() - interval '2 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_expire_locks
  BEFORE INSERT ON fsm_locks
  EXECUTE FUNCTION expire_stale_locks();

-- ── Event Log (Immutable) ────────────────────────────────────────────────────
CREATE TABLE fsm_events (
  id SERIAL PRIMARY KEY,
  fsm_name TEXT NOT NULL REFERENCES fsm_registry(name) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'state_created','state_updated','state_deleted',
    'transition_created','transition_updated','transition_deleted',
    'fsm_created','fsm_updated'
  )),
  element_id TEXT,
  element_type TEXT,
  old_value JSONB,
  new_value JSONB,
  performed_by TEXT NOT NULL REFERENCES fsm_users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hash TEXT  -- for future Merkle tree integration
);

-- Immutable: no UPDATE or DELETE on events
CREATE RULE no_update_events AS ON UPDATE TO fsm_events DO INSTEAD NOTHING;
CREATE RULE no_delete_events AS ON DELETE TO fsm_events DO INSTEAD NOTHING;

-- ── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE fsm_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE fsm_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fsm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fsm_users ENABLE ROW LEVEL SECURITY;

-- For the initial deployment, allow all authenticated access
-- (we're not using Supabase Auth yet — just two known users)
CREATE POLICY "Allow all on fsm_registry" ON fsm_registry FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fsm_locks" ON fsm_locks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fsm_events" ON fsm_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fsm_users" ON fsm_users FOR ALL USING (true) WITH CHECK (true);

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime for locks and registry changes
ALTER PUBLICATION supabase_realtime ADD TABLE fsm_registry;
ALTER PUBLICATION supabase_realtime ADD TABLE fsm_locks;
