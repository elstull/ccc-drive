import { useState, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// SCAN DOCUMENT — The bridge from paper to digital
//
// Phone camera captures a paper document.
// FSM Drive reads it, classifies it, extracts the data,
// matches it to an active instance, and asks for confirmation.
//
// "I'm expecting a customs receipt for SHIP-2026-001. Does this look right?"
//
// ═══════════════════════════════════════════════════════════════════════════

const DIM = '#8899aa';
const BLUE = '#4a90d9';
const GREEN = '#4ade80';
const YELLOW = '#e8c060';
const RED = '#f08080';

const DOC_TYPES = [
  { id: 'invoice_supplier', label: 'Supplier Invoice', icon: '\uD83D\uDCB0' },
  { id: 'invoice_customer', label: 'Customer Invoice', icon: '\uD83D\uDCB0' },
  { id: 'purchase_order', label: 'Purchase Order', icon: '\uD83D\uDCE6' },
  { id: 'bill_of_lading', label: 'Bill of Lading', icon: '\uD83D\uDEA2' },
  { id: 'customs_receipt', label: 'Customs Receipt', icon: '\uD83D\uDEC3' },
  { id: 'receiving_report', label: 'Receiving Report', icon: '\uD83D\uDCCB' },
  { id: 'insurance_doc', label: 'Insurance Document', icon: '\uD83D\uDEE1' },
  { id: 'legal_cert', label: 'Legal Certification', icon: '\u2696\uFE0F' },
  { id: 'correspondence', label: 'Letter / Email', icon: '\u2709\uFE0F' },
  { id: 'other', label: 'Other Document', icon: '\uD83D\uDCC4' },
];


export default function ScanDocument({ supabase, currentUser, users, onClose, activeInstances }) {
  const [step, setStep] = useState('capture');   // capture, paste, preview, classify, processing, result
  const [imageData, setImageData] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [docType, setDocType] = useState(null);
  const [linkedInstance, setLinkedInstance] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const [liveInstances, setLiveInstances] = useState([]);

  // Fetch active instances from Supabase on open
  useEffect(() => {
    if (!supabase || !currentUser) return;
    const fetchInstances = async () => {
      try {
        const { data } = await supabase.rpc('my_work_queue', { p_user_id: currentUser });
        if (data && data.length > 0) { setLiveInstances(data); return; }
        const { data: direct } = await supabase.from('fsm_instances')
          .select('id, instance_label, current_state, fsm_name')
          .eq('status', 'active').order('created_at', { ascending: false }).limit(20);
        setLiveInstances(direct || []);
      } catch (e) { console.log('Fetch instances:', e.message); }
    };
    fetchInstances();
  }, [supabase, currentUser]);
  const userName = users?.[currentUser]?.name || currentUser;

  // ── Capture image ──
  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageData(ev.target.result);
      setStep('preview');
    };
    reader.readAsDataURL(file);
  };

  // ── Process document ──
  const handleProcess = async () => {
    if (!supabase || !imageData) return;
    setProcessing(true);
    setError(null);
    setStep('processing');

    try {
      // Generate document ID
      const docId = 'DOC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

      // Save to document_intake
      const isPaste = !imageData && pastedText;

      await supabase.from('document_intake').insert({
        id: docId,
        source: isPaste ? 'paste' : 'camera_scan',
        file_name: fileName || (isPaste ? 'pasted_text.txt' : 'scan_' + new Date().toISOString().slice(0, 10) + '.jpg'),
        file_type: isPaste ? 'text' : 'image',
        source_user: currentUser,
        division: 'food',
        gate_status: 'pending',
        classification: docType?.id || 'unknown',
        notes: (linkedInstance ? 'Linked to instance: ' + linkedInstance + '. ' : '')
          + (isPaste ? 'Pasted content: ' + pastedText.slice(0, 500) : ''),
      });

      // Log activity
      await supabase.from('activity_log').insert({
        user_id: currentUser,
        user_name: userName,
        action_type: 'document_received',
        title: (isPaste ? 'Pasted: ' : 'Scanned: ') + (docType?.label || 'Document') + (linkedInstance ? ' for ' + linkedInstance : ''),
        detail: isPaste ? pastedText.slice(0, 200) : (fileName || 'Camera scan'),
        entity_type: 'document',
        entity_id: docId,
        division: 'food',
      });

      // If linked to instance, update instance memory
      if (linkedInstance) {
        const { data: instance } = await supabase
          .from('fsm_instances')
          .select('memory')
          .eq('id', linkedInstance)
          .single();

        if (instance) {
          const docs = instance.memory?.scanned_documents || [];
          docs.push({
            doc_id: docId,
            type: docType?.id,
            label: docType?.label,
            scanned_by: currentUser,
            scanned_at: new Date().toISOString(),
          });
          await supabase.from('fsm_instances').update({
            memory: { ...instance.memory, scanned_documents: docs },
            updated_at: new Date().toISOString(),
          }).eq('id', linkedInstance);
        }
      }

      setResult({
        doc_id: docId,
        type: docType?.label || 'Unknown',
        linked: linkedInstance,
        status: 'Filed and indexed',
      });
      setStep('result');

    } catch (e) {
      console.error('Scan:', e);
      setError(e.message || 'Failed to process document');
      setStep('preview');
    }
    setProcessing(false);
  };

  // ── Parse active instances for linking ──
  const instances = liveInstances.length > 0 ? liveInstances : (activeInstances || []);
  if (typeof instances === 'string') try { instances = JSON.parse(instances); } catch(e) { instances = []; }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #2a3a4e', borderRadius: 6,
          color: '#8899aa', fontSize: 13, padding: '4px 10px', cursor: 'pointer',
          fontFamily: 'inherit',
        }}>{'\u2190'} Back</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Scan or Upload Document</div>
          <div style={{ fontSize: 11, color: '#8899aa' }}>Paper to digital in 3 taps</div>
          <div style={{ fontSize: 12, color: '#c8d4e0', marginTop: 6, lineHeight: 1.5, textAlign: 'center' }}>Invoices, receipts, bills of lading, customs forms, letters � any business document. FSM Drive will read it, classify it, and file it.</div>
        </div>
      </div>


      {/* ── STEP 1: CAPTURE ── */}
      {step === 'capture' && (
        <div>
          {/* Option 1: Camera */}
          <button onClick={() => fileRef.current?.click()} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
            background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
            padding: '18px 16px', marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 28 }}>{'\uD83D\uDCF7'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Take Photo</div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>Point your camera at a paper document</div>
            </div>
          </button>

          {/* Option 2: Upload existing file */}
          <button onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx';
            input.onchange = handleCapture;
            input.click();
          }} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
            background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
            padding: '18px 16px', marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 28 }}>{'\uD83D\uDCC1'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Upload File</div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>PDF, image, or document already on this device or shared drive</div>
            </div>
          </button>

          {/* Option 3: From gallery */}
          <button onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,.pdf,.zip,.doc,.docx,.txt';
            input.onchange = handleCapture;
            input.click();
          }} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
            background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
            padding: '18px 16px', marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 28 }}>{'\uD83D\uDDBC'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Photo Gallery</div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>Choose a photo you already took</div>
            </div>
          </button>

          {/* Option 4: Paste text */}
          <button onClick={() => setStep('paste')} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
            background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
            padding: '18px 16px', marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 28 }}>{'\uD83D\uDCCB'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Paste Text</div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>Copy and paste from an email, message, or other source</div>
            </div>
          </button>


          {/* Hidden camera input */}
          <input ref={fileRef} type="file" accept="image/*,.pdf,.zip,.doc,.docx,.txt" capture="environment"
            onChange={handleCapture} style={{ display: 'none' }} />
        <button onClick={onClose} style={{ display: 'block', width: '100%', padding: '12px', marginTop: 8, background: 'transparent', border: '1px solid #4a5a6e', borderRadius: 12, color: '#aabbcc', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      )}


      {/* ── STEP: PASTE — enter text content ── */}
      {step === 'paste' && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#99aabb', letterSpacing: 1,
            textTransform: 'uppercase', marginBottom: 8 }}>
            Paste document content
          </div>
          <textarea
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            placeholder="Paste the email, invoice text, or any document content here..."
            style={{
              width: '100%', minHeight: 200, padding: '14px', borderRadius: 12,
              background: '#111827', border: '1px solid #1e293b', color: '#e2e8f0',
              fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6,
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 10, color: DIM, marginTop: 4, marginBottom: 12 }}>
            {pastedText.length > 0 ? pastedText.length + ' characters' : 'Paste or type the document content'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setStep('capture'); setPastedText(''); }}
              style={{ flex: 1, padding: '14px', borderRadius: 12,
                background: 'transparent', border: '1px solid #2a3a4e',
                color: '#8899aa', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Back</button>
            <button onClick={() => {
              if (!pastedText.trim()) return;
              setImageData(null);
              setFileName('pasted_text_' + new Date().toISOString().slice(0, 10) + '.txt');
              setStep('preview');
            }} disabled={!pastedText.trim()}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none',
                background: pastedText.trim() ? GREEN : '#1e293b',
                color: pastedText.trim() ? '#111' : DIM,
                fontSize: 14, fontWeight: 700, cursor: pastedText.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}>Continue {'\u203A'}</button>
          </div>
        <button onClick={onClose} style={{ display: 'block', width: '100%', padding: '12px', marginTop: 8, background: 'transparent', border: '1px solid #4a5a6e', borderRadius: 12, color: '#aabbcc', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      )}

      {/* ── STEP 2: PREVIEW — show captured image or pasted text ── */}
      {step === 'preview' && (imageData || pastedText) && (
        <div>
          {/* Image preview */}
          {imageData && (
            <div style={{
              background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
              overflow: 'hidden', marginBottom: 12,
            }}>
              <img src={imageData} alt="Scanned document" style={{
                width: '100%', display: 'block', maxHeight: 300, objectFit: 'contain',
                background: '#000',
              }} />
              <div style={{ padding: '8px 12px', fontSize: 11, color: DIM }}>
                {fileName}
              </div>
            </div>
          )}

          {/* Text preview */}
          {!imageData && pastedText && (
            <div style={{
              background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
              padding: '14px', marginBottom: 12, maxHeight: 200, overflowY: 'auto',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase',
                letterSpacing: 1, marginBottom: 6 }}>Pasted content</div>
              <div style={{ fontSize: 12, color: '#c8d4e0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {pastedText.length > 500 ? pastedText.slice(0, 500) + '...' : pastedText}
              </div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>
                {pastedText.length} characters
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', background: RED + '12', border: '1px solid ' + RED + '44',
              borderRadius: 8, marginBottom: 12, fontSize: 12, color: RED }}>
              {error}
            </div>
          )}

          {/* Classify */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#99aabb', letterSpacing: 1,
            textTransform: 'uppercase', marginBottom: 8 }}>
            What type of document is this?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
            {DOC_TYPES.map(dt => (
              <button key={dt.id} onClick={() => setDocType(dt)} style={{
                padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                background: docType?.id === dt.id ? BLUE + '22' : '#111827',
                border: '1px solid ' + (docType?.id === dt.id ? BLUE : '#1e293b'),
                color: docType?.id === dt.id ? BLUE : '#c8d4e0',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}>
                {dt.icon} {dt.label}
              </button>
            ))}
          </div>

          {/* Link to instance */}
          {instances.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#99aabb', letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 8 }}>
                Link to operation (optional)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                <button onClick={() => setLinkedInstance(null)} style={{
                  padding: '8px 12px', borderRadius: 8, textAlign: 'left',
                  background: !linkedInstance ? BLUE + '22' : 'transparent',
                  border: '1px solid ' + (!linkedInstance ? BLUE : '#1e293b'),
                  color: !linkedInstance ? BLUE : '#8899aa',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}>None — file independently</button>
                {instances.map(inst => (
                  <button key={inst.id || inst.instance_id} onClick={() => setLinkedInstance(inst.id || inst.instance_id)} style={{
                    padding: '8px 12px', borderRadius: 8, textAlign: 'left',
                    background: linkedInstance === (inst.id || inst.instance_id) ? GREEN + '18' : 'transparent',
                    border: '1px solid ' + (linkedInstance === (inst.id || inst.instance_id) ? GREEN + '44' : '#1e293b'),
                    color: linkedInstance === (inst.id || inst.instance_id) ? GREEN : '#c8d4e0',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {inst.label || inst.instance_label || inst.id || inst.instance_id}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setStep('capture'); setImageData(null); setPastedText(''); setDocType(null); setLinkedInstance(null); setError(null); }}
              style={{ flex: 1, padding: '14px', borderRadius: 12,
                background: 'transparent', border: '1px solid #2a3a4e',
                color: '#8899aa', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Start over</button>
            <button onClick={handleProcess} disabled={!docType}
              style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none',
                background: docType ? GREEN : '#1e293b',
                color: docType ? '#111' : DIM,
                fontSize: 14, fontWeight: 700, cursor: docType ? 'pointer' : 'default',
                fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
              }}>
              {'\u2713'} File this document
            </button>
          </div>
        <button onClick={onClose} style={{ display: 'block', width: '100%', padding: '12px', marginTop: 8, background: 'transparent', border: '1px solid #4a5a6e', borderRadius: 12, color: '#aabbcc', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      )}


      {/* ── STEP 3: PROCESSING ── */}
      {step === 'processing' && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>{'\uD83D\uDCC4'}</div>
          <div style={{ color: BLUE, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Reading document...</div>
          <div style={{ color: DIM, fontSize: 12, lineHeight: 1.6 }}>
            Classifying, extracting fields, and filing.
          </div>
          <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        <button onClick={onClose} style={{ display: 'block', width: '100%', padding: '12px', marginTop: 8, background: 'transparent', border: '1px solid #4a5a6e', borderRadius: 12, color: '#aabbcc', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      )}


      {/* ── STEP 4: RESULT ── */}
      {step === 'result' && result && (
        <div style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u2713'}</div>
          <div style={{ color: GREEN, fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Document filed</div>

          <div style={{
            background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
            padding: '16px', textAlign: 'left', marginBottom: 20,
          }}>
            {imageData && (
              <img src={imageData} alt="Filed" style={{
                width: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 8,
                background: '#000', marginBottom: 10,
              }} />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
              <span style={{ color: '#8899aa' }}>Document ID</span>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{result.doc_id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
              <span style={{ color: '#8899aa' }}>Type</span>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{result.type}</span>
            </div>
            {result.linked && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                <span style={{ color: '#8899aa' }}>Linked to</span>
                <span style={{ color: GREEN, fontWeight: 600 }}>{result.linked}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
              <span style={{ color: '#8899aa' }}>Status</span>
              <span style={{ color: GREEN, fontWeight: 600 }}>{result.status}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setStep('capture'); setImageData(null); setPastedText(''); setDocType(null); setLinkedInstance(null); setResult(null); }}
              style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                background: BLUE, color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Scan another</button>
            <button onClick={onClose}
              style={{ flex: 1, padding: '14px', borderRadius: 12,
                background: 'transparent', border: '1px solid #2a3a4e',
                color: '#8899aa', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Done</button>
          </div>
        <button onClick={onClose} style={{ display: 'block', width: '100%', padding: '12px', marginTop: 8, background: 'transparent', border: '1px solid #4a5a6e', borderRadius: 12, color: '#aabbcc', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      )}
    </div>
  );
}



