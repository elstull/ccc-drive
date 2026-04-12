import { useState, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// SCAN DOCUMENT — The bridge from paper to digital
//
// Phone camera or file upload captures a document.
// FSM Drive classifies it, stores it in the documents bucket,
// persists metadata + content to the documentation table with provenance,
// and makes it immediately available to Chat.
//
// Version: 3.0.0 — 2026-04-12
// ═══════════════════════════════════════════════════════════════════════════

const DIM = '#556677';
const BLUE = '#4a90d9';
const GREEN = '#4ade80';
const YELLOW = '#e8c060';
const RED = '#f08080';

// Generic document types — work for any domain
const DOC_TYPES = [
  { id: 'invoice', label: 'Invoice', icon: '\uD83D\uDCB0' },
  { id: 'contract', label: 'Contract / Agreement', icon: '\uD83D\uDCDD' },
  { id: 'report', label: 'Report / Assessment', icon: '\uD83D\uDCCA' },
  { id: 'correspondence', label: 'Letter / Email', icon: '\u2709\uFE0F' },
  { id: 'receipt', label: 'Receipt / Proof', icon: '\uD83E\uDDFE' },
  { id: 'policy', label: 'Policy / Procedure', icon: '\uD83D\uDCD6' },
  { id: 'form', label: 'Form / Application', icon: '\uD83D\uDCCB' },
  { id: 'note', label: 'Meeting Note / Verbal', icon: '\uD83D\uDDE3' },
  { id: 'other', label: 'Other Document', icon: '\uD83D\uDCC4' },
];


export default function ScanDocument({ supabase, currentUser, users, onClose, activeInstances }) {
  const [step, setStep] = useState('capture');   // capture, paste, preview, classify, processing, result
  const [imageData, setImageData] = useState(null);
  const [rawFile, setRawFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [docType, setDocType] = useState(null);
  const [docTitle, setDocTitle] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [linkedInstance, setLinkedInstance] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const userName = users?.[currentUser]?.name || currentUser;

  // ── Capture image or file ──
  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRawFile(file);
    // Auto-set title from filename (without extension)
    if (!docTitle) {
      setDocTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageData(ev.target.result);
      setStep('preview');
    };
    reader.readAsDataURL(file);
  };

  // ── Process document ──
  const handleProcess = async () => {
    if (!supabase || (!imageData && !pastedText)) return;
    setProcessing(true);
    setError(null);
    setStep('processing');

    try {
      const isPaste = !rawFile && pastedText;
      const docId = 'DOC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const timestamp = new Date().toISOString();
      let storagePath = null;

      // ── Step 1: Upload file to storage bucket ──
      if (rawFile) {
        const ext = fileName.split('.').pop() || 'bin';
        storagePath = `${currentUser}/${docId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, rawFile, {
            contentType: rawFile.type,
            upsert: false,
          });
        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          // Non-fatal — continue with metadata even if file upload fails
          storagePath = null;
        }
      }

      // ── Step 2: Save to documentation table with provenance ──
      const { error: insertError } = await supabase.from('documentation').insert({
        title: docTitle || fileName || 'Untitled Document',
        content: isPaste ? pastedText : `[Scanned document: ${fileName || 'camera capture'}]`,
        category: docType?.id || 'other',
        source_type: isPaste ? 'verbal' : 'scan',
        source_name: sourceName || userName,
        confidence: 'direct',
        file_type: isPaste ? 'text' : (rawFile?.type || 'image'),
        file_path: storagePath,
        uploaded_by: currentUser,
        created_by: currentUser,
      });

      if (insertError) {
        throw new Error('Failed to save document: ' + insertError.message);
      }

      // ── Step 3: Log activity ──
      try {
        await supabase.from('activity_log').insert({
          user_id: currentUser,
          user_name: userName,
          action_type: 'document_received',
          title: (isPaste ? 'Pasted: ' : 'Uploaded: ') + (docTitle || docType?.label || 'Document'),
          detail: isPaste ? pastedText.slice(0, 200) : (fileName || 'Camera scan'),
          entity_type: 'document',
          entity_id: docId,
        });
      } catch (logErr) {
        console.error('Activity log error (non-fatal):', logErr);
      }

      // ── Step 4: If linked to instance, update instance memory ──
      if (linkedInstance) {
        try {
          const { data: instance } = await supabase
            .from('fsm_instances')
            .select('memory')
            .eq('id', linkedInstance)
            .single();

          if (instance) {
            const docs = instance.memory?.scanned_documents || [];
            docs.push({
              doc_id: docId,
              title: docTitle,
              type: docType?.id,
              label: docType?.label,
              source: sourceName || userName,
              scanned_by: currentUser,
              scanned_at: timestamp,
            });
            await supabase.from('fsm_instances').update({
              memory: { ...instance.memory, scanned_documents: docs },
              updated_at: timestamp,
            }).eq('id', linkedInstance);
          }
        } catch (linkErr) {
          console.error('Instance link error (non-fatal):', linkErr);
        }
      }

      setResult({
        doc_id: docId,
        title: docTitle || fileName,
        type: docType?.label || 'Unknown',
        source: sourceName || userName,
        linked: linkedInstance,
        stored: !!storagePath,
        status: 'Filed and available to Chat',
      });
      setStep('result');

    } catch (err) {
      console.error('Process error:', err);
      setError(err.message || 'Something went wrong processing this document.');
      setStep('preview');
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setStep('capture');
    setImageData(null);
    setRawFile(null);
    setPastedText('');
    setFileName('');
    setDocType(null);
    setDocTitle('');
    setSourceName('');
    setLinkedInstance(null);
    setResult(null);
    setError(null);
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px', color: '#e2e8f0',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Upload Document</div>
          <div style={{ fontSize: 12, color: DIM }}>Capture, classify, and file — Chat finds it instantly</div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#8899aa', fontSize: 20,
          cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px',
        }}>{'\u2715'}</button>
      </div>

      {error && (
        <div style={{ background: RED + '22', border: '1px solid ' + RED + '44', borderRadius: 8,
          padding: '10px 14px', marginBottom: 12, fontSize: 13, color: RED }}>
          {error}
        </div>
      )}

      {/* ── STEP 1: Capture ── */}
      {step === 'capture' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Camera / file upload */}
          <button onClick={() => fileRef.current?.click()} style={{
            background: '#111827', border: '2px dashed #3a4a5e', borderRadius: 12,
            padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
            color: BLUE, fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{'\uD83D\uDCF7'}</div>
            Tap to scan or choose file
            <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>
              Camera, PDF, Word, images, spreadsheets
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.docx,.xlsx,.csv,.txt"
            capture="environment" onChange={handleCapture}
            style={{ display: 'none' }} />

          {/* Or paste text */}
          <button onClick={() => setStep('paste')} style={{
            background: '#111827', border: '1px solid #1e293b', borderRadius: 8,
            padding: '12px', textAlign: 'center', cursor: 'pointer',
            color: DIM, fontSize: 13, fontFamily: 'inherit',
          }}>
            {'\uD83D\uDCCB'} Paste text instead (email, note, verbal record)
          </button>
        </div>
      )}

      {/* ── STEP: Paste ── */}
      {step === 'paste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            placeholder="Paste email text, meeting notes, verbal communication record..."
            rows={8}
            style={{
              background: '#111827', border: '1px solid #3a4a5e', borderRadius: 8,
              padding: '12px', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
              resize: 'vertical', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('capture')} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #1e293b',
              background: 'transparent', color: DIM, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            }}>Back</button>
            <button onClick={() => { if (pastedText.trim()) setStep('preview'); }} disabled={!pastedText.trim()} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: pastedText.trim() ? BLUE : '#1e293b',
              color: pastedText.trim() ? '#fff' : DIM,
              cursor: pastedText.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            }}>Continue</button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Preview ── */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Preview */}
          {imageData && (
            <div style={{ background: '#111827', borderRadius: 8, overflow: 'hidden', border: '1px solid #1e293b' }}>
              <img src={imageData} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} />
              <div style={{ padding: '8px 12px', fontSize: 11, color: DIM }}>{fileName}</div>
            </div>
          )}
          {pastedText && !imageData && (
            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8,
              padding: '12px', fontSize: 12, color: '#c8d4e0', maxHeight: 160, overflow: 'auto', lineHeight: 1.5 }}>
              {pastedText.slice(0, 500)}{pastedText.length > 500 ? '...' : ''}
            </div>
          )}

          {/* Title */}
          <input
            value={docTitle}
            onChange={e => setDocTitle(e.target.value)}
            placeholder="Document title..."
            style={{
              background: '#111827', border: '1px solid #3a4a5e', borderRadius: 8,
              padding: '10px 14px', color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}
          />

          {/* Source */}
          <input
            value={sourceName}
            onChange={e => setSourceName(e.target.value)}
            placeholder="Source (who provided this?)..."
            style={{
              background: '#111827', border: '1px solid #3a4a5e', borderRadius: 8,
              padding: '10px 14px', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none',
            }}
          />

          {/* Document type */}
          <div style={{ fontSize: 12, color: DIM, fontWeight: 600, marginTop: 4 }}>Document Type:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {DOC_TYPES.map(dt => (
              <button key={dt.id} onClick={() => setDocType(dt)} style={{
                background: docType?.id === dt.id ? BLUE + '22' : '#111827',
                border: '1px solid ' + (docType?.id === dt.id ? BLUE : '#1e293b'),
                borderRadius: 8, padding: '8px 10px', textAlign: 'left',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                color: docType?.id === dt.id ? BLUE : '#c8d4e0',
              }}>
                {dt.icon} {dt.label}
              </button>
            ))}
          </div>

          {/* Link to instance */}
          {activeInstances && activeInstances.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: DIM, fontWeight: 600, marginTop: 4 }}>Link to (optional):</div>
              <select value={linkedInstance || ''} onChange={e => setLinkedInstance(e.target.value || null)} style={{
                background: '#111827', border: '1px solid #3a4a5e', borderRadius: 8,
                padding: '10px 14px', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
              }}>
                <option value="">No link</option>
                {activeInstances.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.label || inst.fsm_name} ({inst.id})</option>
                ))}
              </select>
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={reset} style={{
              flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #1e293b',
              background: 'transparent', color: DIM, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            }}>Start Over</button>
            <button onClick={handleProcess} disabled={!docType} style={{
              flex: 1, padding: '12px', borderRadius: 8, border: 'none',
              background: docType ? GREEN : '#1e293b',
              color: docType ? '#000' : DIM,
              cursor: docType ? 'pointer' : 'default',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            }}>{'\u2191'} Upload & File</button>
          </div>
        </div>
      )}

      {/* ── STEP: Processing ── */}
      {step === 'processing' && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse 1s infinite' }}>{'\uD83D\uDCE4'}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: BLUE, marginBottom: 8 }}>Filing document...</div>
          <div style={{ fontSize: 12, color: DIM }}>Uploading to storage and indexing for Chat</div>
        </div>
      )}

      {/* ── STEP: Result ── */}
      {step === 'result' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{'\u2705'}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>Document Filed</div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8, padding: '14px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{result.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#c8d4e0' }}>
              <div><span style={{ color: DIM }}>Type:</span> {result.type}</div>
              <div><span style={{ color: DIM }}>Source:</span> {result.source}</div>
              <div><span style={{ color: DIM }}>File stored:</span> {result.stored ? 'Yes' : 'Metadata only'}</div>
              {result.linked && <div><span style={{ color: DIM }}>Linked to:</span> {result.linked}</div>}
              <div style={{ color: GREEN, fontWeight: 600, marginTop: 4 }}>{result.status}</div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: DIM, textAlign: 'center', lineHeight: 1.6 }}>
            Chat can now find this document. Try asking:
            <br /><span style={{ color: BLUE }}>"What documents were uploaded today?"</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{
              flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #1e293b',
              background: 'transparent', color: BLUE, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600,
            }}>Upload Another</button>
            <button onClick={onClose} style={{
              flex: 1, padding: '12px', borderRadius: 8, border: 'none',
              background: BLUE, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600,
            }}>Done</button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
