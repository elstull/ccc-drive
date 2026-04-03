import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { message, history, userId, userName } = await req.json()
    if (!message) return new Response(JSON.stringify({ error: 'message required' }), { status: 400, headers: corsHeaders })
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    const [iR, aR, pR, wR, bR] = await Promise.allSettled([
      supabase.from('fsm_instances').select('id,fsm_name,current_state_name,current_state_id,entity_id,started_by').eq('is_active',true).order('created_at',{ascending:false}).limit(15),
      supabase.from('activity_log').select('user_id,user_name,title,detail,action_type,entity_id,occurred_at').order('occurred_at',{ascending:false}).limit(20),
      supabase.from('purchase_orders').select('po_number,status,supplier_name,total_amount,currency,notes').order('created_at',{ascending:false}).limit(10),
      supabase.rpc('my_work_queue', { p_user_id: userId }),
      supabase.from('bis_licenses').select('license_number,authorization_amount,utilized_amount,currency,expiry_date,status').limit(5)
    ])
    const instances = iR.status==='fulfilled'?(iR.value.data||[]):[]
    const activity  = aR.status==='fulfilled'?(aR.value.data||[]):[]
    const pos       = pR.status==='fulfilled'?(pR.value.data||[]):[]
    const workQueue = wR.status==='fulfilled'?(wR.value.data||[]):[]
    const bis       = bR.status==='fulfilled'?(bR.value.data||[]):[]
    const now = new Date().toLocaleString('en-US',{timeZone:'America/New_York'})
    const sp = [
      'You are FSM Drive Assistant — the AI for FSM Drive, PAE operations platform.',
      'COMPANY: Premier Automotive Export Ltd (PAE). Exports food to Cuba under BIS AGR (~, validated March 3 2026).',
      'Pass-through model: US suppliers -> Albert Diaz Miami -> ship -> Helen Savo-Sardaro Cuba (DIVEP / FHR 333 S.U.R.L).',
      'Key people: John Felder (President), Ed Stull (CTO), Rick Kam (executive), Albert Diaz (Miami ops), Helen Savo-Sardaro (Cuba chief), Carmen Stull (editor).',
      'Cuba payments NEVER through Stripe. All financials USD for V1.',
      'USER: '+(userName||userId)+' | TIME (ET): '+now,
      'ACTIVE FSM INSTANCES ('+instances.length+'):',
      instances.length>0 ? instances.map(i=>'- ['+i.id+'] '+i.fsm_name+' State:'+i.current_state_name+' Owner:'+i.started_by).join('\n') : 'None.',
      workQueue.length>0 ? 'WORK QUEUE ('+workQueue.length+'):\n'+workQueue.map(w=>'- ['+((w.priority||'normal').toUpperCase())+'] '+w.instance_label+' — '+w.current_state+(w.available_actions?.length?' ['+w.available_actions.map(a=>a.label).join(', ')+']':'')).join('\n') : '',
      'PURCHASE ORDERS ('+pos.length+'):',
      pos.length>0 ? pos.map(p=>'- '+p.po_number+' '+( p.supplier_name||'?')+' $'+(p.total_amount||'?')+' '+p.status).join('\n') : 'None.',
      bis.length>0 ? 'BIS LICENSE:\n'+bis.map(b=>'- '+b.license_number+' Auth:$'+b.authorization_amount+' Used:$'+b.utilized_amount+' '+b.status).join('\n') : '',
      'RECENT ACTIVITY:',
      activity.length>0 ? activity.slice(0,12).map(a=>'- '+(a.user_name||a.user_id)+': '+a.title+(a.detail?' - '+a.detail:'')).join('\n') : 'None.',
      'INSTRUCTIONS: Be concise, mobile-first. Match user language (EN or ES). Answer from data above. Say so if data is insufficient. 2-4 sentences simple, up to 8 complex.'
    ].join('\n')
    const msgs = [...(Array.isArray(history)?history:[]).slice(-12).map(m=>({role:m.role,content:m.content})),{role:'user',content:message}]
    const key = Deno.env.get('ANTHROPIC_API_KEY')
    if (!key) throw new Error('ANTHROPIC_API_KEY secret not configured')
    const r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1024,system:sp,messages:msgs})
    })
    if (!r.ok) throw new Error('Claude API error '+r.status+': '+(await r.text()))
    const d = await r.json()
    const reply = d.content?.[0]?.text
    if (!reply) throw new Error('Empty response from Claude')
    return new Response(JSON.stringify({reply}),{headers:{...corsHeaders,'Content-Type':'application/json'}})
  } catch(error) {
    console.error('chat-query error:',error)
    return new Response(JSON.stringify({error:error instanceof Error?error.message:'Unknown error'}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}})
  }
})
