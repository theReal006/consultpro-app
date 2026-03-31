import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TYPES = [
  { id: 'call',    label: 'Call',    icon: '📞', color: '#10B981', bg: '#ECFDF5' },
  { id: 'meeting', label: 'Meeting', icon: '🤝', color: '#6366F1', bg: '#EEF2FF' },
  { id: 'email',   label: 'Email',   icon: '✉️',  color: '#0042AA', bg: '#EFF6FF' },
  { id: 'note',    label: 'Note',    icon: '📝', color: '#F59E0B', bg: '#FFFBEB' },
]

const EMPTY = {
  activity_type: 'call',
  title: '',
  content: '',
  occurred_at: new Date().toISOString().split('T')[0],
  duration_minutes: '',
  attendees: '',
  outcome: '',
}

export default function ActivityFeed({ contactId, companyId }) {
  const { user } = useAuth()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    let q = supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
    if (contactId) q = q.eq('contact_id', contactId)
    else if (companyId) q = q.eq('company_id', companyId)
    const { data } = await q
    setActivities(data || [])
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user, contactId, companyId])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      user_id: user.id,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
    }
    if (contactId) payload.contact_id = contactId
    if (companyId) payload.company_id = companyId
    await supabase.from('activity_logs').insert(payload)
    setForm(EMPTY)
    setShowForm(false)
    setSaving(false)
    load()
  }

  const del = async (id) => {
    await supabase.from('activity_logs').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Loading activity…</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {activities.length} activit{activities.length === 1 ? 'y' : 'ies'} logged
        </p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: '#0042AA' }}>
          + Log Activity
        </button>
      </div>

      {/* Log form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
          <h3 className="font-bold text-sm mb-4" style={{ color: '#0A1628' }}>Log Activity</h3>
          <form onSubmit={save} className="space-y-3">
            {/* Type pills */}
            <div className="flex gap-2 flex-wrap">
              {TYPES.map(t => (
                <button key={t.id} type="button"
                  onClick={() => setForm(f => ({ ...f, activity_type: t.id }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={form.activity_type === t.id
                    ? { background: t.bg, color: t.color, borderColor: t.color }
                    : { background: 'white', color: '#6B7280', borderColor: '#E5E7EB' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <input required placeholder="Title / subject *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Date</label>
                <input type="date" value={form.occurred_at}
                  onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              {(form.activity_type === 'call' || form.activity_type === 'meeting') && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Duration (mins)</label>
                  <input type="number" min="1" placeholder="e.g. 30" value={form.duration_minutes}
                    onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
              )}
            </div>

            {form.activity_type === 'meeting' && (
              <input placeholder="Attendees (comma separated)" value={form.attendees}
                onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            )}

            <textarea required rows={4}
              placeholder={
                form.activity_type === 'call' ? 'Call summary — what was discussed, key decisions…' :
                form.activity_type === 'meeting' ? 'Meeting notes — agenda, discussion, action items…' :
                form.activity_type === 'email' ? 'Email summary — key points from the thread…' :
                'Note content…'
              }
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none" />

            {(form.activity_type === 'call' || form.activity_type === 'meeting') && (
              <input placeholder="Outcome / next steps" value={form.outcome}
                onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: '#0042AA' }}>
                {saving ? 'Saving…' : 'Save Activity'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feed */}
      {activities.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          No activity logged yet. Hit "+ Log Activity" to add a call, meeting, email, or note.
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map(act => {
            const cfg = TYPES.find(t => t.id === act.activity_type) || TYPES[0]
            return (
              <div key={act.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                      style={{ background: cfg.bg }}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: '#0A1628' }}>{act.title}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {act.duration_minutes && (
                          <span className="text-xs text-gray-400">{act.duration_minutes} min</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(act.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {act.attendees && ` · ${act.attendees}`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => del(act.id)}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
                </div>
                <p className="text-sm text-gray-600 mt-3 leading-relaxed whitespace-pre-line">{act.content}</p>
                {act.outcome && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">Outcome / Next steps: </span>
                      {act.outcome}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
