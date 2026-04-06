// ============================================================
// FSM DRIVE v2 — CHAT EDGE FUNCTION
// chat-query/index.ts
//
// Dynamic system prompt assembly with:
// - Instance identity
// - Team structure and coverage map
// - Active Briefs
// - Operational state summary
// - Pending advisories for current user
// - Financial query capability
// - Problem-solution Chat pattern
// - Advisory awareness and creation
//
// Deploy: npx supabase functions deploy chat-query --project-ref <ref>
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, history, userId, userName } = await req.json();
    const user = userName || userId;

    // ── Supabase client (server-side, service role) ──
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── DYNAMIC CONTEXT ASSEMBLY ──
    // Each section queries the live database at request time.
    // This is the Shared Contextual Intelligence architecture (DN-001).

    // 1. Instance Identity
    // TODO: Move to a config table. For now, set per deployment.
    const instanceCode = Deno.env.get("INSTANCE_CODE") || "CCC";
    const instanceName = Deno.env.get("INSTANCE_NAME") || "CCC Drive";
    const customerName = Deno.env.get("CUSTOMER_NAME") || "Crash Care Clinics";

    // 2. Team Structure
    let teamContext = "No team members found.";
    try {
      const { data: team } = await supabase
        .from("fsm_users")
        .select("id, name, role, org_path, email")
        .order("org_path");

      if (team && team.length > 0) {
        teamContext = team.map(u =>
          `${u.name} (${u.id}) — ${u.role}, org_path: ${u.org_path}`
        ).join("\n");
      }
    } catch {
      // fsm_users table may not exist yet — skip silently
    }

    // 3. Active FSM Summary
    const { data: fsmSummary } = await supabase.rpc("get_fsm_summary");
    // Fallback if RPC doesn't exist yet:
    let fsmContext = "FSM summary not available.";
    if (fsmSummary) {
      fsmContext = JSON.stringify(fsmSummary, null, 2);
    } else {
      // Direct query fallback
      const { data: instances } = await supabase
        .from("fsm_instances")
        .select("id, fsm_definition_id, current_state_id, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (instances) {
        fsmContext = `Active FSM instances (most recent 20):\n${
          instances.map(i => `  ${i.id}: ${i.fsm_definition_id} → ${i.current_state_id} (${i.updated_at})`).join("\n")
        }`;
      }
    }

    // 4. Pending Advisories for Current User
    let advisoryContext = "";
    if (user) {
      const { data: pendingAdvisories } = await supabase
        .from("pending_advisories")
        .select("*")
        .eq("recipient", user);

      if (pendingAdvisories && pendingAdvisories.length > 0) {
        const critical = pendingAdvisories.filter(a => a.urgency === "critical");
        const priority = pendingAdvisories.filter(a => a.urgency === "priority");
        const routine = pendingAdvisories.filter(a => a.urgency === "routine");
        const overdue = pendingAdvisories.filter(a => a.state === "adv-overdue");

        advisoryContext = `\n\nPENDING ADVISORIES FOR ${user}:`;
        if (critical.length > 0) {
          advisoryContext += `\nCRITICAL (must acknowledge before proceeding):`;
          critical.forEach(a => { advisoryContext += `\n  - ${a.title}: ${a.content}`; });
        }
        if (overdue.length > 0) {
          advisoryContext += `\nOVERDUE (mandatory, past acknowledgment window):`;
          overdue.forEach(a => { advisoryContext += `\n  - ${a.title} (escalation level: ${a.escalation_level})`; });
        }
        if (priority.length > 0) {
          advisoryContext += `\nPRIORITY:`;
          priority.forEach(a => { advisoryContext += `\n  - ${a.title}`; });
        }
        if (routine.length > 0) {
          advisoryContext += `\nROUTINE (${routine.length} pending):`;
          routine.forEach(a => { advisoryContext += `\n  - ${a.title}`; });
        }
      }
    }

    // 5. Resource Metrics (lightweight summary)
    let resourceContext = "";
    try {
      const { data: dbSize } = await supabase.rpc("get_database_size");
      const { data: userCount } = await supabase
        .from("fsm_users")
        .select("username", { count: "exact" });
      resourceContext = `\nResource status: Database size: ${dbSize || "unknown"}, Team members: ${userCount?.length || 0}/10`;
    } catch {
      // Resource queries may not exist yet — skip silently
    }

    // ── SYSTEM PROMPT ASSEMBLY ──
    const systemPrompt = `You are the Chat conductor for ${instanceName}, serving ${customerName}.
Instance code: ${instanceCode}

YOUR ROLE:
You are an intelligent conductor that knows this business because you have live access to its operational database. You do not guess. You query. You do not approximate. You compute. Every answer you give is grounded in the actual data in this instance.

TEAM:
${teamContext}

OPERATIONAL STATE:
${fsmContext}
${advisoryContext}
${resourceContext}

BEHAVIORAL RULES:

1. PROBLEM-SOLUTION PATTERN (mandatory):
   Chat NEVER presents a dead end. Every problem identified must include:
   a) Clear statement of the problem
   b) Why it matters (what is at risk)
   c) At least one concrete action ("Would you like me to...")

2. ADVISORY AWARENESS:
   - If the user has CRITICAL pending advisories, present them FIRST before any other interaction.
   - If the user has OVERDUE mandatory advisories, mention them prominently.
   - If the user has PRIORITY advisories, surface them early in the conversation.
   - For ROUTINE advisories, mention them naturally when relevant.
   - The user can create advisories by saying things like "I need my team to acknowledge..."
   - The user can check advisory status: "Has everyone seen the update?"

3. FINANCIAL INTELLIGENCE:
   When asked financial questions, query the database to compute answers from operational data.
   Do not estimate from general knowledge. Compute from this instance's actual FSM transition history,
   billing events, and operational records. If insufficient data exists, say so honestly and indicate
   how much more history is needed for a reliable answer.

4. RESOURCE AWARENESS:
   If asked about resource usage (storage, API cost, users, etc.), query the resource metrics.
   If any resource is approaching a threshold (70%, 85%, 95%), mention it proactively.

5. ACKNOWLEDGMENT GATES:
   When a user says something needs confirmation before proceeding, recognize this as an
   acknowledgment gate. Create the gate on the relevant FSM transition.
   Examples: "This can't proceed until X confirms" / "We need approval from the team before..."

6. CONVERSATIONAL STYLE:
   Be direct, competent, and warm. Use the team member names when referring to people.
   The user is running a business — respect their time. Lead with the answer, then provide context.
   For the instance owner, include operational awareness unprompted when relevant.

QUERY CAPABILITY:
You can query the database to answer questions. When you need data, construct and execute
a Supabase query. Available tables include: fsm_instances, instance_transitions, fsm_users,
fsm_definitions, fsm_states, advisories, advisory_recipients, user_groups, user_group_members,
and any domain-specific tables in this instance.`;

    // ── CALL ANTHROPIC API ──
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          ...(Array.isArray(history) ? history : [])
            .slice(-12)
            .map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();

    // Extract text response
    const reply = data.content
      ?.filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n") || "I wasn't able to generate a response.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
