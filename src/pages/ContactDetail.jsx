import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import EmailComposeModal from '../components/EmailComposeModal'
import SmsComposeModal from '../components/SmsComposeModal'

const TASK_EMPTY = { title: '', description: '', due_date: '', assigned_to_type: 'self', assigned_to_label: '' }

function MeetingNotesModal({ contact, companyId, companyName, user, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    attendees: '',
    notes: '',
    outcome: '',
  })
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState(TASK_EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const addTask = () => {
    if (!newTask.title.trim()) return
    setTasks(prev => [...prev, { ...newTask, _id: Date.now() }])
    setNewTask(TASK_EMPTY)
  }

  const removeTask = (_id) => setTasks(prev => prev.filter(t => t._id !== _id))

  const save = async () => {
    if (!form.title.trim()) { setErr('Meeting title is required.'); return }
    setSaving(true); setErr(null)

    // Save meeting activity
    const { error: actErr } = await supabase.from('activity_logs').insert({
      user_id: user.id,
      contact_id: contact.id,
      activity_type: 'meeting',
      summary: form.title,
      notes: form.notes || null,
      activity_date: form.date,
      attendees: form.attendees || null,
      outcome: form.outcome || null,
    })
    if (actErr) { setErr(actErr.message); setSaving(false); return }

    // Save tasks created from meeting
    for (const task of tasks) {
      const assignedLabel =
        task.assigned_to_type === 'self' ? 'Me' :
        task.assigned_to_type === 'client' ? (companyName || 'Client') :
        task.assigned_to_label || 'Other'
      const payload = {
        user_id: user.id,
        contact_id: contact.id,
        title: task.title,
        description: task.description || null,
        due_date: task.due_date || null,
        priority: 'normal',
        status: 'open',
        assigned_to: task.assigned_to_type === 'self' ? user.id : null,
        assigned_to_label: assignedLabel,
        assigned_to_type: task.assigned_to_type,
      }
      if (companyId) payload.company_id = companyId
      await supabase.from('tasks').insert(payload)
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  const cls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold" style={{ color: '#0A1628' }}>📅 Meeting Notes</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          {err && <p className="text-xs text-red-500 mb-3 px-3 py-2 rounded-lg bg-red-50">{err}</p>}

          <div className="space-y-3 mb-5">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Meeting Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={cls} placeholder="e.g. Kick-off call, Quarterly review…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={cls} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Attendees</label>
                <input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
                  className={cls} placeholder="Names / emails…" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes / Key Discussion Points</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className={`${cls} resize-none`} rows={4} placeholder="What was discussed…" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Outcome / Next Steps</label>
              <textarea value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                className={`${cls} resize-none`} rows={2} placeholder="Decisions made, action items…" />
            </div>
          </div>

          {/* Tasks from meeting */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold mb-3" style={{ color: '#0A1628' }}>✅ Tasks from this Meeting</h3>

            {tasks.length > 0 && (
              <div className="space-y-2 mb-3">
                {tasks.map(task => (
                  <div key={task._id} className="flex items-start gap-3 bg-blue-50 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#0A1628' }}>{task.title}</p>
                      {task.description && <p className="text-xs text-gray-500">{task.description}</p>}
                      <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                        {task.due_date && <span>📅 {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        <span>👤 {task.assigned_to_type === 'self' ? 'Me' : task.assigned_to_type === 'client' ? (companyName || 'Client') : task.assigned_to_label || 'Other'}</span>
                      </div>
                    </div>
                    <button onClick={() => removeTask(task._id)} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add task inline */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <input value={newTask.title} onChange={e => setNewTask(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask() } }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-300"
                placeholder="Task name…" />
              <textarea value={newTask.description} onChange={e => setNewTask(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-300 resize-none"
                placeholder="Description (optional)…" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Due date</label>
                  <input type="date" value={newTask.due_date} onChange={e => setNewTask(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Assign to</label>
                  <div className="flex gap-1.5">
                    {[['self','Me'],['client','Client'],['other','Other']].map(([val,lbl]) => (
                      <button key={val} type="button"
                        onClick={() => setNewTask(f => ({ ...f, assigned_to_type: val, assigned_to_label: '' }))}
                        className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                        style={newTask.assigned_to_type === val
                          ? { background: '#0042AA', color: 'white', borderColor: '#0042AA' }
                          : { background: 'white', color: '#6B7280', borderColor: '#E5E7EB' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {newTask.assigned_to_type === 'other' && (
                <input value={newTask.assigned_to_label} onChange={e => setNewTask(f => ({ ...f, assigned_to_label: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-300"
                  placeholder="Enter name…" />
              )}
              <button onClick={addTask} disabled={!newTask.title.trim()}
                className="w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: '#EFF6FF', color: '#0042AA' }}>
                + Add Task
              </button>
            </div>
          </div>

          <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim()}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: '#0042AA' }}>
              {saving ? 'Saving…' : `Save Meeting${tasks.length > 0 ? ` + ${tasks.length} Task${tasks.length !== 1 ? 's' : ''}` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showSmsModal, setShowSmsModal] = useState(false)

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

  const primaryCompanyId = companies[0]?.id || null
  const primaryCompanyName = companies[0]?.name || null

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
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="text-sm font-medium hover:underline text-left"
                  style={{ color: '#0042AA' }}>
                  {contact.email}
                </button>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="text-xs px-2 py-0.5 rounded-lg font-semibold flex-shrink-0 hover:opacity-80"
                  style={{ background: '#EFF6FF', color: '#0042AA' }}>✉ Email</button>
              </div>
            ) : <span className="text-sm text-gray-400">—</span>}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Phone</p>
            {editing ? (
              <input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className={cls} placeholder="Phone" />
            ) : contact.phone ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-700">{contact.phone}</span>
                <button onClick={() => setShowSmsModal(true)} className="text-xs px-2 py-0.5 rounded-lg font-semibold flex-shrink-0 hover:opacity-80 flex items-center gap-1" style={{ background: '#DCFCE7', color: '#25D366' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </button>
                <a href={`tel:${contact.phone}`} className="text-xs px-2 py-0.5 rounded-lg font-semibold flex-shrink-0" style={{ background: '#F5F3FF', color: '#7C3AED' }}>📞 Call</a>
                <button onClick={() => setShowMeetingModal(true)}
                  className="text-xs px-2 py-0.5 rounded-lg font-semibold flex-shrink-0 hover:opacity-80"
                  style={{ background: '#FFF7ED', color: '#D97706' }}>📅 Meeting</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">—</span>
                <button onClick={() => setShowMeetingModal(true)}
                  className="text-xs px-2 py-0.5 rounded-lg font-semibold hover:opacity-80"
                  style={{ background: '#FFF7ED', color: '#D97706' }}>📅 Meeting</button>
              </div>
            )}
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: '#0A1628' }}>Activity</h2>
          <button onClick={() => setShowMeetingModal(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80"
            style={{ background: '#FFF7ED', color: '#D97706' }}>
            + Log Meeting
          </button>
        </div>
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
                  {a.outcome && <p className="text-xs text-gray-400 mt-0.5 italic">→ {a.outcome}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.activity_date ? new Date(a.activity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showMeetingModal && (
        <MeetingNotesModal
          contact={contact}
          companyId={primaryCompanyId}
          companyName={primaryCompanyName}
          user={user}
          onClose={() => setShowMeetingModal(false)}
          onSaved={load}
        />
      )}

      {showEmailModal && contact.email && (
        <EmailComposeModal
          toEmail={contact.email}
          toName={`${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
          onClose={() => setShowEmailModal(false)}
        />
      )}

      {showSmsModal && contact.phone && (
        <SmsComposeModal
          toPhone={contact.phone}
          toName={`${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
          onClose={() => setShowSmsModal(false)}
        />
      )}
    </div>
  )
}
