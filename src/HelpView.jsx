import { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// HELP VIEW — Context-Aware Assistant
//
// Knows who you are, what role you have, where you were,
// and what you were likely doing. Help is specific, not generic.
//
// "I know this is your first time doing a purchase order with me,
//  would you like me to give you a brief overview?"
//
// ═══════════════════════════════════════════════════════════════════════════

const CONTEXT_HELP = {
  action: {
    title: 'Home Screen',
    description: 'Your daily briefing — what needs your attention today.',
    topics: [
      { q: 'What do the items on my home screen mean?', a: 'Each item is something FSM Drive noticed that may need your attention. Tap any item to see details. Items are sorted by priority — the most urgent appear first.' },
      { q: 'How do I respond to an acknowledgement?', a: 'Tap the acknowledgement card. Review the details, then tap Confirm to acknowledge it. If you need more time, the system will remind you.' },
      { q: 'Why am I not seeing any items?', a: 'Your home screen only shows items that need your attention. If it is quiet, that means everything is on track. You can check the Dashboard for a full overview.' },
    ],
  },
  dashboard: {
    title: 'Operations Dashboard',
    description: 'A live view of everything happening in your business.',
    topics: [
      { q: 'What do the colored dots mean?', a: 'Green means on track. Yellow means something needs attention soon. Red means action is required now.' },
      { q: 'What does "needs action" mean on a card?', a: 'A red badge means there are items in that category waiting for someone to act — an overdue invoice, a pending approval, or a document that needs review.' },
      { q: 'How often does the dashboard update?', a: 'The dashboard loads live data from Supabase each time you open it. Tap Refresh at the bottom to reload.' },
      { q: 'How do I see details about a shipment?', a: 'Tap the Shipments card. You will see each shipment with its costs, revenue, and current status.' },
    ],
  },
  workspace: {
    title: 'Chat',
    description: 'Talk to FSM Drive in natural language. Ask questions, give instructions, get answers.',
    topics: [
      { q: 'What can I ask?', a: 'Anything about your business. "How are we doing this month?" "What shipments are in transit?" "Draft a PO for 50 cases of cheddar." "What does Helen need to do today?" FSM Drive understands your business context.' },
      { q: 'Can I use voice?', a: 'Yes. Tap the microphone button and speak. FSM Drive understands English and Spanish. You can even mix languages in the same conversation.' },
      { q: 'Does it remember previous conversations?', a: 'Yes. FSM Drive maintains conversation history so you can reference earlier discussions.' },
    ],
  },
  editor: {
    title: 'FSM Editor',
    description: 'Design and modify finite state machines that drive your business processes.',
    topics: [
      { q: 'What is a state?', a: 'A state is a condition your business process is in — not an activity. For example, "Order Placed" is a state. "Placing an order" is an activity that happens on a transition.' },
      { q: 'What is a transition?', a: 'A transition is what moves the process from one state to another. It can be atomic (a single action) or compound (an entire sub-process that runs to completion).' },
      { q: 'How do I add a state?', a: 'Tap the \u2295 State button in the left panel. A new state will be created and the States tab will open so you can name it and set its type.' },
      { q: 'How do I delete something?', a: 'First, select a state or transition by tapping its card in the left panel. It will highlight. Then tap the \u2296 State or \u2296 Transition button. This two-step process prevents accidental deletion.' },
      { q: 'What is a compound transition?', a: 'A compound transition contains an entire embedded FSM. When the transition fires, the embedded FSM runs to completion before the parent FSM advances. This is how complex processes are decomposed into manageable pieces.' },
      { q: 'How do I drill into a compound transition?', a: 'Click the \u25B6 label on a dashed (compound) arrow in the diagram, or click "Open" in the transition details. The breadcrumb at the top shows where you are in the hierarchy.' },
    ],
  },
};

const ROLE_TIPS = {
  executive: 'As an executive, you have access to all areas — Dashboard for overview, Editor for process design, and Chat for questions.',
  'operations-lead': 'As operations lead, you can monitor shipments, review documents, and manage day-to-day activities from the Dashboard.',
  'division-chief': 'As division chief, your Dashboard shows your division activity. Acknowledgements route to you for approval.',
  'warehouse-worker': 'Your home screen shows tasks assigned to you — shipments to load, deliveries to confirm. Tap each item for instructions.',
  'finance-manager': 'Your Dashboard focuses on invoices, payments, and adjustments. Items needing financial approval will appear on your home screen.',
};


function HelpTopic({ q, a, expanded, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: 'block', width: '100%', textAlign: 'left', background: expanded ? '#111827' : 'transparent',
      border: '1px solid ' + (expanded ? '#2a3a4e' : '#1e293b'), borderRadius: 8,
      padding: '12px 14px', marginBottom: 6, cursor: 'pointer',
      fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4 }}>{q}</div>
        <span style={{ color: '#8899aa', fontSize: 14, flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s' }}>{'\u25BE'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#8899aa', lineHeight: 1.6, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
          {a}
        </div>
      )}
    </button>
  );
}


export default function HelpView({ currentUser, users, supabase, activeContext, onBack }) {
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [activityCount, setActivityCount] = useState(null);
  const [askInput, setAskInput] = useState('');

  const userName = users?.[currentUser]?.name?.split(' ')[0] || 'there';
  const userRole = users?.[currentUser]?.role || 'executive';
  const context = CONTEXT_HELP[activeContext] || CONTEXT_HELP.action;

  // Check user's experience level
  useEffect(() => {
    if (!supabase || !currentUser) return;
    const checkActivity = async () => {
      try {
        const { count } = await supabase
          .from('activity_log')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUser);
        setActivityCount(count || 0);
      } catch (e) { setActivityCount(null); }
    };
    checkActivity();
  }, [supabase, currentUser]);

  const isNewUser = activityCount !== null && activityCount < 5;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'none', border: '1px solid #2a3a4e', borderRadius: 6,
            color: '#8899aa', fontSize: 13, padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
          }}>{'\u2190'} Back</button>
        )}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Help</div>
          <div style={{ fontSize: 11, color: '#8899aa' }}>Context: {context.title}</div>
        </div>
      </div>

      {/* ── DOCUMENTATION — Search or Download ── */}
      <div style={{
        background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
        padding: '16px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>
          {'\uD83D\uDCD6'} FSM Drive Documentation
        </div>

        {/* Search with Chat */}
        <button onClick={() => {
          if (onBack) onBack();
          // Future: navigate to Chat with documentation search mode
        }} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
          background: '#4a90d912', border: '1px solid #4a90d944', borderRadius: 8,
          padding: '12px 14px', marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{ fontSize: 20 }}>{'\uD83D\uDCAC'}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4a90d9' }}>Ask a question</div>
            <div style={{ fontSize: 11, color: '#8899aa' }}>Chat searches both manuals and your business data</div>
          </div>
        </button>

        {/* Download User's Manual — visible to all */}
        <button onClick={() => {
          // Future: download from Supabase storage
          window.open('/FSM_Drive_Users_Manual_v2_illustrated.docx', '_blank');
        }} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
          background: 'transparent', border: '1px solid #1e293b', borderRadius: 8,
          padding: '12px 14px', marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <span style={{ fontSize: 20 }}>{'\uD83D\uDCE5'}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Download User's Manual</div>
            <div style={{ fontSize: 11, color: '#8899aa' }}>How to run your business with FSM Drive</div>
          </div>
        </button>

        {/* Download Owner's Manual — executives only */}
        {['executive', 'platform-admin', 'owner'].includes(userRole) && (
          <button onClick={() => {
            window.open('/FSM_Drive_Owners_Manual_v2_illustrated.docx', '_blank');
          }} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
            background: 'transparent', border: '1px solid #1e293b', borderRadius: 8,
            padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 20 }}>{'\uD83D\uDCE5'}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Download Owner's Manual</div>
              <div style={{ fontSize: 11, color: '#8899aa' }}>How to operate and administer FSM Drive</div>
            </div>
          </button>
        )}
      </div>

      {/* Proactive greeting */}
      <div style={{
        background: '#111827', border: '1px solid #4a90d944', borderLeft: '3px solid #4a90d9',
        borderRadius: 10, padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.6, marginBottom: 6 }}>
          {isNewUser
            ? `Hi ${userName}, I see you are just getting started. Would you like a quick overview of what you can do here?`
            : `Hi ${userName}, you were on the ${context.title}. ${context.description} How can I help?`}
        </div>
        {ROLE_TIPS[userRole] && (
          <div style={{ fontSize: 12, color: '#8899aa', lineHeight: 1.5, marginTop: 4 }}>
            {ROLE_TIPS[userRole]}
          </div>
        )}
      </div>

      {/* New user welcome */}
      {isNewUser && (
        <div style={{
          background: '#4ade8012', border: '1px solid #4ade8044', borderRadius: 10,
          padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginBottom: 6 }}>
            {'\u2B50'} Quick Start Guide
          </div>
          <div style={{ fontSize: 12, color: '#8899aa', lineHeight: 1.6 }}>
            <div style={{ marginBottom: 6 }}><strong style={{ color: '#e2e8f0' }}>{'\uD83C\uDFE0'} Home</strong> — Your daily briefing. Items needing your attention appear here automatically.</div>
            <div style={{ marginBottom: 6 }}><strong style={{ color: '#e2e8f0' }}>{'\uD83D\uDCCA'} Dashboard</strong> — Full operations view. Shipments, invoices, documents, everything at a glance.</div>
            <div style={{ marginBottom: 6 }}><strong style={{ color: '#e2e8f0' }}>{'\uD83D\uDCAC'} Chat</strong> — Talk to FSM Drive. Ask anything about your business in English or Spanish.</div>
            <div><strong style={{ color: '#e2e8f0' }}>{'\u2753'} Help</strong> — You are here. Context-aware help based on what you are doing.</div>
          </div>
        </div>
      )}

      {/* Context-specific topics */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#99aabb', letterSpacing: 1,
        textTransform: 'uppercase', marginBottom: 8 }}>
        Common questions about {context.title}
      </div>

      {context.topics.map((topic, i) => (
        <HelpTopic key={i} q={topic.q} a={topic.a}
          expanded={expandedTopic === i}
          onToggle={() => setExpandedTopic(expandedTopic === i ? null : i)} />
      ))}

      {/* Ask anything */}
      <div style={{ marginTop: 20, fontSize: 12, fontWeight: 700, color: '#99aabb', letterSpacing: 1,
        textTransform: 'uppercase', marginBottom: 8 }}>
        Ask anything
      </div>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        background: '#111827', border: '1px solid #1e293b', borderRadius: 10,
        padding: '8px 12px',
      }}>
        <input
          value={askInput}
          onChange={e => setAskInput(e.target.value)}
          placeholder="Type your question..."
          style={{
            flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0',
            fontSize: 14, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button onClick={() => {
          if (askInput.trim() && onBack) {
            // In the future: route to Chat with the question prefilled
            onBack();
          }
        }} style={{
          background: askInput.trim() ? '#4a90d9' : '#1e293b',
          border: 'none', borderRadius: 8, padding: '8px 16px',
          color: askInput.trim() ? '#fff' : '#8899aa', fontSize: 13, fontWeight: 600,
          cursor: askInput.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}>
          Ask
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#8899aa', marginTop: 6, textAlign: 'center' }}>
        Or tap Chat in the nav bar to have a full conversation
      </div>

      {/* Version info */}
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#334455' }}>
        FSM Drive {'\u2022'} E.L. Stull & Associates, Inc.
      </div>
    </div>
  );
}
