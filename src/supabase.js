import { createClient } from '@supabase/supabase-js';

// These will come from environment variables in production
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Registry Operations ──────────────────────────────────────────────────────

export async function loadRegistry() {
  const { data, error } = await supabase
    .from('fsm_registry')
    .select('name, definition, owners, editors, updated_at, updated_by');
  if (error) throw error;
  const registry = {};
  for (const row of data) {
    registry[row.name] = {
      ...row.definition,
      owners: row.owners || [],
      editors: row.editors || [],
    };
  }
  return registry;
}

export async function saveElement(fsmName, definition, updatedBy) {
  const { error } = await supabase
    .from('fsm_registry')
    .update({ definition, updated_at: new Date().toISOString(), updated_by: updatedBy })
    .eq('name', fsmName);
  if (error) throw error;
}

export async function logEvent(fsmName, eventType, elementId, elementType, oldValue, newValue, performedBy) {
  const { error } = await supabase
    .from('fsm_events')
    .insert({
      fsm_name: fsmName,
      event_type: eventType,
      element_id: elementId,
      element_type: elementType,
      old_value: oldValue,
      new_value: newValue,
      performed_by: performedBy,
    });
  if (error) console.error('Event log error:', error);
}

// ── Lock Operations ──────────────────────────────────────────────────────────

export async function acquireLock(fsmName, elementId, elementType, userId) {
  // Try to insert — unique constraint on (fsm_name, element_id) prevents duplicates
  const { data, error } = await supabase
    .from('fsm_locks')
    .upsert({
      fsm_name: fsmName,
      element_id: elementId,
      element_type: elementType,
      locked_by: userId,
      locked_at: new Date().toISOString(),
    }, { onConflict: 'fsm_name,element_id' })
    .select();
  
  if (error) {
    console.error('Lock acquire error:', error);
    return false;
  }
  // Verify we actually hold the lock
  if (data?.[0]?.locked_by === userId) return true;
  return false;
}

export async function releaseLock(fsmName, elementId, userId) {
  const { error } = await supabase
    .from('fsm_locks')
    .delete()
    .eq('fsm_name', fsmName)
    .eq('element_id', elementId)
    .eq('locked_by', userId);
  if (error) console.error('Lock release error:', error);
}

export async function loadLocks(fsmName) {
  const { data, error } = await supabase
    .from('fsm_locks')
    .select('element_id, element_type, locked_by, locked_at')
    .eq('fsm_name', fsmName);
  if (error) { console.error('Load locks error:', error); return {}; }
  const locks = {};
  for (const row of data) {
    locks[row.element_id] = {
      lockedBy: row.locked_by,
      lockedAt: row.locked_at,
      type: row.element_type,
    };
  }
  return locks;
}

// ── Realtime Subscriptions ───────────────────────────────────────────────────

export function subscribeToRegistry(callback) {
  return supabase
    .channel('registry-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'fsm_registry',
    }, payload => {
      callback(payload);
    })
    .subscribe();
}

export function subscribeToLocks(callback) {
  return supabase
    .channel('lock-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'fsm_locks',
    }, payload => {
      callback(payload);
    })
    .subscribe();
}

export function subscribeToPresence(channel, userId, userName, callback) {
  const ch = supabase.channel(channel);
  ch.on('presence', { event: 'sync' }, () => {
    callback(ch.presenceState());
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await ch.track({ user_id: userId, user_name: userName, online_at: new Date().toISOString() });
    }
  });
  return ch;
}
