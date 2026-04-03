import { useState, useEffect } from 'react';
import {
  signUp, signIn, signOut, getSession, getUserProfile, getPlans,
  selectPlan, validateInviteCode, onAuthStateChange
} from './auth.js';

// ── Theme constants (matching FSM Drive dark theme) ──────────────────────────
const T = {
  bg: '#0a0e17', surface: '#111827', surfaceAlt: '#1a2332',
  border: '#2a3a4e', borderFocus: '#4a90d9',
  text: '#e2e8f0', textMuted: '#8899aa', textDim: '#556677',
  accent: '#4a90d9', accentHover: '#5a9ee9',
  success: '#34d399', warning: '#fbbf24', error: '#ef4444',
  compound: '#c084fc',
};

const fontStack = "'JetBrains Mono','Fira Code',Consolas,monospace";

// ── Shared Styles ────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '12px 14px', background: T.bg, border: `1.5px solid ${T.border}`,
  borderRadius: 8, color: T.text, fontSize: 13, fontFamily: fontStack, outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};
const labelStyle = { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: T.textDim, marginBottom: 4, display: 'block' };
const btnPrimary = {
  width: '100%', padding: '14px 20px', background: T.accent, border: 'none', borderRadius: 10,
  color: '#fff', fontSize: 14, fontFamily: fontStack, fontWeight: 700, cursor: 'pointer',
  transition: 'background 0.2s', letterSpacing: 0.5,
};
const btnSecondary = {
  ...btnPrimary, background: 'transparent', border: `1.5px solid ${T.border}`, color: T.textMuted,
};
const linkStyle = { color: T.accent, cursor: 'pointer', fontSize: 12, background: 'none', border: 'none', fontFamily: fontStack, textDecoration: 'underline' };

// ── Main Auth Screen ─────────────────────────────────────────────────────────
export default function AuthScreen({ onAuthenticated }) {
  const [view, setView] = useState('login'); // login | register | plans | forgot
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteInfo, setInviteInfo] = useState(null);

  // Plan selection
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('monthly');

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getSession();
        if (session?.user) {
          const profile = await getUserProfile(session.user.id);
          if (profile) {
            onAuthenticated(session, profile);
            return;
          }
        }
      } catch (e) {
        console.log('No existing session');
      }
      setLoading(false);
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const profile = await getUserProfile(session.user.id);
          if (profile) onAuthenticated(session, profile);
        } catch (e) {
          console.error('Profile load error:', e);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [onAuthenticated]);

  // Load plans when switching to plans view
  useEffect(() => {
    if (view === 'plans' || view === 'register') {
      getPlans().then(setPlans).catch(e => console.error('Plans load error:', e));
    }
  }, [view]);

  // Validate invite code
  useEffect(() => {
    if (inviteCode.length >= 10) {
      validateInviteCode(inviteCode).then(info => {
        setInviteInfo(info);
        if (info) setSuccess(`Invited by ${info.sponsor?.name || 'a sponsor'} — ${info.granted_role} access`);
        else setError('Invalid or expired invite code');
      });
    } else {
      setInviteInfo(null);
    }
  }, [inviteCode]);

  const clearMessages = () => { setError(null); setSuccess(null); };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages(); setLoading(true);
    try {
      await signIn(email, password);
      // onAuthStateChange will handle the rest
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Invalid email or password' : err.message);
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    clearMessages();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!name.trim()) { setError('Name is required'); return; }

    setLoading(true);
    try {
      await signUp(email, password, name, inviteCode || null);
      setSuccess('Account created! Check your email to confirm, then sign in.');
      setView('login');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (loading && view === 'login') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.bg, fontFamily: fontStack, color: T.accent, fontSize: 14 }}>
        Connecting to FSM Drive...
      </div>
    );
  }

  // ── Pricing Page ───────────────────────────────────────────────────────────
  if (view === 'plans') {
    return (
      <div style={{ width: '100vw', minHeight: '100vh', background: T.bg, fontFamily: fontStack,
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', overflowY: 'auto' }}>
        <h1 style={{ color: T.accent, fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: 0.5 }}>FSM Drive</h1>
        <p style={{ color: T.textDim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 32px' }}>Choose Your Plan</p>

        {/* Billing toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
          {['monthly', 'yearly'].map(p => (
            <button key={p} onClick={() => setBillingPeriod(p)}
              style={{ padding: '10px 24px', background: billingPeriod === p ? T.accent : T.surface,
                border: 'none', color: billingPeriod === p ? '#fff' : T.textMuted,
                fontSize: 12, fontFamily: fontStack, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {p}{p === 'yearly' ? ' (Save 17%)' : ''}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
          {plans.filter(p => {
            if (billingPeriod === 'monthly') return !p.id.endsWith('_yearly');
            return !p.id.endsWith('_monthly');
          }).map(plan => {
            const isPro = plan.id.includes('pro');
            const isEnterprise = plan.id.includes('enterprise');
            const isFree = plan.id === 'free';
            const price = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;
            const features = plan.features?.highlights || [];

            return (
              <div key={plan.id} style={{
                width: 280, background: T.surface, border: `1.5px solid ${isPro ? T.accent : T.border}`,
                borderRadius: 16, padding: '28px 24px', display: 'flex', flexDirection: 'column',
                position: 'relative', overflow: 'hidden',
              }}>
                {isPro && (
                  <div style={{ position: 'absolute', top: 12, right: -28, background: T.accent, color: '#fff',
                    fontSize: 10, fontWeight: 700, padding: '3px 32px', transform: 'rotate(45deg)', letterSpacing: 1 }}>
                    POPULAR
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 700, color: isPro ? T.accent : T.text, marginBottom: 6 }}>{plan.name.replace(/ \(.*\)/, '')}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>{plan.description}</div>

                <div style={{ marginBottom: 20 }}>
                  {isFree ? (
                    <span style={{ fontSize: 32, fontWeight: 700, color: T.text }}>Free</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 700, color: T.text }}>${(price / 100).toFixed(0)}</span>
                      <span style={{ fontSize: 12, color: T.textDim }}>/{billingPeriod === 'yearly' ? 'year' : 'mo'}</span>
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, marginBottom: 20 }}>
                  {features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ color: T.success, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => { setSelectedPlan(plan); setView('register'); }}
                  style={{ ...btnPrimary, background: isPro ? T.accent : isEnterprise ? T.compound : T.surfaceAlt,
                    color: isFree ? T.textMuted : '#fff', border: isFree ? `1px solid ${T.border}` : 'none',
                    padding: '12px 16px', fontSize: 13 }}>
                  {isFree ? 'Get Started' : isEnterprise ? 'Contact Sales' : 'Start 14-Day Trial'}
                </button>
              </div>
            );
          })}
        </div>

        <button onClick={() => setView('login')} style={{ ...linkStyle, marginTop: 32 }}>
          Already have an account? Sign in
        </button>

        <div style={{ marginTop: 40, color: T.textDim, fontSize: 10 }}>
          E.L. Stull & Associates, Inc.
        </div>
      </div>
    );
  }

  // ── Login / Register Form ──────────────────────────────────────────────────
  const isRegister = view === 'register';

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T.bg, fontFamily: fontStack }}>
      <div style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 20, padding: '36px 40px', boxSizing: 'border-box' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ color: T.accent, fontSize: 24, fontWeight: 700, margin: '0 0 6px', letterSpacing: 0.5 }}>FSM Drive</h1>
          <p style={{ color: T.textDim, fontSize: 11, margin: 0, letterSpacing: 1, textTransform: 'uppercase' }}>
            {isRegister ? 'Create Your Account' : 'Sign In'}
          </p>
          {selectedPlan && isRegister && (
            <div style={{ marginTop: 8, padding: '6px 14px', background: T.accent + '18', border: `1px solid ${T.accent}33`,
              borderRadius: 6, display: 'inline-block' }}>
              <span style={{ fontSize: 11, color: T.accent, fontWeight: 600 }}>
                {selectedPlan.name} — {selectedPlan.id === 'free' ? 'Free' : '14-day trial'}
              </span>
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div style={{ background: '#e0303018', border: '1px solid #e0303044', borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, color: '#f08080', fontSize: 12 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: T.success + '18', border: `1px solid ${T.success}44`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, color: T.success, fontSize: 12 }}>
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={isRegister ? handleRegister : handleLogin}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {isRegister && (
              <>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={inputStyle} value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ed Stull" required
                    onFocus={e => e.target.style.borderColor = T.borderFocus}
                    onBlur={e => e.target.style.borderColor = T.border} />
                </div>
                <div>
                  <label style={labelStyle}>Company</label>
                  <input style={inputStyle} value={company} onChange={e => setCompany(e.target.value)}
                    placeholder="E.L. Stull & Associates"
                    onFocus={e => e.target.style.borderColor = T.borderFocus}
                    onBlur={e => e.target.style.borderColor = T.border} />
                </div>
              </>
            )}

            <div>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" value={email} onChange={e => { setEmail(e.target.value); clearMessages(); }}
                placeholder="you@company.com" required autoFocus={!isRegister}
                onFocus={e => e.target.style.borderColor = T.borderFocus}
                onBlur={e => e.target.style.borderColor = T.border} />
            </div>

            <div>
              <label style={labelStyle}>Password *</label>
              <input style={inputStyle} type="password" value={password} onChange={e => { setPassword(e.target.value); clearMessages(); }}
                placeholder={isRegister ? 'Minimum 8 characters' : '••••••••'} required
                onFocus={e => e.target.style.borderColor = T.borderFocus}
                onBlur={e => e.target.style.borderColor = T.border} />
            </div>

            {isRegister && (
              <>
                <div>
                  <label style={labelStyle}>Confirm Password *</label>
                  <input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" required
                    onFocus={e => e.target.style.borderColor = T.borderFocus}
                    onBlur={e => e.target.style.borderColor = T.border} />
                </div>

                {/* Invite code */}
                <div>
                  <label style={labelStyle}>Invite Code (optional)</label>
                  <input style={{ ...inputStyle, borderColor: inviteInfo ? T.success : T.border }}
                    value={inviteCode} onChange={e => { setInviteCode(e.target.value.toUpperCase()); clearMessages(); }}
                    placeholder="INV-XXXXXXXX"
                    onFocus={e => e.target.style.borderColor = T.borderFocus}
                    onBlur={e => e.target.style.borderColor = inviteInfo ? T.success : T.border} />
                  {inviteInfo && (
                    <div style={{ fontSize: 11, color: T.success, marginTop: 4 }}>
                      ✓ Sponsored by {inviteInfo.sponsor?.name} — {inviteInfo.granted_role} access
                      {inviteInfo.granted_plan && inviteInfo.granted_plan !== 'free' && ` + ${inviteInfo.granted_plan} plan`}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <button type="submit" disabled={loading}
            style={{ ...btnPrimary, marginTop: 22, opacity: loading ? 0.6 : 1 }}>
            {loading ? (isRegister ? 'Creating Account...' : 'Signing In...') : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        {/* Footer links */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {!isRegister ? (
            <>
              <button onClick={() => { setView('register'); clearMessages(); }} style={linkStyle}>
                Don't have an account? Create one
              </button>
              <button onClick={() => { setView('plans'); clearMessages(); }} style={linkStyle}>
                View pricing plans
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setView('login'); clearMessages(); }} style={linkStyle}>
                Already have an account? Sign in
              </button>
              <button onClick={() => { setView('plans'); clearMessages(); }} style={linkStyle}>
                ← Back to pricing
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}`, textAlign: 'center' }}>
          <p style={{ color: T.textDim, fontSize: 10, margin: 0 }}>E.L. Stull & Associates, Inc.</p>
        </div>
      </div>
    </div>
  );
}
