import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ═══════════════════════════════════════════════════════════════════════════
// CHAT VIEW — Dashboard-style layout for conversations and history
//
// Same visual language as the Dashboard:
// - Summary cards at top
// - Clean sections
// - Consistent spacing and colors
// - Voice input via Web Speech API
//
// ═══════════════════════════════════════════════════════════════════════════

const DIM = '#8899aa';
const BLUE = '#4a90d9';
const GREEN = '#4ade80';
const RED = '#e03030';


export default function ChatView({ currentUser, users, supabase }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('chat'); // 'chat' or 'history'
  const [activityLog, setActivityLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const endRef = useRef(null);
  const recognitionRef = useRef(null);

  // ── Voice input setup ──
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? prev + ' ' + transcript : transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.abort(); } catch {}
    };
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Voice start error:', e);
      }
    }
  };

  const hasVoice = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const handleCopy = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

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
    // Stop listening if voice is active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    const msg = input.trim();
    setInput('');
    const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user', content: msg, time: time() };
    const history = [...messages, userMsg].slice(-12).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', pending: true, time: time() }]);
    setLoading(true);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const { data, error } = await supabase.functions.invoke('chat-query', {
        body: { message: msg, history, userId: currentUser, userName: users?.[currentUser]?.name || currentUser },
      });
      if (error) throw error;
      const reply = data?.reply || 'I had trouble connecting. Please try again.';
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.pending
          ? { role: 'assistant', content: reply, time: time() }
          : m
      ));
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.pending
          ? { role: 'assistant', content: 'I had trouble reaching the server. Check your connection and try again.', time: time() }
          : m
      ));
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

      {/* Tab toggle */}
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
            background: '#111827', border: '1px solid #3a4a5e', borderRadius: 12,
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
                  border: '1px solid ' + (m.role === 'user' ? BLUE + '88' : '#3a4a5e'),
                  color: '#e2e8f0', fontSize: 13, lineHeight: 1.6,
                }}>
                  {m.role === 'assistant' ? (
                    m.pending ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: BLUE, fontSize: 12 }}>
                        <span style={{ animation: 'pulse 1s infinite' }}>{'\u25CF'}</span> Thinking...
                      </div>
                    ) : (
                      <div className="chat-md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    )
                  ) : (
                    <div>{m.content}</div>
                  )}
                  {!m.pending && (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 8, marginTop: 6,
                    }}>
                      <span style={{ fontSize: 9, color: DIM }}>{m.time}</span>
                      {m.role === 'assistant' && (
                        <button
                          onClick={() => handleCopy(m.content, i)}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: copiedIndex === i ? GREEN : DIM, fontSize: 10,
                            padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          {copiedIndex === i ? '\u2713 Copied!' : '\uD83D\uDCCB Copy'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input with voice button */}
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            background: '#111827', border: '1px solid #3a4a5e', borderRadius: 12,
            padding: '10px 14px',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
              placeholder={isListening ? 'Listening...' : 'Type your message...'}
              style={{
                flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0',
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
            {hasVoice && (
              <button onClick={toggleVoice} title={isListening ? 'Stop listening' : 'Voice input'} style={{
                width: 38, height: 38, borderRadius: '50%',
                background: isListening ? RED : 'transparent',
                border: '1px solid ' + (isListening ? RED : '#3a4a5e'),
                color: isListening ? '#fff' : DIM, fontSize: 16,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontFamily: 'inherit',
                animation: isListening ? 'pulse 1s infinite' : 'none',
                WebkitTapHighlightColor: 'transparent',
              }}>{'\uD83C\uDF99'}</button>
            )}
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

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        .chat-md p { margin: 0 0 8px 0; }
        .chat-md p:last-child { margin-bottom: 0; }
        .chat-md h1 { font-size: 16px; font-weight: 700; margin: 8px 0 6px; color: #fff; }
        .chat-md h2 { font-size: 14px; font-weight: 700; margin: 8px 0 6px; color: #fff; }
        .chat-md h3 { font-size: 13px; font-weight: 700; margin: 6px 0 4px; color: #fff; }
        .chat-md strong { color: #fff; font-weight: 700; }
        .chat-md ul, .chat-md ol { margin: 4px 0 8px 0; padding-left: 20px; }
        .chat-md li { margin: 2px 0; }
        .chat-md code { background: #1e293b; color: #f0f0f0; padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; }
        .chat-md pre { background: #050810; border: 1px solid #2a3a4e; border-radius: 6px; padding: 10px; overflow-x: auto; margin: 6px 0; }
        .chat-md pre code { background: transparent; padding: 0; font-size: 11px; color: #e2e8f0; }
        .chat-md table { border-collapse: collapse; margin: 8px 0; width: 100%; font-size: 12px; }
        .chat-md th, .chat-md td { border: 1px solid #3a4a5e; padding: 6px 10px; text-align: left; }
        .chat-md th { background: #1a2332; font-weight: 700; color: #fff; }
        .chat-md a { color: #4a90d9; text-decoration: underline; }
        .chat-md blockquote { border-left: 3px solid #4a90d9; padding-left: 10px; margin: 6px 0; color: #c8d4e0; }
      `}</style>
    </div>
  );
}
