import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';

// ============================================================
// FSM DRIVE v2 — AUTH SCREEN
// Real Supabase email/password authentication.
// Replaces the "click your name" login pattern.
//
// Usage in App.jsx:
//   import AuthScreen from './AuthScreen.jsx';
//   Replace the old login render with:
//     <AuthScreen onLogin={(fsmUser) => setCurrentUser(fsmUser)} />
// ============================================================

export default function AuthScreen({ onLogin, instanceName = 'Aculine, Inc.' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await resolveUser(session.user);
      }
    } catch (err) {
      console.error('Session check error:', err);
    } finally {
      setCheckingSession(false);
    }
  }

  async function resolveUser(authUser) {
    // Find the matching fsm_user by auth_id
    const { data: fsmUsers, error: queryError } = await supabase
      .from('fsm_users')
      .select('*')
      .eq('auth_id', authUser.id);

    if (queryError) {
      console.error('User lookup error:', queryError);
      // Fallback: try matching by email
      const { data: emailMatch } = await supabase
        .from('fsm_users')
        .select('*')
        .eq('email', authUser.email);

      if (emailMatch && emailMatch.length > 0) {
        onLogin({
          userId: emailMatch[0].id,
          userName: emailMatch[0].name,
          userRole: emailMatch[0].role,
          userEmail: emailMatch[0].email,
          authId: authUser.id,
        });
        return;
      }
      setError('Account exists but no FSM Drive user profile found. Contact your administrator.');
      return;
    }

    if (fsmUsers && fsmUsers.length > 0) {
      onLogin({
        userId: fsmUsers[0].id,
        userName: fsmUsers[0].name,
        userRole: fsmUsers[0].role,
        userEmail: fsmUsers[0].email,
        authId: authUser.id,
      });
    } else {
      // Try email fallback
      const { data: emailMatch } = await supabase
        .from('fsm_users')
        .select('*')
        .eq('email', authUser.email);

      if (emailMatch && emailMatch.length > 0) {
        // Link the auth_id for next time
        await supabase
          .from('fsm_users')
          .update({ auth_id: authUser.id })
          .eq('id', emailMatch[0].id);

        onLogin({
          userId: emailMatch[0].id,
          userName: emailMatch[0].name,
          userRole: emailMatch[0].role,
          userEmail: emailMatch[0].email,
          authId: authUser.id,
        });
      } else {
        setError('No FSM Drive user profile found for this account. Contact your administrator.');
      }
    }
  }

  async function handleLogin(e) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login')) {
          setError('Invalid email or password.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (data?.user) {
        await resolveUser(data.user);
      }
    } catch (err) {
      setError('Unable to reach the server. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // Show loading while checking existing session
  if (checkingSession) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>{instanceName}</h1>
          <p style={styles.subtitle}>POWERED BY FSM DRIVE</p>
          <p style={{ color: '#8899aa', marginTop: 40, textAlign: 'center' }}>Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{instanceName}</h1>
        <p style={styles.subtitle}>POWERED BY FSM DRIVE</p>

        <div style={{ marginTop: 32 }}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="you@company.com"
              style={styles.input}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Enter your password"
              style={styles.input}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            style={{
              ...styles.loginButton,
              opacity: (loading || !email || !password) ? 0.6 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerText}>Secure authentication powered by Supabase</span>
        </div>

        <p style={styles.footer}>{instanceName}</p>
      </div>
    </div>
  );
}

// Sign out helper — export for use in App.jsx nav
export async function signOut() {
  await supabase.auth.signOut();
  window.location.reload();
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a1628 0%, #111827 50%, #0a1628 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    padding: 16,
  },
  card: {
    background: '#111827',
    border: '1px solid #2a3a4e',
    borderRadius: 16,
    padding: '32px 24px',
    textAlign: 'center',
    width: '100%',
    maxWidth: 380,
    boxSizing: 'border-box',
  },
  title: {
    color: '#4a90d9',
    fontSize: 22,
    fontWeight: 700,
    margin: '0 0 4px',
  },
  subtitle: {
    color: '#8899aa',
    fontSize: 11,
    margin: '0 0 28px',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inputGroup: {
    marginBottom: 16,
    textAlign: 'left',
  },
  label: {
    display: 'block',
    color: '#8899aa',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#0a1628',
    border: '1px solid #2a3a4e',
    borderRadius: 8,
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  error: {
    background: 'rgba(220, 38, 38, 0.1)',
    border: '1px solid rgba(220, 38, 38, 0.3)',
    borderRadius: 8,
    padding: '8px 12px',
    color: '#f87171',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'left',
  },
  loginButton: {
    width: '100%',
    padding: '11px 16px',
    background: 'linear-gradient(135deg, #1a5a8a 0%, #2e75b6 100%)',
    border: 'none',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  divider: {
    marginTop: 20,
    paddingTop: 14,
    borderTop: '1px solid #2a3a4e',
  },
  dividerText: {
    color: '#556677',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  footer: {
    color: '#8899aa',
    fontSize: 10,
    marginTop: 12,
  },
};
