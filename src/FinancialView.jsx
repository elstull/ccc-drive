import { useState, useEffect, useCallback } from 'react';

const DIM    = '#8899aa';
const BLUE   = '#4a90d9';
const GREEN  = '#4ade80';
const YELLOW = '#e8c060';
const RED    = '#ef4444';
const PURPLE = '#c084fc';
const BIS_AUTHORIZATION = 40000000;

const fmt = (n) => { if (n == null) return '—'; return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const fmtShort = (n) => { if (n == null) return '—'; const abs = Math.abs(n); const sign = n < 0 ? '-' : ''; if (abs >= 1000000) return sign + '$' + (abs/1000000).toFixed(2) + 'M'; if (abs >= 1000) return sign + '$' + (abs/1000).toFixed(1) + 'K'; return sign + '$' + abs.toFixed(2); };
const statusColor = (s) => { switch ((s||'').toLowerCase()) { case 'paid': case 'received': case 'approved': return GREEN; case 'overdue': case 'cancelled': return RED; case 'sent': case 'shipped': case 'confirmed': return YELLOW; default: return DIM; } };
const StatusBadge = ({ status }) => (<span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, color:statusColor(status), background:statusColor(status)+'18', border:'1px solid '+statusColor(status)+'44', textTransform:'uppercase', letterSpacing:'0.05em' }}>{status}</span>);
const SummaryCard = ({ label, value, sub, color = '#e2e8f0', accent = BLUE }) => (<div style={{ background:'#111827', border:'1px solid #1e293b', borderRadius:10, padding:'14px 16px', flex:1, minWidth:0, borderTop:'2px solid '+accent }}><div style={{ fontSize:10, color:DIM, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div><div style={{ fontSize:20, fontWeight:700, color, marginBottom:sub?2:0 }}>{value}</div>{sub && <div style={{ fontSize:11, color:DIM }}>{sub}</div>}</div>);

function PLView({ pos, invoices }) {
  const totalRevenue = invoices.filter(i=>i.status!=='draft').reduce((s,i)=>s+Number(i.total||0),0);
  const totalPaid = invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.amount_paid||0),0);
  const totalCost = pos.filter(p=>p.status!=='draft').reduce((s,p)=>s+Number(p.total_cost||0),0);
  const grossProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? ((grossProfit/totalRevenue)*100).toFixed(1) : '0.0';
  const shipments = {};
  pos.forEach(p => { const sid=p.shipment_id||'Unassigned'; if(!shipments[sid]) shipments[sid]={id:sid,cost:0,revenue:0,pos:[]}; shipments[sid].cost+=Number(p.total_cost||0); shipments[sid].pos.push(p); });
  invoices.forEach(i => { const sid='Unassigned'; if(!shipments[sid]) shipments[sid]={id:sid,cost:0,revenue:0,pos:[]}; shipments[sid].revenue+=Number(i.total||0); });
  return (<><div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}><SummaryCard label='Total Revenue' value={fmtShort(totalRevenue)} sub='Invoiced to date' accent={GREEN} color={GREEN} /><SummaryCard label='Total Cost' value={fmtShort(totalCost)} sub='PO costs' accent={RED} color={RED} /><SummaryCard label='Gross Profit' value={fmtShort(grossProfit)} sub={margin+'% margin'} accent={grossProfit>=0?GREEN:RED} color={grossProfit>=0?GREEN:RED} /><SummaryCard label='Cash Collected' value={fmtShort(totalPaid)} sub='Paid invoices' accent={BLUE} /></div>
  <div style={{fontSize:11,color:DIM,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>P&L by Shipment</div>
  {Object.values(shipments).map(s => { const profit=s.revenue-s.cost; const mg=s.revenue>0?((profit/s.revenue)*100).toFixed(1):null; return (<div key={s.id} style={{background:'#111827',border:'1px solid #1e293b',borderRadius:10,padding:'12px 14px',marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div style={{fontSize:13,fontWeight:700,color:'#e2e8f0'}}>{s.id}</div>{mg&&<span style={{fontSize:11,color:profit>=0?GREEN:RED,fontWeight:700}}>{mg}% margin</span>}</div><div style={{display:'flex',gap:8}}><div style={{flex:1,background:'#0a0e17',borderRadius:6,padding:'8px 10px'}}><div style={{fontSize:11,color:'#aabbcc',textTransform:'uppercase',marginBottom:2}}>Revenue</div><div style={{fontSize:14,fontWeight:700,color:GREEN}}>{fmtShort(s.revenue)}</div></div><div style={{flex:1,background:'#0a0e17',borderRadius:6,padding:'8px 10px'}}><div style={{fontSize:11,color:'#aabbcc',textTransform:'uppercase',marginBottom:2}}>Cost</div><div style={{fontSize:14,fontWeight:700,color:RED}}>{fmtShort(s.cost)}</div></div><div style={{flex:1,background:'#0a0e17',borderRadius:6,padding:'8px 10px'}}><div style={{fontSize:11,color:'#aabbcc',textTransform:'uppercase',marginBottom:2}}>Profit</div><div style={{fontSize:14,fontWeight:700,color:profit>=0?GREEN:RED}}>{fmtShort(profit)}</div></div></div>{s.pos.length>0&&<div style={{marginTop:8,display:'flex',gap:4,flexWrap:'wrap'}}>{s.pos.map(p=>(<span key={p.id} style={{fontSize:13,fontWeight:600,color:'#c8d4e0',background:'#0a0e17',border:'1px solid #1e293b',padding:'4px 10px',borderRadius:4}}>{p.supplier_name}</span>))}</div>}</div>); })}</>);
}

function InvoiceView({ invoices }) {
  const outstanding = invoices.filter(i=>i.status==='sent').reduce((s,i)=>s+Number(i.total||0),0);
  const overdue = invoices.filter(i=>i.status==='overdue').reduce((s,i)=>s+Number(i.total||0),0);
  const paid = invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.amount_paid||0),0);
  const draft = invoices.filter(i=>i.status==='draft').reduce((s,i)=>s+Number(i.total||0),0);
  const dueLabel = (d,status) => { if(status==='paid') return null; if(!d) return ''; const days=Math.floor((new Date(d).getTime()-Date.now())/86400000); if(days<0) return Math.abs(days)+'d overdue'; if(days===0) return 'Due today'; return 'Due in '+days+'d'; };
  const dueColor = (d,status) => { if(status==='paid') return DIM; if(!d) return DIM; const days=Math.floor((new Date(d).getTime()-Date.now())/86400000); if(days<0) return RED; if(days<=3) return YELLOW; return DIM; };
  return (<><div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}><SummaryCard label='Sent / Outstanding' value={fmtShort(outstanding)} sub={invoices.filter(i=>i.status==='sent').length+' invoices'} accent={YELLOW} color={YELLOW} /><SummaryCard label='Overdue' value={fmtShort(overdue)} sub={invoices.filter(i=>i.status==='overdue').length+' invoices'} accent={RED} color={RED} /><SummaryCard label='Collected' value={fmtShort(paid)} sub={invoices.filter(i=>i.status==='paid').length+' paid'} accent={GREEN} color={GREEN} /><SummaryCard label='Draft' value={fmtShort(draft)} sub={invoices.filter(i=>i.status==='draft').length+' pending'} accent={DIM} /></div>
  <div style={{fontSize:11,color:DIM,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>All Invoices</div>
  {invoices.length===0&&<div style={{textAlign:'center',padding:'40px 16px',color:DIM,fontSize:13}}>No invoices found.</div>}
  {invoices.map(inv=>(<div key={inv.id} style={{background:'#111827',border:'1px solid #1e293b',borderRadius:10,padding:'12px 14px',marginBottom:8,borderLeft:'3px solid '+statusColor(inv.status)}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}><div><div style={{fontSize:13,fontWeight:700,color:'#e2e8f0',marginBottom:2}}>{inv.id}</div><div style={{fontSize:12,color:DIM}}>{inv.customer_name}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:16,fontWeight:700,color:'#e2e8f0',marginBottom:4}}>{fmt(inv.total)}</div><StatusBadge status={inv.status} /></div></div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}><span style={{fontSize:11,color:'#aabbcc'}}>{inv.invoice_date}</span><span style={{fontSize:10,color:dueColor(inv.due_date,inv.status),fontWeight:600}}>{inv.status==='paid'?'? Paid '+fmt(inv.amount_paid):dueLabel(inv.due_date,inv.status)}</span></div></div>))}</>);
}

function BISView({ pos }) {
  const utilized = pos.filter(p=>p.status!=='draft'&&p.status!=='cancelled').reduce((s,p)=>s+Number(p.total_cost||0),0);
  const remaining = BIS_AUTHORIZATION - utilized;
  const pct = ((utilized/BIS_AUTHORIZATION)*100).toFixed(4);
  const licenseExp = '2027-03-03';
  const daysLeft = Math.floor((new Date(licenseExp).getTime()-Date.now())/86400000);
  const barColor = pct > 80 ? RED : pct > 60 ? YELLOW : GREEN;
  return (<><div style={{background:'#111827',border:'1px solid #1e293b',borderRadius:12,padding:'20px',marginBottom:16,borderTop:'2px solid '+barColor}}><div style={{fontSize:11,color:DIM,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>BIS License Exception AGR — Authorization Utilization</div><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}><div style={{fontSize:28,fontWeight:700,color:barColor}}>{pct}%</div><div style={{fontSize:13,color:DIM}}>of  authorization</div></div><div style={{height:8,background:'#1e293b',borderRadius:4,overflow:'hidden',marginBottom:12}}><div style={{height:'100%',width:pct+'%',background:barColor,borderRadius:4}} /></div><div style={{display:'flex',gap:8}}><div style={{flex:1,background:'#0a0e17',borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:11,color:'#aabbcc',textTransform:'uppercase',marginBottom:4}}>Utilized</div><div style={{fontSize:16,fontWeight:700,color:barColor}}>{fmtShort(utilized)}</div></div><div style={{flex:1,background:'#0a0e17',borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:11,color:'#aabbcc',textTransform:'uppercase',marginBottom:4}}>Remaining</div><div style={{fontSize:16,fontWeight:700,color:GREEN}}>{fmtShort(remaining)}</div></div><div style={{flex:1,background:'#0a0e17',borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:11,color:'#aabbcc',textTransform:'uppercase',marginBottom:4}}>Expires</div><div style={{fontSize:16,fontWeight:700,color:daysLeft<90?YELLOW:'#e2e8f0'}}>{daysLeft}d</div></div></div><div style={{marginTop:10,fontSize:11,color:'#aabbcc'}}>License validated March 3, 2026 · Expires {licenseExp} · Cuba Food Export (AGR)</div></div>
  <div style={{fontSize:11,color:DIM,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Transactions Against License</div>
  {pos.map((p,i)=>{ const pctThis=((Number(p.total_cost||0)/BIS_AUTHORIZATION)*100).toFixed(4); return (<div key={p.id} style={{background:'#111827',border:'1px solid #1e293b',borderRadius:10,padding:'10px 14px',marginBottom:6,opacity:p.status==='draft'?0.5:1}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:12,fontWeight:700,color:'#e2e8f0'}}>{p.id}</div><div style={{fontSize:11,color:DIM,marginTop:1}}>{p.supplier_name}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:14,fontWeight:700,color:p.status==='draft'?DIM:'#e2e8f0'}}>{fmt(p.total_cost)}</div><div style={{fontSize:11,color:'#aabbcc'}}>{pctThis}% of auth</div></div></div><div style={{display:'flex',justifyContent:'space-between',marginTop:6,alignItems:'center'}}><StatusBadge status={p.status} />{p.status!=='draft'&&<span style={{fontSize:11,color:'#aabbcc'}}>{p.shipment_id}</span>}</div></div>); })}</>);
}

function CashFlowView({ pos, invoices, corrections }) {
  const entries = [
    ...pos.map(p=>({id:p.id,date:p.order_date||p.created_at,type:'cost',label:p.supplier_name,ref:p.id,amount:-Number(p.total_cost||0),status:p.status,note:p.shipment_id})),
    ...invoices.filter(i=>i.status!=='draft').map(i=>({id:i.id,date:i.invoice_date||i.created_at,type:'revenue',label:i.customer_name,ref:i.id,amount:Number(i.total||0),status:i.status,note:null})),
    ...corrections.map(c=>({id:c.id,date:c.original_date||c.created_at,type:'correction',label:'Correction: '+c.correction_type,ref:c.original_id,amount:Number(c.correction_delta_usd||0),status:c.status,note:c.reason_detail})),
  ].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let running=0;
  const withRunning=entries.map(e=>{ if(e.status!=='draft'&&e.status!=='pending'&&e.status!=='cancelled') running+=e.amount; return {...e,running}; });
  const totalIn=entries.filter(e=>e.amount>0&&e.status!=='draft').reduce((s,e)=>s+e.amount,0);
  const totalOut=entries.filter(e=>e.amount<0&&e.status!=='draft').reduce((s,e)=>s+Math.abs(e.amount),0);
  const net=totalIn-totalOut;
  const typeColor=(t)=>t==='revenue'?GREEN:t==='correction'?PURPLE:RED;
  const typeLabel=(t)=>t==='revenue'?'Revenue':t==='correction'?'Correction':'Cost';
  return (<><div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}><SummaryCard label='Total In' value={fmtShort(totalIn)} sub='Revenue' accent={GREEN} color={GREEN} /><SummaryCard label='Total Out' value={fmtShort(totalOut)} sub='PO costs' accent={RED} color={RED} /><SummaryCard label='Net Position' value={fmtShort(net)} accent={net>=0?GREEN:RED} color={net>=0?GREEN:RED} /></div>
  <div style={{fontSize:11,color:DIM,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Ledger — Chronological</div>
  {withRunning.map((e,i)=>(<div key={i} style={{background:'#111827',border:'1px solid #1e293b',borderRadius:10,padding:'10px 14px',marginBottom:6,borderLeft:'3px solid '+typeColor(e.type),opacity:(e.status==='draft'||e.status==='pending')?0.6:1}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div style={{flex:1,minWidth:0}}><div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}><span style={{fontSize:9,color:typeColor(e.type),fontWeight:700,textTransform:'uppercase'}}>{typeLabel(e.type)}</span><span style={{fontSize:11,color:'#aabbcc'}}>{e.ref}</span></div><div style={{fontSize:12,fontWeight:600,color:'#e2e8f0'}}>{e.label}</div>{e.note&&<div style={{fontSize:11,color:DIM,marginTop:2}}>{e.note}</div>}</div><div style={{textAlign:'right',flexShrink:0,marginLeft:12}}><div style={{fontSize:14,fontWeight:700,color:e.amount>=0?GREEN:RED}}>{e.amount>=0?'+':''}{fmtShort(e.amount)}</div><div style={{fontSize:10,color:DIM,marginTop:2}}>Bal: {fmtShort(e.running)}</div></div></div><div style={{display:'flex',justifyContent:'space-between',marginTop:6}}><span style={{fontSize:11,color:'#aabbcc'}}>{e.date?new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}):''}</span><StatusBadge status={e.status} /></div></div>))}</>);
}

export default function FinancialView({ currentUser, users, supabase }) {
  const [tab, setTab] = useState('pl');
  const [pos, setPOs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { if(!supabase) return; setLoading(true); try { const [poRes,invRes,corRes]=await Promise.all([supabase.from('purchase_orders').select('*').order('created_at',{ascending:false}),supabase.from('invoices').select('*').order('invoice_date',{ascending:false}),supabase.from('financial_corrections').select('*').order('created_at',{ascending:false})]); setPOs(poRes.data||[]); setInvoices(invRes.data||[]); setCorrections(corRes.data||[]); } catch(e){console.error('Financial load:',e);} setLoading(false); }, [supabase]);
  useEffect(()=>{load();},[load]);
  const TABS=[{id:'pl',label:'P&L',icon:'??'},{id:'invoices',label:'Invoices',icon:'??'},{id:'bis',label:'BIS License',icon:'??'},{id:'cashflow',label:'Cash Flow',icon:'??'}];
  return (<div style={{maxWidth:520,margin:'0 auto',padding:'16px'}}><div style={{marginBottom:16}}><div style={{fontSize:16,fontWeight:700,color:'#e2e8f0',marginBottom:4}}>Financials</div><div style={{fontSize:12,color:DIM}}>P&L · Invoices · BIS License · Cash Flow</div></div>
  <div style={{display:'flex',gap:4,marginBottom:16,overflowX:'auto',paddingBottom:2}}>{TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{flexShrink:0,padding:'8px 14px',borderRadius:8,background:tab===t.id?'#111827':'transparent',border:'1px solid '+(tab===t.id?BLUE:'#1e293b'),color:tab===t.id?BLUE:DIM,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',WebkitTapHighlightColor:'transparent'}}>{t.icon} {t.label}</button>))}</div>
  <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><button onClick={load} style={{background:'none',border:'1px solid #1e293b',borderRadius:6,color:DIM,fontSize:11,padding:'4px 12px',cursor:'pointer',fontFamily:'inherit'}}>? Refresh</button></div>
  {loading?(<div style={{textAlign:'center',padding:'40px',color:BLUE,fontSize:13}}>Loading financial data...</div>):(<>{tab==='pl'&&<PLView pos={pos} invoices={invoices} />}{tab==='invoices'&&<InvoiceView invoices={invoices} />}{tab==='bis'&&<BISView pos={pos} />}{tab==='cashflow'&&<CashFlowView pos={pos} invoices={invoices} corrections={corrections} />}</>)}
  </div>);
}
