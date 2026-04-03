import { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadRegistry, saveElement, logEvent,
  acquireLock as dbAcquireLock, releaseLock as dbReleaseLock, loadLocks,
  subscribeToRegistry, subscribeToLocks, subscribeToPresence, supabase
} from './supabase.js';
import { signOut, getUserProfile } from './auth.js';
import AuthScreen from './AuthScreen.jsx';
import FSMEditor from './FSMEditor.jsx';

export default function AppWithAuth() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [registry, setRegistry] = useState(null);
  const [locks, setLocks] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRefs = useRef([]);

  // ── Load registry from Supabase ────────────────────────────────────────────
  const refreshRegistry = useCallback(async () => {
    try {
      const reg = await loadRegistry();
      setRegistry(reg);
      setError(null);
    } catch (e) {
      console.error('Failed to load registry:', e);
      setError(e.message);
    }
  }, []);

  const refreshLocks = useCallback(async (fsmName) => {
    try {
      const l = await loadLocks(fsmName);
      setLocks(l);
    } catch (e) {
      console.error('Failed to load locks:', e);
    }
  }, []);

  // ── Called when AuthScreen succeeds ─────────────────────────────────────────
  const handleAuthenticated = useCallback(async (sess, profile) => {
    setSession(sess);
    setUserProfile(profile);
    try {
      await refreshRegistry();
    } catch (e) {
      setError(`Registry load failed: ${e.message}`);
    }
    setLoading(false);
  }, [refreshRegistry]);

  // ── Subscribe to Realtime once authenticated ───────────────────────────────
  useEffect(() => {
    if (!userProfile || !registry) return;

    const regChannel = subscribeToRegistry((payload) => {
      refreshRegistry();
    });
    channelRefs.current.push(regChannel);

    const lockChannel = subscribeToLocks((payload) => {
      if (payload.new?.fsm_name) refreshLocks(payload.new.fsm_name);
      else if (payload.old?.fsm_name) refreshLocks(payload.old.fsm_name);
    });
    channelRefs.current.push(lockChannel);

    const presChannel = subscribeToPresence(
      'fsm-editors-presence',
      userProfile.id,
      userProfile.name,
      (state) => setOnlineUsers(state)
    );
    channelRefs.current.push(presChannel);

    return () => {
      channelRefs.current.forEach(ch => supabase.removeChannel(ch));
      channelRefs.current = [];
    };
  }, [userProfile, registry, refreshRegistry, refreshLocks]);

  // ── Save FSM ───────────────────────────────────────────────────────────────
  const handleSaveFSM = useCallback(async (fsmName, states, transitions) => {
    if (!userProfile || !registry) return;
    const definition = { states, transitions };
    try {
      await saveElement(fsmName, definition, userProfile.id);
      setRegistry(prev => ({ ...prev, [fsmName]: { ...prev[fsmName], states, transitions } }));
    } catch (e) {
      console.error('Save failed:', e);
    }
  }, [userProfile, registry]);

  // ── Lock/unlock ────────────────────────────────────────────────────────────
  const handleAcquireLock = useCallback(async (fsmName, elementId, elementType) => {
    if (!userProfile) return false;
    const result = await dbAcquireLock(fsmName, elementId, elementType, userProfile.id);
    if (result) {
      setLocks(prev => ({
        ...prev,
        [elementId]: { lockedBy: userProfile.id, lockedAt: new Date().toISOString(), type: elementType }
      }));
    }
    return result;
  }, [userProfile]);

  const handleReleaseLock = useCallback(async (fsmName, elementId) => {
    if (!userProfile) return;
    await dbReleaseLock(fsmName, elementId, userProfile.id);
    setLocks(prev => { const n = { ...prev }; delete n[elementId]; return n; });
  }, [userProfile]);

  const handleLogEvent = useCallback(async (fsmName, eventType, elementId, elementType, oldVal, newVal) => {
    if (!userProfile) return;
    await logEvent(fsmName, eventType, elementId, elementType, oldVal, newVal, userProfile.id);
  }, [userProfile]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await signOut();
    setSession(null);
    setUserProfile(null);
    setRegistry(null);
    setLocks({});
    setOnlineUsers({});
  };

  // ── Not authenticated — show auth screen ───────────────────────────────────
  if (!session || !userProfile) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  // ── Loading registry ───────────────────────────────────────────────────────
  if (!registry) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0e17', color: '#4a90d9', fontFamily: "'JetBrains Mono', monospace", fontSize: 14
      }}>
        Loading FSM Registry...
      </div>
    );
  }

  // ── Build users map from profile ───────────────────────────────────────────
  const users = { [userProfile.id]: { name: userProfile.name, email: userProfile.email } };
  // Add any online users we can see
  Object.values(onlineUsers).flat().forEach(p => {
    if (!users[p.user_id]) users[p.user_id] = { name: p.user_name };
  });

  // ── Render editor ──────────────────────────────────────────────────────────
  return (
    <FSMEditor
      initialRegistry={registry}
      currentUser={userProfile.id}
      users={users}
      locks={locks}
      onlineUsers={onlineUsers}
      onSaveFSM={handleSaveFSM}
      onAcquireLock={handleAcquireLock}
      onReleaseLock={handleReleaseLock}
      onLogEvent={handleLogEvent}
      onRefreshLocks={refreshLocks}
      onLogout={handleLogout}
      userProfile={userProfile}
    />
  );
}
