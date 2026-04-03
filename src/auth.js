import { supabase } from './supabase.js';

// ── Auth Operations ──────────────────────────────────────────────────────────

export async function signUp(email, password, name, inviteCode) {
  // Sign up with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, invite_code: inviteCode || null },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

// ── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(authId) {
  const { data, error } = await supabase
    .from('fsm_users')
    .select('*, subscription_plans(*)')
    .eq('auth_id', authId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from('fsm_users')
    .update({ ...updates, last_seen_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Subscription Plans ───────────────────────────────────────────────────────

export async function getPlans() {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function selectPlan(userId, planId, period) {
  // Update user's plan
  const { error: updateError } = await supabase
    .from('fsm_users')
    .update({
      subscription_plan: planId,
      subscription_period: period,
      subscription_status: planId === 'free' ? 'active' : 'trialing',
      trial_ends_at: planId === 'free' ? null : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', userId);
  if (updateError) throw updateError;

  // Log the event (immutable)
  const { error: eventError } = await supabase
    .from('subscription_events')
    .insert({
      user_id: userId,
      event_type: 'plan_selected',
      new_plan: planId,
      metadata: { period },
    });
  if (eventError) console.error('Event log error:', eventError);
}

// ── Sponsorship ──────────────────────────────────────────────────────────────

export async function createInvite(sponsorId, email, role, plan, message) {
  const inviteCode = 'INV-' + Math.random().toString(36).substr(2, 8).toUpperCase();

  const { data, error } = await supabase
    .from('sponsorships')
    .insert({
      sponsor_id: sponsorId,
      sponsored_email: email,
      granted_role: role,
      granted_plan: plan,
      invite_code: inviteCode,
      message,
    })
    .select()
    .single();
  if (error) throw error;

  // Log it
  await supabase.from('subscription_events').insert({
    user_id: sponsorId,
    event_type: 'sponsor_invited',
    metadata: { email, role, plan, invite_code: inviteCode },
  });

  return data;
}

export async function getMyInvites(sponsorId) {
  const { data, error } = await supabase
    .from('sponsorships')
    .select('*, sponsored_user:fsm_users!sponsorships_sponsored_user_id_fkey(name, email)')
    .eq('sponsor_id', sponsorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function revokeInvite(inviteId, sponsorId) {
  const { error } = await supabase
    .from('sponsorships')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('sponsor_id', sponsorId);
  if (error) throw error;

  await supabase.from('subscription_events').insert({
    user_id: sponsorId,
    event_type: 'sponsor_revoked',
    metadata: { invite_id: inviteId },
  });
}

export async function validateInviteCode(code) {
  const { data, error } = await supabase
    .from('sponsorships')
    .select('*, sponsor:fsm_users!sponsorships_sponsor_id_fkey(name, email, company)')
    .eq('invite_code', code)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();
  if (error) return null;
  return data;
}

// ── Stripe Integration (stub — to be wired to Stripe API) ───────────────────

export async function createCheckoutSession(userId, planId, period) {
  // This will call our /api/stripe/checkout endpoint
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, planId, period }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create checkout session');
  }
  return response.json();
}

export async function getSubscriptionStatus(userId) {
  const { data, error } = await supabase
    .from('fsm_users')
    .select('subscription_plan, subscription_status, subscription_period, trial_ends_at, stripe_customer_id')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ── Auth State Listener ──────────────────────────────────────────────────────

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
