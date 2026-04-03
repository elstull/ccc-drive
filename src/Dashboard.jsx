import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// OPERATIONS DASHBOARD
//
// "Here is what is happening across the entire business right now."
//
// Shows: Active processes, coverage events, financial summary,
//        recent activity, and items needing attention.
//
// Mobile-first: single column, 14px min fonts, touch-friendly.
// ═══════════════════════════════════════════════════════════════════════════

const GREEN  = '#4ade80';
const YELLOW = '#e8c060';
const RED    = '#ef4444';
const BLUE   = '#4a90d9';
const PURPLE = '#c084fc';
const DIM    = '#cbd5e0';

// ── Summary Card ──
function SummaryCard({ icon, label, value, sub, color, alert, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
      padding: '14px 16px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
      fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent', width: '100%',
      borderLeft: alert ? `3px solid ${RED}` : `3px solid ${color || '#1e293b'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        {alert && (
          <span style={{ background: RED + '22', border: `1px solid ${RED}44`, borderRadius: 10,
            padding: '2px 8px', fontSize: 14, fontWeight: 700, color: RED }}>
            {alert}
          </span>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
      <div style={{ fontSize: 15, color: DIM, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 14, color: color || DIM, marginTop: 4 }}>{sub}</div>}
    </button>
  );
}


// ── Activity Row — compact by default, expands on tap ──
function ActivityRow({ id, icon, title, subtitle, badge, badgeColor, time, action, expanded, onTap }) {
  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: action && !expanded ? 'center' : 'flex-start',
      flexWrap: 'wrap', gap: expanded ? 10 : 8, width: '100%',
      background: action ? '#111827' : 'transparent',
      border: action ? `1px solid ${RED}44` : '1px solid #1e293b',
      borderLeft: action ? `3px solid ${RED}` : '1px solid #1e293b',
      borderRadius: 8, padding: expanded ? '12px 14px' : '8px 12px', textAlign: 'left',
      cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4,
      WebkitTapHighlightColor: 'transparent',
    }}>
      <span style={{ fontSize: expanded ? 18 : 15, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 16, fontWeight: 600, color: '#e2e8f0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expanded ? 'normal' : 'nowrap',
            flex: 1, minWidth: 0,
          }}>{title}</span>
          {!expanded && badge && (
            <span style={{ fontSize: 14, color: badgeColor || GREEN, fontWeight: 600,
              background: (badgeColor || GREEN) + '18', padding: '1px 6px', borderRadius: 6,
              flexShrink: 0, whiteSpace: 'nowrap' }}>
              {badge}
            </span>
          )}
          {!expanded && action && (
            <span style={{ fontSize: 14, color: RED, flexShrink: 0 }}>{'\u26A0'}</span>
          )}
        </div>
        {/* ── Expanded detail ── */}
        {expanded && (
          <div style={{ marginTop: 6 }}>
            {subtitle && <div style={{ fontSize: 16, color: '#cbd5e0', lineHeight: 1.5, marginBottom: 4 }}>{subtitle}</div>}
            {action && (
              <div style={{ fontSize: 15, color: RED, fontWeight: 600, marginTop: 4 }}>
                {'\u26A0'} {action}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              {badge && (
                <span style={{ fontSize: 14, color: badgeColor || GREEN, fontWeight: 600,
                  background: (badgeColor || GREEN) + '18', padding: '2px 8px', borderRadius: 8 }}>
                  {badge}
                </span>
              )}
              {time && <span style={{ fontSize: 16, color: '#a0aec0' }}>{time}</span>}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}


// ── Section Label ──
function SectionLabel({ text, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 20 }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0' }}>{text}</span>
      {count !== undefined && <span style={{ fontSize: 14, color: DIM }}>({count})</span>}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export default function Dashboard({ currentUser, users, supabase }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [d, setD] = useState({
    instances: [], transitions: [], coverage: [], coverageMap: [],
    invoices: [], documents: [], health: null,
    fsmCount: 0,
  });

  const timeAgo = (dt) => {
    if (!dt) return '';
    const mins = Math.floor((Date.now() - new Date(dt).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
    return Math.floor(mins / 1440) + 'd ago';
  };

  const fmt = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '$0';
    return '$' + parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // ── Load ──
  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      // Active FSM instances
      const { data: instances, error: e1 } = await supabase
        .from('fsm_instances')
        .select('id, fsm_name, current_state_name, status, priority, label, entity_type, entity_id, started_by, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (e1) console.warn('fsm_instances:', e1.message);

      // Recent transitions
      const { data: transitions, error: e2 } = await supabase
        .from('instance_transitions')
        .select('id, instance_id, from_state_name, to_state_name, transition_label, triggered_by, fired_at')
        .order('fired_at', { ascending: false })
        .limit(20);
      if (e2) console.warn('instance_transitions:', e2.message);

      // Active coverage
      const { data: coverage, error: e3 } = await supabase
        .from('coverage_assignments')
        .select('id, primary_user_id, backup_user_id, trigger_type, brief_complete, activated_at, deactivated_at, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (e3) console.warn('coverage_assignments:', e3.message);

      // Default coverage map
      const { data: coverageMap, error: e4 } = await supabase
        .from('default_coverage_map')
        .select('primary_user_id, backup_user_id, scope, notes')
        .order('primary_user_id');
      if (e4) console.warn('default_coverage_map:', e4.message);

      // FSM definitions count
      const { data: fsms, error: e5 } = await supabase
        .from('fsm_registry')
        .select('name');
      if (e5) console.warn('fsm_registry:', e5.message);

      // Invoices (may be empty)
      let invoices = [];
      try {
        const { data: inv } = await supabase
          .from('customer_invoices')
          .select('id, customer_name, total_usd, total, status, created_at')
          .order('created_at', { ascending: false })
          .limit(20);
        invoices = inv || [];
      } catch (_) {}

      // Documents (may be empty)
      let documents = [];
      try {
        const { data: docs } = await supabase
          .from('document_intake')
          .select('id, file_name, classification, gate_status, source, created_at')
          .order('created_at', { ascending: false })
          .limit(20);
        documents = docs || [];
      } catch (_) {}

      // Health snapshot
      let health = null;
      try {
        const { data: h } = await supabase
          .from('health_snapshots')
          .select('*')
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .single();
        health = h;
      } catch (_) {}

      setD({
        instances: instances || [],
        transitions: transitions || [],
        coverage: coverage || [],
        coverageMap: coverageMap || [],
        invoices,
        documents,
        health,
        fsmCount: (fsms || []).length,
      });
    } catch (e) {
      console.error('Dashboard load error:', e);
      setError('Failed to load dashboard data');
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Expand/collapse toggle ──
  const toggle = (id) => setExpandedId(prev => prev === id ? null : id);

  // ── Computed & sorted by importance ──
  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };

  const activeInstances = d.instances
    .filter(i => i.status === 'active')
    .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

  const completedInstances = d.instances.filter(i => i.status === 'completed');
  const criticalInstances = activeInstances.filter(i => i.priority === 'critical');

  const activeCoverage = d.coverage
    .filter(c => !c.deactivated_at)
    .sort((a, b) => {
      // Incomplete briefs first (still being set up), then by recency
      if (!a.brief_complete && b.brief_complete) return -1;
      if (a.brief_complete && !b.brief_complete) return 1;
      return 0;
    });

  // Coverage map: gaps first (most important), then covered
  const sortedCoverageMap = [...d.coverageMap].sort((a, b) => {
    if (!a.backup_user_id && b.backup_user_id) return -1;
    if (a.backup_user_id && !b.backup_user_id) return 1;
    return 0;
  });

  const coverageGaps = sortedCoverageMap.filter(m => !m.backup_user_id);

  // Documents: red → pending → yellow → green
  const docPriority = { red: 0, pending: 1, yellow: 2, green: 3 };
  const sortedDocs = [...d.documents].sort((a, b) =>
    (docPriority[a.gate_status] ?? 1) - (docPriority[b.gate_status] ?? 1));
  const pendingDocs = sortedDocs.filter(doc => doc.gate_status === 'pending' || doc.gate_status === 'yellow' || doc.gate_status === 'red');

  // Invoices: overdue → unpaid → paid
  const invPriority = { overdue: 0, disputed: 1, sent: 2, draft: 3, partial: 4, acknowledged: 5, paid: 6, written_off: 7 };
  const sortedInvoices = [...d.invoices].sort((a, b) =>
    (invPriority[a.status] ?? 3) - (invPriority[b.status] ?? 3));
  const overdueInvoices = sortedInvoices.filter(i => i.status === 'overdue');

  const totalAlerts = criticalInstances.length + activeCoverage.length + coverageGaps.length + overdueInvoices.length;

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
        <div style={{ color: BLUE, fontSize: 14 }}>Loading operations status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
        <div style={{ color: RED, fontSize: 14, marginBottom: 12 }}>{error}</div>
        <button onClick={loadData} style={{
          background: 'none', border: `1px solid ${BLUE}`, borderRadius: 8,
          color: BLUE, fontSize: 16, padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit',
        }}>Retry</button>
      </div>
    );
  }


  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px', paddingBottom: 100 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
          Operations Dashboard
        </div>
        <div style={{ fontSize: 15, color: DIM }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        {totalAlerts > 0 && (
          <div style={{ marginTop: 8, padding: '10px 14px', background: RED + '12', border: `1px solid ${RED}44`,
            borderRadius: 8, fontSize: 16, color: RED, fontWeight: 600 }}>
            {'\u26A0'} {totalAlerts} item{totalAlerts !== 1 ? 's' : ''} need{totalAlerts === 1 ? 's' : ''} attention
          </div>
        )}
        {totalAlerts === 0 && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN }} />
            <span style={{ fontSize: 15, color: GREEN, fontWeight: 600 }}>All systems healthy</span>
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6 }}>
        <SummaryCard
          icon={'\u26A1'} label="Active Processes" value={activeInstances.length}
          sub={`${completedInstances.length} completed`} color={BLUE}
          alert={criticalInstances.length > 0 ? `${criticalInstances.length} critical` : null} />
        <SummaryCard
          icon={'\uD83D\uDEE1\uFE0F'} label="Coverage" value={activeCoverage.length > 0 ? `${activeCoverage.length} active` : 'Normal'}
          sub={coverageGaps.length > 0 ? `${coverageGaps.length} gap${coverageGaps.length !== 1 ? 's' : ''}` : 'All backed up'}
          color={activeCoverage.length > 0 ? PURPLE : GREEN}
          alert={coverageGaps.length > 0 ? `${coverageGaps.length} gap${coverageGaps.length !== 1 ? 's' : ''}` : null} />
        <SummaryCard
          icon={'\uD83D\uDCC4'} label="Documents" value={sortedDocs.length}
          sub={pendingDocs.length > 0 ? `${pendingDocs.length} need review` : 'All processed'}
          color={BLUE}
          alert={pendingDocs.length > 0 ? `${pendingDocs.length} pending` : null} />
        <SummaryCard
          icon={'\uD83D\uDCCA'} label="FSM Definitions" value={d.fsmCount}
          sub={`Powering ${activeInstances.length} live processes`}
          color={GREEN} />
      </div>

      {/* ── Coverage Map (Resilience) ── */}
      {sortedCoverageMap.length > 0 && (
        <>
          <SectionLabel text="Resilience — Coverage Map" count={sortedCoverageMap.length} />
          {sortedCoverageMap.map((m, i) => {
            const hasGap = !m.backup_user_id;
            return (
              <ActivityRow key={i}
                id={`cov-map-${i}`}
                expanded={expandedId === `cov-map-${i}`}
                onTap={() => toggle(`cov-map-${i}`)}
                icon={hasGap ? '\u26A0\uFE0F' : '\uD83D\uDEE1\uFE0F'}
                title={m.primary_user_id}
                subtitle={hasGap
                  ? (m.notes || 'No backup identified — structural gap')
                  : `Backup: ${m.backup_user_id} (${m.scope})`}
                badge={hasGap ? 'GAP' : 'Covered'}
                badgeColor={hasGap ? RED : GREEN}
                action={hasGap ? 'Must resolve before operations' : null} />
            );
          })}
        </>
      )}

      {/* ── Active Coverage Events ── */}
      {activeCoverage.length > 0 && (
        <>
          <SectionLabel text="Active Coverage" count={activeCoverage.length} />
          {activeCoverage.map(c => (
            <ActivityRow key={c.id}
              id={`cov-${c.id}`}
              expanded={expandedId === `cov-${c.id}`}
              onTap={() => toggle(`cov-${c.id}`)}
              icon={'\uD83D\uDEE1\uFE0F'}
              title={`${c.primary_user_id} covered by ${c.backup_user_id || '?'}`}
              subtitle={`Trigger: ${c.trigger_type} \u2022 Brief: ${c.brief_complete ? 'complete' : 'in progress'}`}
              badge={c.activated_at ? 'Active' : 'Setting up'}
              badgeColor={c.activated_at ? PURPLE : YELLOW}
              time={timeAgo(c.created_at)} />
          ))}
        </>
      )}

      {/* ── Active FSM Instances ── */}
      <SectionLabel text="Active Processes" count={activeInstances.length} />
      {activeInstances.length === 0 && (
        <div style={{ color: DIM, fontSize: 16, textAlign: 'center', padding: 16 }}>No active processes</div>
      )}
      {activeInstances.map(inst => (
        <ActivityRow key={inst.id}
          id={`inst-${inst.id}`}
          expanded={expandedId === `inst-${inst.id}`}
          onTap={() => toggle(`inst-${inst.id}`)}
          icon={inst.priority === 'critical' ? '\uD83D\uDD34' : '\u25B6\uFE0F'}
          title={inst.label || inst.fsm_name}
          subtitle={`State: ${inst.current_state_name} \u2022 ${inst.entity_type || ''} ${inst.entity_id || ''}`}
          badge={inst.priority === 'critical' ? 'Critical' : inst.current_state_name}
          badgeColor={inst.priority === 'critical' ? RED : BLUE}
          time={timeAgo(inst.updated_at)} />
      ))}

      {/* ── Completed Processes ── */}
      {completedInstances.length > 0 && (
        <>
          <SectionLabel text="Completed" count={completedInstances.length} />
          {completedInstances.slice(0, 5).map(inst => (
            <ActivityRow key={inst.id}
              id={`done-${inst.id}`}
              expanded={expandedId === `done-${inst.id}`}
              onTap={() => toggle(`done-${inst.id}`)}
              icon={'\u2705'}
              title={inst.label || inst.fsm_name}
              subtitle={`Final state: ${inst.current_state_name}`}
              badge="Done"
              badgeColor={GREEN}
              time={timeAgo(inst.updated_at)} />
          ))}
        </>
      )}

      {/* ── Recent Transitions (Activity Feed) ── */}
      <SectionLabel text="Recent Activity" count={d.transitions.length} />
      {d.transitions.length === 0 && (
        <div style={{ color: DIM, fontSize: 16, textAlign: 'center', padding: 16 }}>No recent activity</div>
      )}
      {d.transitions.slice(0, 8).map(t => (
        <ActivityRow key={t.id}
          id={`tr-${t.id}`}
          expanded={expandedId === `tr-${t.id}`}
          onTap={() => toggle(`tr-${t.id}`)}
          icon={'\u27A1\uFE0F'}
          title={`${t.from_state_name} \u2192 ${t.to_state_name}`}
          subtitle={`${t.transition_label} \u2022 by ${t.triggered_by}`}
          badge={t.to_state_name}
          badgeColor={BLUE}
          time={timeAgo(t.fired_at)} />
      ))}

      {/* ── Invoices (if any) ── */}
      {sortedInvoices.length > 0 && (
        <>
          <SectionLabel text="Invoices" count={sortedInvoices.length} />
          {sortedInvoices.slice(0, 5).map(inv => (
            <ActivityRow key={inv.id}
              id={`inv-${inv.id}`}
              expanded={expandedId === `inv-${inv.id}`}
              onTap={() => toggle(`inv-${inv.id}`)}
              icon={'\uD83D\uDCB0'}
              title={`${inv.id} \u2014 ${inv.customer_name || 'Customer'}`}
              subtitle={fmt(inv.total_usd || inv.total)}
              badge={inv.status}
              badgeColor={inv.status === 'paid' ? GREEN : inv.status === 'overdue' ? RED : YELLOW}
              action={inv.status === 'overdue' ? 'Payment overdue' : null}
              time={timeAgo(inv.created_at)} />
          ))}
        </>
      )}

      {/* ── Documents (if any) ── */}
      {sortedDocs.length > 0 && (
        <>
          <SectionLabel text="Documents" count={sortedDocs.length} />
          {sortedDocs.slice(0, 5).map(doc => (
            <ActivityRow key={doc.id}
              id={`doc-${doc.id}`}
              expanded={expandedId === `doc-${doc.id}`}
              onTap={() => toggle(`doc-${doc.id}`)}
              icon={'\uD83D\uDCC4'}
              title={doc.file_name || doc.id}
              subtitle={`${doc.classification || 'Unclassified'} \u2022 ${doc.source || 'unknown'}`}
              badge={doc.gate_status || 'pending'}
              badgeColor={doc.gate_status === 'green' ? GREEN : doc.gate_status === 'pending' ? YELLOW : RED}
              action={pendingDocs.find(p => p.id === doc.id) ? 'Needs review' : null}
              time={timeAgo(doc.created_at)} />
          ))}
        </>
      )}

      {/* ── Refresh ── */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button onClick={loadData} style={{
          background: 'none', border: `1px solid #2a3a4e`, borderRadius: 8,
          color: DIM, fontSize: 15, padding: '10px 24px', cursor: 'pointer',
          fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
        }}>Refresh</button>
      </div>

    </div>
  );
}
