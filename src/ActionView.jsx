import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// HOME SCREEN — FSM-Driven Work Queue
//
// The operator's desk. Shows:
//   1. MY WORK — instances I've been working on (resume where I left off)
//   2. AVAILABLE — things I can act on (FSM says these transitions are mine)
//   3. NOTIFICATIONS — acknowledgements, alerts needing response
//   4. START NEW — operations I'm authorized to begin
//
// Everything is driven by the FSMs. You can't do anything the FSM
// doesn't allow. You can't skip steps. The system guides you.
//
// ═══════════════════════════════════════════════════════════════════════════

const DIM = '#8899aa';
const BLUE = '#4a90d9';   // Orange — primary actions, "my work"
const GREEN = '#4ade80';  // Coral — "waiting for you", positive
const YELLOW = '#e8c060'; // Amber — notifications, warnings
const RED = '#ef4444';    // Red — critical alerts, errors (unchanged intent)
const PURPLE = '#c084fc'; // Amber — shared with you (was purple)

function getGreeting(name) {
  const h = new Date().getHours();
  const first = name?.startsWith('Dr.') ? name?.split(' ').slice(0,2).join(' ') : name?.split(' ')[0] || 'there';
  if (h < 12) return 'Good morning, ' + first;
  if (h < 17) return 'Good afternoon, ' + first;
  return 'Good evening, ' + first;
}

function getDateStr() {
  const d = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
}


// ── Work Item Card — an instance from the work queue ──
function WorkCard({ item, onFire, onPause, onDiscard, onHelp, sectionColor }) {
  const pri = (item.priority || 'normal').toLowerCase();
  const priorityColor = pri === 'critical' ? RED : pri === 'high' ? YELLOW : BLUE;
  const isMine = item.is_mine === true;
  const isPaused = item.session_status === 'paused';
  let actions = item.available_actions || [];
  if (typeof actions === 'string') try { actions = JSON.parse(actions); } catch(e) { actions = []; }
  if (!Array.isArray(actions)) actions = [];

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  return (
    <div style={{
      background: '#111827',
      border: '1px solid ' + (isMine ? BLUE + '44' : '#1e293b'),
      borderLeft: '3px solid ' + (sectionColor || BLUE),
      borderRadius: 10, padding: '14px 16px', marginBottom: 8,
    }}>
      {/* Top: label + status badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: pri === 'normal' ? '#e2e8f0' : priorityColor, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
          {item.instance_label || item.instance_id}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 6 }}>
          {isMine && !isPaused && (
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
              background: BLUE + '22', border: '1px solid ' + BLUE + '44', color: BLUE,
              fontWeight: 700, textTransform: 'uppercase' }}>My work</span>
          )}
          {isPaused && (
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
              background: YELLOW + '22', border: '1px solid ' + YELLOW + '44', color: YELLOW,
              fontWeight: 700, textTransform: 'uppercase' }}>Paused</span>
          )}
        </div>
      </div>

      {/* FSM + State */}
      <div style={{ fontSize: 11, color: '#8899aa', marginBottom: 6 }}>
        {item.fsm_name} {'\u2022'} <span style={{ color: '#c8d4e0', fontWeight: 600 }}>{item.current_state}</span>
      </div>

      {/* Time info */}
      {item.hours_in_state != null && (
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>
          {item.hours_in_state < 1
            ? Math.round(item.hours_in_state * 60) + ' minutes in this state'
            : item.hours_in_state < 24
              ? Math.round(item.hours_in_state) + ' hours in this state'
              : Math.round(item.hours_in_state / 24) + ' days in this state'}
          {isMine && item.last_active ? ' \u2022 Last active: ' + item.last_active : ''}
        </div>
      )}

      {/* FSM action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {actions.map((action, i) => (
          <button key={i} onClick={() => onFire && onFire(item, action)}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: i === 0 ? (isMine ? BLUE : GREEN) : 'transparent',
              border: '1px solid ' + (i === 0 ? (isMine ? BLUE : GREEN) : '#2a3a4e'),
              color: i === 0 ? '#fff' : '#8899aa',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
            }}>
            {isMine && i === 0 ? '\u25B6 Continue: ' : '\u25B6 '}{action.label}
            {action.type === 'compound' ? ' \u2192' : ''}
          </button>
        ))}
      </div>

      {/* Discard confirmation */}
      {confirmDiscard ? (
        <div style={{
          padding: '10px 12px', background: RED + '12', border: '1px solid ' + RED + '44',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 12, color: RED, fontWeight: 600, marginBottom: 8 }}>
            Discard this work? This will cancel the operation entirely.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { onDiscard && onDiscard(item); setConfirmDiscard(false); }}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none',
                background: RED, color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit' }}>Yes, discard</button>
            <button onClick={() => setConfirmDiscard(false)}
              style={{ padding: '8px 16px', borderRadius: 8,
                background: 'transparent', border: '1px solid #2a3a4e',
                color: '#8899aa', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      ) : (
        /* Work controls */
        <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
          <button onClick={() => onPause && onPause(item)}
            style={{ padding: '6px 12px', borderRadius: 6,
              background: 'transparent', border: '1px solid #2a3a4e',
              color: '#8899aa', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}>{'\u23F8'} Return Later</button>
          <button onClick={() => setConfirmDiscard(true)}
            style={{ padding: '6px 12px', borderRadius: 6,
              background: 'transparent', border: '1px solid #2a3a4e',
              color: '#99aabb', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}>{'\u2717'} Discard</button>
          <button onClick={() => onHelp && onHelp(item)}
            style={{ padding: '6px 12px', borderRadius: 6,
              background: 'transparent', border: '1px solid #2a3a4e',
              color: '#99aabb', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
              marginLeft: 'auto',
            }}>{'\u2753'} Help</button>
        </div>
      )}
    </div>
  );
}


// ── Notification Card — acknowledgements and alerts ──
function NotificationCard({ item, onAct }) {
  const isOverdue = item.acknowledge_by && new Date(item.acknowledge_by) < new Date();
  return (
    <button onClick={() => onAct && onAct(item)} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: '#111827',
      border: '1px solid ' + (isOverdue ? RED + '44' : '#1e293b'),
      borderLeft: '3px solid ' + (isOverdue ? RED : YELLOW),
      borderRadius: 10, padding: '12px 14px', marginBottom: 8,
      cursor: 'pointer', fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{'\uD83D\uDD14'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4 }}>
            {isOverdue ? 'Overdue: ' : ''}{item.title}
          </div>
          {item.description && (
            <div style={{ fontSize: 12, color: '#8899aa', marginTop: 4, lineHeight: 1.4 }}>{item.description}</div>
          )}
          <div style={{ fontSize: 11, color: BLUE, marginTop: 4, fontWeight: 500 }}>Tap to respond</div>
        </div>
      </div>
    </button>
  );
}


// ── Start New Card ──
function StartNewCard({ fsm, onStart }) {
  return (
    <button onClick={() => onStart && onStart(fsm)} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', textAlign: 'left',
      background: 'transparent',
      border: '1px solid #1e293b',
      borderRadius: 10, padding: '12px 14px', marginBottom: 6,
      cursor: 'pointer', fontFamily: 'inherit',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <span style={{ fontSize: 18, color: GREEN }}>{'\u2295'}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{fsm.label}</div>
        <div style={{ fontSize: 11, color: DIM }}>{fsm.description}</div>
      </div>
    </button>
  );
}


// ── Shared Item Card — documents/data shared with you ──
function SharedCard({ item, onRespond, sectionColor }) {
  const intentColors = {
    urgent: RED, for_your_approval: YELLOW,
    for_your_review: GREEN, when_convenient: BLUE, fyi: DIM,
  };
  const intentLabels = {
    urgent: 'Urgent — Action Required', for_your_approval: 'For Your Approval',
    for_your_review: 'For Your Review', when_convenient: 'When Convenient', fyi: 'FYI',
  };
  const color = intentColors[item.intent] || BLUE;
  const [showResponse, setShowResponse] = useState(false);
  const [responseMsg, setResponseMsg] = useState('');

  return (
    <div style={{
      border: '1px solid ' + (sectionColor || color) + '44',
      borderLeft: '3px solid ' + (sectionColor || color),
      borderRadius: 10, padding: '14px 16px', marginBottom: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4, flex: 1, minWidth: 0 }}>
          {item.document_name}
        </div>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginLeft: 6,
          background: color + '22', border: '1px solid ' + color + '44', color: color,
          fontWeight: 700, textTransform: 'uppercase',
        }}>{intentLabels[item.intent] || item.intent}</span>
      </div>

      {/* From + time */}
      <div style={{ fontSize: 11, color: '#8899aa', marginBottom: 4 }}>
        From {item.shared_by_name}
        {item.hours_pending != null && ' \u2022 ' + (
          item.hours_pending < 1 ? Math.round(item.hours_pending * 60) + ' min ago'
          : item.hours_pending < 24 ? Math.round(item.hours_pending) + ' hours ago'
          : Math.round(item.hours_pending / 24) + ' days ago'
        )}
      </div>

      {/* Message */}
      {item.message && (
        <div style={{ fontSize: 12, color: '#c8d4e0', lineHeight: 1.5, marginBottom: 8,
          padding: '6px 10px', background: '#0d1220', borderRadius: 6,
        }}>"{item.message}"</div>
      )}

      {/* Response area */}
      {showResponse ? (
        <div style={{ marginTop: 6 }}>
          <textarea value={responseMsg} onChange={e => setResponseMsg(e.target.value)}
            placeholder="Add a note (optional)..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, minHeight: 50,
              background: '#0d1220', border: '1px solid #1e293b', color: '#e2e8f0',
              fontSize: 12, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
              boxSizing: 'border-box', marginBottom: 8,
            }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(item.intent === 'for_your_approval' || item.intent === 'urgent') && (
              <>
                <button onClick={() => { onRespond(item, 'approved', responseMsg); setShowResponse(false); }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: GREEN, color: '#111', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{'\u2713'} Approve</button>
                <button onClick={() => { onRespond(item, 'changes_requested', responseMsg); setShowResponse(false); }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: YELLOW, color: '#111', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Request Changes</button>
              </>
            )}
            {item.intent === 'for_your_review' && (
              <>
                <button onClick={() => { onRespond(item, 'completed', responseMsg); setShowResponse(false); }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: GREEN, color: '#111', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{'\u2713'} Looks Good</button>
                <button onClick={() => { onRespond(item, 'changes_requested', responseMsg); setShowResponse(false); }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: YELLOW, color: '#111', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Suggest Changes</button>
              </>
            )}
            {(item.intent === 'when_convenient' || item.intent === 'fyi') && (
              <button onClick={() => { onRespond(item, 'acknowledged', responseMsg); setShowResponse(false); }}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none',
                  background: BLUE, color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>{'\u2713'} Acknowledge</button>
            )}
            <button onClick={() => setShowResponse(false)}
              style={{ padding: '7px 14px', borderRadius: 8,
                background: 'transparent', border: '1px solid #2a3a4e',
                color: '#8899aa', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button onClick={() => setShowResponse(true)}
            style={{ padding: '7px 14px', borderRadius: 8,
              background: sectionColor || color, color: item.intent === 'fyi' ? '#fff' : '#111',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}>{item.intent === 'for_your_approval' ? '\u2713 Review & Respond'
              : item.intent === 'urgent' ? '\u26A0 Respond Now'
              : item.intent === 'for_your_review' ? '\u270E Review'
              : '\u2713 Acknowledge'}</button>
        </div>
      )}
    </div>
  );
}


// ── Section Header ──
function SectionLabel({ text, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: color || '#99aabb', letterSpacing: 1, textTransform: 'uppercase' }}>
        {text}
      </div>
      {count > 0 && (
        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10,
          background: (color || '#99aabb') + '22', color: color || '#99aabb', fontWeight: 700 }}>
          {count}
        </span>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN HOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function ActionView({ currentUser, users, supabase, onScan }) {
  const [workQueue, setWorkQueue] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sharedItems, setSharedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startableFSMs, setStartableFSMs] = useState([]);
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [shareModal, setShareModal] = useState(null); // { item, step }

  const userName = users?.[currentUser]?.name || currentUser;
  const userRole = users?.[currentUser]?.role || 'executive';

  // ── Morse code U (· · —) for urgent — repeated 3 times ──
  const playUrgent = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const dot = 0.1;   // 100ms
      const dash = 0.3;  // 300ms
      const gap = 0.1;   // 100ms between elements
      const wordGap = 0.4; // 400ms between repetitions
      const freq = 880;

      const playTone = (start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Play · · — three times
      for (let rep = 0; rep < 3; rep++) {
        const base = rep * (dot + gap + dot + gap + dash + wordGap);
        playTone(base, dot);                           // ·
        playTone(base + dot + gap, dot);               // ·
        playTone(base + dot + gap + dot + gap, dash);  // —
      }
    } catch (e) { console.log('Audio:', e.message); }
  }, []);

  // ── Check for critical alerts ──
  const checkCriticalAlerts = useCallback(async () => {
    if (!supabase || !currentUser) return;
    try {
      const { data } = await supabase.rpc('get_critical_alerts', { p_user_id: currentUser });
      const alerts = data || [];
      setCriticalAlerts(alerts);
      // Fire beeps for alerts that should fire
      const toFire = alerts.filter(a => a.should_fire);
      if (toFire.length > 0) {
        playUrgent();
        // Record that alerts fired
        for (const alert of toFire) {
          await supabase.rpc('record_alert_fired', { p_event_id: alert.event_id });
        }
      }
    } catch (e) { console.log('Critical alerts:', e.message); }
  }, [supabase, currentUser, playUrgent]);

  // Poll for critical alerts every 3 minutes
  useEffect(() => {
    checkCriticalAlerts();
    const interval = setInterval(checkCriticalAlerts, 180000);
    return () => clearInterval(interval);
  }, [checkCriticalAlerts]);

  // ── Load work queue from FSM runtime ──
  const loadData = useCallback(async () => {
    if (!supabase || !currentUser) { setLoading(false); return; }
    setLoading(true);

    // 1. Work queue from FSM instances
    try {
      const { data: queue } = await supabase.rpc('my_work_queue', { p_user_id: currentUser });
      setWorkQueue(queue || []);
    } catch (e) {
      console.log('Work queue:', e.message);
      setWorkQueue([]);
    }

    // 2. Notifications (acknowledgements)
    try {
      const { data: acks } = await supabase
        .from('acknowledgements').select('*')
        .eq('required_by', currentUser).eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications(acks || []);
    } catch (e) {
      console.log('Acks:', e.message);
      setNotifications([]);
    }

    // 3. Shared items
    try {
      const { data: shares } = await supabase.rpc('my_shared_items', { p_user_id: currentUser });
      setSharedItems(shares || []);
    } catch (e) {
      console.log('Shares:', e.message);
      setSharedItems([]);
    }

    // 4. Startable FSMs (based on role)
    const starters = [];
    if (['executive', 'platform-admin', 'operations-lead'].includes(userRole)) {
      starters.push(
        { name: 'Cuba Export Controller', label: 'New Shipment', description: 'Start a new export operation to Cuba' },
        { name: 'Daily Operations', label: 'New Operations Day', description: 'Open a new business day' }
      );
    }
    if (['executive', 'platform-admin', 'operations-lead', 'division-chief'].includes(userRole)) {
      starters.push(
        { name: 'Supplier Purchase Cycle', label: 'New Purchase Order', description: 'Order products from a supplier' }
      );
    }
    setStartableFSMs(starters);

    setLoading(false);
  }, [supabase, currentUser, userRole]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Handle notification acknowledgement ──
  const handleAck = async (item) => {
    if (!supabase) return;
    try {
      await supabase.from('acknowledgements').update({
        status: 'acknowledged', acknowledged_at: new Date().toISOString(),
        acknowledged_by: currentUser, updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      loadData();
    } catch (e) { console.log('Ack failed:', e.message); }
  };

  // ── Handle fire transition — execute an FSM action ──
  const handleFire = async (item, action) => {
    if (!supabase || !action) return;
    try {
      const { data, error } = await supabase.rpc('fire_transition', {
        p_instance_id: item.instance_id,
        p_transition_id: action.id,
        p_user_id: currentUser,
        p_data: {},
      });
      if (error) throw error;
      console.log('Fired:', data);
      loadData(); // Refresh to show updated state
    } catch (e) {
      console.log('Fire transition:', e.message);
      alert('Could not fire transition: ' + e.message);
    }
  };

  // ── Handle start new ──
  const handleStartNew = async (fsm) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.rpc('start_instance', {
        p_fsm_name: fsm.name,
        p_user_id: currentUser,
      });
      console.log('Started:', data);
      loadData();
    } catch (e) { console.log('Start:', e.message); }
  };

  // ── Handle Return Later — pause work, save place ──
  const handlePause = async (item) => {
    if (!supabase) return;
    try {
      await supabase.rpc('pause_work', {
        p_instance_id: item.instance_id,
        p_user_id: currentUser,
      });
      loadData();
    } catch (e) { console.log('Pause:', e.message); }
  };

  // ── Handle Discard — cancel the instance ──
  const handleDiscard = async (item) => {
    if (!supabase) return;
    try {
      await supabase.from('fsm_instances').update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', item.instance_id);
      // Also cancel any active children
      await supabase.from('fsm_instances').update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('parent_instance_id', item.instance_id).eq('status', 'active');
      // Close work session
      await supabase.from('work_sessions').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('instance_id', item.instance_id).eq('user_id', currentUser).in('status', ['active', 'paused']);
      loadData();
    } catch (e) { console.log('Discard:', e.message); }
  };

  // ── Handle Help — context-aware advice ──
  const [helpItem, setHelpItem] = useState(null);
  const handleHelp = (item) => {
    setHelpItem(helpItem?.instance_id === item.instance_id ? null : item);
  };

  // ── Handle acknowledge critical alert — stops the beeping ──
  const handleAcknowledgeAlert = async (alert) => {
    if (!supabase) return;
    try {
      await supabase.rpc('acknowledge_alert', {
        p_event_id: alert.event_id,
        p_user_id: currentUser,
      });
      setCriticalAlerts(prev => prev.filter(a => a.event_id !== alert.event_id));
    } catch (e) { console.log('Ack alert:', e.message); }
  };

  // ── Handle respond to shared document ──
  const handleShareResponse = async (share, status, message) => {
    if (!supabase) return;
    try {
      await supabase.rpc('respond_to_share', {
        p_share_id: share.share_id,
        p_user_id: currentUser,
        p_status: status,
        p_message: message || null,
      });
      setSharedItems(prev => prev.filter(s => s.share_id !== share.share_id));
    } catch (e) { console.log('Share response:', e.message); }
  };

  // ── Separate work queue into mine and available ──
  const myWork = workQueue.filter(w => w.is_mine);
  const available = workQueue.filter(w => !w.is_mine);
  const totalActions = myWork.length + available.length + notifications.length + criticalAlerts.length + sharedItems.length;

  // ── RENDER ──
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px' }}>

      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
            {getGreeting(userName)}
          </h1>
          <p style={{ color: DIM, fontSize: 12, margin: '4px 0 0' }}>{getDateStr()}</p>
        </div>
        <button onClick={loadData}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #1e293b',
            background: 'transparent', color: '#99aabb', fontSize: 13,
            fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          {'\uD83D\uDD04'}
        </button>
      </div>

      {/* ── CRITICAL ALERTS — red banner with acknowledge ── */}
      {criticalAlerts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {criticalAlerts.map(alert => (
            <div key={alert.event_id} style={{
              background: '#e0303015', border: '1px solid #e0303060',
              borderLeft: '4px solid #e03030', borderRadius: 10,
              padding: '14px 16px', marginBottom: 8,
              animation: 'criticalPulse 2s infinite',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f08080', lineHeight: 1.4 }}>
                  {'\uD83D\uDD14'} {alert.title}
                </div>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, flexShrink: 0, marginLeft: 6,
                  background: '#e0303030', color: '#f08080', fontWeight: 700, textTransform: 'uppercase'
                }}>Critical</span>
              </div>
              <div style={{ fontSize: 11, color: '#cc8888', marginBottom: 8 }}>
                {alert.days_from_now === 0 ? 'Today' : alert.days_from_now < 0 ? Math.abs(alert.days_from_now) + ' days overdue' : 'In ' + alert.days_from_now + ' days'}
                {alert.alert_fire_count > 0 && ' \u2022 Alerted ' + alert.alert_fire_count + ' time' + (alert.alert_fire_count > 1 ? 's' : '')}
              </div>
              <button onClick={() => handleAcknowledgeAlert(alert)} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#e03030', color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}>Acknowledge</button>
            </div>
          ))}
        </div>
      )}

      {/* Quick action — Scan Document */}
      {!loading && (
        <button onClick={onScan} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '12px', marginBottom: 16,
          background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
          color: '#e2e8f0', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{ fontSize: 18 }}>{'\uD83D\uDCF7'}</span>
          Scan or Upload Document
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: BLUE, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
          Loading your work queue...
        </div>
      )}

      {/* Summary */}
      {!loading && totalActions > 0 && (
        <div style={{ fontSize: 14, color: '#8899aa', lineHeight: 1.5, marginBottom: 4 }}>
          {myWork.length > 0
            ? 'You have ' + myWork.length + ' item' + (myWork.length > 1 ? 's' : '') + ' in progress'
              + (available.length > 0 ? ' and ' + available.length + ' waiting for you.' : '.')
            : available.length > 0
              ? available.length + ' item' + (available.length > 1 ? 's' : '') + ' waiting for you.'
              : ''
          }
          {notifications.length > 0 &&
            (totalActions > notifications.length ? ' Plus ' : '') +
            notifications.length + ' notification' + (notifications.length > 1 ? 's' : '') + '.'
          }
        </div>
      )}

      {/* All clear */}
      {!loading && totalActions === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u2713'}</div>
          <div style={{ color: GREEN, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>All clear</div>
          <div style={{ color: '#8899aa', fontSize: 14, lineHeight: 1.5 }}>
            Nothing needs your attention right now. Start a new operation below, or check the Dashboard.
          </div>
        </div>
      )}

      {/* ── MY WORK — instances I've been working on ── */}
      {myWork.length > 0 && (
        <>
          <SectionLabel text="My work" count={myWork.length} color={BLUE} />
          {myWork.map((item, i) => (
            <>
              <WorkCard key={'m' + i} item={item} sectionColor={BLUE} onFire={handleFire} onPause={handlePause} onDiscard={handleDiscard} onHelp={handleHelp} />
              {helpItem?.instance_id === item.instance_id && (
                <div key={'mh' + i} style={{ padding: '12px 14px', background: '#0f1724', border: '1px solid ' + BLUE + '44',
                  borderLeft: '3px solid ' + BLUE, borderRadius: 10, marginBottom: 8, marginTop: -4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: BLUE, marginBottom: 6 }}>{'\u2753'} Help</div>
                  <div style={{ fontSize: 12, color: '#c8d4e0', lineHeight: 1.6 }}>
                    You are working on <strong>{item.instance_label}</strong>, currently in state <strong>{item.current_state}</strong>.
                    {(() => { let acts = item.available_actions || []; if (typeof acts === 'string') try { acts = JSON.parse(acts); } catch(e) { acts = []; } return acts.length > 0 ? ' Available actions: ' + acts.map(a => a.label).join(', ') + '.' : ''; })()}
                  </div>
                  <div style={{ fontSize: 11, color: '#8899aa', marginTop: 6, lineHeight: 1.5 }}>
                    {'\u23F8'} <strong>Return Later</strong> — saves your work and releases the lock. You can resume anytime.
                    {'\u00A0\u00A0'}{'\u2717'} <strong>Discard</strong> — cancels this operation entirely. Cannot be undone.
                  </div>
                  <button onClick={() => setHelpItem(null)} style={{ marginTop: 8, padding: '4px 12px', borderRadius: 6,
                    background: 'transparent', border: '1px solid #2a3a4e', color: '#8899aa', fontSize: 11,
                    cursor: 'pointer', fontFamily: 'inherit' }}>Close help</button>
                </div>
              )}
            </>
          ))}
        </>
      )}

      {/* ── SHARED WITH YOU — documents and data shared by others ── */}
      {sharedItems.length > 0 && (
        <>
          <SectionLabel text="Shared with you" count={sharedItems.length} color={PURPLE} />
          {sharedItems.map((item, i) => (
            <SharedCard key={"sh" + i} item={item} onRespond={handleShareResponse} sectionColor={PURPLE} />
          ))}
        </>
      )}

      {/* ── AVAILABLE — things waiting for me ── */}
      {available.length > 0 && (
        <>
          <SectionLabel text="Waiting for you" count={available.length} color={GREEN} />
          {available.map((item, i) => (
            <>
              <WorkCard key={'a' + i} item={item} sectionColor={GREEN} onFire={handleFire} onPause={handlePause} onDiscard={handleDiscard} onHelp={handleHelp} />
              {helpItem?.instance_id === item.instance_id && (
                <div key={'ah' + i} style={{ padding: '12px 14px', background: '#0f1724', border: '1px solid ' + GREEN + '44',
                  borderLeft: '3px solid ' + GREEN, borderRadius: 10, marginBottom: 8, marginTop: -4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 6 }}>{'\u2753'} Help</div>
                  <div style={{ fontSize: 12, color: '#c8d4e0', lineHeight: 1.6 }}>
                    <strong>{item.instance_label}</strong> is waiting for you. It is in state <strong>{item.current_state}</strong>.
                    {(() => { let acts = item.available_actions || []; if (typeof acts === 'string') try { acts = JSON.parse(acts); } catch(e) { acts = []; } return acts.length > 0 ? ' You can: ' + acts.map(a => a.label).join(', ') + '.' : ''; })()}
                  </div>
                  <div style={{ fontSize: 11, color: '#8899aa', marginTop: 6, lineHeight: 1.5 }}>
                    Tap an action button to begin. Your progress will be saved automatically.
                  </div>
                  <button onClick={() => setHelpItem(null)} style={{ marginTop: 8, padding: '4px 12px', borderRadius: 6,
                    background: 'transparent', border: '1px solid #2a3a4e', color: '#8899aa', fontSize: 11,
                    cursor: 'pointer', fontFamily: 'inherit' }}>Close help</button>
                </div>
              )}
            </>
          ))}
        </>
      )}

      {/* ── NOTIFICATIONS — acknowledgements ── */}
      {notifications.length > 0 && (
        <>
          <SectionLabel text="Notifications" count={notifications.length} color={YELLOW} />
          {notifications.map((item, i) => (
            <NotificationCard key={'n' + i} item={item} onAct={handleAck} />
          ))}
        </>
      )}

      {/* ── START NEW — operations you can begin ── */}
      {!loading && startableFSMs.length > 0 && (
        <>
          <SectionLabel text="Start new" color={DIM} />
          {startableFSMs.map((fsm, i) => (
            <StartNewCard key={'s' + i} fsm={fsm} onStart={handleStartNew} />
          ))}
        </>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
        <span style={{ color: '#2a3a4e', fontSize: 10, letterSpacing: 1 }}>FSM DRIVE</span>
      </div>
      <style>{`@keyframes criticalPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.85; } }`}</style>
    </div>
  );
}


