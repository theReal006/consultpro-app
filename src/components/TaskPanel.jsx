import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PRIORITIES = [
  { id: 'low',    label: 'Low',    color: '#6B7280', bg: '#F3F4F6' },
  { id: 'normal', label: 'Normal', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'high',   label: 'High',   color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'urgent', label: 'Urgent', color: '#EF4444', bg: '#FEF2F2' },
]

const EMPTY = { title: '', description: '', due_date: '', priority: 'normal' }

function isOverdue(task) {
  return task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString())
}

export default function TaskPanel({ contactId, companyId }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('open')

  const load = async () => {
    let q = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false })
    if (contactId) q = q.eq('contact_id', contactId)
    else if (companyId) q = q.eq('company_id', companyId)
    const { data } = await q
    setTasks(data || [])
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user, contactId, companyId])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, user_id: user.id, assigned_to: user.id, due_date: form.due_date || null }
    if (contactId) payload.contact_id = contactId
    if (companyId) payload.company_id = companyId
    await supabase.from('tasks').insert(payload)
    setForm(EMPTY)
    setShowForm(false)
    setSaving(false)
    load()
  }

  const toggle = async (task) => {
    const status = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    }).eq('id', task.id)
    load()
  }

  const del = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    load()
  }

  const openCount = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length
  const overdueCount = tasks.filter(isOverdue).length
  const filtered = tasks.filter(t =>
    filter === 'all' ? true :
    filter === 'done' ? t.status === 'done' :
    t.status !== 'done' && t.status !== 'cancelled'
  )

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Loading tasks…</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">{openCount} open task{openCount !== 1 ? 's' : ''}</p>
          {overdueCount > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#FEF2F2', color: '#EF4444' }}>
              {overdueCount} overdue
            </span>
          )}
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: '#0042AA' }}>
          + Add Task
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {[['open', 'Open'], ['done', 'Done'], ['all', 'All']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter(val)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={filter === val
              ? { background: '#0042AA', color: 'white' }
              : { background: '#F3F4F6', color: '#6B7280' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
          <h3 className="font-bold text-sm mb-4" style={{ color: '#0A1628' }}>New Task / Follow-up</h3>
          <form onSubmit={save} className="space-y-3">
            <input required placeholder="Task title *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <textarea placeholder="Description / details (optional)" rows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Due date</label>
                <input type="date" value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Priority</label>
                <select value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
                  {PRIORITIES.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: '#0042AA' }}>
                {saving ? 'Saving…' : 'Add Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          {filter === 'done' ? 'No completed tasks yet.' : 'No open tasks. Hit "+ Add Task" to create a follow-up.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const pri = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1]
            const overdue = isOverdue(task)
            return (
              <div key={task.id}
                className="bg-white rounded-xl p-4 shadow-sm border flex items-start gap-3 transition-all"
                style={{ borderColor: overdue ? '#FCA5A5' : '#F3F4F6' }}>

                {/* Check button */}
                <button onClick={() => toggle(task)}
                  className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                  style={task.status === 'done'
                    ? { background: '#10B981', borderColor: '#10B981' }
                    : { borderColor: '#D1D5DB' }}>
                  {task.status === 'done' && <span className="text-white text-xs font-bold">✓</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}
                      style={task.status !== 'done' ? { color: '#0A1628' } : {}}>
                      {task.title}
                    </span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                      style={{ background: pri.bg, color: pri.color }}>
                      {pri.label}
                    </span>
                    {overdue && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: '#FEF2F2', color: '#EF4444' }}>
                        Overdue
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                  )}
                  {task.due_date && (
                    <p className="text-xs mt-1" style={{ color: overdue ? '#EF4444' : '#9CA3AF' }}>
                      Due {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <button onClick={() => del(task.id)}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
