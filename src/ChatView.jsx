import { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// CHAT VIEW — Dashboard-style layout for conversations and history
//
// Same visual language as the Dashboard:
// - Summary cards at top
// - Clean sections
// - Consistent spacing and colors
//
// ═══════════════════════════════════════════════════════════════════════════

const DIM = '#8899aa';
const BLUE = '#4a90d9';
const GREEN = '#4ade80';


export default function ChatView({ currentUser, users, supabase }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('chat'); // 'chat' or 'history'
  const [activityLog, setActivityLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const endRef = useRef(null);

  const userName = users?.[currentUser]?.name?.split(' ')[0] || 'there';

  // Load activity log
  const loadHistory = useCallback(async () => {
    if (!supabase) return;
    setLogLoading(true);
    try {
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(50);
      setActivityLog(data || []);
    } catch (e) { console.error('Log:', e); }
    setLogLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (view === 'history') loadHistory();
  }, [view, loadHistory]);

  const timeAgo = (d) => {
    if (!d) return '';
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 60) return mins + 'm ago';
    if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
    return Math.floor(mins / 1440) + 'd ago';
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    const userMsg = { role: 'user', content: msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('chat-query', {
        body: { message: msg, history, userId: currentUser, userName: users?.[currentUser]?.name || currentUser },
      });
      if (error) throw error;
      const reply = data?.reply || 'I had trouble connecting. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'I had trouble reaching the server. Check your connection and try again.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
          Chat
        </div>
        <div style={{ fontSize: 12, color: DIM }}>
          Ask FSM Drive anything about your business
        </div>
      </div>

      {/* Tab toggle — same style as Dashboard drill-in */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button onClick={() => setView('chat')} style={{
          flex: 1, padding: '10px', textAlign: 'center', borderRadius: 8,
          background: view === 'chat' ? '#111827' : 'transparent',
          border: '1px solid ' + (view === 'chat' ? BLUE : '#1e293b'),
          color: view === 'chat' ? BLUE : DIM, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}>{'\uD83D\uDCAC'} Conversation</button>
        <button onClick={() => setView('history')} style={{
          flex: 1, padding: '10px', textAlign: 'center', borderRadius: 8,
          background: view === 'history' ? '#111827' : 'transparent',
          border: '1px solid ' + (view === 'history' ? BLUE : '#1e293b'),
          color: view === 'history' ? BLUE : DIM, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}>{'\uD83D\uDCCB'} Activity History</button>
      </div>

      {/* ── CONVERSATION VIEW ── */}
      {view === 'chat' && (
        <>
          {/* Messages */}
          <div style={{
            background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
            padding: '12px', minHeight: 300, maxHeight: 'calc(100vh - 340px)',
            overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
            marginBottom: 12,
          }}>
            {messages.length === 0 && (
              <div style={{ color: DIM, fontSize: 13, textAlign: 'center', padding: '40px 16px', lineHeight: 1.8 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{'\uD83D\uDCAC'}</div>
                Hi {userName}, I am FSM Drive.
                <br />Ask me anything about your business.
                <br /><span style={{ fontSize: 11, color: '#445566' }}>Try: "What needs my attention?" or "How are shipments doing?"</span>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 14,
                  background: m.role === 'user' ? BLUE + '22' : '#0a0e17',
                  border: '1px solid ' + (m.role === 'user' ? BLUE + '44' : '#1e293b'),
                  color: '#e2e8f0', fontSize: 13, lineHeight: 1.6,
                }}>
                  {m.content}
                </div>
                <span style={{ fontSize: 9, color: DIM, marginTop: 2, padding: '0 6px' }}>{m.time}</span>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: BLUE, fontSize: 12, padding: '4px 8px' }}>
                <span style={{ animation: 'pulse 1s infinite' }}>{'\u25CF'}</span> Thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
            padding: '10px 14px',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
              placeholder="Type your message..."
              style={{
                flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0',
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button onClick={sendMessage} disabled={!input.trim()} style={{
              background: input.trim() ? BLUE : '#1e293b',
              border: 'none', borderRadius: 8, padding: '10px 16px',
              color: input.trim() ? '#fff' : DIM, fontSize: 14, fontWeight: 600,
              cursor: input.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}>{'\u2191'}</button>
          </div>
        </>
      )}

      {/* ── ACTIVITY HISTORY VIEW ── */}
      {view === 'history' && (
        <>
          {logLoading && (
            <div style={{ textAlign: 'center', padding: '20px', color: BLUE, fontSize: 13 }}>Loading history...</div>
          )}
          {!logLoading && activityLog.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: DIM, fontSize: 13 }}>
              No activity recorded yet. Run the demo to see activity here.
            </div>
          )}
          {activityLog.map((a, i) => (
            <div key={i} style={{
              background: '#111827', border: '1px solid #1e293b', borderRadius: 10,
              padding: '12px 14px', marginBottom: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                    {a.user_name || a.user_id}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: DIM }}>{timeAgo(a.occurred_at)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#c8d4e0', fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
              {a.detail && <div style={{ fontSize: 12, color: '#8899aa', lineHeight: 1.5 }}>{a.detail}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {a.action_type && (
                  <span style={{ fontSize: 10, color: DIM, background: '#0a0e17', border: '1px solid #1e293b',
                    padding: '2px 8px', borderRadius: 4 }}>{a.action_type}</span>
                )}
                {a.entity_id && (
                  <span style={{ fontSize: 10, color: BLUE, background: BLUE + '12', border: '1px solid ' + BLUE + '33',
                    padding: '2px 8px', borderRadius: 4 }}>{a.entity_id}</span>
                )}
                {a.division && (
                  <span style={{ fontSize: 10, color: DIM, background: '#0a0e17', border: '1px solid #1e293b',
                    padding: '2px 8px', borderRadius: 4 }}>{a.division}</span>
                )}
              </div>
            </div>
          ))}
          {!logLoading && activityLog.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={loadHistory} style={{
                background: 'none', border: '1px solid #2a3a4e', borderRadius: 8,
                color: '#8899aa', fontSize: 11, padding: '8px 20px', cursor: 'pointer',
                fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
              }}>Refresh</button>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
