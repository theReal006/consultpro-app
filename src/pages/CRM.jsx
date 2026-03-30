import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Papa from 'papaparse'

const STAGES = [
  { id: 'nurture',  label: 'Nurture',  color: '#6366F1', bg: '#EEF2FF' },
  { id: 'active',   label: 'Active',   color: '#0042AA', bg: '#EFF6FF' },
  { id: 'quoted',   label: 'Quoted',   color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'won',      label: 'Won',      color: '#10B981', bg: '#ECFDF5' },
  { id: 'lost',     label: 'Lost',     color: '#EF4444', bg: '#FEF2F2' },
]

const SOURCE_OPTIONS = ['Referral','LinkedIn','Website','Cold Outreach','Event','Other']

function LeadModal({ lead, onClose, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState(lead || {
    name: '', contact_name: '', email: '', phone: '',
    industry: '', website: '', address: '',
    crm_stage: 'nurture', pipeline_value: '', source: '', notes: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...form, pipeline_value: parseFloat(form.pipeline_value) || 0, status: 'prospect', user_id: user.id }
    if (lead?.id) await supabase.from('clients').update(payload).eq('id', lead.id)
    else await supabase.from('clients').insert(payload)
    onSave(); onClose()
  }

  const f = (key) => ({ value: form[key] || '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) })
  const cls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4" style={{ color: '#0A1628' }}>{lead?.id ? 'Edit Company' : 'Add to Pipeline'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Company name *" className={cls} {...f('name')} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Contact name" className={cls} {...f('contact_name')} />
            <input type="email" placeholder="Email" className={cls} {...f('email')} />
            <input placeholder="Phone" className={cls} {...f('phone')} />
            <input placeholder="Industry" className={cls} {...f('industry')} />
            <input placeholder="Website" className={cls} {...f('website')} />
            <input type="number" placeholder="Pipeline value ($)" className={cls} {...f('pipeline_value')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className={cls} {...f('crm_stage')}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select className={cls} {...f('source')}>
              <option value="">Source…</option>
              {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <textarea placeholder="Notes" rows={3} className={`${cls} resize-none`} {...f('notes')} />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#0042AA' }}>
              {lead?.id ? 'Save Changes' : 'Add to Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmailModal({ lead, onClose }) {
  const [subject, setSubject] = useState(`Following up — ${lead.name}`)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const send = async () => {
    if (!lead.email) { setResult('❌ No email address on file'); return }
    setSending(true)
    const token = (await supabase.auth.getSession()).data?.session?.access_token
    const res = await supabase.functions.invoke('send-invoice', {
      body: { to: lead.email, to_name: lead.contact_name || lead.name, subject,
        body: `<div style="font-family:sans-serif;padding:24px;color:#0A1628">${body.replace(/\n/g,'<br>')}</div>` },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    setResult(res.data?.success ? '✅ Email sent!' : `❌ ${res.data?.error || 'Failed'}`)
    setSending(false)
    if (res.data?.success) {
      const note = `[${new Date().toLocaleDateString()}] Email sent — "${subject}"`
      await supabase.from('clients').update({ notes: lead.notes ? `${lead.notes}\n${note}` : note, last_contacted_at: new Date().toISOString() }).eq('id', lead.id)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4" style={{ color: '#0A1628' }}>Email — {lead.contact_name || lead.name}</h2>
        {!lead.email && <div className="mb-3 p-3 rounded-xl text-sm" style={{ background: '#FEF3C7', color: '#92400E' }}>No email on file. Edit this company to add one.</div>}
        <div className="space-y-3">
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none" />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message…" rows={7}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none" />
          {result && <p className="text-sm font-semibold">{result}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Close</button>
            <button onClick={send} disabled={sending || !lead.email}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: '#0042AA' }}>
              {sending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function KanbanCard({ lead, onMove, onEdit, onEmail }) {
  const currentIdx = STAGES.findIndex(s => s.id === lead.crm_stage)
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-bold text-sm" style={{ color: '#0A1628' }}>{lead.name}</p>
          {lead.contact_name && <p className="text-xs text-gray-400">{lead.contact_name}</p>}
        </div>
        {lead.pipeline_value > 0 && (
          <span className="text-xs font-bold" style={{ color: '#10B981' }}>${Number(lead.pipeline_value).toLocaleString()}</span>
        )}
      </div>
      {lead.source && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 mb-2 inline-block">{lead.source}</span>}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {currentIdx > 0 && (
          <button onClick={() => onMove(lead, STAGES[currentIdx - 1].id)}
            className="text-xs px-2 py-1 rounded-lg hover:opacity-80" style={{ background: '#F3F4F6', color: '#6B7280' }}>
            ← {STAGES[currentIdx - 1].label}
          </button>
        )}
        {currentIdx < STAGES.length - 1 && (
          <button onClick={() => onMove(lead, STAGES[currentIdx + 1].id)}
            className="text-xs px-2 py-1 rounded-lg text-white hover:opacity-80" style={{ background: STAGES[currentIdx + 1].color }}>
            {STAGES[currentIdx + 1].label} →
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => onEmail(lead)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#EFF6FF', color: '#0042AA' }}>✉</button>
        {lead.phone && <a href={`sms:${lead.phone}`} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#F0FDF4', color: '#10B981' }}>💬</a>}
        <button onClick={() => onEdit(lead)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#F5F3FF', color: '#6366F1' }}>✎</button>
      </div>
    </div>
  )
}

function CSVImportModal({ onClose, onSave }) {
  const { user } = useAuth()
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => setPreview(r.data.slice(0,5)) })
  }

  const handleImport = () => {
    const file = fileRef.current.files[0]; if (!file) return
    setImporting(true)
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: async (r) => {
      const records = r.data.map(row => ({
        user_id: user.id,
        name: row.Company || row.company || row['Company Name'] || '',
        contact_name: row.Contact || row.contact || row['Contact Name'] || '',
        email: row.Email || row.email || '',
        phone: row.Phone || row.phone || '',
        industry: row.Industry || row.industry || '',
        website: row.Website || row.website || '',
        source: row.Source || row.source || '',
        pipeline_value: parseFloat(row.Value || row.value || row['Pipeline Value'] || 0) || 0,
        crm_stage: (row.Stage || row.stage || row.Status || row.status || 'nurture').toLowerCase(),
        notes: row.Notes || row.notes || '',
        status: 'prospect',
      })).filter(r => r.name)
      const { error } = await supabase.from('clients').insert(records)
      setResult(error ? `❌ ${error.message}` : `✅ Imported ${records.length} companies`)
      setImporting(false)
      if (!error) setTimeout(() => { onSave(); onClose() }, 1500)
    }})
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-2" style={{ color: '#0A1628' }}>Import from CSV</h2>
        <p className="text-xs text-gray-400 mb-4">Columns: <code>Company, Contact, Email, Phone, Industry, Website, Source, Value, Stage, Notes</code></p>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="w-full text-sm mb-4" />
        {preview && (
          <div className="mb-4 overflow-x-auto">
            <p className="text-xs font-semibold text-gray-500 mb-2">Preview (first 5 rows):</p>
            <table className="text-xs w-full border-collapse">
              <thead><tr>{Object.keys(preview[0]).slice(0,5).map(k => <th key={k} className="border border-gray-200 px-2 py-1 bg-gray-50 text-left">{k}</th>)}</tr></thead>
              <tbody>{preview.map((row, i) => <tr key={i}>{Object.values(row).slice(0,5).map((v, j) => <td key={j} className="border border-gray-200 px-2 py-1">{String(v).slice(0,30)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        {result && <p className="text-sm font-semibold mb-3">{result}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
          <button onClick={handleImport} disabled={importing || !preview}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: '#0042AA' }}>
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CRM() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [showModal, setShowModal] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [emailLead, setEmailLead] = useState(null)
  const [showCSV, setShowCSV] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('clients').select('*').not('crm_stage', 'is', null).order('created_at', { ascending: false })
    setCompanies(data || [])
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  const moveStage = async (lead, newStage) => {
    await supabase.from('clients').update({ crm_stage: newStage }).eq('id', lead.id)
    load()
  }

  const filtered = companies.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.contact_name || '').toLowerCase().includes(search.toLowerCase())
    const matchStage = filterStage === 'all' || c.crm_stage === filterStage
    const matchSource = filterSource === 'all' || c.source === filterSource
    return matchSearch && matchStage && matchSource
  }).sort((a, b) => {
    if (sortBy === 'pipeline_value') return Number(b.pipeline_value) - Number(a.pipeline_value)
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const pipelineTotal = companies.filter(c => !['won','lost'].includes(c.crm_stage)).reduce((s, c) => s + Number(c.pipeline_value || 0), 0)
  const wonTotal = companies.filter(c => c.crm_stage === 'won').reduce((s, c) => s + Number(c.pipeline_value || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0A1628' }}>CRM Pipeline</h1>
          <p className="text-sm text-gray-400">
            Pipeline: <strong style={{ color: '#0042AA' }}>${pipelineTotal.toLocaleString()}</strong>
            {' · '}Won: <strong style={{ color: '#10B981' }}>${wonTotal.toLocaleString()}</strong>
            {' · '}{companies.length} companies
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCSV(true)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            ↑ CSV Import
          </button>
          <button onClick={() => { setEditLead(null); setShowModal(true) }}
            className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: '#0042AA' }}>
            + Add Company
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex bg-white border border-gray-200 rounded-xl p-1">
          {['kanban','list'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all"
              style={view === v ? { background: '#0042AA', color: 'white' } : { color: '#6B7280' }}>
              {v}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies…"
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm bg-white w-48 focus:outline-none" />
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none">
          <option value="all">All stages</option>
          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none">
          <option value="all">All sources</option>
          {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {view === 'list' && (
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none">
            <option value="created_at">Date added</option>
            <option value="pipeline_value">Value ↓</option>
            <option value="name">Name A–Z</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading pipeline…</div>
      ) : view === 'kanban' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          {STAGES.map(stage => {
            const cards = filtered.filter(c => c.crm_stage === stage.id)
            const stageTotal = cards.reduce((s, c) => s + Number(c.pipeline_value || 0), 0)
            return (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{stage.label}</span>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: stage.bg, color: stage.color }}>{cards.length}</span>
                  </div>
                  {stageTotal > 0 && <span className="text-xs font-semibold text-gray-400">${stageTotal.toLocaleString()}</span>}
                </div>
                <div className="min-h-16">
                  {cards.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 text-center text-xs text-gray-300">Empty</div>
                  ) : cards.map(lead => (
                    <KanbanCard key={lead.id} lead={lead}
                      onMove={moveStage}
                      onEdit={(l) => { setEditLead(l); setShowModal(true) }}
                      onEmail={setEmailLead}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No companies match your filters.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Company','Contact','Stage','Value','Source','Last Contact','Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const stage = STAGES.find(s => s.id === lead.crm_stage) || STAGES[0]
                  return (
                    <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="text-sm font-semibold" style={{ color: '#0A1628' }}>{lead.name}</p>
                        {lead.industry && <p className="text-xs text-gray-400">{lead.industry}</p>}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        <p>{lead.contact_name || '—'}</p>
                        {lead.email && <p className="text-xs text-gray-400">{lead.email}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: stage.bg, color: stage.color }}>{stage.label}</span>
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold" style={{ color: '#10B981' }}>
                        {lead.pipeline_value > 0 ? `$${Number(lead.pipeline_value).toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{lead.source || '—'}</td>
                      <td className="py-3 px-4 text-xs text-gray-400">
                        {lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1.5 flex-wrap">
                          <button onClick={() => setEmailLead(lead)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#EFF6FF', color: '#0042AA' }}>✉</button>
                          {lead.phone && <a href={`sms:${lead.phone}`} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#F0FDF4', color: '#10B981' }}>💬</a>}
                          <button onClick={() => { setEditLead(lead); setShowModal(true) }} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#F5F3FF', color: '#6366F1' }}>✎</button>
                          <select value={lead.crm_stage} onChange={e => moveStage(lead, e.target.value)}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 focus:outline-none">
                            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && <LeadModal lead={editLead} onClose={() => { setShowModal(false); setEditLead(null) }} onSave={load} />}
      {emailLead && <EmailModal lead={emailLead} onClose={() => { setEmailLead(null); load() }} />}
      {showCSV && <CSVImportModal onClose={() => setShowCSV(false)} onSave={load} />}
    </div>
  )
}
