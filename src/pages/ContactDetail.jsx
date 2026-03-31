import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function ContactDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [contact, setContact] = useState(null)
  const [companies, setCompanies] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const load = async () => {
    const [contactRes, companiesRes, activityRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('company_contacts')
        .select('company_id, clients(id, name, crm_stage, status, industry)')
        .eq('contact_id', id)
        .eq('user_id', user.id),
      supabase.from('activity_logs')
        .select('*')
        .eq('contact_id', id)
        .eq('user_id', user.id)
        .order('activity_date', { ascending: false })
        .limit(20),
    ])

    if (!contactRes.data) { navigate('/crm'); return }
    setContact(contactRes.data)
    setForm(contactRes.data)
    setCompanies((companiesRes.data || []).map(r => r.clients).filter(Boolean))
    setActivities(activityRes.data || [])
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user, id])

  const save = async () => {
    setSaving(true); setErr(null)
    const { error } = await supabase.from('contacts').update({
      first_name: form.first_name?.trim(),
      last_name: form.last_name?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      title: form.title?.trim() || null,
      notes: form.notes || null,
    }).eq('id', id)
    if (error) { setErr(error.message); setSaving(false); return }
    setEditing(false); setSaving(false)
    load()
  }

  const ACTIVITY_ICONS = { call: '📞', email: '✉️', meeting: '📅', note: '📝', task: '✅' }
  const cls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>
  if (!contact) return null

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-5 transition-colors">
        ← Back
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
              style={{ background: '#0042AA' }}>
              {contact.first_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              {editing ? (
                <div className="flex gap-2 mb-1">
                  <input value={form.first_name || ''} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold w-32" placeholder="First" />
                  <input value={form.last_name || ''} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold w-32" placeholder="Last" />
                </div>
              ) : (
                <h1 className="text-2xl font-bold" style={{ color: '#0A1628' }}>
                  {contact.first_name} {contact.last_name}
                </h1>
              )}
              {editing ? (
                <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="px-3 py-1 rounded-lg border border-gray-200 text-sm text-gray-500 mt-1 w-56" placeholder="Title / Role" />
              ) : (
                contact.title && <p className="text-sm text-gray-500 mt-0.5">{contact.title}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setForm(contact); setErr(null) }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
                <button onClick={save} disabled={saving}
                  className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#0042AA' }}>{saving ? 'Saving…' : 'Save'}</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">✎ Edit</button>
            )}
          </div>
        </div>

        {err && <p className="text-xs text-red-500 mb-3">{err}</p>}

        {/* Contact info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">Email</p>
            {editing ? (
              <input type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className={cls} placeholder="Email" />
            ) : contact.email ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">{contact.email}</span>
                <a href={`mailto:${contact.email}`}
                  className="text-xs px-2 py-0.5 rounded-lg font-semibold" style={{ background: '#EFF6FF', color: '#0042AA' }}>✉ Email</a>
              </div>
            ) : <span className="text-sm text-gray-400">—</span>}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Phone</p>
            {editing ? (
              <input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className={cls} placeholder="Phone" />
            ) : contact.phone ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">{contact.phone}</span>
                <a href={`sms:${contact.phone}`} className="text-xs px-2 py-0.5 rounded-lg font-semibold" style={{ background: '#F0FDF4', color: '#059669' }}>💬 Text</a>
                <a href={`tel:${contact.phone}`} className="text-xs px-2 py-0.5 rounded-lg font-semibold" style={{ background: '#F5F3FF', color: '#7C3AED' }}>📞 Call</a>
              </div>
            ) : <span className="text-sm text-gray-400">—</span>}
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-1">Notes</p>
          {editing ? (
            <textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className={`${cls} resize-none`} rows={3} placeholder="Notes about this contact…" />
          ) : (
            <p className="text-sm text-gray-600">{contact.notes || <span className="text-gray-400">No notes</span>}</p>
          )}
        </div>
      </div>

      {/* Linked companies */}
      {companies.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-bold mb-3" style={{ color: '#0A1628' }}>Linked Companies</h2>
          <div className="space-y-2">
            {companies.map(c => (
              <Link key={c.id} to={`/clients/${c.id}`}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#0042AA' }}>🏢 {c.name}</p>
                  {c.industry && <p className="text-xs text-gray-400">{c.industry}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {c.crm_stage && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold">{c.crm_stage}</span>
                  )}
                  <span className="text-xs text-gray-400">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-bold mb-3" style={{ color: '#0A1628' }}>Activity</h2>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No activity logged for this contact yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map(a => (
              <div key={a.id} className="flex gap-3">
                <span className="text-base mt-0.5">{ACTIVITY_ICONS[a.activity_type] || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#0A1628' }}>{a.summary || a.activity_type}</p>
                  {a.notes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.notes}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.activity_date ? new Date(a.activity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
