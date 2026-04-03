import { useState, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// FLOATING CHAT — available on every screen
//
// Draggable, resizable, dockable.
// Toggle between live chat and activity history.
// Context-aware: knows which screen you're on.
//
// ═══════════════════════════════════════════════════════════════════════════

const DIM = '#556677';

export default function FloatingChat({ supabase, currentUser, users, activeView }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const endRef = useRef(null);
  const panelRef = useRef(null);

  // Drag state
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [size, setSize] = useState({ w: 0, h: 320 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0, corner: '' });

  const resetPos = () => { setPos({ x: -1, y: -1 }); setSize({ w: 0, h: 320 }); };

  const userName = users?.[currentUser]?.name?.split(' ')[0] || 'there';

  // Load activity log
  useEffect(() => {
    if (!showHistory || !supabase) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('activity_log')
          .select('*')
          .order('occurred_at', { ascending: false })
          .limit(30);
        setActivityLog(data || []);
      } catch (e) { console.error('Log:', e); }
    };
    load();
  }, [showHistory, supabase]);

  const timeAgo = (d) => {
    if (!d) return '';
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 60) return mins + 'm ago';
    if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
    return Math.floor(mins / 1440) + 'd ago';
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    setShowHistory(false);
    // Placeholder response — will wire to Claude API
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I can see you are on the ' + (activeView || 'home') + ' screen. Full AI integration coming soon. For detailed conversations, use the Chat tab.'
      }]);
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, 800);
  };

  // Drag handlers
  const onDragStart = (e) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragStart.current = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top };
    setDragging(true);
    const onMove = (ev) => {
      setPos({
        x: dragStart.current.px + (ev.clientX - dragStart.current.mx),
        y: dragStart.current.py + (ev.clientY - dragStart.current.my),
      });
      if (!size.w) setSize(s => ({ ...s, w: rect.width }));
    };
    const onUp = () => { setDragging(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Resize handlers
  const onResizeStart = (corner) => (e) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: rect.width, h: rect.height, corner };
    const onMove = (ev) => {
      const dx = ev.clientX - resizeStart.current.mx;
      const dy = ev.clientY - resizeStart.current.my;
      const c = resizeStart.current.corner;
      let nw = resizeStart.current.w, nh = resizeStart.current.h;
      if (c.includes('r')) nw += dx;
      if (c.includes('l')) nw -= dx;
      if (c.includes('b')) nh += dy;
      if (c.includes('t')) nh -= dy;
      setSize({ w: Math.max(280, nw), h: Math.max(200, nh) });
      if (pos.x === -1) {
        const r = panelRef.current.getBoundingClientRect();
        setPos({ x: r.left, y: r.top });
      }
      if (c.includes('l')) setPos(p => ({ ...p, x: (p.x === -1 ? panelRef.current.getBoundingClientRect().left : p.x) + dx }));
      if (c.includes('t')) setPos(p => ({ ...p, y: (p.y === -1 ? panelRef.current.getBoundingClientRect().top : p.y) + dy }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Floating button — small, semi-transparent until hover ──
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', right: 12, zIndex: 9998,
        width: 38, height: 38, borderRadius: '50%',
        background: '#4a90d988', border: '1px solid #4a90d944',
        color: '#fff', fontSize: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#4a90d9'; e.currentTarget.style.transform = 'scale(1.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#4a90d988'; e.currentTarget.style.transform = 'scale(1)'; }}
      >{'\uD83D\uDCAC'}</button>
    );
  }

  // ── Chat panel — constrained width, matches app patterns ──
  return (
    <div ref={panelRef} style={{
      position: 'fixed', zIndex: 9998,
      ...(pos.x === -1
        ? { bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', right: 12, width: 340 }
        : { left: pos.x, top: pos.y, width: size.w || 340 }),
      height: size.h,
      background: '#0d1220', border: '1px solid #2a3a4e', borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      cursor: dragging ? 'grabbing' : 'default',
    }}>
      {/* Header — drag handle */}
      <div onMouseDown={onDragStart} style={{
        padding: '8px 12px', borderBottom: '1px solid #1e293b',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'grab', userSelect: 'none', flexShrink: 0,
        background: '#111827',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4a90d9' }}>
            {showHistory ? '\uD83D\uDCCB History' : '\uD83D\uDCAC Chat'}
          </span>
          <span style={{ fontSize: 10, color: DIM }}>
            {activeView || 'home'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {pos.x !== -1 && (
            <button onClick={resetPos} title="Dock" style={{
              background: '#4a90d922', border: '1px solid #4a90d944', borderRadius: 4,
              padding: '2px 6px', color: '#4a90d9', fontSize: 10, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600,
            }}>{'\u21E9'}</button>
          )}
          <button onClick={() => setOpen(false)} style={{
            background: 'none', border: 'none', color: '#8899aa', fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px',
          }}>{'\u2715'}</button>
        </div>
      </div>

      {/* Content — chat or history */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px 10px',
        display: 'flex', flexDirection: 'column', gap: 6,
        scrollbarWidth: 'thin',
      }}>
        {showHistory ? (
          <>
            {activityLog.length === 0 && (
              <div style={{ color: DIM, fontSize: 11, textAlign: 'center', padding: '16px 0' }}>No activity yet</div>
            )}
            {activityLog.map((a, i) => (
              <div key={i} style={{
                padding: '6px 10px', borderRadius: 8,
                background: '#111827', border: '1px solid #1e293b', fontSize: 11, lineHeight: 1.5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: '#4a90d9', fontWeight: 600 }}>{a.user_name || a.user_id}</span>
                  <span style={{ color: DIM, fontSize: 9 }}>{timeAgo(a.occurred_at)}</span>
                </div>
                <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 1 }}>{a.title}</div>
                {a.detail && <div style={{ color: '#8899aa', fontSize: 10 }}>{a.detail}</div>}
              </div>
            ))}
          </>
        ) : (
          <>
            {messages.length === 0 && (
              <div style={{ color: DIM, fontSize: 11, textAlign: 'center', padding: '16px 0', lineHeight: 1.6 }}>
                Ask me anything about what you see.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', padding: '6px 10px', borderRadius: 10,
                background: m.role === 'user' ? '#4a90d922' : '#111827',
                border: '1px solid ' + (m.role === 'user' ? '#4a90d944' : '#1e293b'),
                color: '#e2e8f0', fontSize: 12, lineHeight: 1.5,
              }}>
                {m.content}
              </div>
            ))}
            {loading && <div style={{ color: '#4a90d9', fontSize: 11 }}>Thinking...</div>}
          </>
        )}
        <div ref={endRef} />
      </div>

      {/* Input bar with history toggle */}
      <div style={{
        padding: '6px 10px', borderTop: '1px solid #1e293b',
        display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0,
        background: '#111827',
      }}>
        <button onClick={() => setShowHistory(h => !h)} title={showHistory ? 'Chat' : 'History'}
          style={{
            background: showHistory ? '#4a90d922' : 'transparent',
            border: '1px solid ' + (showHistory ? '#4a90d944' : '#2a3a4e'),
            borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
            color: showHistory ? '#4a90d9' : DIM, fontSize: 11,
            fontFamily: 'inherit', flexShrink: 0,
          }}>{showHistory ? '\uD83D\uDCAC' : '\uD83D\uDCCB'}</button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          placeholder={showHistory ? 'Switch to chat...' : 'Ask...'}
          disabled={showHistory}
          style={{
            flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0',
            fontSize: 13, fontFamily: 'inherit', outline: 'none',
            opacity: showHistory ? 0.4 : 1,
          }}
        />
        <button onClick={sendMessage} disabled={!input.trim() || showHistory} style={{
          background: input.trim() && !showHistory ? '#4a90d9' : '#1e293b',
          border: 'none', borderRadius: 8, padding: '8px 14px',
          color: input.trim() && !showHistory ? '#fff' : DIM, fontSize: 13, fontWeight: 600,
          cursor: input.trim() && !showHistory ? 'pointer' : 'default', fontFamily: 'inherit',
        }}>{'\u2191'}</button>
      </div>

      {/* Resize handles */}
      {[
        { corner: 'tl', top: 0, left: 0, cursor: 'nwse-resize' },
        { corner: 'tr', top: 0, right: 0, cursor: 'nesw-resize' },
        { corner: 'bl', bottom: 0, left: 0, cursor: 'nesw-resize' },
        { corner: 'br', bottom: 0, right: 0, cursor: 'nwse-resize' },
      ].map(h => (
        <div key={h.corner} onMouseDown={onResizeStart(h.corner)}
          style={{ position: 'absolute', width: 16, height: 16, cursor: h.cursor, zIndex: 2,
            top: h.top, bottom: h.bottom, left: h.left, right: h.right,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: 2, background: DIM, opacity: 0.35 }} />
        </div>
      ))}
    </div>
  );
}
