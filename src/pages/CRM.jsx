import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [form, setForm] = useState(lead || {
    name: '', contact_name: '', phone: '',
    industry: '', website: '', address: '',
    crm_stage: 'nurture', pipeline_value: '', source: '', notes: '',
  })
  const [contacts, setContacts] = useState([])
  const [editingContact, setEditingContact] = useState(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [addMode, setAddMode] = useState('new') // 'new' | 'search'
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', email: '', phone: '', title: '' })
  const [contactSearch, setContactSearch] = useState('')
  const [contactSearchResults, setContactSearchResults] = useState([])
  const [contactErr, setContactErr] = useState(null)

  useEffect(() => {
    if (lead?.id) loadContacts()
  }, [lead?.id])

  const loadContacts = async () => {
    const { data } = await supabase
      .from('company_contacts')
      .select('contacts(id, first_name, last_name, email, phone, title)')
      .eq('user_id', user.id)
      .eq('company_id', lead.id)
    setContacts((data || []).map(r => r.contacts).filter(Boolean))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...form, pipeline_value: parseFloat(form.pipeline_value) || 0, status: 'prospect', user_id: user.id }
    if (lead?.id) await supabase.from('clients').update(payload).eq('id', lead.id)
    else await supabase.from('clients').insert(payload)
    onSave(); onClose()
  }

  const saveContactEdit = async (c) => {
    await supabase.from('contacts').update({
      first_name: c.first_name, last_name: c.last_name,
      email: c.email || null, phone: c.phone || null, title: c.title || null,
    }).eq('id', c.id)
    setEditingContact(null)
    loadContacts()
  }

  const addNewContact = async () => {
    if (!newContact.first_name.trim()) { setContactErr('First name is required'); return }
    setContactErr(null)
    const { data: cd, error: ce } = await supabase.from('contacts').insert({
      user_id: user.id,
      first_name: newContact.first_name.trim(),
      last_name: newContact.last_name.trim(),
      email: newContact.email.trim() || null,
      phone: newContact.phone.trim() || null,
      title: newContact.title.trim() || null,
    }).select().single()
    if (ce) { setContactErr(ce.message); return }
    if (cd?.id && lead?.id) {
      const { error: le } = await supabase.from('company_contacts').insert({
        user_id: user.id, company_id: lead.id, contact_id: cd.id,
      })
      if (le) { setContactErr(le.message); return }
    }
    setNewContact({ first_name: '', last_name: '', email: '', phone: '', title: '' })
    setShowAddContact(false)
    setContactErr(null)
    loadContacts()
  }

  const searchExistingContacts = async (q) => {
    setContactSearch(q)
    if (q.length < 2) { setContactSearchResults([]); return }
    const { data } = await supabase.from('contacts')
      .select('id, first_name, last_name, email, title')
      .eq('user_id', user.id)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)
    // exclude already-linked
    const linkedIds = new Set(contacts.map(c => c.id))
    setContactSearchResults((data || []).filter(c => !linkedIds.has(c.id)))
  }

  const linkExistingContact = async (contact) => {
    if (!lead?.id) return
    setContactErr(null)
    const { error } = await supabase.from('company_contacts').insert({
      user_id: user.id, company_id: lead.id, contact_id: contact.id,
    })
    if (error) { setContactErr(error.message); return }
    setContactSearch(''); setContactSearchResults([]); setShowAddContact(false)
    loadContacts()
  }

  const unlinkContact = async (contactId) => {
    await supabase.from('company_contacts').delete().eq('company_id', lead.id).eq('contact_id', contactId)
    loadContacts()
  }

  const f = (key) => ({ value: form[key] || '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) })
  const cls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4" style={{ color: '#0A1628' }}>{lead?.id ? 'Edit Company' : 'Add to Pipeline'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Company name *" className={cls} {...f('name')} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Primary contact name" className={cls} {...f('contact_name')} />
            <input placeholder="Phone" className={cls} {...f('phone')} />
            <input placeholder="Industry" className={cls} {...f('industry')} />
            <input placeholder="Website" className={cls} {...f('website')} />
            <input type="number" placeholder="Pipeline value ($)" className={cls} {...f('pipeline_value')} />
            <select className={`${cls} bg-white`} {...f('source')}>
              <option value="">Source…</option>
              {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <select className={`${cls} bg-white`} {...f('crm_stage')}>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <textarea placeholder="Notes" rows={2} className={`${cls} resize-none`} {...f('notes')} />

          {/* ── Contacts section (edit mode only) ── */}
          {lead?.id && (
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold" style={{ color: '#0A1628' }}>Linked Contacts</p>
                <button type="button" onClick={() => { setShowAddContact(v => !v); setContactErr(null) }}
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                  style={{ background: '#EFF6FF', color: '#0042AA' }}>+ Add / Link</button>
              </div>

              {showAddContact && (
                <div className="mb-3 p-3 rounded-xl border border-blue-100 space-y-2" style={{ background: '#F8FAFF' }}>
                  {/* Tab toggle */}
                  <div className="flex gap-1 mb-2">
                    {[['new','Create new'],['search','Link existing']].map(([m, lbl]) => (
                      <button key={m} type="button" onClick={() => { setAddMode(m); setContactErr(null) }}
                        className="flex-1 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={addMode === m ? { background: '#0042AA', color: 'white' } : { background: 'white', color: '#6B7280', border: '1px solid #E5E7EB' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>

                  {addMode === 'new' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="First name *" value={newContact.first_name}
                          onChange={e => setNewContact(p => ({ ...p, first_name: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-xs" />
                        <input placeholder="Last name" value={newContact.last_name}
                          onChange={e => setNewContact(p => ({ ...p, last_name: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-xs" />
                        <input placeholder="Email" type="email" value={newContact.email}
                          onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-xs" />
                        <input placeholder="Phone" value={newContact.phone}
                          onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-xs" />
                        <input placeholder="Title / Role" value={newContact.title}
                          onChange={e => setNewContact(p => ({ ...p, title: e.target.value }))}
                          className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 text-xs" />
                      </div>
                      {contactErr && <p className="text-xs text-red-500">{contactErr}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setShowAddContact(false); setContactErr(null) }}
                          className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500">Cancel</button>
                        <button type="button" onClick={addNewContact}
                          className="flex-1 py-1.5 rounded-lg text-white text-xs font-semibold"
                          style={{ background: '#0042AA' }}>Save Contact</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <input
                        placeholder="Search by name or email…"
                        value={contactSearch}
                        onChange={e => searchExistingContacts(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs"
                        autoFocus
                      />
                      {contactSearchResults.length > 0 && (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {contactSearchResults.map(c => (
                            <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-blue-50 cursor-pointer"
                              onClick={() => linkExistingContact(c)}>
                              <div>
                                <p className="text-xs font-semibold" style={{ color: '#0A1628' }}>{c.first_name} {c.last_name}</p>
                                {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                                {c.title && <p className="text-xs text-gray-400">{c.title}</p>}
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-lg font-semibold" style={{ background: '#EFF6FF', color: '#0042AA' }}>Link</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {contactSearch.length >= 2 && contactSearchResults.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">No contacts found. Try "Create new" tab.</p>
                      )}
                      {contactErr && <p className="text-xs text-red-500">{contactErr}</p>}
                      <button type="button" onClick={() => { setShowAddContact(false); setContactSearch(''); setContactErr(null) }}
                        className="w-full py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500">Cancel</button>
                    </>
                  )}
                </div>
              )}

              {contacts.length === 0 && !showAddContact && (
                <p className="text-xs text-gray-400 text-center py-2">No contacts linked yet.</p>
              )}

              <div className="space-y-2">
                {contacts.map(c => editingContact?.id === c.id ? (
                  <div key={c.id} className="p-3 rounded-xl border border-blue-100 space-y-2" style={{ background: '#F8FAFF' }}>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editingContact.first_name} onChange={e => setEditingContact(p => ({ ...p, first_name: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-xs" placeholder="First name" />
                      <input value={editingContact.last_name} onChange={e => setEditingContact(p => ({ ...p, last_name: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-xs" placeholder="Last name" />
                      <input value={editingContact.email || ''} onChange={e => setEditingContact(p => ({ ...p, email: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-xs" placeholder="Email" />
                      <input value={editingContact.phone || ''} onChange={e => setEditingContact(p => ({ ...p, phone: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-xs" placeholder="Phone" />
                      <input value={editingContact.title || ''} onChange={e => setEditingContact(p => ({ ...p, title: e.target.value }))}
                        className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 text-xs" placeholder="Title / Role" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingContact(null)}
                        className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500">Cancel</button>
                      <button type="button" onClick={() => saveContactEdit(editingContact)}
                        className="flex-1 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: '#0042AA' }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100">
                    <div className="min-w-0">
                      <button type="button" onClick={() => { onClose(); navigate(`/contacts/${c.id}`) }}
                        className="text-xs font-semibold hover:underline text-left" style={{ color: '#0042AA' }}>
                        {c.first_name} {c.last_name}
                      </button>
                      {c.title && <p className="text-xs text-gray-400">{c.title}</p>}
                      <div className="flex gap-3 mt-0.5">
                        {c.email && <span className="text-xs text-gray-500">{c.email}</span>}
                        {c.phone && <span className="text-xs text-gray-500">{c.phone}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <button type="button" onClick={() => setEditingContact({ ...c })}
                        className="text-xs px-2 py-1 rounded-lg" style={{ background: '#F5F3FF', color: '#6366F1' }}>✎</button>
                      <button type="button" onClick={() => unlinkContact(c.id)}
                        className="text-xs px-2 py-1 rounded-lg" style={{ background: '#FEF2F2', color: '#EF4444' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

// contact = { name, email, companyId, companyName }
function EmailModal({ contact, onClose }) {
  const [subject, setSubject] = useState(`Following up — ${contact.companyName || contact.name}`)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const send = async () => {
    if (!contact.email) { setResult('❌ No email address on file'); return }
    setSending(true)
    const token = (await supabase.auth.getSession()).data?.session?.access_token
    const res = await supabase.functions.invoke('send-invoice', {
      body: {
        to: contact.email,
        to_name: contact.name,
        subject,
        body: `<div style="font-family:sans-serif;padding:24px;color:#0A1628">${body.replace(/\n/g,'<br>')}</div>`,
      },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    setResult(res.data?.success ? '✅ Email sent!' : `❌ ${res.data?.error || 'Failed'}`)
    setSending(false)
    if (res.data?.success && contact.companyId) {
      await supabase.from('clients').update({ last_contacted_at: new Date().toISOString() }).eq('id', contact.companyId)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-1" style={{ color: '#0A1628' }}>Email — {contact.name}</h2>
        {contact.companyName && <p className="text-xs text-gray-400 mb-3">🏢 {contact.companyName}</p>}
        {!contact.email && <div className="mb-3 p-3 rounded-xl text-sm" style={{ background: '#FEF3C7', color: '#92400E' }}>No email address on file for this contact.</div>}
        <div className="space-y-3">
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none" />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message…" rows={7}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none" />
          {result && <p className="text-sm font-semibold">{result}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Close</button>
            <button onClick={send} disabled={sending || !contact.email}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: '#0042AA' }}>
              {sending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Shows contacts for a company, lets you email/SMS them
function ContactPickerModal({ lead, onClose, onEmail }) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('company_contacts')
        .select('contacts(id, first_name, last_name, email, phone, title)')
        .eq('user_id', user.id)
        .eq('company_id', lead.id)
      setContacts((data || []).map(r => r.contacts).filter(Boolean))
      setLoading(false)
    }
    load()
  }, [lead.id, user])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0A1628' }}>Contact {lead.name}</h2>
            <p className="text-xs text-gray-400">Select a contact to reach out to</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 mb-3">No contacts linked to this company yet.</p>
            <p className="text-xs text-gray-400">Use "+ Add Contact" and link them to {lead.name}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#0A1628' }}>
                    {c.first_name} {c.last_name}
                  </p>
                  {c.title && <p className="text-xs text-gray-400">{c.title}</p>}
                  {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                </div>
                <div className="flex gap-1.5 ml-3 flex-shrink-0">
                  {c.email && (
                    <button
                      onClick={() => { onEmail({ name: `${c.first_name} ${c.last_name}`, email: c.email, companyId: lead.id, companyName: lead.name }); onClose() }}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                      style={{ background: '#EFF6FF', color: '#0042AA' }}>✉ Email</button>
                  )}
                  {c.phone && (
                    <a href={`sms:${c.phone}`}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                      style={{ background: '#F0FDF4', color: '#059669' }}>💬 Text</a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                      style={{ background: '#F5F3FF', color: '#7C3AED' }}>📞 Call</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanCard({ lead, onMove, onEdit, onContact, isDragging, onDragStart, onDragEnd }) {
  const currentIdx = STAGES.findIndex(s => s.id === lead.crm_stage)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-3 cursor-grab active:cursor-grabbing transition-opacity select-none"
      style={{ opacity: isDragging ? 0.4 : 1 }}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: '#0A1628' }}>{lead.name}</p>
          {lead.contact_name && <p className="text-xs text-gray-400 truncate">{lead.contact_name}</p>}
        </div>
        {lead.pipeline_value > 0 && (
          <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: '#10B981' }}>${Number(lead.pipeline_value).toLocaleString()}</span>
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
        <button onClick={() => onContact(lead)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#EFF6FF', color: '#0042AA' }} title="Email/Text contact">✉</button>
        <button onClick={() => onEdit(lead)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#F5F3FF', color: '#6366F1' }} title="Edit">✎</button>
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

function AddContactModal({ companies, onClose, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', title: '', company_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const cls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'
  const f = key => ({ value: form[key], onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.first_name.trim()) { setErr('First name is required'); return }
    setSaving(true); setErr(null)
    // insert contact
    const { data: contactData, error: contactErr } = await supabase.from('contacts').insert({
      user_id: user.id,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      title: form.title.trim() || null,
    }).select().single()
    if (contactErr) { setErr(contactErr.message); setSaving(false); return }

    // link to company if selected
    if (form.company_id && contactData?.id) {
      await supabase.from('company_contacts').insert({
        user_id: user.id,
        company_id: form.company_id,
        contact_id: contactData.id,
      })
    }
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4" style={{ color: '#0A1628' }}>Add Contact</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">First name *</label>
              <input required placeholder="First name" className={cls} {...f('first_name')} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Last name</label>
              <input placeholder="Last name" className={cls} {...f('last_name')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email</label>
              <input type="email" placeholder="Email" className={cls} {...f('email')} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Phone</label>
              <input placeholder="Phone" className={cls} {...f('phone')} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Title / Role</label>
            <input placeholder="e.g. CEO, Marketing Director" className={cls} {...f('title')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Link to company (optional)</label>
            <select className={`${cls} bg-white`} {...f('company_id')}>
              <option value="">— No company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: '#0042AA' }}>{saving ? 'Saving…' : 'Add Contact'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ContactsView({ companies, navigate, onEmail }) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      // get all contacts that are linked to CRM companies via company_contacts
      const crmIds = companies.map(c => c.id)
      if (crmIds.length === 0) { setContacts([]); setLoading(false); return }
      const { data } = await supabase
        .from('company_contacts')
        .select('contact_id, company_id, contacts(id, first_name, last_name, email, phone, title)')
        .eq('user_id', user.id)
        .in('company_id', crmIds)
      const companyMap = {}
      companies.forEach(c => { companyMap[c.id] = c })
      const rows = (data || []).map(row => ({
        ...row.contacts,
        company: companyMap[row.company_id],
        company_id: row.company_id,
      })).filter(Boolean)
      // deduplicate by contact id (keep first company link)
      const seen = new Set()
      const deduped = rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
      setContacts(deduped)
      setLoading(false)
    }
    load()
  }, [user, companies])

  const filtered = contacts.filter(c =>
    !search ||
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.company?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-center py-20 text-gray-400">Loading contacts…</div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…"
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm bg-white w-64 focus:outline-none" />
        <span className="text-sm text-gray-400">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400 text-sm">No contacts yet. Use "+ Add Contact" to create one linked to a pipeline company.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name','Title','Email','Phone','Company','Stage',''].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(contact => {
                const stage = STAGES.find(s => s.id === contact.company?.crm_stage)
                return (
                  <tr key={contact.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <button onClick={() => navigate(`/contacts/${contact.id}`)}
                        className="text-sm font-semibold hover:underline text-left" style={{ color: '#0042AA' }}>
                        {contact.first_name} {contact.last_name}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{contact.title || '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {contact.email ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 truncate max-w-[140px]">{contact.email}</span>
                          <button onClick={() => onEmail({ name: `${contact.first_name} ${contact.last_name}`, email: contact.email, companyId: contact.company_id, companyName: contact.company?.name })}
                            className="text-xs px-2 py-0.5 rounded-lg flex-shrink-0" style={{ background: '#EFF6FF', color: '#0042AA' }}>✉</button>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {contact.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{contact.phone}</span>
                          <a href={`sms:${contact.phone}`} className="text-xs px-2 py-0.5 rounded-lg flex-shrink-0" style={{ background: '#F0FDF4', color: '#059669' }}>💬</a>
                          <a href={`tel:${contact.phone}`} className="text-xs px-2 py-0.5 rounded-lg flex-shrink-0" style={{ background: '#F5F3FF', color: '#7C3AED' }}>📞</a>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {contact.company ? (
                        <button onClick={() => navigate(`/clients/${contact.company.id}`)}
                          className="text-xs font-semibold hover:underline" style={{ color: '#0042AA' }}>
                          🏢 {contact.company.name}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {stage && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: stage.bg, color: stage.color }}>{stage.label}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => navigate(`/clients/${contact.company_id}`)}
                        className="text-xs px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                        style={{ color: '#0042AA' }}>View →</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CRM() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [showModal, setShowModal] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [contactPickerLead, setContactPickerLead] = useState(null)
  const [emailContact, setEmailContact] = useState(null)
  const [showCSV, setShowCSV] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  // drag state
  const [dragId, setDragId] = useState(null)
  const [dragOverStage, setDragOverStage] = useState(null)

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
          <button onClick={() => setShowAddContact(true)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            + Add Contact
          </button>
          <button onClick={() => { setEditLead(null); setShowModal(true) }}
            className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: '#0042AA' }}>
            + Add Company
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5" style={view === 'contacts' ? { marginBottom: 0 } : {}}>
        <div className="flex bg-white border border-gray-200 rounded-xl p-1">
          {[['kanban','Kanban'],['list','List'],['contacts','Contacts']].map(([val,lbl]) => (
            <button key={val} onClick={() => setView(val)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={view === val ? { background: '#0042AA', color: 'white' } : { color: '#6B7280' }}>
              {lbl}
            </button>
          ))}
        </div>
        {view !== 'contacts' && <>
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
        </>}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading pipeline…</div>
      ) : view === 'contacts' ? (
        <ContactsView companies={companies} navigate={navigate} onEmail={(c) => setEmailContact(c)} />
      ) : view === 'kanban' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          {STAGES.map(stage => {
            const cards = filtered.filter(c => c.crm_stage === stage.id)
            const stageTotal = cards.reduce((s, c) => s + Number(c.pipeline_value || 0), 0)
            const isDropTarget = dragOverStage === stage.id
            return (
              <div key={stage.id}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => {
                  e.preventDefault()
                  if (dragId) {
                    const dragged = companies.find(c => c.id === dragId)
                    if (dragged && dragged.crm_stage !== stage.id) moveStage(dragged, stage.id)
                  }
                  setDragId(null); setDragOverStage(null)
                }}
                className="rounded-xl transition-colors"
                style={isDropTarget ? { background: stage.bg, outline: `2px dashed ${stage.color}` } : {}}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{stage.label}</span>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: stage.bg, color: stage.color }}>{cards.length}</span>
                  </div>
                  {stageTotal > 0 && <span className="text-xs font-semibold text-gray-400">${stageTotal.toLocaleString()}</span>}
                </div>
                <div className="min-h-16 p-1">
                  {cards.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed p-4 text-center text-xs transition-colors"
                      style={{ borderColor: isDropTarget ? stage.color : '#E5E7EB', color: isDropTarget ? stage.color : '#D1D5DB' }}>
                      {isDropTarget ? `Drop here` : 'Empty'}
                    </div>
                  ) : cards.map(lead => (
                    <KanbanCard key={lead.id} lead={lead}
                      isDragging={dragId === lead.id}
                      onDragStart={() => setDragId(lead.id)}
                      onDragEnd={() => { setDragId(null); setDragOverStage(null) }}
                      onMove={moveStage}
                      onEdit={(l) => { setEditLead(l); setShowModal(true) }}
                      onContact={setContactPickerLead}
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
                          <button onClick={() => setContactPickerLead(lead)} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#EFF6FF', color: '#0042AA' }} title="Email/Text contact">✉</button>
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
      {contactPickerLead && (
        <ContactPickerModal
          lead={contactPickerLead}
          onClose={() => setContactPickerLead(null)}
          onEmail={(contact) => { setContactPickerLead(null); setEmailContact(contact) }}
        />
      )}
      {emailContact && <EmailModal contact={emailContact} onClose={() => { setEmailContact(null); load() }} />}
      {showCSV && <CSVImportModal onClose={() => setShowCSV(false)} onSave={load} />}
      {showAddContact && <AddContactModal companies={companies} onClose={() => setShowAddContact(false)} onSave={load} />}
    </div>
  )
}
