import { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT VISUALS — each looks like a real business document
// ═══════════════════════════════════════════════════════════════════════════

const docStyle = {
  background: '#fff', borderRadius: 8, padding: '20px 24px', color: '#111',
  fontFamily: 'Arial, sans-serif', fontSize: 12, lineHeight: 1.5,
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: 460, margin: '0 auto 12px',
};
const hl = { background: '#4ade8018', border: '1px solid #4ade8044', borderRadius: 3, padding: '1px 4px' };
const hdr = (title, color) => ({ fontSize: 16, fontWeight: 700, color: color || '#1a3a6e', marginBottom: 2 });
const sub = { fontSize: 10, color: '#666', marginTop: 1 };
const divider = { borderTop: '2px solid #1a3a6e', paddingTop: 10, marginBottom: 10 };
const fieldRow = { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 };
const fieldLabel = { color: '#666' };
const stamp = (text, color) => ({
  marginTop: 10, padding: '6px 10px', background: color + '15', border: '1px solid ' + color + '44',
  borderRadius: 6, fontSize: 10, color: color, textAlign: 'center',
});


// ── PURCHASE ORDER ──
function PurchaseOrderDoc() {
  return (
    <div style={docStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={hdr('PURCHASE ORDER', '#1a3a6e')}>PURCHASE ORDER</div>
          <div style={sub}>Premier Automotive Export, Ltd.</div>
          <div style={sub}>c/o E.L. Stull & Associates</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><span style={fieldLabel}>PO: </span><span style={hl}><strong>PO-DEMO-001</strong></span></div>
          <div><span style={fieldLabel}>Date: </span><span style={hl}>March 19, 2026</span></div>
          <div><span style={fieldLabel}>Terms: </span><span style={hl}>Net-30</span></div>
        </div>
      </div>
      <div style={divider}>
        <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Vendor</div>
        <div style={{ fontWeight: 600 }}>Sysco Corporation</div>
        <div style={sub}>1390 Enclave Parkway, Houston TX 77077</div>
        <div style={sub}>Contact: Mike Johnson, Account Rep</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Product</th>
            <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Price</th>
            <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '8px 4px' }}><span style={hl}>Cheddar Cheese 10lb Block</span></td>
            <td style={{ padding: '8px 4px', textAlign: 'center' }}><span style={hl}>50 cases</span></td>
            <td style={{ padding: '8px 4px', textAlign: 'right' }}><span style={hl}>$3.50/lb</span></td>
            <td style={{ padding: '8px 4px', textAlign: 'right' }}><span style={hl}>$17,500.00</span></td>
          </tr>
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 160 }}>
          <div style={{ ...fieldRow, fontWeight: 700, fontSize: 13, borderTop: '2px solid #1a3a6e', paddingTop: 4 }}>
            <span>Total:</span><span style={hl}>$17,500.00</span>
          </div>
        </div>
      </div>
      <div style={sub}>Delivery: Miami warehouse by Thursday. Ship to Cuba via Crowley.</div>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ padding: '8px 10px', background: '#4a90d915', border: '1px solid #4a90d944', borderRadius: 6, fontSize: 10, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#4a90d9', marginBottom: 2 }}>{'\uD83D\uDCDE'} Path A: Call</div>
          <div style={{ color: '#666' }}>Ed calls Sysco. FSM Drive records, transcribes, and generates this PO.</div>
        </div>
        <div style={{ padding: '8px 10px', background: '#4ade8015', border: '1px solid #4ade8044', borderRadius: 6, fontSize: 10, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: 2 }}>{'\u2B50'} Path B: One Tap</div>
          <div style={{ color: '#666' }}>Ed taps Reorder. FSM Drive drafts from last order. One tap to confirm and send.</div>
        </div>
      </div>
      <div style={stamp('\u2713 Same PO either way \u2014 generated, sent, and tracked by FSM Drive', '#4ade80')}></div>
    </div>
  );
}


// ── SYSCO INVOICE (inbound) ──
function SyscoInvoiceDoc() {
  return (
    <div style={docStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a3a6e' }}>SYSCO</div>
          <div style={sub}>Sysco Corporation</div>
          <div style={sub}>1390 Enclave Parkway, Houston TX</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={hdr('INVOICE')}>INVOICE</div>
          <div><span style={fieldLabel}>No: </span><span style={hl}><strong>INV-4521</strong></span></div>
          <div><span style={fieldLabel}>Date: </span><span style={hl}>March 19, 2026</span></div>
          <div><span style={fieldLabel}>Terms: </span><span style={hl}>Net-30</span></div>
        </div>
      </div>
      <div style={divider}>
        <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Bill To</div>
        <div style={{ fontWeight: 600 }}>Premier Automotive Export, Ltd.</div>
        <div style={sub}>PO Reference: <span style={hl}>PO-DEMO-001</span></div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead><tr style={{ borderBottom: '1px solid #ddd' }}>
          <th style={{ textAlign: 'left', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Description</th>
          <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Qty</th>
          <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Price</th>
          <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Amount</th>
        </tr></thead>
        <tbody><tr>
          <td style={{ padding: '8px 4px' }}><span style={hl}>Cheddar Cheese 10lb Block</span></td>
          <td style={{ padding: '8px 4px', textAlign: 'center' }}><span style={hl}>50 cases</span></td>
          <td style={{ padding: '8px 4px', textAlign: 'right' }}><span style={hl}>$3.50/lb</span></td>
          <td style={{ padding: '8px 4px', textAlign: 'right' }}><span style={hl}>$17,500.00</span></td>
        </tr></tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 160 }}>
          <div style={fieldRow}><span style={fieldLabel}>Subtotal:</span><span>$17,500.00</span></div>
          <div style={fieldRow}><span style={fieldLabel}>Tax:</span><span>$0.00</span></div>
          <div style={{ ...fieldRow, fontWeight: 700, fontSize: 13, borderTop: '2px solid #1a3a6e', paddingTop: 4 }}>
            <span>Total:</span><span style={hl}>$17,500.00</span>
          </div>
        </div>
      </div>
      <div style={stamp('\u2713 6 fields extracted \u2022 96% confidence \u2022 Source: verified \u2022 GREEN', '#4ade80')}></div>
    </div>
  );
}


// ── BILL OF LADING ──
function BillOfLadingDoc() {
  return (
    <div style={docStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={hdr('BILL OF LADING', '#1a3a6e')}>BILL OF LADING</div>
          <div style={sub}>Malvar Freight / Crowley Logistics</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><span style={fieldLabel}>BOL: </span><span style={hl}><strong>BOL-DEMO-001</strong></span></div>
          <div><span style={fieldLabel}>Date: </span><span style={hl}>March 20, 2026</span></div>
        </div>
      </div>
      <div style={divider}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Shipper</div>
            <div style={{ fontWeight: 600, fontSize: 11 }}>Premier Automotive Export</div>
            <div style={sub}>Miami, FL</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Consignee</div>
            <div style={{ fontWeight: 600, fontSize: 11 }}>FHR 333 S.U.R.L.</div>
            <div style={sub}>Havana, Cuba</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div style={fieldRow}><span style={fieldLabel}>Container:</span><span style={hl}>CRLU-4427183</span></div>
        <div style={fieldRow}><span style={fieldLabel}>Seal:</span><span style={hl}>SEAL-7742</span></div>
        <div style={fieldRow}><span style={fieldLabel}>Vessel:</span><span style={hl}>MV Crowley Eagle</span></div>
        <div style={fieldRow}><span style={fieldLabel}>ETA:</span><span style={hl}>March 23, 2026</span></div>
        <div style={fieldRow}><span style={fieldLabel}>Temp:</span><span style={hl}>34\u00B0F verified</span></div>
        <div style={fieldRow}><span style={fieldLabel}>Weight:</span><span style={hl}>5,000 lbs</span></div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <thead><tr style={{ borderBottom: '1px solid #ddd' }}>
          <th style={{ textAlign: 'left', padding: '4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Commodity</th>
          <th style={{ textAlign: 'center', padding: '4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Pieces</th>
          <th style={{ textAlign: 'right', padding: '4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Weight</th>
        </tr></thead>
        <tbody><tr>
          <td style={{ padding: '6px 4px' }}><span style={hl}>Cheddar Cheese 10lb Block</span></td>
          <td style={{ padding: '6px 4px', textAlign: 'center' }}><span style={hl}>50 cases</span></td>
          <td style={{ padding: '6px 4px', textAlign: 'right' }}><span style={hl}>500 lbs</span></td>
        </tr></tbody>
      </table>
      <div style={sub}>Loaded by: Albert Diaz, Malvar Freight. Cold chain custody verified.</div>
      <div style={stamp('\u2713 Chain of custody recorded \u2022 Helen notified', '#4ade80')}></div>
    </div>
  );
}


// ── TEMPERATURE ALERT ──
function TemperatureAlertDoc() {
  return (
    <div style={{ ...docStyle, borderLeft: '4px solid #e03030' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={hdr('TEMPERATURE BREACH ALERT', '#e03030')}>TEMPERATURE ALERT</div>
          <div style={sub}>FSM Drive Monitoring System</div>
        </div>
        <div style={{ background: '#e0303020', border: '1px solid #e0303060', borderRadius: 6,
          padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#e03030', height: 'fit-content' }}>
          CRITICAL
        </div>
      </div>
      <div style={{ ...divider, borderColor: '#e03030' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={fieldRow}><span style={fieldLabel}>Shipment:</span><span style={hl}>DEMO-SHIP-001</span></div>
          <div style={fieldRow}><span style={fieldLabel}>Container:</span><span style={hl}>CRLU-4427183</span></div>
          <div style={fieldRow}><span style={fieldLabel}>Set point:</span><span style={{ ...hl, borderColor: '#4ade8044' }}>34\u00B0F</span></div>
          <div style={fieldRow}><span style={{ ...hl, background: '#e0303018', borderColor: '#e0303044', fontWeight: 700, color: '#e03030' }}>Actual: 52\u00B0F</span></div>
          <div style={fieldRow}><span style={fieldLabel}>Duration:</span><span style={{ ...hl, background: '#e0303018', borderColor: '#e0303044', color: '#e03030' }}>6 hours</span></div>
          <div style={fieldRow}><span style={fieldLabel}>Cause:</span><span style={hl}>Reefer malfunction</span></div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#333', marginBottom: 8 }}>
        <strong>Impact Assessment:</strong> 8 of 50 cases exposed to temperatures above safe threshold. Product integrity compromised for affected units.
      </div>
      <div style={{ fontSize: 11, color: '#333', marginBottom: 8 }}>
        <strong>Recommended Actions:</strong>
      </div>
      <div style={{ fontSize: 11, color: '#444', paddingLeft: 12 }}>
        1. Inspect all cases on arrival<br/>
        2. Segregate 8 affected cases<br/>
        3. File insurance claim: $2,800<br/>
        4. Create back order with Sysco: 8 replacement cases
      </div>
      <div style={stamp('\u26A0 Back order created \u2022 Insurance claim recommended', '#e03030')}></div>
    </div>
  );
}


// ── RECEIVING REPORT ──
function ReceivingReportDoc() {
  return (
    <div style={docStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={hdr('RECEIVING REPORT', '#1a3a6e')}>RECEIVING REPORT</div>
          <div style={sub}>FHR 333 S.U.R.L. — Havana Warehouse</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><span style={fieldLabel}>Date: </span><span style={hl}>March 23, 2026</span></div>
          <div><span style={fieldLabel}>Received by: </span><span style={hl}>Helen Savo-Sardaro</span></div>
        </div>
      </div>
      <div style={divider}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={fieldRow}><span style={fieldLabel}>Shipment:</span><span style={hl}>DEMO-SHIP-001</span></div>
          <div style={fieldRow}><span style={fieldLabel}>PO:</span><span style={hl}>PO-DEMO-001</span></div>
          <div style={fieldRow}><span style={fieldLabel}>Seal:</span><span style={hl}>SEAL-7742 intact</span></div>
          <div style={fieldRow}><span style={fieldLabel}>Temp on arrival:</span><span style={hl}>36\u00B0F</span></div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead><tr style={{ borderBottom: '1px solid #ddd' }}>
          <th style={{ textAlign: 'left', padding: '4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Product</th>
          <th style={{ textAlign: 'center', padding: '4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Ordered</th>
          <th style={{ textAlign: 'center', padding: '4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Good</th>
          <th style={{ textAlign: 'center', padding: '4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Damaged</th>
        </tr></thead>
        <tbody><tr>
          <td style={{ padding: '6px 4px' }}>Cheddar 10lb Block</td>
          <td style={{ padding: '6px 4px', textAlign: 'center' }}>50</td>
          <td style={{ padding: '6px 4px', textAlign: 'center' }}><span style={{ ...hl, background: '#4ade8018', borderColor: '#4ade8044' }}><strong>42</strong></span></td>
          <td style={{ padding: '6px 4px', textAlign: 'center' }}><span style={{ ...hl, background: '#e0303018', borderColor: '#e0303044', color: '#e03030' }}><strong>8</strong></span></td>
        </tr></tbody>
      </table>
      <div style={{ fontSize: 11, color: '#333', marginBottom: 6 }}>
        <strong>Damage Notes:</strong> 8 cases show temperature damage consistent with breach report. Soft texture, discoloration. Photographed and segregated. Not suitable for sale.
      </div>
      <div style={{ fontSize: 11, color: '#333' }}>
        <strong>Disposition:</strong> 42 cases moved to cold storage. 8 cases held for insurance inspection.
      </div>
      <div style={stamp('\u2713 Compared to PO \u2022 Discrepancy recorded \u2022 Customs: $2,625 duty paid', '#4ade80')}></div>
    </div>
  );
}


// ── CUSTOMER INVOICE (outgoing) ──
function CustomerInvoiceDoc() {
  return (
    <div style={docStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={hdr('INVOICE', '#1a3a6e')}>INVOICE</div>
          <div style={sub}>Premier Automotive Export, Ltd.</div>
          <div style={sub}>c/o E.L. Stull & Associates</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><span style={fieldLabel}>Invoice: </span><span style={hl}><strong>INV-DEMO-001</strong></span></div>
          <div><span style={fieldLabel}>Date: </span><span style={hl}>March 23, 2026</span></div>
          <div><span style={fieldLabel}>Terms: </span><span style={hl}>Net-30</span></div>
          <div><span style={fieldLabel}>Due: </span><span style={hl}>April 22, 2026</span></div>
        </div>
      </div>
      <div style={divider}>
        <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Bill To</div>
        <div style={{ fontWeight: 600 }}>Hotel El Cobre</div>
        <div style={sub}>Santiago de Cuba, Cuba</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead><tr style={{ borderBottom: '1px solid #ddd' }}>
          <th style={{ textAlign: 'left', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Description</th>
          <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Qty</th>
          <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Price</th>
          <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, color: '#666', fontWeight: 700 }}>Amount</th>
        </tr></thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '6px 4px' }}><span style={hl}>Cheddar Cheese 10lb Block</span></td>
            <td style={{ padding: '6px 4px', textAlign: 'center' }}><span style={hl}>42 cases</span></td>
            <td style={{ padding: '6px 4px', textAlign: 'right' }}><span style={hl}>$4.75/lb</span></td>
            <td style={{ padding: '6px 4px', textAlign: 'right' }}><span style={hl}>$1,995.00</span></td>
          </tr>
          <tr>
            <td style={{ padding: '6px 4px' }}>Shipping & Handling</td>
            <td style={{ padding: '6px 4px', textAlign: 'center' }}>1</td>
            <td style={{ padding: '6px 4px', textAlign: 'right' }}>$850.00</td>
            <td style={{ padding: '6px 4px', textAlign: 'right' }}><span style={hl}>$850.00</span></td>
          </tr>
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 180 }}>
          <div style={fieldRow}><span style={fieldLabel}>Subtotal:</span><span>$2,845.00</span></div>
          <div style={fieldRow}><span style={fieldLabel}>Tax:</span><span>$0.00</span></div>
          <div style={{ ...fieldRow, fontWeight: 700, fontSize: 13, borderTop: '2px solid #1a3a6e', paddingTop: 4 }}>
            <span>Total:</span><span style={hl}>$2,845.00</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#888', marginTop: 8 }}>
        Note: 8 cases from original PO-DEMO-001 excluded due to transit damage. Credit memo issued. Back order in progress.
      </div>
      <div style={stamp('\u2713 Auto-generated from delivery confirmation \u2022 42 of 50 cases \u2022 P&L updated', '#4ade80')}></div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// DEMO STEPS
// ═══════════════════════════════════════════════════════════════════════════

const STEPS = [
  {
    title: 'The Order', icon: '\uD83D\uDCDE',
    narration: 'Ed needs 50 cases of cheddar from Sysco. He can call Mike at Sysco and FSM Drive records the call and extracts the order \u2014 or he can tap one button and FSM Drive sends the PO directly. Either way, the result is the same.',
    whatDid: 'Two paths, same result: (1) Ed calls \u2014 FSM Drive records, transcribes, and extracts the order automatically. (2) Ed taps Reorder \u2014 FSM Drive drafts the PO from the last order, Ed confirms with one tap, and the PO is emailed to Sysco. Either way: PO generated, cost recorded, supplier payment scheduled.',
    rpc: 'demo_step1_create_po',
    DocComponent: PurchaseOrderDoc,
    docLabel: 'Purchase order generated by FSM Drive',
  },
  {
    title: 'A Document Arrives', icon: '\uD83D\uDCE7',
    narration: 'Sysco emails their invoice. FSM Drive opens the PDF, reads every field, verifies the sender, and matches it to the purchase order.',
    whatDid: 'Read the document. Classified as supplier invoice. Extracted all fields. Verified @sysco.com as trusted. Matched to PO-DEMO-001. Confidence: 96%. Gate: GREEN.',
    rpc: 'demo_step_document_intake',
    DocComponent: SyscoInvoiceDoc,
    docLabel: 'Sysco invoice — read and extracted by FSM Drive',
    interactive: true,
    interactiveLabel: 'Tap to confirm this invoice',
  },
  {
    title: 'Loaded in Miami', icon: '\uD83D\uDEA2',
    narration: 'Albert at Malvar Freight loads the container in Miami. Cold chain verified at 34\u00B0F.',
    whatDid: 'Logged chain of custody, recorded all costs, and generated the Bill of Lading. Helen was notified automatically.',
    rpc: 'demo_step2_load_shipment',
    DocComponent: BillOfLadingDoc,
    docLabel: 'Bill of Lading generated by FSM Drive',
  },
  {
    title: 'Trouble at Sea', icon: '\u26A0\uFE0F', severity: 'critical',
    narration: 'The refrigeration unit malfunctions for 6 hours. Temperature reaches 52\u00B0F.',
    whatDid: 'Detected the breach, assessed the impact, and generated this alert with recommended actions.',
    rpc: 'demo_step3_temperature_breach',
    DocComponent: TemperatureAlertDoc,
    docLabel: 'Temperature breach alert',
  },
  {
    title: 'Helen Receives', icon: '\uD83D\uDCCB',
    narration: 'The shipment arrives in Havana. Helen counts 42 good cases and 8 damaged.',
    whatDid: 'Compared to the PO, recorded the discrepancy, documented the damage, and processed customs duties.',
    rpc: 'demo_step4_receive_shipment',
    DocComponent: ReceivingReportDoc,
    docLabel: 'Receiving report filed by Helen',
    interactive: true,
    interactiveLabel: 'Tap to confirm receipt',
  },
  {
    title: 'Invoice Adjusts', icon: '\uD83D\uDCB0',
    narration: 'The customer invoice generates automatically \u2014 only for what arrived in good condition.',
    whatDid: 'Generated an invoice for 42 cases plus shipping. 8 damaged excluded. Credit memo issued. P&L updated.',
    rpc: 'demo_step5_create_invoice',
    DocComponent: CustomerInvoiceDoc,
    docLabel: 'Customer invoice — auto-generated for 42 of 50 cases',
  },
  {
    title: 'The Full Picture', icon: '\uD83C\uDFE0',
    narration: 'Ed opens FSM Drive on his phone. One glance tells him everything.',
    whatDid: 'Every dollar tracked. Every document generated. Every person informed. Every decision ready for your review.',
    rpc: 'demo_step6_full_picture',
    interactive: true,
    interactiveLabel: 'See the full picture',
  },
];


// ═══════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════════════════

function Section({ label, color, borderColor, children }) {
  return (
    <div style={{ background: '#0f1724', border: '1px solid ' + (borderColor || '#1e293b'),
      borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ padding: '6px 14px', background: (borderColor || '#1e293b') + '18',
        borderBottom: '1px solid ' + (borderColor || '#1e293b') + '40' }}>
        <span style={{ color: color || '#667788', fontSize: 10, fontWeight: 700,
          letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ padding: '10px 14px' }}>{children}</div>
    </div>
  );
}

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2,
          background: i < current ? '#4a90d9' : i === current ? '#e8c060' : '#1e293b',
          transition: 'background 0.5s' }} />
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN DEMO
// ═══════════════════════════════════════════════════════════════════════════

export default function DemoMode({ onExit, supabase }) {
  const [idx, setIdx] = useState(-1);
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resetting, setResetting] = useState(true);

  const step = idx >= 0 ? STEPS[idx] : null;
  const isLast = idx === STEPS.length - 1;

  useEffect(() => {
    const reset = async () => {
      setResetting(true);
      try { if (supabase) await supabase.rpc('demo_reset'); } catch (e) {}
      setResetting(false);
      setIdx(0);
    };
    reset();
  }, [supabase]);

  useEffect(() => {
    setShow(false);
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, [idx]);

  useEffect(() => {
    if (idx < 0 || !step || !supabase) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase.rpc(step.rpc);
        if (err) throw err;
      } catch (e) {
        console.error('Demo:', e);
        setError(e.message);
      }
      setLoading(false);
    };
    run();
  }, [idx, step, supabase]);

  const advance = () => { if (isLast) setDone(true); else setIdx(prev => prev + 1); };
  const restart = async () => {
    setDone(false); setResetting(true);
    try { if (supabase) await supabase.rpc('demo_reset'); } catch (e) {}
    setResetting(false); setIdx(0);
  };

  if (resetting) return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>{'\uD83C\uDFBC'}</div>
      <div style={{ color: '#4a90d9', fontSize: 16, fontWeight: 600 }}>Preparing demo...</div>
    </div>
  );

  // ── COMPLETION WITH FSM DIAGRAM ──
  if (done) return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u2713'}</div>
      <div style={{ color: '#4ade80', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>That was FSM Drive.</div>
      <div style={{ color: '#8899aa', fontSize: 14, lineHeight: 1.6, marginBottom: 8, padding: '0 12px' }}>
        Every document you saw was generated by real functions. Real costs were recorded. A real invoice was read and extracted. Real P&L was calculated.
      </div>
      <div style={{ color: '#c8d4e0', fontSize: 14, lineHeight: 1.6, marginBottom: 20, padding: '0 12px', fontStyle: 'italic' }}>
        {"\"Handles the paperwork and keeps you fully informed, leaving you time to think and manage your business.\""}
      </div>

      <div style={{ textAlign: 'left', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#667788', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
          The FSM that ran this demo
        </div>
        <svg viewBox="0 0 480 520" style={{ width: '100%', background: '#0a0e17', borderRadius: 10, border: '1px solid #1e293b' }}>
          <text x="240" y="24" textAnchor="middle" fill="#4a90d9" fontSize="11" fontWeight="700" fontFamily="monospace">Demo Shipment Controller</text>
          {[
            { y: 60,  label: '\uD83D\uDCDE The Order',        type: 'initial' },
            { y: 120, label: '\uD83D\uDCE7 Document Arrives',  type: 'normal' },
            { y: 180, label: '\uD83D\uDEA2 Loaded in Miami',   type: 'normal' },
            { y: 240, label: '\u26A0\uFE0F Trouble at Sea',    type: 'alert' },
            { y: 300, label: '\uD83D\uDCCB Helen Receives',    type: 'normal' },
            { y: 360, label: '\uD83D\uDCB0 Invoice Adjusts',   type: 'normal' },
            { y: 420, label: '\uD83C\uDFE0 Full Picture',      type: 'terminal' },
          ].map((s, i) => {
            const w = 210, h = 34, rx = s.type === 'terminal' ? 17 : 4;
            const c = s.type === 'initial' ? '#34d399' : s.type === 'terminal' ? '#f87171' : s.type === 'alert' ? '#e03030' : '#4a90d9';
            return (
              <g key={i}>
                <rect x={240 - w/2} y={s.y - h/2} width={w} height={h} rx={rx} fill={c + '22'} stroke={c} strokeWidth="2" />
                {s.type === 'terminal' && <rect x={240 - w/2 + 4} y={s.y - h/2 + 4} width={w - 8} height={h - 8} rx={rx - 2} fill="none" stroke={c} strokeWidth="1" opacity="0.4" />}
                <text x={240} y={s.y + 1} textAnchor="middle" dominantBaseline="middle" fill={c} fontSize="10" fontWeight="600" fontFamily="monospace">{s.label}</text>
                {i < 6 && <line x1={240} y1={s.y + h/2} x2={240} y2={s.y + 60 - h/2} stroke="#4a90d944" strokeWidth="1.5" markerEnd="url(#demoArrow)" />}
                <text x={360} y={s.y + 1} textAnchor="start" dominantBaseline="middle" fill="#4ade80" fontSize="14">{'\u2713'}</text>
              </g>
            );
          })}
          <defs><marker id="demoArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4a90d944" /></marker></defs>
          <text x="240" y="465" textAnchor="middle" fill="#334455" fontSize="9" fontFamily="monospace">7 states {'\u2022'} 6 transitions {'\u2022'} all completed {'\u2022'} 0 errors</text>
          <text x="240" y="482" textAnchor="middle" fill="#4a90d9" fontSize="9" fontFamily="monospace" fontStyle="italic">This demo was itself an FSM running on FSM Drive</text>
        </svg>
      </div>

      <button onClick={onExit} style={{ display: 'block', width: '100%', padding: '16px', marginBottom: 10, background: '#4a90d9', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>Get Started</button>
      <button onClick={restart} style={{ display: 'block', width: '100%', padding: '14px', background: 'transparent', border: '1px solid #2a3a4e', borderRadius: 12, color: '#8899aa', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>Run again</button>
    </div>
  );

  if (!step) return null;

  // ── STEP DISPLAY ──
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px' }}>
      <ProgressBar current={idx} total={STEPS.length} />
      <div style={{ marginBottom: 12 }}>
        <span style={{ color: '#4a90d9', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
          Live Demo {'\u2022'} Step {idx + 1} of {STEPS.length}
        </span>
      </div>

      <div style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 0.4s, transform 0.4s' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 12,
          background: '#111827', borderRadius: 12, border: step.severity === 'critical' ? '1px solid #e0303060' : '1px solid #1e293b' }}>
          <span style={{ fontSize: 32, lineHeight: 1 }}>{step.icon}</span>
          <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, margin: 0 }}>{step.title}</h2>
        </div>

        <Section label="The situation" color={step.severity === 'critical' ? '#f08080' : '#c8d4e0'} borderColor={step.severity === 'critical' ? '#e03030' : '#2a3a4e'}>
          <div style={{ color: '#c8d4e0', fontSize: 14, lineHeight: 1.6 }}>{step.narration}</div>
        </Section>

        {/* THE DOCUMENT */}
        {step.DocComponent && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#667788', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, padding: '0 4px' }}>
              {step.docLabel}
            </div>
            <step.DocComponent />
          </div>
        )}

        <Section label="What FSM Drive did" color="#4ade80" borderColor="#4ade8040">
          <div style={{ color: '#4ade80', fontSize: 13, lineHeight: 1.6 }}>{step.whatDid}</div>
        </Section>

        {loading && <div style={{ textAlign: 'center', padding: '12px 0', color: '#4a90d9', fontSize: 13 }}>Running real functions...</div>}
        {error && <Section label="Note" color="#e8c060" borderColor="#e8960040"><div style={{ color: '#e8c060', fontSize: 12 }}>{error}</div></Section>}

        <button onClick={advance} disabled={loading}
          style={{ display: 'block', width: '100%', padding: '16px', marginTop: 8,
            background: loading ? '#1e293b' : step.interactive ? '#e03030' : '#ffffff',
            border: 'none', borderRadius: 12,
            color: loading ? '#556677' : step.interactive ? '#fff' : '#111',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            cursor: loading ? 'wait' : 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          {loading ? 'Processing...' : isLast ? '\uD83C\uDFE0 See what happened' : step.interactive ? step.interactiveLabel : 'Next \u203A'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#556677', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}>Exit demo</button>
      </div>
    </div>
  );
}
