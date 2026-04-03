import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadRegistry, saveElement, logEvent,
  acquireLock as dbAcquireLock, releaseLock as dbReleaseLock, loadLocks,
  subscribeToRegistry, subscribeToLocks, subscribeToPresence, supabase
} from './supabase.js';
import FSMEditor from './FSMEditor.jsx';
import ActionView from './ActionView.jsx';
import ChatView from './ChatView.jsx';
import DemoMode from './DemoMode.jsx';
import Dashboard from './Dashboard.jsx';
import FinancialView from './FinancialView.jsx';
import HelpView from './HelpView.jsx';
import FloatingChat from './FloatingChat.jsx';
import ScanDocument from './ScanDocument.jsx';

const USERS = {
  'dr.mike': { name: 'Dr. Mike Kam', email: 'info@crashcareclinics.com' },
  'therapist.amy': { name: 'Amy (Massage)', email: 'amy@crashcareclinics.com' },
  'therapist.ben': { name: 'Ben (Rehab)', email: 'ben@crashcareclinics.com' },
  'therapist.cara': { name: 'Cara (Laser)', email: 'cara@crashcareclinics.com' },
  'front.desk': { name: 'Front Desk', email: 'frontdesk@crashcareclinics.com' },
};

const EMAIL_TO_ID = {};
Object.entries(USERS).forEach(([id, u]) => {
  EMAIL_TO_ID[u.email.toLowerCase()] = id;
});


// ═══════════════════════════════════════════════════════════════════════════
// BOTTOM NAV — bigger icons, bigger text, always visible
// ═══════════════════════════════════════════════════════════════════════════

function BottomNav({ role, activeTab, onNav, onSignOut }) {
  const tabs = [
    { id: 'action', icon: '\uD83C\uDFE0', label: 'Home' },
    { id: 'workspace', icon: '\uD83D\uDCAC', label: 'Chat' },
  ];
  if (['executive', 'platform-admin', 'operations-lead', 'finance-manager'].includes(role)) {
    tabs.push({ id: 'dashboard', icon: '\uD83D\uDCCA', label: 'Dashboard' });
    tabs.push({ id: 'finance', icon: '\uD83D\uDCB0', label: 'Finance' });
  }
  if (['executive', 'platform-admin'].includes(role)) {
    tabs.push({ id: 'editor', icon: '\u2699\uFE0F', label: 'Editor' });
  }
  tabs.push({ id: 'help', icon: '\u2753', label: 'Help' });
  tabs.push({ id: '_signout', icon: '\uD83D\uDEAA', label: 'Sign out' });

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#0d1220', borderTop: '1px solid #1e293b',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      gap: 6,
      height: 72,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {tabs.map(tab => {
        const active = tab.id === activeTab;
        const isExit = tab.id === '_signout';
        return (
          <button key={tab.id}
            onClick={() => isExit ? onSignOut() : onNav(tab.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '6px 14px', minWidth: 60,
              WebkitTapHighlightColor: 'transparent',
            }}>
            <span style={{
              fontSize: 26, lineHeight: 1,
              opacity: (active && !isExit) ? 1 : isExit ? 0.4 : 0.4,
              filter: (active && !isExit) ? 'none' : 'grayscale(0.8)',
            }}>{tab.icon}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              color: (active && !isExit) ? '#4a90d9' : isExit ? '#f08080' : '#99aabb',
            }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [registry, setRegistry] = useState(null);
  const [locks, setLocks] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [appView, setAppView] = useState('action');
  const prevViewRef = useRef('action');
  const [userRole, setUserRole] = useState('executive');
  const [registryLoading, setRegistryLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('quick');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const channelRefs = useRef([]);

  // ── Check for existing session on app load ─────────────────────────────
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const email = session.user.email.toLowerCase();
          const userId = EMAIL_TO_ID[email];
          if (userId) { await loginUser(userId); setAuthChecking(false); return; }
        }
        const saved = localStorage.getItem('fsm_drive_user');
        if (saved && USERS[saved]) { await loginUser(saved); setAuthChecking(false); return; }
      } catch (e) { console.log('Session check:', e.message); }
      setAuthChecking(false);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && session.user) {
        const email = session.user.email.toLowerCase();
        const userId = EMAIL_TO_ID[email];
        if (userId) await loginUser(userId);
        else setError('No FSM Drive account found for ' + session.user.email);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loginUser = async (userId) => {
    setCurrentUser(userId);
    localStorage.setItem('fsm_drive_user', userId);
    try {
      const { data: jobData } = await supabase
        .from('user_job_assignments').select('job_profile_id')
        .eq('user_id', userId).eq('is_primary', true).limit(1);
      if (jobData?.[0]) setUserRole(jobData[0].job_profile_id);
    } catch (e) { console.log('Role lookup:', e.message); }
    setConnected(true);
  };

  const quickLogin = async (userId) => { setLoading(true); await loginUser(userId); setLoading(false); };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: window.location.origin }
      });
      if (error) setError(error.message);
    } catch (e) { setError('Google sign-in not available yet.'); setLoginMode('quick'); }
    setLoading(false);
  };

  const signInWithEmail = async () => {
    if (!emailInput.trim() || !passwordInput.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(), password: passwordInput.trim()
      });
      if (error) setError(error.message);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const logout = async () => {
    localStorage.removeItem('fsm_drive_user');
    try { await supabase.auth.signOut(); } catch (e) {}
    setCurrentUser(null); setConnected(false); setRegistry(null);
    setAppView('action'); setUserRole('executive'); setError(null);
  };

  const navigateTo = (view) => {
    if (view !== 'help' && view !== '_signout') prevViewRef.current = appView;
    if (view === 'editor' && !registry) refreshRegistry().then(() => setAppView('editor'));
    else setAppView(view);
  };

  const refreshRegistry = useCallback(async () => {
    setRegistryLoading(true);
    try { const reg = await loadRegistry(); setRegistry(reg); setError(null); }
    catch (e) { console.error('Registry:', e); setError(e.message); }
    setRegistryLoading(false);
  }, []);

  const refreshLocks = useCallback(async (fsmName) => {
    try { const l = await loadLocks(fsmName); setLocks(l); }
    catch (e) { console.error('Locks:', e); }
  }, []);

  useEffect(() => {
    if (!connected || !currentUser) return;
    const ch1 = subscribeToRegistry(() => refreshRegistry());
    const ch2 = subscribeToLocks((p) => {
      if (p.new?.fsm_name) refreshLocks(p.new.fsm_name);
      else if (p.old?.fsm_name) refreshLocks(p.old.fsm_name);
    });
    const ch3 = subscribeToPresence('fsm-editors-presence', currentUser,
      USERS[currentUser]?.name || currentUser, (s) => setOnlineUsers(s));
    channelRefs.current = [ch1, ch2, ch3];
    return () => { channelRefs.current.forEach(c => supabase.removeChannel(c)); channelRefs.current = []; };
  }, [connected, currentUser, refreshRegistry, refreshLocks]);

  const handleSaveFSM = useCallback(async (n, s, t) => {
    if (!currentUser || !registry) return;
    try { await saveElement(n, { states: s, transitions: t }, currentUser);
      setRegistry(p => ({ ...p, [n]: { ...p[n], states: s, transitions: t } }));
    } catch (e) { console.error('Save:', e); }
  }, [currentUser, registry]);

  const handleAcquireLock = useCallback(async (f, e, t) => {
    if (!currentUser) return false;
    const r = await dbAcquireLock(f, e, t, currentUser);
    if (r) setLocks(p => ({ ...p, [e]: { lockedBy: currentUser, lockedAt: new Date().toISOString(), type: t } }));
    return r;
  }, [currentUser]);

  const handleReleaseLock = useCallback(async (f, e) => {
    if (!currentUser) return;
    await dbReleaseLock(f, e, currentUser);
    setLocks(p => { const n = { ...p }; delete n[e]; return n; });
  }, [currentUser]);

  const handleLogEvent = useCallback(async (f, ev, eId, eT, o, n) => {
    if (!currentUser) return;
    await logEvent(f, ev, eId, eT, o, n, currentUser);
  }, [currentUser]);


  // ═══════════════════════════════════════════════════════════════════════
  // AUTH CHECK — brief splash
  // ═══════════════════════════════════════════════════════════════════════

  if (authChecking) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0e17' }}>
        <div style={{ color: '#4a90d9', fontSize: 16, fontFamily: "'JetBrains Mono', monospace" }}>
          FSM Drive
        </div>
      </div>
    );
  }


  // ═══════════════════════════════════════════════════════════════════════
  // DEMO MODE — FSM Drive demonstrating itself
  // ═══════════════════════════════════════════════════════════════════════

  if (showDemo) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#0a0e17',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
        <DemoMode onExit={() => setShowDemo(false)} supabase={supabase} />
      </div>
    );
  }


  // ═══════════════════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ═══════════════════════════════════════════════════════════════════════

  if (!currentUser || !connected) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0e17',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", padding: 16, boxSizing: 'border-box' }}>
        <div style={{ background: '#111827', border: '1px solid #2a3a4e', borderRadius: 16,
          padding: '32px 24px', textAlign: 'center', width: '100%', maxWidth: 380 }}>
          <h1 style={{ color: '#4a90d9', fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Crash Care Clinics</h1>
          <p style={{ color: '#8899aa', fontSize: 11, margin: '0 0 28px', letterSpacing: 1, textTransform: 'uppercase' }}>
            Powered by FSM Drive
          </p>

          {/* ── Demo button — prominent ─────────────────────── */}
          <button onClick={() => setShowDemo(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 20px', marginBottom: 20,
              background: 'linear-gradient(135deg, #1a3a5c, #2a5a8c)', border: '1.5px solid #4a90d9',
              borderRadius: 10, color: '#e2e8f0', fontSize: 14, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
            {'\uD83C\uDFBC'} Watch Demo
          </button>

          {error && (
            <div style={{ background: '#e0303018', border: '1px solid #e0303044', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, color: '#f08080', fontSize: 12 }}>{error}</div>
          )}

          <button onClick={signInWithGoogle} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '14px 20px', marginBottom: 12,
              background: '#fff', border: 'none', borderRadius: 10,
              color: '#333', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              cursor: loading ? 'wait' : 'pointer', WebkitTapHighlightColor: 'transparent' }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#2a3a4e' }} />
            <span style={{ color: '#8899aa', fontSize: 11 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#2a3a4e' }} />
          </div>

          {loginMode === 'quick' ? (
            <>
              <p style={{ color: '#8899aa', fontSize: 12, marginBottom: 14 }}>Select your identity:</p>
              <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                {Object.entries(USERS).map(([id, user]) => (
                  <button key={id} onClick={() => quickLogin(id)} disabled={loading}
                    style={{ display: 'block', width: '100%', padding: '14px 16px', marginBottom: 8,
                      background: '#1a2332', border: '1.5px solid #2a3a4e', borderRadius: 10,
                      color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit',
                      cursor: loading ? 'wait' : 'pointer', textAlign: 'left',
                      WebkitTapHighlightColor: 'transparent' }}>
                    <div style={{ fontWeight: 700 }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: '#8899aa', marginTop: 3 }}>{user.email}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setLoginMode('email')}
                style={{ background: 'none', border: 'none', color: '#4a90d9', fontSize: 12,
                  cursor: 'pointer', marginTop: 12, fontFamily: 'inherit' }}>
                Sign in with email instead
              </button>
            </>
          ) : (
            <>
              <input value={emailInput} onChange={e => setEmailInput(e.target.value)}
                placeholder="Email" type="email"
                style={{ display: 'block', width: '100%', padding: '12px 16px', marginBottom: 10,
                  background: '#1a2332', border: '1.5px solid #2a3a4e', borderRadius: 10,
                  color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box', WebkitAppearance: 'none' }} />
              <input value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                placeholder="Password" type="password"
                onKeyDown={e => { if (e.key === 'Enter') signInWithEmail(); }}
                style={{ display: 'block', width: '100%', padding: '12px 16px', marginBottom: 14,
                  background: '#1a2332', border: '1.5px solid #2a3a4e', borderRadius: 10,
                  color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box', WebkitAppearance: 'none' }} />
              <button onClick={signInWithEmail} disabled={loading}
                style={{ display: 'block', width: '100%', padding: '14px 20px',
                  background: '#4a90d9', border: 'none', borderRadius: 10,
                  color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                  cursor: loading ? 'wait' : 'pointer' }}>
                Sign In
              </button>
              <button onClick={() => setLoginMode('quick')}
                style={{ background: 'none', border: 'none', color: '#4a90d9', fontSize: 12,
                  cursor: 'pointer', marginTop: 12, fontFamily: 'inherit' }}>
                Use quick login instead
              </button>
            </>
          )}

          {loading && <div style={{ color: '#4a90d9', fontSize: 12, marginTop: 12 }}>Connecting...</div>}

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #2a3a4e' }}>
            <p style={{ color: '#8899aa', fontSize: 10 }}>Crash Care Clinics</p>
          </div>
        </div>
      </div>
    );
  }


  // ═══════════════════════════════════════════════════════════════════════
  // UNIFIED SHELL — simple document flow, iOS scrolls naturally
  // ═══════════════════════════════════════════════════════════════════════

  const renderView = () => {
    switch (appView) {
      case 'action':
        return <ActionView currentUser={currentUser} users={USERS} supabase={supabase} onScan={() => setShowScan(true)} />;
      case 'workspace':
        return <ChatView currentUser={currentUser} users={USERS} supabase={supabase} />;
      case 'editor':
        if (registryLoading || !registry) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: '60vh', color: '#4a90d9', fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}>
              Loading FSM Registry...
            </div>
          );
        }
        return <FSMEditor initialRegistry={registry} currentUser={currentUser} users={USERS}
          locks={locks} onlineUsers={onlineUsers} onSaveFSM={handleSaveFSM}
          onAcquireLock={handleAcquireLock} onReleaseLock={handleReleaseLock}
          onLogEvent={handleLogEvent} onRefreshLocks={refreshLocks}
          onSwitchToWorkspace={() => navigateTo('workspace')} onSwitchToHome={() => navigateTo('action')}
          onLogout={logout} />;
      case 'dashboard':
        return <Dashboard currentUser={currentUser} users={USERS} supabase={supabase} />;
            case 'finance':
        return <FinancialView currentUser={currentUser} users={USERS} supabase={supabase} />;
case 'help':
        return <HelpView currentUser={currentUser} users={USERS} supabase={supabase} activeContext={prevViewRef.current} onBack={() => navigateTo(prevViewRef.current)} />;
      default: return null;
    }
  };

  // Editor manages its own height. Other views need padding for the nav bar.
  const isEditor = appView === 'editor';
  return (
    <div style={{
      background: '#0a0e17',
      fontFamily: isEditor
        ? "'JetBrains Mono', 'SF Mono', monospace"
        : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      minHeight: isEditor ? undefined : '100vh',
      height: isEditor ? '100vh' : undefined,
      overflow: isEditor ? 'hidden' : undefined,
      paddingBottom: isEditor ? 0 : 80,
    }}>
      {showScan && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: '#0a0e17', zIndex: 10000, overflowY: 'auto', paddingBottom: 80,
        }}>
          <ScanDocument supabase={supabase} currentUser={currentUser} users={USERS}
            onClose={() => setShowScan(false)} activeInstances={[]} />
        </div>
      )}
      {renderView()}
      <FloatingChat supabase={supabase} currentUser={currentUser} users={USERS} activeView={appView} />
      <BottomNav role={userRole} activeTab={appView} onNav={navigateTo} onSignOut={logout} />
    </div>
  );
}


