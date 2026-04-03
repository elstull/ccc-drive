import { useState, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════
// FSM Drive: Conversation Workspace
// File-based, topic-partitioned conversations with rich content
// ═══════════════════════════════════════════════════════════════════

const THEMES = {
  dark: {
    bg: "#0a0e17", surface: "#141a26", surfaceAlt: "#1a2236", border: "#2a3448",
    text: "#e2e8f0", textDim: "#8892a4", textMuted: "#5a647a",
    accent: "#4f8eff", accentDim: "#4f8eff33", success: "#34d399", warning: "#fbbf24",
    error: "#ef4444", compound: "#c084fc",
    userBubble: "#1e3a5f", aiBubble: "#1a2236", systemBubble: "#1a2a1a",
    fileBg: "#1a2236", fileHover: "#222e44",
  },
  light: {
    bg: "#f8f9fc", surface: "#ffffff", surfaceAlt: "#f0f2f8", border: "#e2e5ee",
    text: "#1a1d28", textDim: "#5a6072", textMuted: "#8892a4",
    accent: "#2563eb", accentDim: "#2563eb22", success: "#059669", warning: "#d97706",
    error: "#dc2626", compound: "#7c3aed",
    userBubble: "#e8f0fe", aiBubble: "#f0f2f8", systemBubble: "#e8f8e8",
    fileBg: "#f0f2f8", fileHover: "#e4e8f2",
  }
};

// File type icons
const FILE_ICONS = {
  'image/jpeg': '🖼️', 'image/png': '🖼️', 'image/gif': '🖼️', 'image/webp': '🖼️',
  'application/pdf': '📄', 'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'text/csv': '📊', 'text/plain': '📃', 'text/markdown': '📃',
  'application/json': '{ }', 'default': '📎'
};

const getFileIcon = (mimeType) => FILE_ICONS[mimeType] || FILE_ICONS.default;

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + 'm ago';
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours + 'h ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Category colors
const CAT_COLORS = {
  order: '#4f8eff', supplier: '#34d399', shipment: '#fbbf24', customer: '#c084fc',
  compliance: '#ef4444', finance: '#059669', operations: '#8892a4', planning: '#60a5fa',
  issue: '#ef4444', general: '#8892a4'
};

// Priority badges
const PRIORITY_BADGE = { urgent: '🔴', high: '🟠', normal: '', low: '⚪' };


// ═══════════════════════════════════════════════════════════════════
// SIMPLE MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════════

function RenderMarkdown({ text, C }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let inTable = false, tableRows = [];

  const renderInline = (line) => {
    return line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:' + C.surfaceAlt + ';padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:' + C.accent + '">$1</a>');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: '8px 0 4px' }}
        dangerouslySetInnerHTML={{ __html: renderInline(line.slice(4)) }} />);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} style={{ fontWeight: 700, fontSize: 14, color: C.text, margin: '10px 0 4px' }}
        dangerouslySetInnerHTML={{ __html: renderInline(line.slice(3)) }} />);
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} style={{ fontWeight: 700, fontSize: 16, color: C.text, margin: '12px 0 6px' }}
        dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }} />);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: 10, margin: '6px 0', color: C.textDim, fontStyle: 'italic' }}
        dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }} />);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<div key={i} style={{ paddingLeft: 12, margin: '2px 0' }}>
        <span style={{ color: C.accent, marginRight: 6 }}>•</span>
        <span dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }} />
      </div>);
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.+)/);
      elements.push(<div key={i} style={{ paddingLeft: 12, margin: '2px 0' }}>
        <span style={{ color: C.accent, marginRight: 6, fontWeight: 600 }}>{match[1]}.</span>
        <span dangerouslySetInnerHTML={{ __html: renderInline(match[2]) }} />
      </div>);
    } else if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; }
      if (!/^\|[\s-:|]+\|$/.test(line)) { // skip separator rows
        tableRows.push(line.split('|').filter(Boolean).map(c => c.trim()));
      }
    } else {
      if (inTable) {
        elements.push(<table key={`t${i}`} style={{ borderCollapse: 'collapse', width: '100%', margin: '6px 0', fontSize: 12 }}>
          <tbody>{tableRows.map((row, ri) => (
            <tr key={ri}>{row.map((cell, ci) => (
              ri === 0 ? <th key={ci} style={{ border: `1px solid ${C.border}`, padding: '4px 8px', background: C.surfaceAlt, fontWeight: 600, textAlign: 'left' }}>{cell}</th>
                : <td key={ci} style={{ border: `1px solid ${C.border}`, padding: '4px 8px' }}>{cell}</td>
            ))}</tr>
          ))}</tbody>
        </table>);
        inTable = false; tableRows = [];
      }
      if (line.trim() === '---') {
        elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '8px 0' }} />);
      } else if (line.trim()) {
        elements.push(<p key={i} style={{ margin: '3px 0', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: renderInline(line) }} />);
      }
    }
  }
  
  return <div style={{ fontSize: 13, color: C.text }}>{elements}</div>;
}


// ═══════════════════════════════════════════════════════════════════
// FILE ATTACHMENT RENDERER
// ═══════════════════════════════════════════════════════════════════

function FileAttachment({ file, C }) {
  const isImage = file.file_type?.startsWith('image/');
  const [expanded, setExpanded] = useState(isImage);
  
  return (
    <div style={{ margin: '6px 0', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.fileBg }}>
      {isImage && expanded && file.file_url && (
        <img src={file.file_url} alt={file.file_name} 
          style={{ width: '100%', maxHeight: 300, objectFit: 'contain', cursor: 'pointer', background: '#000' }}
          onClick={() => window.open(file.file_url, '_blank')} />
      )}
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }}>
        <span style={{ fontSize: 20 }}>{getFileIcon(file.file_type)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file_name}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>{formatFileSize(file.file_size)}</div>
        </div>
        {file.file_url && (
          <a href={file.file_url} download style={{ color: C.accent, fontSize: 11, textDecoration: 'none', fontWeight: 600 }}
            onClick={e => e.stopPropagation()}>
            ↓ Download
          </a>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// DOCUMENT CARD RENDERER
// ═══════════════════════════════════════════════════════════════════

function DocumentCard({ cardType, entityId, data, C }) {
  const titles = {
    purchase_order: '📦 Purchase Order',
    invoice: '🧾 Invoice',
    quote: '💬 Quote',
    delivery_checklist: '✅ Delivery Checklist',
    fsm_status: '⚙️ FSM Status',
    payment: '💳 Payment',
    shipment: '🚢 Shipment',
    license: '📋 License'
  };

  return (
    <div style={{ margin: '6px 0', border: `1px solid ${C.accent}44`, borderRadius: 8, background: C.surfaceAlt, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: C.accentDim, borderBottom: `1px solid ${C.accent}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{titles[cardType] || '📄 Document'}</span>
        <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{entityId}</span>
      </div>
      {data && (
        <div style={{ padding: '8px 12px', fontSize: 12 }}>
          {Object.entries(data).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: `1px solid ${C.border}22` }}>
              <span style={{ color: C.textDim, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
              <span style={{ color: C.text, fontWeight: 500 }}>{typeof v === 'number' && k.includes('cost') || k.includes('total') || k.includes('amount') ? '$' + v.toLocaleString() : String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// ACTION CARD RENDERER
// ═══════════════════════════════════════════════════════════════════

function ActionCard({ action, onAction, C }) {
  const colorMap = {
    approve: C.success, reject: C.error, dispute: C.warning,
    confirm: C.accent, escalate: C.error, reorder: C.accent,
    assign: C.compound, close: C.textMuted, custom: C.accent
  };
  const btnColor = colorMap[action.action_type] || C.accent;

  if (action.action_taken) {
    return (
      <div style={{ margin: '6px 0', padding: '8px 12px', borderRadius: 8, background: C.success + '15', border: `1px solid ${C.success}44`, fontSize: 12 }}>
        ✅ <strong>{action.action_taken}</strong> by {action.action_taken_by} — {formatTime(action.action_taken_at)}
      </div>
    );
  }

  const options = action.action_options || [
    { label: action.action_type?.charAt(0).toUpperCase() + action.action_type?.slice(1), value: action.action_type }
  ];

  return (
    <div style={{ margin: '6px 0', padding: '10px 12px', borderRadius: 8, background: btnColor + '11', border: `1px solid ${btnColor}44` }}>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>⚡ Action Required</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(Array.isArray(options) ? options : [options]).map((opt, i) => (
          <button key={i} onClick={() => onAction?.(opt.value || opt.label)}
            style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${btnColor}`, background: i === 0 ? btnColor : 'transparent',
              color: i === 0 ? '#fff' : btnColor, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {opt.label || opt}
          </button>
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════════════

function MessageBubble({ msg, users, C, onAction }) {
  const isUser = msg.sender_role === 'user';
  const isAI = msg.sender_role === 'ai';
  const isSystem = msg.sender_role === 'system';
  const sender = users?.[msg.sender_id];
  const bgColor = isUser ? C.userBubble : isAI ? C.aiBubble : C.systemBubble;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', margin: '6px 0', maxWidth: '85%', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
      {/* Sender label */}
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2, paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0 }}>
        {isAI ? '🤖 FSM Drive AI' : isSystem ? '🔔 System' : sender?.name || msg.sender_id}
        <span style={{ marginLeft: 6, color: C.textMuted }}>{formatTime(msg.created_at)}</span>
      </div>
      
      {/* Bubble */}
      <div style={{ background: bgColor, border: `1px solid ${C.border}`, borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '8px 14px', width: '100%' }}>
        {/* Text content */}
        {msg.body && msg.content_type !== 'action_card' && (
          <RenderMarkdown text={msg.body} C={C} />
        )}
        
        {/* File attachment */}
        {msg.content_type === 'file' && (
          <FileAttachment file={msg} C={C} />
        )}
        
        {/* Document card */}
        {msg.content_type === 'document_card' && (
          <DocumentCard cardType={msg.card_type} entityId={msg.card_entity_id} data={msg.card_data} C={C} />
        )}
        
        {/* Action card */}
        {msg.content_type === 'action_card' && (
          <ActionCard action={msg} onAction={onAction} C={C} />
        )}
        
        {/* Status update */}
        {msg.content_type === 'status_update' && (
          <div style={{ fontSize: 12, color: C.success, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success }} />
            {msg.body}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// CONVERSATION LIST (sidebar)
// ═══════════════════════════════════════════════════════════════════

function ConversationList({ conversations, activeId, onSelect, onCreate, onExport, C }) {
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  
  const filtered = conversations.filter(c => {
    if (catFilter !== 'all' && c.category !== catFilter) return false;
    if (filter && !c.title.toLowerCase().includes(filter.toLowerCase()) && !c.topic.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const categories = ['all', ...new Set(conversations.map(c => c.category))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.surface }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 8px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.accent, margin: 0, letterSpacing: 0.5 }}>Conversations</h2>
          <button onClick={onCreate}
            style={{ background: C.accent, border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + New
          </button>
        </div>
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search conversations..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
        {/* Category pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${catFilter === cat ? C.accent : C.border}`,
                background: catFilter === cat ? C.accentDim : 'transparent',
                color: catFilter === cat ? C.accent : C.textDim, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', textTransform: 'capitalize' }}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      
      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(conv => (
          <div key={conv.id} onClick={() => onSelect(conv.id)}
            style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}22`, cursor: 'pointer',
              background: conv.id === activeId ? C.accentDim : 'transparent',
              borderLeft: conv.id === activeId ? `3px solid ${C.accent}` : '3px solid transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {conv.pinned && <span style={{ fontSize: 10 }}>📌</span>}
              {PRIORITY_BADGE[conv.priority]}
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title}</span>
              <span style={{ fontSize: 9, color: C.textMuted }}>{formatTime(conv.last_message_at || conv.created_at)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: (CAT_COLORS[conv.category] || C.textMuted) + '22', color: CAT_COLORS[conv.category] || C.textMuted, fontWeight: 600, textTransform: 'capitalize' }}>
                {conv.category}
              </span>
              {conv.message_count > 0 && <span style={{ fontSize: 9, color: C.textDim }}>{conv.message_count} msgs</span>}
              {conv.attachment_count > 0 && <span style={{ fontSize: 9, color: C.textDim }}>📎{conv.attachment_count}</span>}
            </div>
            {conv.last_message_preview && (
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.last_message_preview}
              </div>
            )}
          </div>
        ))}
        {!filtered.length && (
          <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: 11 }}>
            {filter ? 'No conversations match your search' : 'No conversations yet. Click + New to start.'}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// NEW CONVERSATION DIALOG
// ═══════════════════════════════════════════════════════════════════

function NewConversationDialog({ templates, onClose, onCreate, C }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const categories = ['order', 'supplier', 'shipment', 'customer', 'compliance', 'finance', 'operations', 'planning', 'issue', 'general'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, width: 420, maxHeight: '80vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.accent, margin: '0 0 16px' }}>New Conversation</h3>
        
        <label style={{ fontSize: 11, color: C.textDim, fontWeight: 600, display: 'block', marginBottom: 4 }}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., PO-CUBA-002 Planning"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', marginBottom: 12 }} />
        
        <label style={{ fontSize: 11, color: C.textDim, fontWeight: 600, display: 'block', marginBottom: 4 }}>Category</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${category === cat ? C.accent : C.border}`,
                background: category === cat ? C.accentDim : 'transparent',
                color: category === cat ? C.accent : C.textDim, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', textTransform: 'capitalize' }}>
              {cat}
            </button>
          ))}
        </div>
        
        {templates?.length > 0 && <>
          <label style={{ fontSize: 11, color: C.textDim, fontWeight: 600, display: 'block', marginBottom: 4 }}>Quick Start Template</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {templates.map(t => (
              <div key={t.id} onClick={() => setSelectedTemplate(t.id === selectedTemplate ? null : t.id)}
                style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${selectedTemplate === t.id ? C.accent : C.border}`,
                  background: selectedTemplate === t.id ? C.accentDim : C.bg, cursor: 'pointer' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: selectedTemplate === t.id ? C.accent : C.text }}>{t.title}</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{t.description}</div>
              </div>
            ))}
          </div>
        </>}
        
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose}
            style={{ padding: '6px 16px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={() => title && onCreate({ title, category, template: selectedTemplate })}
            disabled={!title}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: title ? C.accent : C.textMuted, color: '#fff', fontSize: 11, fontWeight: 600, cursor: title ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// MAIN WORKSPACE COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function ConversationWorkspace({
  theme = "dark",
  currentUser = "ed.stull",
  users = {},
  supabase = null,     // Supabase client for real data
  onSwitchToEditor,    // callback to switch to FSM editor view
  onSwitchToHome,      // callback to switch to action view
}) {
  const C = THEMES[theme] || THEMES.dark;
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [templates, setTemplates] = useState([]);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sidebarWidth] = useState(280);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Demo data (when no Supabase)
  useEffect(() => {
    if (!supabase) {
      setConversations([
        { id: 'conv-po-cuba-001', title: 'PO-CUBA-001 Tracking', topic: 'po-cuba-001', category: 'order', status: 'active', priority: 'high', pinned: true, message_count: 12, attachment_count: 3, last_message_at: new Date().toISOString(), last_message_preview: 'Cheney Brothers cannot ship to Cuba...' },
        { id: 'conv-walmart', title: 'Walmart Supplier Setup', topic: 'walmart', category: 'supplier', status: 'active', priority: 'normal', pinned: false, message_count: 4, attachment_count: 0, last_message_at: new Date(Date.now() - 3600000).toISOString(), last_message_preview: 'Call scheduled for tomorrow 10:15 AM' },
        { id: 'conv-shipment-1', title: 'March Shipment Planning', topic: 'march-shipment', category: 'shipment', status: 'active', priority: 'normal', pinned: false, message_count: 8, attachment_count: 1, last_message_at: new Date(Date.now() - 7200000).toISOString(), last_message_preview: 'Need reefer container for frozen meat...' },
        { id: 'conv-compliance', title: 'BIS License Tracking', topic: 'bis-license', category: 'compliance', status: 'active', priority: 'normal', pinned: false, message_count: 3, attachment_count: 1, last_message_at: new Date(Date.now() - 86400000).toISOString(), last_message_preview: '$39.9M authorized, contract deadline March 2027' },
      ]);
      setTemplates([
        { id: 'tmpl-new-order', title: 'New Customer Order', description: 'Process a new order from Cuba', category: 'order' },
        { id: 'tmpl-delivery-issue', title: 'Delivery Issue', description: 'Report damaged goods or missing items', category: 'issue' },
        { id: 'tmpl-supplier-setup', title: 'New Supplier Setup', description: 'Onboard a new supplier', category: 'supplier' },
        { id: 'tmpl-shipment-tracking', title: 'Shipment Tracking', description: 'Track a shipment end-to-end', category: 'shipment' },
        { id: 'tmpl-weekly-planning', title: 'Weekly Planning', description: 'Review the week ahead', category: 'planning' },
      ]);
    }
  }, [supabase]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    // Demo messages
    if (!supabase) {
      setMessages([
        { id: 1, sender_id: 'system', sender_role: 'system', content_type: 'text', body: 'Conversation started. Topic: **' + activeConvId + '**', created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 2, sender_id: 'ed.stull', sender_role: 'user', content_type: 'text', body: 'What is the current status of this order?', created_at: new Date(Date.now() - 3500000).toISOString() },
        { id: 3, sender_id: 'ai', sender_role: 'ai', content_type: 'text', body: "Here's the current status:\n\n**PO-CUBA-001**\n- Status: Draft\n- Supplier: Pending (Cheney Bros declined, Walmart call tomorrow)\n- 36 line items, ~$27,000\n- Container: 40ft dry + reefer needed\n\n> *Note: Rice MUST be 2lb packets — Cuban law prohibits bulk rice imports.*\n\nShall I pull up the full line item breakdown?", created_at: new Date(Date.now() - 3400000).toISOString() },
      ]);
    }
  }, [activeConvId, supabase]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || !activeConvId) return;
    const newMsg = {
      id: Date.now(),
      sender_id: currentUser,
      sender_role: 'user',
      content_type: 'text',
      body: inputText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender_id: 'ai',
        sender_role: 'ai',
        content_type: 'text',
        body: 'I understand your question. Let me check the relevant FSMs and data...\n\n*This is a demo response. In production, this connects to the Claude API with full context from the conversation thread, linked FSMs, and attached documents.*',
        created_at: new Date().toISOString()
      }]);
    }, 1000);
  }, [inputText, activeConvId, currentUser]);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setMessages(prev => [...prev, {
          id: Date.now(),
          sender_id: currentUser,
          sender_role: 'user',
          content_type: 'file',
          body: '',
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: URL.createObjectURL(file),
          created_at: new Date().toISOString()
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, [currentUser]);

  const handleExport = useCallback(() => {
    if (!activeConvId) return;
    const conv = conversations.find(c => c.id === activeConvId);
    const exportData = {
      format: 'fsmchat',
      version: '1.0',
      exported_at: new Date().toISOString(),
      conversation: conv,
      messages: messages
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (conv?.topic || 'conversation') + '.fsmchat';
    a.click(); URL.revokeObjectURL(url);
  }, [activeConvId, conversations, messages]);

  const handleExportMd = useCallback(() => {
    if (!activeConvId) return;
    const conv = conversations.find(c => c.id === activeConvId);
    let md = `---\ntitle: ${conv?.title}\ntopic: ${conv?.topic}\ncategory: ${conv?.category}\nexported: ${new Date().toISOString()}\n---\n\n# ${conv?.title}\n\n---\n\n`;
    messages.forEach(msg => {
      const sender = msg.sender_role === 'ai' ? 'FSM Drive AI' : msg.sender_role === 'system' ? 'System' : (users[msg.sender_id]?.name || msg.sender_id);
      md += `### ${sender} — ${new Date(msg.created_at).toLocaleString()}\n\n`;
      if (msg.body) md += msg.body + '\n\n';
      if (msg.file_name) md += `📎 **Attachment:** ${msg.file_name}\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (conv?.topic || 'conversation') + '.md';
    a.click(); URL.revokeObjectURL(url);
  }, [activeConvId, conversations, messages, users]);

  const handleImport = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.format === 'fsmchat' && data.conversation && data.messages) {
          const conv = { ...data.conversation, id: data.conversation.id || 'conv-imported-' + Date.now(), imported_from: file.name };
          setConversations(prev => [conv, ...prev]);
          setActiveConvId(conv.id);
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  const activeConv = conversations.find(c => c.id === activeConvId);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: sidebarWidth, minWidth: sidebarWidth, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
        {/* FSM Drive branding */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 14, fontWeight: 700, color: C.accent, margin: 0, letterSpacing: 0.5 }}>FSM Drive</h1>
              <p style={{ fontSize: 9, color: C.textDim, margin: '2px 0 0', letterSpacing: 1, textTransform: 'uppercase' }}>Workspace</p>
            </div>
            {onSwitchToHome && (
              <button onClick={onSwitchToHome}
                style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: C.textMuted, fontSize: 10, fontWeight: 600, fontFamily: 'inherit' }}>
                🏠 Home
              </button>
            )}
            {onSwitchToEditor && (
              <button onClick={onSwitchToEditor}
                style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: C.textMuted, fontSize: 10, fontWeight: 600, fontFamily: 'inherit' }}>
                ⚙️ Editor
              </button>
            )}
          </div>
        </div>
        
        <ConversationList
          conversations={conversations} activeId={activeConvId}
          onSelect={setActiveConvId} onCreate={() => setShowNewDialog(true)}
          onExport={handleExport} C={C} />
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeConv ? (
          <>
            {/* Conversation header */}
            <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surface }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{activeConv.title}</h2>
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 8, background: (CAT_COLORS[activeConv.category] || C.textMuted) + '22', color: CAT_COLORS[activeConv.category], fontWeight: 600, textTransform: 'capitalize' }}>
                    {activeConv.category}
                  </span>
                </div>
                {activeConv.linked_fsms?.length > 0 && (
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                    FSMs: {activeConv.linked_fsms.join(', ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={handleExport} title="Export as .fsmchat"
                  style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: C.textMuted, fontSize: 10, fontFamily: 'inherit' }}>
                  💾 JSON
                </button>
                <button onClick={handleExportMd} title="Export as Markdown"
                  style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: C.textMuted, fontSize: 10, fontFamily: 'inherit' }}>
                  📝 MD
                </button>
                <label title="Import .fsmchat file"
                  style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: C.textMuted, fontSize: 10, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }}>
                  📂 Import
                  <input type="file" accept=".fsmchat,.json" style={{ display: 'none' }} onChange={handleImport} />
                </label>
              </div>
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column' }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}>
              
              {dragOver && (
                <div style={{ position: 'absolute', inset: 0, background: C.accent + '22', border: `3px dashed ${C.accent}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>Drop files here — photos, PDFs, documents</div>
                </div>
              )}
              
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} users={users} C={C} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div style={{ padding: '10px 18px 14px', borderTop: `1px solid ${C.border}`, background: C.surface }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: C.textMuted, fontSize: 14, flexShrink: 0 }}
                  title="Attach file">
                  📎
                </button>
                <button onClick={() => { setInputText("What do I need to know today?"); setTimeout(handleSend, 100); }}
                  style={{ background: C.surfaceAlt, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: C.accent, fontSize: 14, flexShrink: 0 }}
                  title="What do I need to know today?">
                  📋
                </button>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileDrop} />
                
                <textarea value={inputText} onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message... (Shift+Enter for new line)"
                  rows={1}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'none', minHeight: 36, maxHeight: 120 }} />
                
                <button onClick={handleSend} disabled={!inputText.trim()}
                  style={{ background: inputText.trim() ? C.accent : C.surfaceAlt, border: 'none', borderRadius: 8, padding: '8px 14px', cursor: inputText.trim() ? 'pointer' : 'not-allowed', color: inputText.trim() ? '#fff' : C.textMuted, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0 }}>
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 48, opacity: 0.3 }}>💬</div>
            <div style={{ fontSize: 14, color: C.textMuted, fontWeight: 600 }}>Select a conversation or start a new one</div>
            <div style={{ fontSize: 11, color: C.textDim, maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
              Conversations are organized by topic. Attach photos, documents, and files. 
              Export as .fsmchat or Markdown. Import saved conversations anytime.
            </div>
            <button onClick={() => setShowNewDialog(true)}
              style={{ marginTop: 8, background: C.accent, border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + New Conversation
            </button>
          </div>
        )}
      </div>

      {/* New conversation dialog */}
      {showNewDialog && (
        <NewConversationDialog templates={templates} C={C}
          onClose={() => setShowNewDialog(false)}
          onCreate={({ title, category, template }) => {
            const id = 'conv-' + Date.now();
            const topic = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const newConv = { id, title, topic, category, status: 'active', priority: 'normal', pinned: false, message_count: 0, attachment_count: 0, created_at: new Date().toISOString() };
            setConversations(prev => [newConv, ...prev]);
            setActiveConvId(id);
            setMessages([{
              id: 1, sender_id: 'system', sender_role: 'system', content_type: 'text',
              body: `Conversation started: **${title}**\n\nCategory: ${category}${template ? '\nTemplate: ' + template : ''}\n\nI'm ready to help. You can type questions, attach files, or ask me to pull up any PO, invoice, or FSM status.`,
              created_at: new Date().toISOString()
            }]);
            setShowNewDialog(false);
          }} />
      )}
    </div>
  );
}
