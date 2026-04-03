import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

// ── FSM Drive FSM Rule Engine ──────────────────────────────────────────────
const VERB_PATTERNS = [
  /^waiting/i, /^processing/i, /^running/i, /^checking/i,
  /^sending/i, /^receiving/i, /^loading/i, /^computing/i,
  /^validating/i, /^updating/i, /^creating/i, /^deleting/i,
  /^handling/i, /^managing/i, /^executing/i, /^performing/i,
  /ing$/i
];
const ACTIVITY_DESC_PATTERNS = [
  /\bcurrently\b/i, /\bawaiting\b/i, /\bbeing\b/i, /\bneeds?\b/i,
  /\bprocessing\b/i, /\brunning\b/i, /\bworking\b/i, /\bhandling\b/i,
  /\bperforming\b/i, /\bexecuting\b/i, /\bcalculating\b/i, /\bcomputing\b/i,
  /\bwaiting\s+for\b/i, /\bin\s+the\s+process\b/i,
];

const validateState = (state, allStates) => {
  const warnings = [], errors = [];
  if (!state.name.trim()) errors.push("State name is required");
  if (VERB_PATTERNS.some(p => p.test(state.name.trim())))
    warnings.push(`"${state.name}" looks like an activity. States should be conditions.`);
  if (state.description && ACTIVITY_DESC_PATTERNS.some(p => p.test(state.description)))
    warnings.push("Description uses activity language. States are conditions — processes happen on transitions.");
  const dupes = allStates.filter(s => s.id !== state.id && s.name.toLowerCase() === state.name.toLowerCase());
  if (dupes.length) errors.push(`Duplicate state name "${state.name}"`);
  return { warnings, errors };
};

const validateTransition = (t, states) => {
  const warnings = [], errors = [];
  if (!t.from) errors.push("Source state required");
  if (!t.to) errors.push("Target state required");
  if (!t.architectLabel.trim()) errors.push("Architect label required");
  if (!t.operatorLabel.trim()) warnings.push("Operator label missing");
  if (t.from && t.to && t.from === t.to && !t.guard) warnings.push("Self-transition without guard");
  const fromState = states.find(s => s.id === t.from);
  if (fromState?.type === "terminal") errors.push("Terminal states cannot have outgoing transitions");
  if (t.executionType === "compound" && !t.embeddedFSM?.trim()) errors.push("Compound transition requires an embedded FSM name");
  if (t.executionType === "atomic" && t.embeddedFSM?.trim()) warnings.push("Atomic transition has embedded FSM — should this be compound?");
  return { warnings, errors };
};

const validateFSM = (states, transitions) => {
  const issues = [];
  const initials = states.filter(s => s.type === "initial");
  const terminals = states.filter(s => s.type === "terminal");
  if (!initials.length) issues.push({ level: "error", msg: "No initial state" });
  if (initials.length > 1) issues.push({ level: "error", msg: `${initials.length} initial states — only one allowed` });
  if (!terminals.length) issues.push({ level: "warning", msg: "No terminal state" });
  const compounds = transitions.filter(t => t.executionType === "compound");
  if (compounds.length) issues.push({ level: "info", msg: `${compounds.length} compound transition(s)` });
  const reachable = new Set();
  if (initials[0]) {
    const queue = [initials[0].id]; reachable.add(initials[0].id);
    while (queue.length) {
      const cur = queue.shift();
      transitions.filter(t => t.from === cur).forEach(t => {
        if (!reachable.has(t.to)) { reachable.add(t.to); queue.push(t.to); }
      });
    }
    states.forEach(s => { if (!reachable.has(s.id)) issues.push({ level: "warning", msg: `"${s.name}" unreachable` }); });
  }
  return issues;
};

// ── RBAC Model ──────────────────────────────────────────────────────────────
// Roles: owner (full control, can sponsor), editor (can modify), viewer (read-only)
// Every FSM has owners[]; all other registered users are viewers unless granted editor
const DEFAULT_USERS = {
  "ed.stull": { name: "Ed Stull", email: "edstull@elstull.com", role: "owner", sponsoredBy: null, registeredAt: "2025-01-15T08:00:00-05:00" },
  "system": { name: "System", email: null, role: "owner", sponsoredBy: null, registeredAt: "2025-01-01T00:00:00-05:00" },
};

const DEFAULT_CURRENT_USER = "ed.stull";

const nowISO = () => { const d = new Date(); return d.toISOString().replace("T", "-").replace(/:\d{2}\.\d{3}Z/, "") + "-" + String(d.getHours()).padStart(2,"0") + String(d.getMinutes()).padStart(2,"0") + "-" + Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/\//g, "_"); };
const formatMeta = (createdBy, createdAt) => `Created by ${createdBy || "unknown"}\n${createdAt || "unknown"}`;

// ── FSM Registry: All named FSM definitions ──────────────────────────────────
const DEFAULT_REGISTRY = {
  "Match Scheduling": {
    owners: ["ed.stull"],
    editors: [],
    states: [
      { id: "s1", name: "Unscheduled", type: "initial", description: "Match exists with no assigned date/time", createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "s2", name: "Proposed", type: "normal", description: "A date/time proposal exists, not yet accepted", createdBy: "ed.stull", createdAt: "2026-02-10-0835-America_New_York" },
      { id: "s3", name: "Confirmed", type: "normal", description: "Both teams have accepted the scheduled date/time", createdBy: "ed.stull", createdAt: "2026-02-10-0840-America_New_York" },
      { id: "s4", name: "In Progress", type: "normal", description: "Match has started but is not yet concluded", createdBy: "ed.stull", createdAt: "2026-02-10-0845-America_New_York" },
      { id: "s5", name: "Completed", type: "terminal", description: "Match is finished with a final score on record", createdBy: "ed.stull", createdAt: "2026-02-10-0850-America_New_York" },
      { id: "s6", name: "Cancelled", type: "terminal", description: "Match will not be played", createdBy: "ed.stull", createdAt: "2026-02-10-0855-America_New_York" },
      { id: "s7", name: "Disputed", type: "normal", description: "An unresolved dispute exists for this match", createdBy: "ed.stull", createdAt: "2026-02-10-0900-America_New_York" },
      { id: "s8", name: "Rescheduled", type: "normal", description: "Original schedule is abandoned, no replacement yet", createdBy: "ed.stull", createdAt: "2026-02-10-0905-America_New_York" },
    ],
    transitions: [
      { id: "t1", from: "s1", to: "s2", architectLabel: "CREATE_PROPOSAL", operatorLabel: "Create Proposal", guard: "", executionType: "compound", embeddedFSM: "Proposal Builder" },
      { id: "t2", from: "s2", to: "s3", architectLabel: "CONFIRM_SCHEDULE", operatorLabel: "Confirm Match", guard: "both_teams_accepted", executionType: "atomic", embeddedFSM: "" },
      { id: "t3", from: "s2", to: "s1", architectLabel: "REJECT_PROPOSAL", operatorLabel: "Decline Proposal", guard: "", executionType: "atomic", embeddedFSM: "" },
      { id: "t4", from: "s3", to: "s4", architectLabel: "BEGIN_MATCH", operatorLabel: "Start Match", guard: "scheduled_time_reached", executionType: "atomic", embeddedFSM: "" },
      { id: "t5", from: "s4", to: "s5", architectLabel: "RECORD_RESULT", operatorLabel: "Submit Score", guard: "", executionType: "compound", embeddedFSM: "Score Capture" },
      { id: "t6", from: "s3", to: "s6", architectLabel: "CANCEL_MATCH", operatorLabel: "Cancel", guard: "", executionType: "atomic", embeddedFSM: "" },
      { id: "t7", from: "s4", to: "s7", architectLabel: "RAISE_DISPUTE", operatorLabel: "Dispute Result", guard: "", executionType: "compound", embeddedFSM: "Dispute Resolution" },
      { id: "t8", from: "s7", to: "s5", architectLabel: "RESOLVE_DISPUTE", operatorLabel: "Dispute Resolved", guard: "resolution_accepted", executionType: "compound", embeddedFSM: "Resolution Review" },
      { id: "t9", from: "s3", to: "s8", architectLabel: "REQUEST_RESCHEDULE", operatorLabel: "Reschedule", guard: "", executionType: "atomic", embeddedFSM: "" },
      { id: "t10", from: "s8", to: "s2", architectLabel: "REPROPOSE_SCHEDULE", operatorLabel: "New Proposal", guard: "", executionType: "compound", embeddedFSM: "Proposal Builder" },
      { id: "t11", from: "s2", to: "s6", architectLabel: "CANCEL_PROPOSAL", operatorLabel: "Cancel", guard: "", executionType: "atomic", embeddedFSM: "" },
    ],
  },
  "Proposal Builder": {
    owners: ["ed.stull"],
    editors: [],
    states: [
      { id: "pb1", name: "Empty Draft", type: "initial", description: "No proposal data exists yet" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "pb2", name: "Dates Collected", type: "normal", description: "Available dates have been gathered from both teams" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "pb3", name: "Conflict Free", type: "normal", description: "Proposed dates have no scheduling conflicts" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "pb4", name: "Options Ready", type: "normal", description: "A set of valid date options exists for team captains" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "pb5", name: "Proposal Finalized", type: "terminal", description: "A specific date/time has been selected" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
    transitions: [
      { id: "pbt1", from: "pb1", to: "pb2", architectLabel: "GATHER_DATES", operatorLabel: "Collect Available Dates", guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "pbt2", from: "pb2", to: "pb3", architectLabel: "CHECK_CONFLICTS", operatorLabel: "Verify No Conflicts", guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "pbt3", from: "pb3", to: "pb4", architectLabel: "BUILD_OPTIONS", operatorLabel: "Present Date Options", guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "pbt4", from: "pb4", to: "pb5", architectLabel: "SELECT_DATE", operatorLabel: "Finalize Selection", guard: "captain_selected", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "pbt5", from: "pb3", to: "pb2", architectLabel: "CONFLICT_FOUND", operatorLabel: "Re-collect Dates", guard: "conflict_detected", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
  },
  "Score Capture": {
    owners: ["ed.stull"],
    editors: [],
    states: [
      { id: "sc1", name: "Unrecorded", type: "initial", description: "No score data has been entered for this match" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "sc2", name: "Home Reported", type: "normal", description: "Home team has submitted a score" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "sc3", name: "Confirmation Pending", type: "normal", description: "Away team has received the score for verification" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "sc4", name: "Score Verified", type: "terminal", description: "Both teams agree on the final score" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "sc5", name: "Score Contested", type: "terminal", description: "Away team disagrees — escalation required" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
    transitions: [
      { id: "sct1", from: "sc1", to: "sc2", architectLabel: "ENTER_HOME_SCORE", operatorLabel: "Home Enters Score", guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "sct2", from: "sc2", to: "sc3", architectLabel: "NOTIFY_AWAY", operatorLabel: "Send to Away Team", guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "sct3", from: "sc3", to: "sc4", architectLabel: "CONFIRM_SCORE", operatorLabel: "Away Confirms", guard: "away_agrees", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "sct4", from: "sc3", to: "sc5", architectLabel: "CONTEST_SCORE", operatorLabel: "Away Disputes", guard: "away_disagrees", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "sct5", from: "sc2", to: "sc1", architectLabel: "RETRACT_SCORE", operatorLabel: "Home Corrects", guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
  },
  "Dispute Resolution": {
    owners: ["ed.stull"],
    editors: [],
    states: [
      { id: "dr1", name: "Filed", type: "initial", description: "A dispute has been formally submitted" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "dr2", name: "Under Club Review", type: "normal", description: "Club admin is reviewing the dispute" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "dr3", name: "Escalated", type: "normal", description: "Commissioner has received the dispute for review" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "dr4", name: "Resolved", type: "terminal", description: "A resolution decision has been rendered" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
    transitions: [
      { id: "drt1", from: "dr1", to: "dr2", architectLabel: "ASSIGN_TO_CLUB", operatorLabel: "Club Admin Reviews", guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "drt2", from: "dr2", to: "dr4", architectLabel: "CLUB_RESOLVES", operatorLabel: "Club Decision", guard: "resolved_at_club", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "drt3", from: "dr2", to: "dr3", architectLabel: "ESCALATE", operatorLabel: "Escalate to Commissioner", guard: "club_cannot_resolve", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "drt4", from: "dr3", to: "dr4", architectLabel: "COMMISSIONER_DECIDES", operatorLabel: "Commissioner Ruling", guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
  },
  "Resolution Review": {
    owners: ["ed.stull"],
    editors: [],
    states: [
      { id: "rr1", name: "Pending", type: "initial", description: "Resolution request is queued for review" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "rr2", name: "Evidence Collected", type: "normal", description: "All relevant evidence has been gathered" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "rr3", name: "Decision Rendered", type: "terminal", description: "A final, binding decision exists" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
    transitions: [
      { id: "rrt1", from: "rr1", to: "rr2", architectLabel: "GATHER_EVIDENCE", operatorLabel: "Collect Evidence", guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "rrt2", from: "rr2", to: "rr3", architectLabel: "RENDER_DECISION", operatorLabel: "Issue Decision", guard: "evidence_sufficient", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "rrt3", from: "rr2", to: "rr1", architectLabel: "REQUEST_MORE", operatorLabel: "Need More Evidence", guard: "evidence_insufficient", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
  },
  "Master FSM Interpreter": {
    owners: ["ed.stull"],
    editors: [],
    states: [
      { id: "mi1", name: "Idle", type: "initial", description: "No FSM instance is active" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mi2", name: "Instance Loaded", type: "normal", description: "An FSM definition is in memory with current state set to initial" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mi3", name: "Transition Selected", type: "normal", description: "An outgoing transition has been chosen to fire" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mi4", name: "Atomic Dispatched", type: "normal", description: "A primitive procedure call has been sent, no result yet" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mi5", name: "Child Active", type: "normal", description: "A nested interpreter instance is running and has not yet reached terminal" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mi6", name: "Instance Complete", type: "normal", description: "Current state is terminal — this FSM run is finished" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mi7", name: "Faulted", type: "normal", description: "An unrecoverable error condition exists" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mi8", name: "Shut Down", type: "terminal", description: "Interpreter has been explicitly stopped" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
    transitions: [
      { id: "mit1", from: "mi1", to: "mi2", architectLabel: "LOAD_DEFINITION", operatorLabel: "Load FSM",
        guard: "definition_exists", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit2", from: "mi2", to: "mi3", architectLabel: "SELECT_TRANSITION", operatorLabel: "Evaluate Guards",
        guard: "eligible_transition_found", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit3", from: "mi2", to: "mi6", architectLabel: "DETECT_TERMINAL", operatorLabel: "Terminal Reached",
        guard: "current_state_is_terminal", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit4", from: "mi3", to: "mi4", architectLabel: "DISPATCH_ATOMIC", operatorLabel: "Call Primitive",
        guard: "execution_type_atomic", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit5", from: "mi3", to: "mi5", architectLabel: "SPAWN_CHILD", operatorLabel: "Enter Embedded FSM",
        guard: "execution_type_compound", executionType: "compound", embeddedFSM: "Master FSM Interpreter" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit6", from: "mi4", to: "mi2", architectLabel: "ATOMIC_RESOLVED", operatorLabel: "Primitive Succeeded",
        guard: "result_ok", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit7", from: "mi5", to: "mi2", architectLabel: "CHILD_COMPLETED", operatorLabel: "Child Reached Terminal",
        guard: "child_terminal", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit8", from: "mi6", to: "mi1", architectLabel: "RELEASE_INSTANCE", operatorLabel: "Clean Up",
        guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit9", from: "mi4", to: "mi7", architectLabel: "PRIMITIVE_FAILED", operatorLabel: "Procedure Error",
        guard: "result_error", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit10", from: "mi5", to: "mi7", architectLabel: "CHILD_FAULTED", operatorLabel: "Child Error",
        guard: "child_faulted", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit11", from: "mi7", to: "mi1", architectLabel: "RESET", operatorLabel: "Discard & Reset",
        guard: "", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit12", from: "mi7", to: "mi2", architectLabel: "RETRY", operatorLabel: "Retry from Fault",
        guard: "retry_policy_exists", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit13", from: "mi1", to: "mi8", architectLabel: "SHUTDOWN", operatorLabel: "Stop Interpreter",
        guard: "shutdown_requested", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
      { id: "mit14", from: "mi2", to: "mi7", architectLabel: "GUARD_DEADLOCK", operatorLabel: "No Eligible Transition",
        guard: "no_transition_eligible", executionType: "atomic", embeddedFSM: "" , createdBy: "ed.stull", createdAt: "2026-02-10-0830-America_New_York" },
    ],
  },
};

// ── Color Themes ─────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#0a0e17", surface: "#111827", surfaceAlt: "#1a2332",
    border: "#2a3a4e", borderFocus: "#4a90d9",
    text: "#e2e8f0", textMuted: "#8899aa", textDim: "#556677",
    accent: "#4a90d9",
    initial: "#34d399", initialBg: "rgba(52,211,153,0.12)",
    terminal: "#f87171", terminalBg: "rgba(248,113,113,0.12)",
    normal: "#60a5fa", normalBg: "rgba(96,165,250,0.08)",
    compound: "#c084fc", compoundBg: "rgba(192,132,252,0.15)",
    warning: "#fbbf24", error: "#ef4444", success: "#34d399", info: "#60a5fa",
    edgeLine: "#5a8abb", edgeLabel: "#a0b4cc",
    flash: "rgba(192,132,252,0.08)",
  },
  light: {
    bg: "#f8f9fb", surface: "#ffffff", surfaceAlt: "#f0f2f5",
    border: "#d0d5dd", borderFocus: "#2563eb",
    text: "#1a1a2e", textMuted: "#555566", textDim: "#888899",
    accent: "#2563eb",
    initial: "#059669", initialBg: "rgba(5,150,105,0.10)",
    terminal: "#dc2626", terminalBg: "rgba(220,38,38,0.08)",
    normal: "#2563eb", normalBg: "rgba(37,99,235,0.06)",
    compound: "#7c3aed", compoundBg: "rgba(124,58,237,0.08)",
    warning: "#d97706", error: "#dc2626", success: "#059669", info: "#2563eb",
    edgeLine: "#4a6a8a", edgeLabel: "#444455",
    flash: "rgba(124,58,237,0.06)",
  },
};
let CC = THEMES.dark;

const stateColor = (type) => {
  if (type === "initial") return { stroke: CC.initial, fill: CC.initialBg };
  if (type === "terminal") return { stroke: CC.terminal, fill: CC.terminalBg };
  return { stroke: CC.normal, fill: CC.normalBg };
};

let _idCounter = 500;
const nextId = (prefix) => `${prefix}${++_idCounter}`;

function wrapText(text, maxChars) {
  if (!text) return [];
  const words = text.split(" ");
  const lines = []; let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (test.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function getNodeSize(d, transitions) {
  const charW = 9, detailCharW = 7.5, pad = 32;
  const nameW = d.name.length * charW + pad * 2;
  const detailLines = [];
  if (d.description) detailLines.push(...wrapText(d.description, 26));
  const guarded = (transitions || []).filter(t => t.from === d.id && t.guard);
  guarded.forEach(g => detailLines.push(`[${g.guard}]`));
  const hasDetails = detailLines.length > 0;
  const nameH = 38, detailH = hasDetails ? detailLines.length * 17 + 16 : 0;
  const totalH = nameH + detailH;
  const maxDetailW = hasDetails ? Math.max(...detailLines.map(l => l.length * detailCharW + pad)) : 0;
  const w = Math.max(170, nameW, maxDetailW);
  return { w, totalH, nameH, detailH, hasDetails, detailLines };
}

function rectIntersect(cx, cy, hw, hh, px, py, margin = 4) {
  const dx = px - cx, dy = py - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy - hh - margin };
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  const hw2 = hw + margin, hh2 = hh + margin;
  const scale = (absDx * hh2 > absDy * hw2) ? hw2 / absDx : hh2 / absDy;
  return { x: cx + dx * scale, y: cy + dy * scale };
}

// ── Miniature FSM Renderer (static layout, no force sim) ─────────────────────
function renderMiniatureFSM(g, fsm, cx, cy, maxW, maxH, opacity = 1) {
  if (!fsm || !fsm.states.length) return;
  const { states, transitions } = fsm;
  const n = states.length;

  // Simple circular layout
  const radius = Math.min(maxW, maxH) * 0.32;
  const positions = states.map((s, i) => ({
    ...s,
    x: cx + Math.cos(i * 2 * Math.PI / n - Math.PI / 2) * radius,
    y: cy + Math.sin(i * 2 * Math.PI / n - Math.PI / 2) * radius,
  }));

  const miniG = g.append("g").attr("opacity", opacity);

  // Background card
  miniG.append("rect")
    .attr("x", cx - maxW / 2).attr("y", cy - maxH / 2)
    .attr("width", maxW).attr("height", maxH)
    .attr("rx", 6).attr("fill", CC.flash)
    .attr("stroke", CC.compound).attr("stroke-width", 1).attr("stroke-dasharray", "4,2");

  // Title
  miniG.append("text").attr("x", cx).attr("y", cy - maxH / 2 + 14)
    .attr("text-anchor", "middle").attr("fill", CC.compound)
    .attr("font-size", "11px").attr("font-weight", "700")
    .attr("font-family", "'JetBrains Mono',monospace")
    .text(fsm._name || "");

  // Edges
  transitions.forEach(t => {
    const src = positions.find(p => p.id === t.from);
    const tgt = positions.find(p => p.id === t.to);
    if (!src || !tgt) return;
    if (src.id === tgt.id) return; // skip self-loops in mini
    const dx = tgt.x - src.x, dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const dr = dist * 2;
    miniG.append("path")
      .attr("d", `M${src.x},${src.y} A${dr},${dr} 0 0,1 ${tgt.x},${tgt.y}`)
      .attr("fill", "none")
      .attr("stroke", t.executionType === "compound" ? CC.compound : CC.edgeLine)
      .attr("stroke-width", 0.8)
      .attr("stroke-dasharray", t.executionType === "compound" ? "3,2" : "none")
      .attr("marker-end", "none");
  });

  // Nodes
  positions.forEach(p => {
    const col = stateColor(p.type);
    const r = 10;
    miniG.append("circle")
      .attr("cx", p.x).attr("cy", p.y).attr("r", r)
      .attr("fill", col.fill).attr("stroke", col.stroke).attr("stroke-width", 1.5);
    if (p.type === "terminal") {
      miniG.append("circle")
        .attr("cx", p.x).attr("cy", p.y).attr("r", r - 3)
        .attr("fill", "none").attr("stroke", col.stroke).attr("stroke-width", 0.5).attr("opacity", 0.5);
    }
    miniG.append("text").attr("x", p.x).attr("y", p.y + r + 10)
      .attr("text-anchor", "middle").attr("fill", CC.textMuted)
      .attr("font-size", "11px").attr("font-family", "'JetBrains Mono',monospace")
      .text(p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name);
  });

  return miniG;
}

// ── Inline Edit Panels ───────────────────────────────────────────────────────
function InlineStateEditor({ state, states, onUpdate, onDelete, onClose, lockedBy, saveNudge, canEdit }) {
  const v = validateState(state, states);
  const isReadOnly = !canEdit;
  return (
    <div style={panelStyle} onClick={e => e.stopPropagation()}>
      <div style={panelHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: CC.accent, fontWeight: 700, fontSize: 11 }}>Edit State</span>
          {lockedBy && <span style={{ fontSize: 9, color: CC.warning, fontWeight: 600 }}>🔒 {lockedBy}</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isReadOnly && <button style={panelBtnDanger} onClick={() => { onDelete(state.id); onClose(); }}>Delete</button>}
          <button style={{ ...panelBtnClose, background: CC.accent, color: "#fff", borderRadius: 4, padding: "2px 10px", fontWeight: 600, border: "none" }} onClick={onClose}>Save ✓</button>
        </div>
      </div>
      {saveNudge && <div style={{ background: CC.warning + "18", borderBottom: `1px solid ${CC.warning}33`, padding: "4px 12px", fontSize: 10, color: CC.warning }}>⏱ Please save — other editors may be waiting</div>}
      <div style={panelBody}>
        <div style={fieldGroup}><label style={fieldLabel}>Name</label><input style={fieldInput} value={state.name} onChange={e => onUpdate(state.id, "name", e.target.value)} autoFocus disabled={isReadOnly} /></div>
        <div style={fieldGroup}><label style={fieldLabel}>Type</label>
          <select style={fieldInput} value={state.type} onChange={e => onUpdate(state.id, "type", e.target.value)} disabled={isReadOnly}>
            <option value="initial">Initial</option><option value="normal">Normal</option><option value="terminal">Terminal</option>
          </select></div>
        <div style={fieldGroup}><label style={fieldLabel}>Description</label><input style={fieldInput} value={state.description} onChange={e => onUpdate(state.id, "description", e.target.value)} disabled={isReadOnly} /></div>
        {state.createdBy && <div style={{ fontSize: 9, color: CC.textDim, marginTop: 2 }}>Created by {state.createdBy} · {state.createdAt}</div>}
        {v.errors.map((e, i) => <div key={`e${i}`} style={valStyle("error")}>⛔ {e}</div>)}
        {v.warnings.map((w, i) => <div key={`w${i}`} style={valStyle("warning")}>⚠ {w}</div>)}
      </div></div>
  );
}
function InlineTransitionEditor({ transition, states, onUpdate, onDelete, onClose, registry, onNavigate, lockedBy, saveNudge, canEdit }) {
  const v = validateTransition(transition, states);
  const canDrill = transition.executionType === "compound" && transition.embeddedFSM && registry[transition.embeddedFSM];
  const isReadOnly = !canEdit;
  return (
    <div style={{ ...panelStyle, width: 310 }} onClick={e => e.stopPropagation()}>
      <div style={panelHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: CC.accent, fontWeight: 700, fontSize: 11 }}>Edit Transition</span>
          {lockedBy && <span style={{ fontSize: 9, color: CC.warning, fontWeight: 600 }}>🔒 {lockedBy}</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isReadOnly && <button style={panelBtnDanger} onClick={() => { onDelete(transition.id); onClose(); }}>Delete</button>}
          <button style={{ ...panelBtnClose, background: CC.accent, color: "#fff", borderRadius: 4, padding: "2px 10px", fontWeight: 600, border: "none" }} onClick={onClose}>Save ✓</button>
        </div>
      </div>
      {saveNudge && <div style={{ background: CC.warning + "18", borderBottom: `1px solid ${CC.warning}33`, padding: "4px 12px", fontSize: 10, color: CC.warning }}>⏱ Please save — other editors may be waiting</div>}
      <div style={panelBody}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ ...fieldGroup, flex: 1 }}><label style={fieldLabel}>From</label>
            <select style={fieldInput} value={transition.from} onChange={e => onUpdate(transition.id, "from", e.target.value)} disabled={isReadOnly}>{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div style={{ ...fieldGroup, flex: 1 }}><label style={fieldLabel}>To</label>
            <select style={fieldInput} value={transition.to} onChange={e => onUpdate(transition.id, "to", e.target.value)} disabled={isReadOnly}>{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
        <div style={fieldGroup}><label style={fieldLabel}>Architect Label</label><input style={fieldInput} value={transition.architectLabel} onChange={e => onUpdate(transition.id, "architectLabel", e.target.value)} disabled={isReadOnly} /></div>
        <div style={fieldGroup}><label style={fieldLabel}>Operator Label</label><input style={fieldInput} value={transition.operatorLabel} onChange={e => onUpdate(transition.id, "operatorLabel", e.target.value)} disabled={isReadOnly} /></div>
        <div style={fieldGroup}><label style={fieldLabel}>Guard</label><input style={fieldInput} value={transition.guard} placeholder="e.g. both_teams_accepted" onChange={e => onUpdate(transition.id, "guard", e.target.value)} disabled={isReadOnly} /></div>
        <div style={{ borderTop: `1px solid ${CC.border}`, paddingTop: 6, marginTop: 2 }}>
          <div style={fieldGroup}><label style={fieldLabel}>Execution</label>
            <select style={fieldInput} value={transition.executionType} onChange={e => onUpdate(transition.id, "executionType", e.target.value)} disabled={isReadOnly}>
              <option value="atomic">Atomic (primitive)</option><option value="compound">Compound (embedded FSM)</option>
            </select></div>
          {transition.executionType === "compound" && (
            <div style={{ ...fieldGroup, marginTop: 6 }}><label style={fieldLabel}>Embedded FSM</label>
              <input style={{ ...fieldInput, borderColor: CC.compound, color: CC.compound }} value={transition.embeddedFSM || ""} placeholder="e.g. Proposal Builder"
                onChange={e => onUpdate(transition.id, "embeddedFSM", e.target.value)} disabled={isReadOnly} /></div>)}
          {canDrill && (
            <button onClick={() => { onClose(); onNavigate(transition.embeddedFSM); }}
              style={{ marginTop: 6, background: CC.compound, border: "none", color: "#fff", borderRadius: 4,
                padding: "6px 12px", fontSize: 11, fontFamily: "inherit", fontWeight: 600, cursor: "pointer", width: "100%" }}>
              ▶ Open "{transition.embeddedFSM}"
            </button>)}
        </div>
        {transition.createdBy && <div style={{ fontSize: 9, color: CC.textDim, marginTop: 4 }}>Created by {transition.createdBy} · {transition.createdAt}</div>}
        {v.errors.map((e, i) => <div key={`e${i}`} style={valStyle("error")}>⛔ {e}</div>)}
        {v.warnings.map((w, i) => <div key={`w${i}`} style={valStyle("warning")}>⚠ {w}</div>)}
      </div></div>
  );
}
const panelStyle = { background: CC.surface, border: `1px solid ${CC.borderFocus}`, borderRadius: 8, boxShadow: `0 8px 32px rgba(0,0,0,0.6)`, width: 290, fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace", overflow: "hidden" };
const panelHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: CC.surfaceAlt, borderBottom: `1px solid ${CC.border}` };
const panelBody = { padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 };
const panelBtnClose = { background: "transparent", border: "none", color: CC.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "2px 4px" };
const panelBtnDanger = { background: "transparent", border: `1px solid ${CC.error}`, color: CC.error, fontSize: 11, fontFamily: "inherit", fontWeight: 600, borderRadius: 3, padding: "2px 8px", cursor: "pointer" };
const fieldGroup = { display: "flex", flexDirection: "column", gap: 2 };
const fieldLabel = { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: CC.textDim };
const fieldInput = { width: "100%", background: CC.bg, border: `1px solid ${CC.border}`, borderRadius: 4, color: CC.text, padding: "5px 7px", fontSize: 11, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const valStyle = (l) => ({ fontSize: 11, color: l === "error" ? CC.error : CC.warning, padding: "2px 0" });

// ── Process Decomposition Tree ───────────────────────────────────────────────
function ProcessTree({ registry, rootName, currentFSMName, maxDepth, onNavigate, onFlashStart, onFlashEnd }) {
  const visited = useRef(new Set());

  const renderNode = (fsmName, depth, parentTransLabel) => {
    if (depth > maxDepth) return <div key={fsmName + depth} style={{ paddingLeft: 12, fontSize: 11, color: CC.textDim, fontStyle: "italic" }}>… deeper levels hidden</div>;
    if (visited.current.has(fsmName)) return <div key={fsmName + "cyc"} style={{ paddingLeft: 12, fontSize: 11, color: CC.warning }}>↻ cycle: {fsmName}</div>;
    const fsm = registry[fsmName];
    if (!fsm) return <div key={fsmName} style={{ paddingLeft: 12, fontSize: 11, color: CC.error }}>⚠ "{fsmName}" not in registry</div>;

    visited.current.add(fsmName);
    const isCurrent = fsmName === currentFSMName;
    const compounds = fsm.transitions.filter(t => t.executionType === "compound" && t.embeddedFSM);
    const atomicCount = fsm.transitions.filter(t => t.executionType === "atomic").length;
    const stateCount = fsm.states.length;

    const children = compounds.map(t => renderNode(t.embeddedFSM, depth + 1, t.operatorLabel || t.architectLabel));
    visited.current.delete(fsmName);

    return (
      <div key={fsmName + depth} style={{ marginBottom: depth === 0 ? 0 : 2 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 4, padding: "3px 0", cursor: "pointer", borderRadius: 4,
          background: isCurrent ? `${CC.compound}18` : "transparent" }}
          onClick={() => onNavigate(fsmName)}
          onMouseEnter={() => { if (!isCurrent && onFlashStart) onFlashStart(fsmName); }}
          onMouseLeave={() => { if (onFlashEnd) onFlashEnd(); }}>
          <span style={{ color: compounds.length ? CC.compound : CC.success, fontSize: 11, flexShrink: 0, width: 12, textAlign: "center" }}>
            {compounds.length ? "▾" : "●"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 500,
              color: isCurrent ? CC.compound : CC.text, lineHeight: 1.3 }}>
              {fsmName}
            </div>
            {parentTransLabel && depth > 0 && (
              <div style={{ fontSize: 11, color: CC.textDim, marginTop: 1 }}>via {parentTransLabel}</div>
            )}
            <div style={{ fontSize: 11, color: CC.textDim, marginTop: 1 }}>
              {stateCount}s · {atomicCount}a · {compounds.length}c
            </div>
          </div>
        </div>
        {children.length > 0 && (
          <div style={{ paddingLeft: 14, borderLeft: `1px solid ${CC.border}`, marginLeft: 5 }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  visited.current.clear();
  return renderNode(rootName, 0, null);
}

// ── Diagram Component ────────────────────────────────────────────────────────
function FSMDiagram({ states, transitions, selectedStateId, selectedTransitionId,
  onSelectState, onSelectTransition, onDblClickState, onDblClickTransition, containerRef, onZoomReady, showEmbedded, registry, flashTarget, onNavigateFSM, theme, locks, currentUser }) {
  const svgRef = useRef(null);
  const nodesDataRef = useRef([]);
  const hasFittedRef = useRef(false);
  const width = 960, height = 740;

  useEffect(() => {
    if (!svgRef.current || !states.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const defs = svg.append("defs");
    // Metadata tooltip
    let metaTip = containerRef?.current?.querySelector(".meta-tooltip");
    if (!metaTip) {
      metaTip = document.createElement("div");
      metaTip.className = "meta-tooltip";
      Object.assign(metaTip.style, { position: "absolute", display: "none", background: "#151828ee", color: "#c0c8d8",
        border: "1px solid #2a3050", borderRadius: "6px", padding: "6px 10px", fontSize: "11px", lineHeight: "1.5",
        whiteSpace: "pre", zIndex: "30", pointerEvents: "none", backdropFilter: "blur(8px)",
        fontFamily: "'JetBrains Mono',monospace", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" });
      containerRef?.current?.appendChild(metaTip);
    }
    let tipTimer = null;
    const showMetaTip = (ev, text) => {
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => {
        const rect = containerRef?.current?.getBoundingClientRect();
        if (!rect) return;
        metaTip.textContent = text;
        metaTip.style.display = "block";
        metaTip.style.left = (ev.clientX - rect.left + 12) + "px";
        metaTip.style.top = (ev.clientY - rect.top - 40) + "px";
      }, 1000);
    };
    const hideMetaTip = () => { clearTimeout(tipTimer); metaTip.style.display = "none"; };
    defs.append("marker").attr("id", "arrow").attr("viewBox", "0 0 10 6").attr("refX", 10).attr("refY", 3).attr("markerWidth", 10).attr("markerHeight", 7).attr("orient", "auto").append("path").attr("d", "M0,0 L10,3 L0,6 Z").attr("fill", CC.edgeLine);
    defs.append("marker").attr("id", "arrow-sel").attr("viewBox", "0 0 10 6").attr("refX", 10).attr("refY", 3).attr("markerWidth", 10).attr("markerHeight", 7).attr("orient", "auto").append("path").attr("d", "M0,0 L10,3 L0,6 Z").attr("fill", CC.accent);
    defs.append("marker").attr("id", "arrow-comp").attr("viewBox", "0 0 10 6").attr("refX", 10).attr("refY", 3).attr("markerWidth", 10).attr("markerHeight", 7).attr("orient", "auto").append("path").attr("d", "M0,0 L10,3 L0,6 Z").attr("fill", CC.compound);
    const glow = defs.append("filter").attr("id", "glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    glow.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).enter().append("feMergeNode").attr("in", d => d);

    const oldPos = {}; nodesDataRef.current.forEach(n => { oldPos[n.id] = { x: n.x, y: n.y }; });

    // Compute 3-zone layout: initial (left) | normal (center) | terminal (right)
    const zoneMap = {}; // 0 = left, 1 = center, 2 = right
    states.forEach(s => {
      if (s.type === "initial") zoneMap[s.id] = 0;
      else if (s.type === "terminal") zoneMap[s.id] = 2;
      else zoneMap[s.id] = 1;
    });

    // BFS depth for ordering center zone top-to-bottom
    const bfsDepth = {};
    const initials = states.filter(s => s.type === "initial");
    if (initials.length) {
      const queue = initials.map(s => ({ id: s.id, depth: 0 }));
      const visited = new Set(initials.map(s => s.id));
      while (queue.length) {
        const { id, depth } = queue.shift();
        bfsDepth[id] = Math.max(bfsDepth[id] || 0, depth);
        transitions.filter(t => t.from === id).forEach(t => {
          if (!visited.has(t.to)) { visited.add(t.to); queue.push({ id: t.to, depth: depth + 1 }); }
        });
      }
      states.forEach(s => { if (bfsDepth[s.id] === undefined) bfsDepth[s.id] = 2; });
    }

    // Step 1: Compute center zone positions — spread by BFS depth, not single column
    const centerMembers = states.filter(s => zoneMap[s.id] === 1)
      .sort((a, b) => (bfsDepth[a.id] || 0) - (bfsDepth[b.id] || 0));
    const centerY = {};
    centerMembers.forEach((s, i) => {
      const spread = Math.max(centerMembers.length - 1, 1);
      centerY[s.id] = height * 0.1 + (i / spread) * height * 0.8;
    });

    // Center X: spread across a band by BFS depth
    const centerMinDepth = Math.min(...centerMembers.map(s => bfsDepth[s.id] || 0));
    const centerMaxDepth = Math.max(...centerMembers.map(s => bfsDepth[s.id] || 0));
    const centerDepthRange = Math.max(centerMaxDepth - centerMinDepth, 1);
    const CENTER_LEFT = width * 0.28, CENTER_RIGHT = width * 0.62;
    const centerX = {};
    centerMembers.forEach(s => {
      const depthFrac = ((bfsDepth[s.id] || 0) - centerMinDepth) / centerDepthRange;
      centerX[s.id] = CENTER_LEFT + depthFrac * (CENTER_RIGHT - CENTER_LEFT);
    });

    // Detect back-edge nodes: outgoing transitions to lower BFS depth → pull X toward targets
    centerMembers.forEach(s => {
      const outgoing = transitions.filter(t => t.from === s.id);
      const backTargets = outgoing
        .filter(t => (bfsDepth[t.to] || 0) < (bfsDepth[s.id] || 0))
        .map(t => centerX[t.to] ?? (zoneMap[t.to] === 0 ? width * 0.15 : centerX[t.to]));
      if (backTargets.length > 0) {
        const avgTargetX = backTargets.reduce((a, b) => a + b, 0) / backTargets.length;
        // Blend 60% toward the back-target to pull it left
        centerX[s.id] = centerX[s.id] * 0.4 + avgTargetX * 0.6;
      }
    });

    // Step 2: Compute initial zone Y — average of outgoing targets
    const initialMembers = states.filter(s => zoneMap[s.id] === 0);
    const initialY = {};
    initialMembers.forEach((s, i) => {
      const targets = transitions.filter(t => t.from === s.id).map(t => centerY[t.to]).filter(y => y !== undefined);
      initialY[s.id] = targets.length ? targets.reduce((a, b) => a + b, 0) / targets.length : height / 2;
    });

    // Step 3: Compute terminal zone Y — average of incoming source Y positions
    // This is the key fix: Cancelled goes near Confirmed/Proposed, Completed near InProgress/Disputed
    const terminalMembers = states.filter(s => zoneMap[s.id] === 2);
    const terminalY = {};
    terminalMembers.forEach(s => {
      const sources = transitions.filter(t => t.to === s.id)
        .map(t => centerY[t.from] ?? initialY[t.from])
        .filter(y => y !== undefined);
      terminalY[s.id] = sources.length ? sources.reduce((a, b) => a + b, 0) / sources.length : height / 2;
    });
    // If terminals overlap vertically, push them apart
    if (terminalMembers.length > 1) {
      const sorted = [...terminalMembers].sort((a, b) => terminalY[a.id] - terminalY[b.id]);
      for (let i = 1; i < sorted.length; i++) {
        const minGap = 120; // minimum vertical gap between terminal states
        if (terminalY[sorted[i].id] - terminalY[sorted[i - 1].id] < minGap) {
          terminalY[sorted[i].id] = terminalY[sorted[i - 1].id] + minGap;
        }
      }
    }

    const nodes = states.map((s) => {
      const old = oldPos[s.id]; const dims = getNodeSize(s, transitions);
      const zone = zoneMap[s.id];
      const zoneX = zone === 0 ? width * 0.15 : zone === 2 ? width * 0.85 : (centerX[s.id] || width * 0.50);
      const seedY = zone === 0 ? (initialY[s.id] || height / 2) :
                    zone === 2 ? (terminalY[s.id] || height / 2) :
                    (centerY[s.id] || height / 2);
      return { ...s, ...dims, x: old ? old.x : zoneX, y: old ? old.y : seedY };
    });
    const links = transitions.map(t => ({ ...t, source: t.from, target: t.to }));

    // Vertical targets use the same connectivity-aware positions
    const yTargets = {};
    nodes.forEach(n => {
      const zone = zoneMap[n.id];
      yTargets[n.id] = zone === 0 ? (initialY[n.id] || height / 2) :
                       zone === 2 ? (terminalY[n.id] || height / 2) :
                       (centerY[n.id] || height / 2);
    });

    // Pre-compute minimum link distances: label text must fit between node edges
    const LABEL_CHAR_W = 7.5; // approximate char width at 12px monospace
    const LABEL_PAD = 40; // padding around label text
    const linkMinDist = {};
    links.forEach(link => {
      const t = link;
      // Find the widest text line for this transition
      const labelText = t.operatorLabel || t.architectLabel || "";
      const guardText = t.guard ? `[${t.guard}]` : "";
      const embedText = (t.executionType === "compound" && t.embeddedFSM) ? `▶ ${t.embeddedFSM}` : "";
      const maxTextW = Math.max(
        labelText.length * LABEL_CHAR_W,
        guardText.length * LABEL_CHAR_W,
        embedText.length * LABEL_CHAR_W
      );
      // Source and target half-widths
      const srcNode = nodes.find(n => n.id === (typeof t.source === "object" ? t.source.id : t.source));
      const tgtNode = nodes.find(n => n.id === (typeof t.target === "object" ? t.target.id : t.target));
      const srcHW = srcNode ? srcNode.w / 2 : 75;
      const tgtHW = tgtNode ? tgtNode.w / 2 : 75;
      linkMinDist[t.id] = srcHW + maxTextW + LABEL_PAD + tgtHW;
    });

    // X targets per node for force
    const xTargets = {};
    nodes.forEach(n => {
      const zone = zoneMap[n.id];
      xTargets[n.id] = zone === 0 ? width * 0.15 : zone === 2 ? width * 0.85 : (centerX[n.id] || width * 0.50);
    });

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id)
        .distance(d => Math.max(180, linkMinDist[d.id] || 180))
        .strength(0.2))
      .force("charge", d3.forceManyBody().strength(-600))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => Math.max(d.w, d.totalH) / 2 + 18))
      // Horizontal force: per-node X target
      .force("xpos", d3.forceX().x(d => xTargets[d.id] || width / 2).strength(0.25))
      // Vertical force: spread nodes within their zone
      .force("ypos", d3.forceY().y(d => yTargets[d.id] || height / 2).strength(0.12))
      .alphaDecay(0.04);

    const g = svg.append("g");
    const zoomBehavior = d3.zoom().scaleExtent([0.1, 5])
      .on("zoom", e => g.attr("transform", e.transform))
      .filter(e => e.type === "wheel" || e.type === "mousedown");
    // Override wheel to always zoom toward viewport center
    svg.call(zoomBehavior);
    svg.on("wheel.zoom", function(e) {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1.08 : 0.92;
      svg.transition().duration(150).call(zoomBehavior.scaleBy, dir, [width / 2, height / 2]);
    });

    const fitToView = (animate = true) => {
      const gNode = g.node(); if (!gNode) return;
      const bbox = gNode.getBBox();
      if (!bbox.width || !bbox.height) return;
      const pad = 25;
      const sc = Math.min(width / (bbox.width + pad * 2), height / (bbox.height + pad * 2), 3.0);
      const tx = width / 2 - (bbox.x + bbox.width / 2) * sc;
      const ty = height / 2 - (bbox.y + bbox.height / 2) * sc;
      const tf = d3.zoomIdentity.translate(tx, ty).scale(sc);
      if (animate) svg.transition().duration(500).call(zoomBehavior.transform, tf);
      else svg.call(zoomBehavior.transform, tf);
    };
    if (onZoomReady) onZoomReady({ fitToView: () => fitToView(true), zoomIn: () => svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.3, [width / 2, height / 2]), zoomOut: () => svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.7, [width / 2, height / 2]) });

    const svgToContainer = (svgX, svgY) => {
      const svgEl = svgRef.current, contEl = containerRef?.current;
      if (!svgEl || !contEl) return { x: 0, y: 0 };
      const pt = svgEl.createSVGPoint(); pt.x = svgX; pt.y = svgY;
      const sp = pt.matrixTransform(g.node().getScreenCTM());
      const cr = contEl.getBoundingClientRect();
      return { x: sp.x - cr.left, y: sp.y - cr.top };
    };

    // ── Edges ──
    const edgeG = g.append("g");
    const edgeEls = edgeG.selectAll("g").data(links).enter().append("g").style("cursor", "pointer")
      .on("click", (ev, d) => { ev.stopPropagation(); onSelectTransition(d.id); });
    edgeEls.append("path").attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 20).style("pointer-events", "stroke");
    edgeEls.append("path").attr("fill", "none").attr("stroke", CC.accent).attr("stroke-width", 4).attr("opacity", 0).style("pointer-events", "none");
    const edgePaths = edgeEls.append("path").attr("fill", "none")
      .attr("stroke", d => d.id === selectedTransitionId ? CC.accent : d.executionType === "compound" ? CC.compound : CC.edgeLine)
      .attr("stroke-width", d => d.id === selectedTransitionId ? 2.5 : d.executionType === "compound" ? 2.25 : 2)
      .attr("marker-end", d => d.id === selectedTransitionId ? "url(#arrow-sel)" : d.executionType === "compound" ? "url(#arrow-comp)" : "url(#arrow)")
      .attr("opacity", 1).attr("stroke-dasharray", d => d.executionType === "compound" ? "8,4" : "none").style("pointer-events", "none");

    edgeEls
      .on("mouseenter", function(ev, d) { d3.select(this).select("path:nth-child(2)").attr("opacity", 0.2); d3.select(this).select("path:nth-child(3)").attr("stroke", CC.accent).attr("stroke-width", 2.5).attr("opacity", 1); showMetaTip(ev, formatMeta(d.createdBy, d.createdAt)); })
      .on("mousemove", function(ev, d) { showMetaTip(ev, formatMeta(d.createdBy, d.createdAt)); })
      .on("mouseleave", function(ev, d) { d3.select(this).select("path:nth-child(2)").attr("opacity", 0); d3.select(this).select("path:nth-child(3)").attr("stroke", d.id === selectedTransitionId ? CC.accent : d.executionType === "compound" ? CC.compound : CC.edgeLine).attr("stroke-width", d.id === selectedTransitionId ? 2.5 : d.executionType === "compound" ? 2.25 : 2).attr("opacity", 1); hideMetaTip(); })
      .on("dblclick", (ev, d) => { ev.stopPropagation(); ev.preventDefault(); const pos = svgToContainer((d.source.x + d.target.x) / 2, (d.source.y + d.target.y) / 2); onDblClickTransition(d.id, pos.x, pos.y); });

    const edgeLabelBg = edgeEls.append("rect").attr("fill", CC.bg).attr("rx", 3).attr("opacity", 0.9);
    const edgeLabels = edgeEls.append("text").attr("fill", d => d.id === selectedTransitionId ? CC.accent : d.executionType === "compound" ? CC.compound : CC.edgeLabel).attr("font-size", "12px").attr("font-family", "'JetBrains Mono',monospace").attr("text-anchor", "middle").attr("dominant-baseline", "central").text(d => d.operatorLabel || d.architectLabel);
    const guardLabels = edgeEls.append("text").attr("fill", d => d.id === selectedTransitionId ? CC.accent : CC.textDim).attr("font-size", "11px").attr("font-family", "'JetBrains Mono',monospace").attr("font-style", "italic").attr("text-anchor", "middle").attr("dominant-baseline", "central").text(d => d.guard ? `[${d.guard}]` : "");

    // Embedded FSM name as clickable label
    const embeddedLabels = edgeEls.append("text")
      .attr("fill", CC.compound).attr("font-size", "11px").attr("font-family", "'JetBrains Mono',monospace")
      .attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("font-weight", "600")
      .style("cursor", d => (d.executionType === "compound" && d.embeddedFSM && registry?.[d.embeddedFSM]) ? "pointer" : "default")
      .style("text-decoration", d => (d.executionType === "compound" && d.embeddedFSM && registry?.[d.embeddedFSM]) ? "underline" : "none")
      .text(d => (showEmbedded && d.executionType === "compound" && d.embeddedFSM) ? `▶ ${d.embeddedFSM}` : "")
      .on("click", (ev, d) => {
        ev.stopPropagation();
        if (d.executionType === "compound" && d.embeddedFSM && registry?.[d.embeddedFSM]) onNavigateFSM(d.embeddedFSM);
      });

    // ── Nodes ──
    const nodeG = g.append("g");
    const nodeEls = nodeG.selectAll("g").data(nodes).enter().append("g").style("cursor", "grab")
      .on("click", (ev, d) => { ev.stopPropagation(); onSelectState(d.id); })
      .on("dblclick", (ev, d) => { ev.stopPropagation(); ev.preventDefault(); const pos = svgToContainer(d.x, d.y); onDblClickState(d.id, pos.x, pos.y); })
      .on("mouseenter", (ev, d) => { showMetaTip(ev, formatMeta(d.createdBy, d.createdAt)); })
      .on("mousemove", (ev, d) => { showMetaTip(ev, formatMeta(d.createdBy, d.createdAt)); })
      .on("mouseleave", () => { hideMetaTip(); })
      .call(d3.drag().on("start", (ev, d) => { if (!ev.active) sim.alphaTarget(0.1).restart(); d.fx = d.x; d.fy = d.y; }).on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; hideMetaTip(); }).on("end", (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    nodeEls.each(function(d) {
      const el = d3.select(this); const colors = stateColor(d.type); const isSel = d.id === selectedStateId;
      const { w, totalH, nameH, hasDetails, detailLines } = d; const rx = d.type === "terminal" ? 14 : 6;
      if (isSel) el.append("rect").attr("x", -w / 2 - 4).attr("y", -totalH / 2 - 4).attr("width", w + 8).attr("height", totalH + 8).attr("rx", rx + 2).attr("fill", "none").attr("stroke", CC.accent).attr("stroke-width", 1.5).attr("opacity", 0.35).attr("filter", "url(#glow)");
      el.append("rect").attr("x", -w / 2).attr("y", -totalH / 2).attr("width", w).attr("height", totalH).attr("rx", rx).attr("fill", colors.fill).attr("stroke", isSel ? CC.accent : colors.stroke).attr("stroke-width", isSel ? 3 : 2.25);
      if (d.type === "terminal") el.append("rect").attr("x", -w / 2 + 4).attr("y", -totalH / 2 + 4).attr("width", w - 8).attr("height", totalH - 8).attr("rx", Math.max(rx - 2, 2)).attr("fill", "none").attr("stroke", isSel ? CC.accent : colors.stroke).attr("stroke-width", 1.5).attr("opacity", 0.45);
      const glyph = d.type === "initial" ? "▶" : d.type === "terminal" ? "◼" : "";
      if (glyph) el.append("text").attr("x", -w / 2 + 12).attr("y", -totalH / 2 + nameH / 2).attr("fill", colors.stroke).attr("font-size", "11px").attr("dominant-baseline", "central").text(glyph);
      el.append("text").attr("x", 0).attr("y", -totalH / 2 + nameH / 2).attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("fill", CC.text).attr("font-size", "15px").attr("font-family", "'JetBrains Mono',monospace").attr("font-weight", "700").text(d.name);
      if (hasDetails) {
        el.append("line").attr("x1", -w / 2 + 1).attr("x2", w / 2 - 1).attr("y1", -totalH / 2 + nameH).attr("y2", -totalH / 2 + nameH).attr("stroke", isSel ? CC.accent : colors.stroke).attr("stroke-width", 0.7).attr("opacity", 0.5);
        const startY = -totalH / 2 + nameH + 10;
        detailLines.forEach((line, i) => { el.append("text").attr("x", -w / 2 + 14).attr("y", startY + i * 17).attr("fill", line.startsWith("[") ? CC.textDim : CC.textMuted).attr("font-size", "12px").attr("font-family", "'JetBrains Mono',monospace").attr("dominant-baseline", "hanging").text(line); });
      }
      if (d.type === "initial") { el.append("circle").attr("cx", -w / 2 - 20).attr("cy", -totalH / 2 + nameH / 2).attr("r", 6).attr("fill", CC.initial); el.append("line").attr("x1", -w / 2 - 14).attr("y1", -totalH / 2 + nameH / 2).attr("x2", -w / 2).attr("y2", -totalH / 2 + nameH / 2).attr("stroke", CC.initial).attr("stroke-width", 2); }
      // Lock indicator
      const lock = locks?.[d.id];
      if (lock) {
        const isOwnLock = lock.lockedBy === currentUser;
        el.append("rect").attr("x", w / 2 - 18).attr("y", -totalH / 2 + 2).attr("width", 20).attr("height", 16).attr("rx", 3)
          .attr("fill", isOwnLock ? CC.accent + "44" : CC.warning + "44").attr("stroke", isOwnLock ? CC.accent : CC.warning).attr("stroke-width", 1);
        el.append("text").attr("x", w / 2 - 8).attr("y", -totalH / 2 + 11).attr("text-anchor", "middle").attr("dominant-baseline", "central")
          .attr("font-size", "10px").text("🔒");
      }
    });

    svg.on("click", () => { onSelectState(null); onSelectTransition(null); });

    // ── Miniatures layer (for flash peek or embedded toggle) ──
    const miniLayer = g.append("g").attr("class", "mini-layer");

    // ── Tick ──
    sim.on("tick", () => {
      // Compute bounding box of all nodes for perimeter routing
      let bbMinX = Infinity, bbMaxX = -Infinity, bbMinY = Infinity, bbMaxY = -Infinity;
      for (const n of nodes) {
        const hw = (n.w || 150) / 2 + 30, hh = (n.totalH || 40) / 2 + 30;
        bbMinX = Math.min(bbMinX, n.x - hw); bbMaxX = Math.max(bbMaxX, n.x + hw);
        bbMinY = Math.min(bbMinY, n.y - hh); bbMaxY = Math.max(bbMaxY, n.y + hh);
      }
      const bbPad = 60; // extra clearance outside the cluster

      // Count obstructions along a bezier path on a given side
      const countObsOnPath = (sp, tp, sourceId, targetId, offset, nxP, nyP) => {
        let count = 0;
        const dx = tp.x - sp.x, dy = tp.y - sp.y;
        const pad = 25;
        for (const n of nodes) {
          if (n.id === sourceId || n.id === targetId) continue;
          const nHW = (n.w || 150) / 2 + pad, nHH = (n.totalH || 40) / 2 + pad;
          for (let frac = 0.1; frac <= 0.9; frac += 0.1) {
            const t2 = frac, bend = Math.sin(t2 * Math.PI) * offset;
            const px = sp.x + dx * t2 + nxP * bend;
            const py = sp.y + dy * t2 + nyP * bend;
            if (px > n.x - nHW && px < n.x + nHW && py > n.y - nHH && py < n.y + nHH) { count++; break; }
          }
        }
        return count;
      };

      const computeEdgePath = (d) => {
        const s = d.source, t = d.target;
        const sHW = (s.w || 150) / 2, sHH = (s.totalH || 40) / 2, tHW = (t.w || 150) / 2, tHH = (t.totalH || 40) / 2;
        if (s.id === t.id) { const topY = s.y - sHH; return `M${s.x - 25},${topY} C${s.x - 75},${topY - 70} ${s.x + 75},${topY - 70} ${s.x + 25},${topY}`; }

        const sp = rectIntersect(s.x, s.y, sHW, sHH, t.x, t.y, 5);
        const tp = rectIntersect(t.x, t.y, tHW, tHH, s.x, s.y, 5);
        const dx = tp.x - sp.x, dy = tp.y - sp.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nxP = -dy / dist, nyP = dx / dist;
        const hasRev = links.some(l => l.source.id === t.id && l.target.id === s.id);

        // Count obstructions on direct path
        let directObs = 0;
        const pad = 25;
        for (const n of nodes) {
          if (n.id === s.id || n.id === t.id) continue;
          const nHW = (n.w || 150) / 2 + pad, nHH = (n.totalH || 40) / 2 + pad;
          for (let frac = 0.15; frac <= 0.85; frac += 0.1) {
            const px = sp.x + dx * frac, py = sp.y + dy * frac;
            if (px > n.x - nHW && px < n.x + nHW && py > n.y - nHH && py < n.y + nHH) { directObs++; break; }
          }
        }

        if (directObs === 0) {
          // Clean direct path: gentle arc
          const dr = dist * (hasRev ? 1.2 : 2.5);
          const svgSweep = hasRev ? 0 : 1;
          d._sweepDir = hasRev ? -1 : 1;
          d._routed = false;
          return `M${sp.x},${sp.y} A${dr},${dr} 0 0,${svgSweep} ${tp.x},${tp.y}`;
        }

        // Try increasingly wide deflections on both sides
        const tryOffsets = [80, 140, 220, 320];
        let bestSide = 1, bestOff = tryOffsets[0], bestObs = Infinity;
        for (const off of tryOffsets) {
          for (const side of [1, -1]) {
            const obs = countObsOnPath(sp, tp, s.id, t.id, off * side, nxP, nyP);
            if (obs < bestObs) { bestObs = obs; bestSide = side; bestOff = off; }
            if (obs === 0) break;
          }
          if (bestObs === 0) break;
        }

        // If still obstructed, route via perimeter
        if (bestObs > 0) {
          const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
          // Decide top or bottom perimeter based on which is farther from midpoint
          const distToTop = my - bbMinY, distToBot = bbMaxY - my;
          const useTop = distToTop <= distToBot;
          const periY = useTop ? bbMinY - bbPad : bbMaxY + bbPad;
          // Exit source from top/bottom, travel along perimeter, enter target from top/bottom
          const srcExitY = useTop ? s.y - sHH - 10 : s.y + sHH + 10;
          const tgtEntryY = useTop ? t.y - tHH - 10 : t.y + tHH + 10;
          d._sweepDir = useTop ? -1 : 1;
          d._routed = true;
          d._periY = periY;
          return `M${s.x},${srcExitY} C${s.x},${periY} ${t.x},${periY} ${t.x},${tgtEntryY}`;
        }

        // Apply best deflection
        if (hasRev) bestSide = -bestSide;
        d._sweepDir = bestSide;
        d._routed = true;
        const off = bestOff * bestSide;
        const c1x = sp.x + dx * 0.25 + nxP * off;
        const c1y = sp.y + dy * 0.25 + nyP * off;
        const c2x = sp.x + dx * 0.75 + nxP * off;
        const c2y = sp.y + dy * 0.75 + nyP * off;
        return `M${sp.x},${sp.y} C${c1x},${c1y} ${c2x},${c2y} ${tp.x},${tp.y}`;
      };

      // Pre-compute routing info for labels
      links.forEach(d => computeEdgePath(d));
      edgeEls.select("path:nth-child(1)").attr("d", computeEdgePath);
      edgeEls.select("path:nth-child(2)").attr("d", computeEdgePath);
      edgePaths.attr("d", computeEdgePath);

      const lp = (d) => {
        if (d.source.id === d.target.id) return { x: d.source.x, y: d.source.y - (d.source.totalH || 40) / 2 - 50 };
        const s = d.source, t = d.target;

        // Perimeter-routed: label at top/bottom midpoint
        if (d._routed && d._periY !== undefined) {
          return { x: (s.x + t.x) / 2, y: d._periY };
        }

        const sHW = (s.w || 150) / 2, sHH = (s.totalH || 40) / 2, tHW = (t.w || 150) / 2, tHH = (t.totalH || 40) / 2;
        const sp = rectIntersect(s.x, s.y, sHW, sHH, t.x, t.y, 5);
        const tp = rectIntersect(t.x, t.y, tHW, tHH, s.x, s.y, 5);
        const edx = tp.x - sp.x, edy = tp.y - sp.y, edist = Math.sqrt(edx * edx + edy * edy) || 1;
        const nxP = -edy / edist, nyP = edx / edist;
        const sweepDir = d._sweepDir || 1;
        const mx = (sp.x + tp.x) / 2, my = (sp.y + tp.y) / 2;

        if (d._routed) {
          // Deflected bezier: label at curve apex
          const off = 80 * sweepDir; // approximate
          return { x: mx + nxP * off, y: my + nyP * off };
        }
        // Standard arc offset
        const off = 14;
        return { x: mx + nxP * off * sweepDir, y: my + nyP * off * sweepDir };
      };
      edgeLabels.attr("x", d => lp(d).x).attr("y", d => lp(d).y - 9);
      guardLabels.attr("x", d => lp(d).x).attr("y", d => lp(d).y + 9);
      embeddedLabels.attr("x", d => lp(d).x).attr("y", d => lp(d).y + (d.guard ? 26 : 9));
      edgeLabelBg.each(function(d) {
        const lbl = edgeLabels.filter(l => l.id === d.id).node(); if (!lbl) return;
        const bb = lbl.getBBox(); const extra = (d.guard ? 22 : 0) + (showEmbedded && d.executionType === "compound" && d.embeddedFSM ? 20 : 0);
        d3.select(this).attr("x", bb.x - 6).attr("y", bb.y - 4).attr("width", bb.width + 12).attr("height", bb.height + extra + 8);
      });
      nodeEls.attr("transform", d => `translate(${d.x},${d.y})`);
      nodesDataRef.current = nodes;

      // Render miniature for flash target
      miniLayer.selectAll("*").remove();
      if (flashTarget && registry?.[flashTarget]) {
        const flashTrans = links.find(l => l.executionType === "compound" && l.embeddedFSM === flashTarget);
        if (flashTrans) {
          const cx = (flashTrans.source.x + flashTrans.target.x) / 2;
          const cy = (flashTrans.source.y + flashTrans.target.y) / 2 + 80;
          const fsm = { ...registry[flashTarget], _name: flashTarget };
          renderMiniatureFSM(miniLayer, fsm, cx, cy, 200, 150, 0.9);
        }
      }
    });

    sim.on("end", () => { if (!hasFittedRef.current) { hasFittedRef.current = true; fitToView(true); } });
    return () => { sim.stop(); clearTimeout(tipTimer); if (metaTip) metaTip.style.display = "none"; };
  }, [states, transitions, selectedStateId, selectedTransitionId, showEmbedded, flashTarget, registry, theme, locks, currentUser]);

  return <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ background: CC.bg, borderRadius: 6 }} />;
}

// ── Delayed Tooltip (1-second hover) ─────────────────────────────────────────
function Tip({ text, children, delay = 1000 }) {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);
  const onEnter = () => { timerRef.current = setTimeout(() => setShow(true), delay); };
  const onLeave = () => { clearTimeout(timerRef.current); setShow(false); };
  return (
    <div onMouseEnter={onEnter} onMouseLeave={onLeave} style={{ position: "relative", display: "inline-flex" }}>
      {children}
      {show && (
        <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          background: "#1a1d2e", color: "#c8d0e0", border: "1px solid #2a3050", borderRadius: 6, padding: "5px 10px",
          fontSize: 11, whiteSpace: "nowrap", zIndex: 999, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
          {text}
        </div>
      )}
    </div>
  );
}

// ── Main Editor ──────────────────────────────────────────────────────────────
export default function FSMEditor({ initialRegistry, currentUser: propUser, users: propUsers, locks: propLocks,
  onlineUsers, onSaveFSM, onAcquireLock, onReleaseLock, onLogEvent, onRefreshLocks, onLogout }) {
  // Use props if provided, fall back to defaults for standalone/artifact mode
  const isOnline = !!onSaveFSM;
  const [registry, setRegistry] = useState(initialRegistry || DEFAULT_REGISTRY);
  const currentUser = propUser || DEFAULT_CURRENT_USER;
  const users = propUsers || DEFAULT_USERS;
  const [navStack, setNavStack] = useState(["Master FSM Interpreter"]); // breadcrumb
  const currentFSMName = navStack[navStack.length - 1];
  const currentFSM = registry[currentFSMName] || { states: [], transitions: [] };
  const [selectedStateId, setSelectedStateId] = useState(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showJSON, setShowJSON] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [inlineEdit, setInlineEdit] = useState(null);
  // ── Collaborative Locking ──
  const locks = propLocks || {};
  const [saveNudge, setSaveNudge] = useState(null);
  const saveNudgeTimerRef = useRef(null);

  const acquireLock = useCallback(async (elementId, elementType) => {
    const existing = locks[elementId];
    if (existing && existing.lockedBy !== currentUser) return false;
    if (existing && existing.lockedBy === currentUser) return true;
    // Use Supabase-backed lock if available
    if (onAcquireLock) {
      const result = await onAcquireLock(currentFSMName, elementId, elementType);
      if (!result) return false;
    }
    clearTimeout(saveNudgeTimerRef.current);
    saveNudgeTimerRef.current = setTimeout(() => setSaveNudge(elementId), 30000);
    return true;
  }, [locks, currentUser, onAcquireLock, currentFSMName]);

  const releaseLock = useCallback(async (elementId) => {
    if (onReleaseLock) await onReleaseLock(currentFSMName, elementId);
    setSaveNudge(null);
    clearTimeout(saveNudgeTimerRef.current);
  }, [onReleaseLock, currentFSMName]);

  const isLockedByOther = useCallback((elementId) => {
    const l = locks[elementId];
    return l && l.lockedBy !== currentUser ? l : null;
  }, [locks, currentUser]);
  const [showEmbedded, setShowEmbedded] = useState(true);
  const [flashTarget, setFlashTarget] = useState(null);
  const [showTree, setShowTree] = useState(true);
  const [treeDepth, setTreeDepth] = useState(3);
  const [theme, setTheme] = useState("dark");
  CC = THEMES[theme];
  const [showChat, setShowChat] = useState(true);
  const [showLog, setShowLog] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [logPos, setLogPos] = useState({ x: -1, y: -1 }); // -1 = auto-position above chat bar
  const [logSize, setLogSize] = useState({ w: 0, h: 160 }); // w=0 means match chat bar
  const [isDraggingLog, setIsDraggingLog] = useState(false);
  const [isResizingLog, setIsResizingLog] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const logRef = useRef(null);
  const diagramContainerRef = useRef(null);
  const zoomControlsRef = useRef(null);

  const states = currentFSM.states;
  const transitions = currentFSM.transitions;
  const fsmIssues = useMemo(() => validateFSM(states, transitions), [states, transitions]);

  // Updaters that write into the registry
  const setStates = (fn) => setRegistry(r => ({ ...r, [currentFSMName]: { ...r[currentFSMName], states: typeof fn === "function" ? fn(r[currentFSMName].states) : fn } }));
  const setTransitions = (fn) => setRegistry(r => ({ ...r, [currentFSMName]: { ...r[currentFSMName], transitions: typeof fn === "function" ? fn(r[currentFSMName].transitions) : fn } }));

  // Sync registry from parent (Realtime updates from other users)
  useEffect(() => {
    if (initialRegistry) setRegistry(initialRegistry);
  }, [initialRegistry]);

  const canEdit = useMemo(() => {
    const fsm = registry[currentFSMName];
    if (!fsm) return false;
    return fsm.owners?.includes(currentUser) || fsm.editors?.includes(currentUser);
  }, [registry, currentFSMName, currentUser]);

  const addState = () => { const id = nextId("s"); setStates(p => [...p, { id, name: "New State", type: "normal", description: "", createdBy: currentUser, createdAt: nowISO() }]); setSelectedStateId(id); setActiveTab("states"); };
  const updateState = (id, f, v) => setStates(p => p.map(s => s.id === id ? { ...s, [f]: v } : s));
  const deleteState = (id) => { setStates(p => p.filter(s => s.id !== id)); setTransitions(p => p.filter(t => t.from !== id && t.to !== id)); if (selectedStateId === id) setSelectedStateId(null); };
  const addTransition = () => { const id = nextId("t"); setTransitions(p => [...p, { id, from: states[0]?.id || "", to: states[1]?.id || states[0]?.id || "", architectLabel: "NEW_TRANSITION", operatorLabel: "New Action", guard: "", executionType: "atomic", embeddedFSM: "", createdBy: currentUser, createdAt: nowISO() }]); setSelectedTransitionId(id); setActiveTab("transitions"); };
  const updateTransition = (id, f, v) => setTransitions(p => p.map(t => t.id === id ? { ...t, [f]: v } : t));
  const deleteTransition = (id) => { setTransitions(p => p.filter(t => t.id !== id)); if (selectedTransitionId === id) setSelectedTransitionId(null); };

  // Navigation
  const navigateTo = useCallback((fsmName) => {
    if (registry[fsmName]) { setNavStack(p => [...p, fsmName]); setSelectedStateId(null); setSelectedTransitionId(null); setInlineEdit(null); if (onRefreshLocks) onRefreshLocks(fsmName); }
  }, [registry]);
  const navigateBack = useCallback(() => {
    if (navStack.length > 1) { setNavStack(p => p.slice(0, -1)); setSelectedStateId(null); setSelectedTransitionId(null); setInlineEdit(null); }
  }, [navStack]);
  const navigateToBreadcrumb = useCallback((idx) => {
    if (idx < navStack.length - 1) { setNavStack(p => p.slice(0, idx + 1)); setSelectedStateId(null); setSelectedTransitionId(null); setInlineEdit(null); }
  }, [navStack]);

  // Flash/peek: set on mousedown, clear on mouseup
  const startFlash = useCallback((fsmName) => { if (registry[fsmName]) setFlashTarget(fsmName); }, [registry]);
  const endFlash = useCallback(() => setFlashTarget(null), []);

  const exportJSON = () => {
    const doc = { fsmRegistry: Object.fromEntries(Object.entries(registry).map(([name, fsm]) => [name, {
      states: fsm.states.map(s => ({ id: s.id, name: s.name, type: s.type, ...(s.description && { description: s.description }) })),
      transitions: fsm.transitions.map(t => ({ id: t.id, from: t.from, to: t.to, architectLabel: t.architectLabel, operatorLabel: t.operatorLabel, executionType: t.executionType, ...(t.guard && { guard: t.guard }), ...(t.embeddedFSM && { embeddedFSM: t.embeddedFSM }) })),
    }])) };
    setJsonText(JSON.stringify(doc, null, 2)); setShowJSON(true); setJsonError("");
  };
  const importJSON = () => {
    try {
      const doc = JSON.parse(jsonText);
      const reg = doc.fsmRegistry || doc;
      const newReg = {};
      for (const [name, fsm] of Object.entries(reg)) {
        if (!fsm.states || !fsm.transitions) throw new Error(`"${name}" missing states or transitions`);
        newReg[name] = { states: fsm.states.map(s => ({ id: s.id, name: s.name, type: s.type || "normal", description: s.description || "" })), transitions: fsm.transitions.map(t => ({ id: t.id, from: t.from, to: t.to, architectLabel: t.architectLabel || "", operatorLabel: t.operatorLabel || "", guard: t.guard || "", executionType: t.executionType || "atomic", embeddedFSM: t.embeddedFSM || "" })) };
      }
      setRegistry(newReg); setNavStack([Object.keys(newReg)[0] || "Untitled"]); setShowJSON(false); setJsonError("");
    } catch (e) { setJsonError(e.message); }
  };

  const handleDblClickState = useCallback(async (id, x, y) => {
    const otherLock = locks[id];
    if (otherLock && otherLock.lockedBy !== currentUser) return;
    const got = await acquireLock(id, "state");
    if (!got) return;
    setInlineEdit({ type: "state", id, x, y }); setSelectedStateId(id); setSelectedTransitionId(null);
  }, [locks, currentUser, acquireLock]);
  const handleDblClickTransition = useCallback(async (id, x, y) => {
    const otherLock = locks[id];
    if (otherLock && otherLock.lockedBy !== currentUser) return;
    const got = await acquireLock(id, "transition");
    if (!got) return;
    setInlineEdit({ type: "transition", id, x, y }); setSelectedTransitionId(id); setSelectedStateId(null);
  }, [locks, currentUser, acquireLock]);
  const closeInlineEdit = useCallback(async () => {
    if (inlineEdit) {
      await releaseLock(inlineEdit.id);
      // Save the entire FSM to Supabase on close
      if (onSaveFSM) {
        const fsm = registry[currentFSMName];
        if (fsm) await onSaveFSM(currentFSMName, fsm.states, fsm.transitions);
      }
    }
    setInlineEdit(null);
  }, [inlineEdit, releaseLock, onSaveFSM, registry, currentFSMName]);
  const getInlinePanelPos = () => {
    if (!inlineEdit || !diagramContainerRef.current) return { left: 0, top: 0 };
    const cont = diagramContainerRef.current, cw = cont.offsetWidth, ch = cont.offsetHeight;
    let x = inlineEdit.x + 15, y = inlineEdit.y - 190;
    if (x + 320 > cw) x = inlineEdit.x - 335; if (y < 8) y = 8; if (y + 380 > ch - 8) y = ch - 388; if (x < 8) x = 8;
    return { left: x, top: y };
  };

  // ── Chat with Claude (FSM-aware) ──────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const buildFSMContext = () => {
    const fsm = registry[currentFSMName];
    if (!fsm) return "";
    const stateList = fsm.states.map(s => `  ${s.name} (${s.type})${s.description ? ": " + s.description : ""}`).join("\n");
    const transList = fsm.transitions.map(t => {
      const from = fsm.states.find(s => s.id === t.from)?.name || "?";
      const to = fsm.states.find(s => s.id === t.to)?.name || "?";
      return `  ${from} → ${to}: ${t.operatorLabel} [${t.architectLabel}]${t.guard ? " guard: " + t.guard : ""}${t.executionType === "compound" ? " (compound → " + t.embeddedFSM + ")" : ""}`;
    }).join("\n");
    return `Current FSM: "${currentFSMName}"\nStates:\n${stateList}\nTransitions:\n${transList}\nRegistry FSMs: ${Object.keys(registry).join(", ")}`;
  };

  const sendChat = async (retryText) => {
    const text = retryText || chatInput.trim();
    if (!text || chatLoading) return;
    const ts = new Date().toLocaleString();
    if (!retryText) {
      setChatMessages(prev => [...prev, { role: "user", content: text, time: ts }]);
      setChatInput("");
    }
    setChatLoading(true);
    try {
      const hist = chatMessages.filter(m => m.role === "user" || m.role === "assistant")
        .filter(m => !m.isError)
        .map(m => ({ role: m.role, content: m.content }));
      if (!retryText) hist.push({ role: "user", content: text });
      const chatEndpoint = isOnline ? "/api/chat" : "https://api.anthropic.com/v1/messages";
      const resp = await fetch(chatEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `You are the FSM Drive design assistant. You help refine finite state machine specifications. States are conditions ("what is"), never activities. All computation happens on transitions. Atomic transitions are primitive procedures. Compound transitions invoke embedded FSMs that must complete before firing.\n\nContext:\n${buildFSMContext()}`,
          messages: hist,
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await resp.json();
      const reply = data.content?.map(c => c.text || "").join("") || "No response body returned.";
      setChatMessages(prev => [...prev, { role: "assistant", content: reply, time: new Date().toLocaleString() }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `⚠ ${e.message}`, time: new Date().toLocaleString(), isError: true }]);
    }
    setChatLoading(false);
  };

  const retryChat = () => {
    // Find last user message, remove any error response after it, resend
    const msgs = [...chatMessages];
    // Remove trailing error messages
    while (msgs.length > 0 && msgs[msgs.length - 1].isError) msgs.pop();
    // Find the last user message to retry
    const lastUser = [...msgs].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    setChatMessages(msgs);
    sendChat(lastUser.content);
  };

  const hasError = chatMessages.length > 0 && chatMessages[chatMessages.length - 1].isError;

  // Drag/resize handlers for conversation log
  const resizeCornerRef = useRef(null); // which corner: "tl","tr","bl","br"

  const onLogDragStart = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    const rect = logRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDraggingLog(true);
  };

  const onLogResizeStart = (corner) => (e) => {
    e.preventDefault(); e.stopPropagation();
    const rect = logRef.current?.getBoundingClientRect();
    const container = diagramContainerRef.current?.getBoundingClientRect();
    if (!rect || !container) return;
    resizeCornerRef.current = corner;
    resizeStartRef.current = {
      x: e.clientX, y: e.clientY,
      w: rect.width, h: rect.height,
      left: rect.left - container.left, top: rect.top - container.top
    };
    // If still in auto mode, snap to explicit position first
    if (logPos.x === -1) {
      setLogPos({ x: rect.left - container.left, y: rect.top - container.top });
      setLogSize({ w: rect.width, h: rect.height });
    }
    setIsResizingLog(true);
  };

  useEffect(() => {
    if (!isDraggingLog && !isResizingLog) return;
    const onMove = (e) => {
      if (isDraggingLog) {
        const container = diagramContainerRef.current?.getBoundingClientRect();
        if (!container) return;
        setLogPos({
          x: e.clientX - container.left - dragOffsetRef.current.x,
          y: e.clientY - container.top - dragOffsetRef.current.y
        });
      }
      if (isResizingLog) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;
        const c = resizeCornerRef.current;
        const s = resizeStartRef.current;
        let newW = s.w, newH = s.h, newX = s.left, newY = s.top;
        if (c === "br") { newW = s.w + dx; newH = s.h + dy; }
        else if (c === "bl") { newW = s.w - dx; newH = s.h + dy; newX = s.left + dx; }
        else if (c === "tr") { newW = s.w + dx; newH = s.h - dy; newY = s.top + dy; }
        else if (c === "tl") { newW = s.w - dx; newH = s.h - dy; newX = s.left + dx; newY = s.top + dy; }
        // Enforce minimums — clamp and prevent position overshoot
        if (newW < 300) { if (c === "bl" || c === "tl") newX = s.left + s.w - 300; newW = 300; }
        if (newH < 150) { if (c === "tl" || c === "tr") newY = s.top + s.h - 150; newH = 150; }
        setLogSize({ w: newW, h: newH });
        setLogPos({ x: newX, y: newY });
      }
    };
    const onUp = () => { setIsDraggingLog(false); setIsResizingLog(false); resizeCornerRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDraggingLog, isResizingLog]);

  const resetLogPosition = () => { setLogPos({ x: -1, y: -1 }); setLogSize({ w: 0, h: 160 }); };

  const toggleVoice = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported in this browser."); return; }
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = "en-US";
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setChatInput(prev => prev + (prev ? " " : "") + text);
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start(); setIsListening(true);
  };

  const S = {
    root: { display: "flex", height: "calc(100vh - 72px)", fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace", background: CC.bg, color: CC.text, overflow: "hidden" },
    side: { width: 300, minWidth: 300, display: "flex", flexDirection: "column", background: CC.surface, borderRight: `1px solid ${CC.border}`, overflow: "hidden" },
    hdr: { padding: "14px 18px", borderBottom: `1px solid ${CC.border}`, background: CC.surfaceAlt },
    tabs: { display: "flex", borderBottom: `1px solid ${CC.border}` },
    tab: a => ({ flex: 1, padding: 10, textAlign: "center", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, cursor: "pointer", background: a ? CC.surfaceAlt : "transparent", color: a ? CC.accent : CC.textMuted, borderBottom: a ? `2px solid ${CC.accent}` : "2px solid transparent" }),
    scroll: { flex: 1, overflowY: "auto", padding: 12 },
    card: s => ({ background: s ? CC.surfaceAlt : "transparent", border: `1px solid ${s ? CC.borderFocus : CC.border}`, borderRadius: 6, padding: "10px 12px", marginBottom: 8, cursor: "pointer" }),
    lbl: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: CC.textDim, marginBottom: 4 },
    inp: { width: "100%", background: CC.bg, border: `1px solid ${CC.border}`, borderRadius: 4, color: CC.text, padding: "6px 8px", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
    sel: { width: "100%", background: CC.bg, border: `1px solid ${CC.border}`, borderRadius: 4, color: CC.text, padding: "6px 8px", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
    btn: c => ({ background: "transparent", border: `1px solid ${c}`, color: c, borderRadius: 4, padding: "6px 12px", fontSize: 11, fontFamily: "inherit", fontWeight: 600, cursor: "pointer" }),
    btnF: c => ({ background: c, border: "none", color: CC.bg, borderRadius: 4, padding: "6px 12px", fontSize: 11, fontFamily: "inherit", fontWeight: 600, cursor: "pointer" }),
    btnX: { background: "transparent", border: "none", color: "#f08080", fontSize: 13, cursor: "pointer", padding: "4px 8px", fontFamily: "inherit", fontWeight: 600 },
    // Standard action buttons — same everywhere
    actAdd: c => ({ background: "transparent", border: `1.5px solid ${c}`, color: c, borderRadius: 6, padding: "10px 8px", fontSize: 11, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", textAlign: "center", width: "100%" }),
    actDel: active => ({ background: "transparent", border: `1.5px solid ${active ? "#f08080" : CC.textDim}`, color: active ? "#f08080" : CC.textDim, borderRadius: 6, padding: "10px 8px", fontSize: 11, fontFamily: "inherit", fontWeight: 700, cursor: active ? "pointer" : "default", opacity: active ? 1 : 0.4, textAlign: "center", width: "100%" }),
    badge: c => ({ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, color: c, background: `${c}22`, marginRight: 6 }),
    val: l => ({ fontSize: 11, color: l === "error" ? CC.error : l === "info" ? CC.info : CC.warning, padding: "4px 0", lineHeight: 1.4 }),
  };
  const zoomBtnStyle = { width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: CC.surfaceAlt, border: `1px solid ${CC.border}`, borderRadius: 4, color: CC.text, fontSize: 16, fontFamily: "inherit", fontWeight: 600, cursor: "pointer" };

  const renderState = (s) => {
    const v = validateState(s, states);
    const isSel = s.id === selectedStateId;
    return (<div key={s.id} style={{ ...S.card(isSel), borderLeft: isSel ? `3px solid ${stateColor(s.type).stroke}` : undefined }} onClick={() => { setSelectedStateId(s.id); setSelectedTransitionId(null); setInlineEdit(null); }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={S.badge(stateColor(s.type).stroke)}>{s.type}</span>
      </div>
      {s.id === selectedStateId ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} onClick={e => e.stopPropagation()}>
          <div><div style={S.lbl}>Name</div><input style={S.inp} value={s.name} onChange={e => updateState(s.id, "name", e.target.value)} /></div>
          <div><div style={S.lbl}>Type</div><select style={S.sel} value={s.type} onChange={e => updateState(s.id, "type", e.target.value)}><option value="initial">Initial</option><option value="normal">Normal</option><option value="terminal">Terminal</option></select></div>
          <div><div style={S.lbl}>Description</div><input style={S.inp} value={s.description} onChange={e => updateState(s.id, "description", e.target.value)} /></div>
          {v.errors.map((e, i) => <div key={`e${i}`} style={S.val("error")}>⛔ {e}</div>)}
          {v.warnings.map((w, i) => <div key={`w${i}`} style={S.val("warning")}>⚠ {w}</div>)}
        </div>
      ) : (<div><div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>{s.description && <div style={{ fontSize: 11, color: CC.textDim, marginTop: 2 }}>{s.description}</div>}</div>)}
    </div>);
  };

  const renderTransition = (t) => {
    const v = validateTransition(t, states);
    const fn = states.find(s => s.id === t.from)?.name || "?", tn = states.find(s => s.id === t.to)?.name || "?";
    const isCmp = t.executionType === "compound", canDrill = isCmp && t.embeddedFSM && registry[t.embeddedFSM];
    const isSel = t.id === selectedTransitionId;
    return (<div key={t.id} style={{ ...S.card(isSel), borderLeft: isSel ? `3px solid ${isCmp ? CC.compound : CC.edgeLabel}` : undefined }} onClick={() => { setSelectedTransitionId(t.id); setSelectedStateId(null); setInlineEdit(null); }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: CC.textMuted }}>{fn} → {tn}</span>
        {isCmp && <span style={S.badge(CC.compound)}>compound</span>}
      </div>
      {t.id === selectedTransitionId ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><div style={S.lbl}>From</div><select style={S.sel} value={t.from} onChange={e => updateTransition(t.id, "from", e.target.value)}>{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div style={{ flex: 1 }}><div style={S.lbl}>To</div><select style={S.sel} value={t.to} onChange={e => updateTransition(t.id, "to", e.target.value)}>{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>
          <div><div style={S.lbl}>Architect Label</div><input style={S.inp} value={t.architectLabel} onChange={e => updateTransition(t.id, "architectLabel", e.target.value)} /></div>
          <div><div style={S.lbl}>Operator Label</div><input style={S.inp} value={t.operatorLabel} onChange={e => updateTransition(t.id, "operatorLabel", e.target.value)} /></div>
          <div><div style={S.lbl}>Guard</div><input style={S.inp} value={t.guard} placeholder="e.g. condition" onChange={e => updateTransition(t.id, "guard", e.target.value)} /></div>
          <div style={{ borderTop: `1px solid ${CC.border}`, paddingTop: 8 }}>
            <div style={S.lbl}>Execution</div>
            <select style={S.sel} value={t.executionType} onChange={e => updateTransition(t.id, "executionType", e.target.value)}><option value="atomic">Atomic (primitive)</option><option value="compound">Compound (embedded FSM)</option></select>
          </div>
          {isCmp && <div><div style={S.lbl}>Embedded FSM</div><input style={{ ...S.inp, borderColor: CC.compound, color: CC.compound }} value={t.embeddedFSM || ""} onChange={e => updateTransition(t.id, "embeddedFSM", e.target.value)} /></div>}
          {canDrill && (<div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => navigateTo(t.embeddedFSM)} style={{ ...S.btnF(CC.compound), flex: 1, color: "#fff" }}>▶ Open "{t.embeddedFSM}"</button>
            <button onMouseDown={() => startFlash(t.embeddedFSM)} onMouseUp={endFlash} onMouseLeave={endFlash}
              style={{ ...S.btn(CC.compound), flex: 0, padding: "6px 10px", fontSize: 11 }} title="Hold to peek">👁</button>
          </div>)}
          {v.errors.map((e, i) => <div key={`e${i}`} style={S.val("error")}>⛔ {e}</div>)}
          {v.warnings.map((w, i) => <div key={`w${i}`} style={S.val("warning")}>⚠ {w}</div>)}
        </div>
      ) : (<div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{t.operatorLabel}</div>
        <div style={{ fontSize: 11, color: CC.textDim }}>{t.architectLabel}{t.guard ? ` [${t.guard}]` : ""}</div>
        {isCmp && t.embeddedFSM && <div style={{ fontSize: 11, color: CC.compound, marginTop: 2, cursor: canDrill ? "pointer" : "default" }}
          onClick={e => { if (canDrill) { e.stopPropagation(); navigateTo(t.embeddedFSM); } }}>⟨{t.embeddedFSM}⟩{canDrill ? " →" : ""}</div>}
      </div>)}
    </div>);
  };

  const inlineState = inlineEdit?.type === "state" ? states.find(s => s.id === inlineEdit.id) : null;
  const inlineTrans = inlineEdit?.type === "transition" ? transitions.find(t => t.id === inlineEdit.id) : null;
  const inlinePos = getInlinePanelPos();

  return (
    <div style={S.root}>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <div style={S.side}>
        <div style={S.hdr}>
          <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: 0.3, color: CC.text, margin: 0, lineHeight: 1.3 }}>{currentFSMName}</h1>
          <div style={{ marginTop: 6, fontSize: 10, color: CC.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: canEdit ? CC.success : CC.textDim, flexShrink: 0 }} />
            <span>{users[currentUser]?.name || currentUser}</span>
            <span style={{ color: CC.textDim }}>·</span>
            <span style={{ color: canEdit ? CC.success : CC.textDim, fontWeight: 600 }}>
              {registry[currentFSMName]?.owners?.includes(currentUser) ? "owner" : canEdit ? "editor" : "viewer"}
            </span>
            {isOnline && <span style={{ color: CC.success, fontWeight: 600 }}>· live</span>}
          </div>
          {/* Online presence */}
          {onlineUsers && Object.keys(onlineUsers).length > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: CC.textDim, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span>Online:</span>
              {Object.values(onlineUsers).flat().map((p, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3,
                  background: p.user_id === currentUser ? CC.accent + "22" : CC.surfaceAlt,
                  border: `1px solid ${p.user_id === currentUser ? CC.accent + "44" : CC.border}`,
                  borderRadius: 10, padding: "1px 7px", fontSize: 10 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: CC.success }} />
                  {p.user_name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Breadcrumb */}
        <div style={{ padding: "8px 18px", borderBottom: `1px solid ${CC.border}`, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {navStack.map((name, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <span style={{ color: CC.textDim, fontSize: 11 }}>›</span>}
              <span onClick={() => navigateToBreadcrumb(i)}
                style={{ fontSize: 11, fontWeight: i === navStack.length - 1 ? 700 : 400,
                  color: i === navStack.length - 1 ? CC.compound : CC.textMuted,
                  cursor: i < navStack.length - 1 ? "pointer" : "default",
                  textDecoration: i < navStack.length - 1 ? "underline" : "none" }}>
                {name}
              </span>
            </span>
          ))}
        </div>

        <div style={S.tabs}>
          <div style={S.tab(activeTab === "overview")} onClick={() => setActiveTab("overview")}>Overview</div>
          <div style={S.tab(activeTab === "states")} onClick={() => setActiveTab("states")}>States</div>
          <div style={S.tab(activeTab === "transitions")} onClick={() => setActiveTab("transitions")}>Transitions</div>
          <div style={S.tab(activeTab === "validate")} onClick={() => setActiveTab("validate")}>Check</div>
        </div>

        <div style={S.scroll}>
          {activeTab === "overview" && (() => {
            const errorCount = fsmIssues.filter(i => i.level === "error").length;
            const warnCount = fsmIssues.filter(i => i.level === "warning").length;
            const compoundCount = transitions.filter(t => t.executionType === "compound").length;
            const atomicCount = transitions.filter(t => t.executionType === "atomic").length;
            const hasInitial = states.some(s => s.type === "initial");
            const hasTerminal = states.some(s => s.type === "terminal");
            // Determine guidance
            const steps = [];
            if (!states.length) steps.push({ text: "Add your first state — what condition does this process start in?", action: () => { addState(); setActiveTab("states"); }, label: "\u2295 Add State" });
            else if (!hasInitial) steps.push({ text: "Mark one state as Initial — where does this FSM begin?", action: () => setActiveTab("states"), label: "Edit States" });
            else if (transitions.length === 0) steps.push({ text: "Add a transition — what moves the enterprise from one condition to the next?", action: () => { addTransition(); setActiveTab("transitions"); }, label: "\u2295 Add Transition" });
            else if (!hasTerminal) steps.push({ text: "Add a Terminal state — every process needs a completion condition.", action: () => { addState(); setActiveTab("states"); }, label: "\u2295 Add Terminal" });
            else if (errorCount > 0) steps.push({ text: `${errorCount} error(s) found — review in the Check tab.`, action: () => setActiveTab("validate"), label: "Review Errors" });
            else steps.push({ text: "FSM looks good. Double-click states or transitions on the diagram to refine, or drill into compound transitions.", action: null, label: null });

            return (
              <div>
                {/* FSM summary card */}
                <div style={{ background: CC.surfaceAlt, border: `1px solid ${CC.border}`, borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: CC.text, marginBottom: 8 }}>{currentFSMName}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: CC.bg, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: CC.normal }}>{states.length}</div>
                      <div style={{ fontSize: 11, color: CC.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>States</div>
                    </div>
                    <div style={{ background: CC.bg, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: CC.edgeLabel }}>{transitions.length}</div>
                      <div style={{ fontSize: 11, color: CC.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Transitions</div>
                    </div>
                    <div style={{ background: CC.bg, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: CC.success }}>{atomicCount}</div>
                      <div style={{ fontSize: 11, color: CC.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Atomic</div>
                    </div>
                    <div style={{ background: CC.bg, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: CC.compound }}>{compoundCount}</div>
                      <div style={{ fontSize: 11, color: CC.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Compound</div>
                    </div>
                  </div>
                </div>

                {/* Health indicator */}
                <div style={{ background: errorCount ? `${CC.error}15` : warnCount ? `${CC.warning}15` : `${CC.success}15`,
                  border: `1px solid ${errorCount ? CC.error : warnCount ? CC.warning : CC.success}44`,
                  borderRadius: 6, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{errorCount ? "⛔" : warnCount ? "⚠" : "✓"}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: errorCount ? CC.error : warnCount ? CC.warning : CC.success }}>
                      {errorCount ? `${errorCount} Error${errorCount > 1 ? "s" : ""}` : warnCount ? `${warnCount} Warning${warnCount > 1 ? "s" : ""}` : "All Clear"}
                    </div>
                    <div style={{ fontSize: 11, color: CC.textDim, marginTop: 1 }}>
                      {errorCount ? "Fix errors before this FSM can execute" : warnCount ? "Warnings won't block execution" : "Ready for the Master FSM Interpreter"}
                    </div>
                  </div>
                </div>

                {/* Guided next step */}
                <div style={{ background: CC.surfaceAlt, border: `1px solid ${CC.accent}33`, borderRadius: 6, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: CC.accent, fontWeight: 700, marginBottom: 6 }}>Next Step</div>
                  <div style={{ fontSize: 11, color: CC.text, lineHeight: 1.5, marginBottom: steps[0]?.action ? 8 : 0 }}>{steps[0]?.text}</div>
                  {steps[0]?.action && (
                    <button onClick={steps[0].action}
                      style={{ background: CC.accent, border: "none", color: CC.bg, borderRadius: 4, padding: "7px 14px", fontSize: 11, fontFamily: "inherit", fontWeight: 600, cursor: "pointer", width: "100%" }}>
                      {steps[0].label}
                    </button>
                  )}
                </div>

                {/* Quick actions — balanced 2x2 grid */}
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: CC.textDim, fontWeight: 700, marginBottom: 8 }}>Quick Actions</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button onClick={() => { addState(); setActiveTab("states"); }} style={S.actAdd(CC.normal)}>{"\u2295"} State</button>
                  <button onClick={() => { if (selectedStateId) deleteState(selectedStateId); }} style={S.actDel(selectedStateId)}>{"\u2296"} State</button>
                  <button onClick={() => { addTransition(); setActiveTab("transitions"); }} style={S.actAdd(CC.edgeLabel)}>{"\u2295"} Transition</button>
                  <button onClick={() => { if (selectedTransitionId) deleteTransition(selectedTransitionId); }} style={S.actDel(selectedTransitionId)}>{"\u2296"} Transition</button>
                </div>
                <div style={{ marginTop: 6 }}>
                  <button onClick={exportJSON} style={{ ...S.actAdd(CC.textDim) }}>Export Registry JSON</button>
                </div>

                {/* Key concepts (collapsible) */}
                <div style={{ marginTop: 16, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: CC.textDim, fontWeight: 700, marginBottom: 6 }}>Key Principles</div>
                <div style={{ fontSize: 11, color: CC.textMuted, lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 6 }}><span style={{ color: CC.normal, fontWeight: 600 }}>States</span> are conditions the enterprise is in — never activities.</div>
                  <div style={{ marginBottom: 6 }}><span style={{ color: CC.edgeLabel, fontWeight: 600 }}>Transitions</span> are the processes that move between conditions.</div>
                  <div style={{ marginBottom: 6 }}><span style={{ color: CC.success, fontWeight: 600 }}>Atomic</span> = a single coded procedure.</div>
                  <div><span style={{ color: CC.compound, fontWeight: 600 }}>Compound</span> = an embedded FSM that runs to completion.</div>
                </div>
              </div>
            );
          })()}
          {activeTab === "states" && (<>{states.map(renderState)}<div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button style={S.actAdd(CC.normal)} onClick={addState}>{"\u2295"} State</button><button style={S.actDel(selectedStateId)} onClick={() => { if (selectedStateId) deleteState(selectedStateId); }}>{"\u2296"} State</button></div></>)}
          {activeTab === "transitions" && (<>{transitions.map(renderTransition)}<div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button style={S.actAdd(CC.edgeLabel)} onClick={addTransition}>{"\u2295"} Transition</button><button style={S.actDel(selectedTransitionId)} onClick={() => { if (selectedTransitionId) deleteTransition(selectedTransitionId); }}>{"\u2296"} Transition</button></div></>)}
          {activeTab === "validate" && (
            <div>
              <div style={{ ...S.lbl, marginBottom: 12 }}>FSM: {currentFSMName}</div>
              {!fsmIssues.length ? <div style={{ fontSize: 11, color: CC.success }}>✓ No issues</div>
                : fsmIssues.map((iss, i) => <div key={i} style={S.val(iss.level)}>{iss.level === "error" ? "⛔" : iss.level === "info" ? "ℹ" : "⚠"} {iss.msg}</div>)}
              <div style={{ ...S.lbl, marginTop: 16, marginBottom: 8 }}>Per-State</div>
              {states.map(s => { const v = validateState(s, states); if (!v.errors.length && !v.warnings.length) return null;
                return <div key={s.id} style={{ marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</div>{v.errors.map((e, i) => <div key={`e${i}`} style={S.val("error")}>⛔ {e}</div>)}{v.warnings.map((w, i) => <div key={`w${i}`} style={S.val("warning")}>⚠ {w}</div>)}</div>; })}
              <div style={{ ...S.lbl, marginTop: 16, marginBottom: 8 }}>Per-Transition</div>
              {transitions.map(t => { const v = validateTransition(t, states); if (!v.errors.length && !v.warnings.length) return null;
                const fn = states.find(s => s.id === t.from)?.name || "?", tn2 = states.find(s => s.id === t.to)?.name || "?";
                return <div key={t.id} style={{ marginBottom: 8 }}><div style={{ fontSize: 11, fontWeight: 600 }}>{fn} → {tn2}</div>{v.errors.map((e, i) => <div key={`e${i}`} style={S.val("error")}>⛔ {e}</div>)}{v.warnings.map((w, i) => <div key={`w${i}`} style={S.val("warning")}>⚠ {w}</div>)}</div>; })}
              <div style={{ ...S.lbl, marginTop: 16, marginBottom: 8 }}>All FSMs in Registry ({Object.keys(registry).length})</div>
              {Object.keys(registry).map(name => <div key={name} onClick={() => navigateTo(name)} style={{ fontSize: 11, color: name === currentFSMName ? CC.compound : CC.textMuted, cursor: "pointer", padding: "3px 0", textDecoration: name === currentFSMName ? "none" : "underline" }}>{name === currentFSMName ? `▸ ${name} (current)` : name}</div>)}
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderTop: `1px solid ${CC.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {navStack.length > 1 && <button style={S.btn(CC.compound)} onClick={navigateBack}>← Back</button>}
          <button style={S.btn(CC.accent)} onClick={exportJSON}>Export All</button>
          <button style={S.btn(CC.textMuted)} onClick={() => { setShowJSON(true); setJsonText(""); setJsonError(""); }}>Import</button>
        </div>
      </div>

      <div ref={diagramContainerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }} onClick={() => setInlineEdit(null)}>
        {showJSON && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,14,23,0.95)", display: "flex", flexDirection: "column", padding: 20, zIndex: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: CC.accent }}>FSM Registry JSON</span>
              <button style={S.btnX} onClick={() => setShowJSON(false)}>✕ Close</button></div>
            <textarea style={{ ...S.inp, flex: 1, resize: "none", fontSize: 11, lineHeight: 1.5 }} value={jsonText} onChange={e => { setJsonText(e.target.value); setJsonError(""); }} placeholder="Paste FSM registry JSON..." />
            {jsonError && <div style={{ ...S.val("error"), marginTop: 8 }}>⛔ {jsonError}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={S.btnF(CC.accent)} onClick={importJSON}>Import</button>
              <button style={S.btn(CC.textMuted)} onClick={() => setShowJSON(false)}>Cancel</button>
              {jsonText && <button style={S.btn(CC.success)} onClick={() => navigator.clipboard.writeText(jsonText)}>Copy</button>}
            </div></div>
        )}

        <FSMDiagram states={states} transitions={transitions}
          selectedStateId={selectedStateId} selectedTransitionId={selectedTransitionId}
          onSelectState={id => { setSelectedStateId(id); setSelectedTransitionId(null); if (id) setActiveTab("states"); setInlineEdit(null); }}
          onSelectTransition={id => { setSelectedTransitionId(id); setSelectedStateId(null); if (id) setActiveTab("transitions"); setInlineEdit(null); }}
          onDblClickState={handleDblClickState} onDblClickTransition={handleDblClickTransition}
          containerRef={diagramContainerRef} onZoomReady={ctrls => { zoomControlsRef.current = ctrls; }}
          showEmbedded={showEmbedded} registry={registry} flashTarget={flashTarget} onNavigateFSM={navigateTo} theme={theme}
          locks={locks} currentUser={currentUser} />

        {/* Two-column control stack: toggles (left) | separator | zoom (right) */}
        <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", flexDirection: "row", gap: 0, zIndex: 10, alignItems: "flex-end" }}>
          {/* Left column: toggle buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button title="Show/hide embedded FSM labels" onClick={() => setShowEmbedded(p => !p)}
              style={{ ...zoomBtnStyle, width: "auto", padding: "6px 10px", fontSize: 11, color: showEmbedded ? CC.compound : CC.textMuted, borderColor: showEmbedded ? CC.compound : CC.border }}>
              {showEmbedded ? "\u27E8FSM\u27E9 ON" : "\u27E8FSM\u27E9 OFF"}</button>
            <button title="Show/hide process tree" onClick={() => setShowTree(p => !p)}
              style={{ ...zoomBtnStyle, width: "auto", padding: "6px 10px", fontSize: 11,
                color: showTree ? CC.compound : CC.textMuted, borderColor: showTree ? CC.compound : CC.border }}>
              {showTree ? "\uD83C\uDF32 ON" : "\uD83C\uDF32 OFF"}</button>
            <button title="Toggle light/dark theme" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              style={{ ...zoomBtnStyle, width: "auto", padding: "6px 10px", fontSize: 11,
                color: CC.text, borderColor: CC.border }}>
              {theme === "dark" ? "\u2600 Light" : "\uD83C\uDF19 Dark"}</button>
            <button title="Show/hide chat assistant" onClick={() => setShowChat(p => !p)}
              style={{ ...zoomBtnStyle, width: "auto", padding: "6px 10px", fontSize: 11,
                color: showChat ? CC.accent : CC.textMuted, borderColor: showChat ? CC.accent : CC.border }}>
              {showChat ? "\uD83D\uDCAC ON" : "\uD83D\uDCAC OFF"}</button>
          </div>
          {/* Separator */}
          <div style={{ width: 1, alignSelf: "stretch", background: CC.border, margin: "0 6px" }} />
          {/* Zoom buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button title="Zoom in" onClick={() => zoomControlsRef.current?.zoomIn()} style={{ ...zoomBtnStyle, width: 28, height: 28, fontSize: 14, padding: 0 }}>+</button>
            <button title="Zoom out" onClick={() => zoomControlsRef.current?.zoomOut()} style={{ ...zoomBtnStyle, width: 28, height: 28, fontSize: 14, padding: 0 }}>{"\u2212"}</button>
            <button title="Fit to view" onClick={() => zoomControlsRef.current?.fitToView()} style={{ ...zoomBtnStyle, width: 28, height: 28, fontSize: 11, padding: 0 }}>{"\u229E"}</button>
          </div>
        </div>

        {/* Draggable conversation log window — fixed so it overlays everything */}
        {showChat && showLog && chatMessages.length > 0 && (
          <div ref={logRef}
            style={{
              position: "fixed", zIndex: 9999,
              ...(logPos.x === -1
                ? { bottom: 184, left: 320, right: showTree ? 230 : 20 }
                : { left: logPos.x, top: logPos.y, width: logSize.w || undefined, right: logSize.w ? undefined : (showTree ? 230 : 20) }),
              height: logSize.h,
              background: CC.bg + "f0", border: `1.5px solid ${CC.border}`, borderRadius: 14,
              backdropFilter: "blur(16px)", boxShadow: `0 8px 32px ${CC.bg}aa`,
              display: "flex", flexDirection: "column", overflow: "hidden",
              cursor: isDraggingLog ? "grabbing" : "default"
            }}>
            {/* Title bar — drag handle */}
            <div onMouseDown={onLogDragStart}
              style={{ padding: "6px 12px", borderBottom: `1px solid ${CC.border}30`, display: "flex",
                justifyContent: "space-between", alignItems: "center", cursor: "grab", flexShrink: 0,
                userSelect: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: CC.accent, letterSpacing: 0.3 }}>Conversation</span>
                <span style={{ fontSize: 10, color: CC.textDim }}>{chatMessages.filter(m => m.role === "user").length} messages</span>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button onClick={resetLogPosition} title="Snap back above chat bar"
                  style={{ background: logPos.x !== -1 ? CC.accent + "22" : "transparent",
                    border: `1px solid ${logPos.x !== -1 ? CC.accent + "44" : CC.border}`,
                    borderRadius: 4, padding: "2px 8px", color: logPos.x !== -1 ? CC.accent : CC.textMuted,
                    fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>⇩ Dock</button>
                <button onClick={() => setChatMessages([])} title="Clear"
                  style={{ background: "transparent", border: `1px solid ${CC.border}`,
                    borderRadius: 4, padding: "2px 8px", color: CC.textMuted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
              </div>
            </div>
            {/* Scrollable messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6,
              scrollbarWidth: "thin" }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "85%", padding: "8px 14px", borderRadius: 16,
                    background: m.isError ? "#e0303018" : m.role === "user" ? CC.accent + "22" : CC.surfaceAlt,
                    border: `1px solid ${m.isError ? "#e0303044" : m.role === "user" ? CC.accent + "44" : CC.border}`,
                    color: m.isError ? "#f08080" : CC.text, fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word"
                  }}>
                    {m.content}
                  </div>
                  <div style={{ fontSize: 9, color: CC.textDim, marginTop: 2, padding: "0 8px" }}>{m.time}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: CC.textDim, fontSize: 11, padding: "2px 8px" }}>
                  <span style={{ animation: "pulse 1s infinite" }}>●</span> Thinking...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {/* 4-corner resize handles */}
            {[
              { corner: "tl", top: 0, left: 0, cursor: "nwse-resize" },
              { corner: "tr", top: 0, right: 0, cursor: "nesw-resize" },
              { corner: "bl", bottom: 0, left: 0, cursor: "nesw-resize" },
              { corner: "br", bottom: 0, right: 0, cursor: "nwse-resize" }
            ].map(h => (
              <div key={h.corner} onMouseDown={onLogResizeStart(h.corner)}
                style={{ position: "absolute", width: 16, height: 16, cursor: h.cursor, zIndex: 2,
                  top: h.top, bottom: h.bottom, left: h.left, right: h.right,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: 2,
                  background: CC.textDim, opacity: 0.35 }} />
              </div>
            ))}
          </div>
        )}

        {/* Claude Desktop-style chat input bar */}
        {showChat && (
          <div style={{ position: "absolute", bottom: 12, left: 150, right: 155,
            zIndex: 8 }}>
            {/* Rounded-rect input bar — height matches 3 zoom icons (92px) */}
            <div style={{
              width: "100%", height: 92, display: "flex", alignItems: "center", gap: 10,
              background: CC.surface, border: `1.5px solid ${CC.border}`, borderRadius: 20,
              padding: "8px 12px 8px 8px", boxShadow: `0 4px 24px ${CC.bg}88`, boxSizing: "border-box"
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, alignItems: "center" }}>
                <Tip text="Toggle conversation log">
                  <button onClick={() => setShowLog(p => !p)} title=""
                    style={{ width: 36, height: 20, borderRadius: 4,
                      border: `1px solid ${showLog ? CC.accent + "66" : CC.border}`,
                      background: showLog ? CC.accent + "22" : CC.surfaceAlt,
                      color: showLog ? CC.accent : CC.textDim,
                      fontSize: 11, cursor: "pointer", fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {showLog ? "📋" : "📋"}
                  </button>
                </Tip>
                <Tip text="Clear and start new conversation">
                  <button onClick={() => setChatMessages([])} title=""
                    style={{ width: 36, height: 30, borderRadius: "50%", border: `1px solid ${CC.border}`,
                      background: CC.surfaceAlt, color: CC.textMuted, fontSize: 18, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                    +
                  </button>
                </Tip>
                <Tip text="Retry last failed message">
                  <button onClick={retryChat} title="" disabled={!hasError || chatLoading}
                    style={{ width: 36, height: 30, borderRadius: "50%",
                      border: `1px solid ${hasError ? "#e0303066" : CC.border}`,
                      background: hasError ? "#e0303018" : CC.surfaceAlt,
                      color: hasError ? "#f08080" : CC.textDim,
                      fontSize: 14, cursor: hasError ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: hasError ? 1 : 0.4 }}>
                    ↻
                  </button>
                </Tip>
              </div>
              <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Ask about this FSM..."
                rows={3}
                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", resize: "none",
                  padding: "4px 4px", color: CC.text, fontSize: 13, fontFamily: "'JetBrains Mono',monospace",
                  outline: "none", lineHeight: 1.5, height: "100%", boxSizing: "border-box" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <Tip text={isListening ? "Stop listening" : "Voice input (speech to text)"}>
                  <button onClick={toggleVoice} title=""
                    style={{ width: 34, height: 34, borderRadius: "50%",
                      background: isListening ? "#e03030" : "transparent", border: `1px solid ${isListening ? "#e03030" : CC.border}`,
                      cursor: "pointer", color: isListening ? "#fff" : CC.textMuted, fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      animation: isListening ? "pulse 1s infinite" : "none" }}>
                    🎙
                  </button>
                </Tip>
                <Tip text="Send message (Enter)">
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} title=""
                    style={{ width: 34, height: 34, borderRadius: "50%",
                      background: chatInput.trim() ? CC.accent : CC.surfaceAlt,
                      border: `1px solid ${chatInput.trim() ? CC.accent : CC.border}`,
                      cursor: chatInput.trim() ? "pointer" : "default",
                      color: chatInput.trim() ? "#fff" : CC.textDim, fontSize: 14,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ↑
                  </button>
                </Tip>
              </div>
            </div>
          </div>
        )}

        {/* Inline edit panels */}
        {inlineEdit && inlineState && <div style={{ position: "absolute", left: inlinePos.left, top: inlinePos.top, zIndex: 15 }} onClick={e => e.stopPropagation()}><InlineStateEditor state={inlineState} states={states} onUpdate={updateState} onDelete={deleteState} onClose={closeInlineEdit} lockedBy={locks[inlineState.id]?.lockedBy} saveNudge={saveNudge === inlineState.id} canEdit={canEdit} /></div>}
        {inlineEdit && inlineTrans && <div style={{ position: "absolute", left: inlinePos.left, top: inlinePos.top, zIndex: 15 }} onClick={e => e.stopPropagation()}><InlineTransitionEditor transition={inlineTrans} states={states} onUpdate={updateTransition} onDelete={deleteTransition} onClose={closeInlineEdit} registry={registry} onNavigate={navigateTo} lockedBy={locks[inlineTrans.id]?.lockedBy} saveNudge={saveNudge === inlineTrans.id} canEdit={canEdit} /></div>}

        {/* Hint */}
        <div style={{ position: "absolute", top: 12, left: 12, background: CC.surfaceAlt, border: `1px solid ${CC.border}`, borderRadius: 4, padding: "5px 10px", fontSize: 11, color: CC.textDim }}>
          Click ▶ labels to drill down • Hold 👁 to peek • Double-click to edit inline
        </div>

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 12, right: 12, background: CC.surfaceAlt, border: `1px solid ${CC.border}`, borderRadius: 6, padding: "12px 16px", fontSize: 11 }}>
          <div style={{ fontWeight: 700, color: CC.textMuted, marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>Notation</div>
          {[{ label: "Initial", color: CC.initial, rx: 3, sym: "\u25B6" }, { label: "Normal", color: CC.normal, rx: 3, sym: "" }, { label: "Terminal", color: CC.terminal, rx: 7, sym: "\u25A0" }].map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 28, height: 16, borderRadius: it.rx, border: `2.5px solid ${it.color}`, background: it.color + "44", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {it.sym && <span style={{ fontSize: 7, color: it.color, lineHeight: 1 }}>{it.sym}</span>}
                {it.label === "Terminal" && <div style={{ position: "absolute", inset: 2, borderRadius: Math.max(it.rx - 2, 1), border: `1px solid ${it.color}`, opacity: 0.6 }} />}
              </div><span style={{ color: it.color, fontWeight: 600 }}>{it.label}</span></div>))}
          <div style={{ borderTop: `1px solid ${CC.border}`, paddingTop: 4, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}><div style={{ width: 28, borderTop: `1.5px solid ${CC.edgeLine}` }} /><span style={{ color: CC.edgeLine }}>Atomic</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, borderTop: `2.25px dashed ${CC.compound}` }} /><span style={{ color: CC.compound }}>Compound</span></div>
          </div>
        </div>
      </div>

      {/* Right Panel: Process Decomposition Tree */}
      {showTree && (
        <div style={{ width: 210, minWidth: 210, display: "flex", flexDirection: "column", background: CC.surface,
          borderLeft: `1px solid ${CC.border}`, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${CC.border}`, background: CC.surfaceAlt,
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: CC.compound, letterSpacing: 0.3 }}>Process Tree</div>
              <div style={{ fontSize: 11, color: CC.textDim, marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" }}>Decomposition Map</div>
            </div>
            <button onClick={() => setShowTree(false)}
              style={{ background: "transparent", border: "none", color: CC.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
          </div>
          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${CC.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: CC.textDim, whiteSpace: "nowrap" }}>Depth</span>
            {[1, 2, 3, 5, 99].map(d => (
              <button key={d} onClick={() => setTreeDepth(d)}
                style={{ padding: "2px 7px", fontSize: 11, fontFamily: "inherit", fontWeight: treeDepth === d ? 700 : 400,
                  background: treeDepth === d ? CC.compound + "33" : "transparent",
                  border: `1px solid ${treeDepth === d ? CC.compound : CC.border}`,
                  borderRadius: 3, color: treeDepth === d ? CC.compound : CC.textMuted, cursor: "pointer" }}>
                {d >= 99 ? "∞" : d}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
            <ProcessTree registry={registry} rootName={navStack[0]} currentFSMName={currentFSMName}
              maxDepth={treeDepth} onNavigate={(name) => {
                if (name === currentFSMName) return;
                // Build a path from root to target by walking the tree
                const buildPath = (cur, target, path) => {
                  if (cur === target) return [...path, cur];
                  const fsm = registry[cur];
                  if (!fsm) return null;
                  const compounds = fsm.transitions.filter(t => t.executionType === "compound" && t.embeddedFSM);
                  for (const t of compounds) {
                    const result = buildPath(t.embeddedFSM, target, [...path, cur]);
                    if (result) return result;
                  }
                  return null;
                };
                const path = buildPath(navStack[0], name, []);
                if (path) {
                  setNavStack(path);
                } else {
                  // Direct navigate if not in current tree (orphan FSM)
                  setNavStack([name]);
                }
                setSelectedStateId(null); setSelectedTransitionId(null); setInlineEdit(null);
              }}
              onFlashStart={startFlash} onFlashEnd={endFlash} />
          </div>
          <div style={{ padding: "8px 14px", borderTop: `1px solid ${CC.border}`, fontSize: 11, color: CC.textDim }}>
            <span style={{ color: CC.success }}>●</span> leaf (all atomic)
            <span style={{ marginLeft: 8, color: CC.compound }}>▾</span> has embedded FSMs
            <div style={{ marginTop: 3 }}>s = states · a = atomic · c = compound</div>
          </div>
        </div>
      )}
    </div>
  );
}
