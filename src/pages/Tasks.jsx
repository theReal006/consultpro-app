import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PRIORITIES = [
  { id: 'low',    label: 'Low',    color: '#6B7280', bg: '#F3F4F6' },
  { id: 'normal', label: 'Normal', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'high',   label: 'High',   color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'urgent', label: 'Urgent', color: '#EF4444', bg: '#FEF2F2' },
]

const EMPTY = { title: '', description: '', due_date: '', priority: 'normal', company_id: '', assigned_to_type: 'self', assigned_to_label: '' }

function isOverdue(task) {
  return task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString())
}

export default function Tasks() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('open')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const load = async () => {
    const [tasksRes, clientsRes] = await Promise.all([
      supabase.from('tasks')
        .select('*, company:clients(id, name), contact:contacts(id, first_name, last_name)')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('clients').select('id, name').eq('user_id', user.id).order('name'),
    ])
    setTasks(tasksRes.data || [])
    setClients(clientsRes.data || [])
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const selectedClient = clients.find(c => c.id === form.company_id)
    const assignedLabel =
      form.assigned_to_type === 'self' ? 'Me' :
      form.assigned_to_type === 'client' ? (selectedClient?.name || 'Client') :
      form.assigned_to_label || 'Other'
    const payload = {
      ...form,
      user_id: user.id,
      assigned_to: form.assigned_to_type === 'self' ? user.id : null,
      assigned_to_label: assignedLabel,
      due_date: form.due_date || null,
      company_id: form.company_id || null,
    }
    await supabase.from('tasks').insert(payload)
    setForm(EMPTY)
    setShowForm(false)
    setSaving(false)
    load()
  }

  const toggle = async (task) => {
    const status = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({ status, completed_at: status === 'done' ? new Date().toISOString() : null }).eq('id', task.id)
    load()
  }

  const del = async (id) => { await supabase.from('tasks').delete().eq('id', id); load() }

  const filtered = tasks.filter(t => {
    const statusOk = filter === 'all' ? true : filter === 'done' ? t.status === 'done' : t.status !== 'done' && t.status !== 'cancelled'
    const priOk = priorityFilter === 'all' ? true : t.priority === priorityFilter
    return statusOk && priOk
  })

  const openCount    = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length
  const overdueCount = tasks.filter(isOverdue).length
  const doneCount    = tasks.filter(t => t.status === 'done').length
  const urgentCount  = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0A1628' }}>Tasks & Follow-ups</h1>
          <p className="text-sm text-gray-400 mt-0.5">Your to-dos across all clients and contacts</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="px-5 py-2.5 rounded-xl text-white font-semibold" style={{ background: '#0042AA' }}>
          + New Task
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open',    value: openCount,    color: '#0042AA', bg: '#EFF6FF' },
          { label: 'Overdue', value: overdueCount, color: '#EF4444', bg: '#FEF2F2' },
          { label: 'Urgent',  value: urgentCount,  color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Done',    value: doneCount,    color: '#10B981', bg: '#ECFDF5' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-bold text-sm mb-4" style={{ color: '#0A1628' }}>New Task</h3>
          <form onSubmit={save} className="space-y-3">
            {/* Linked client — first and prominent */}
            <div className="p-3 rounded-xl border-2 border-blue-100 bg-blue-50">
              <label className="text-xs font-bold mb-1.5 block" style={{ color: '#0042AA' }}>🏢 Linked Client</label>
              <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-blue-200 text-sm bg-white focus:outline-none focus:border-blue-400">
                <option value="">— No client linked —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

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
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Assigned to */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Assign to</label>
              <div className="flex gap-2 mb-2">
                {[['self','Me'],['client','Client'],['other','Other']].map(([val,lbl]) => (
                  <button key={val} type="button"
                    onClick={() => setForm(f => ({ ...f, assigned_to_type: val, assigned_to_label: '' }))}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                    style={form.assigned_to_type === val
                      ? { background: '#0042AA', color: 'white', borderColor: '#0042AA' }
                      : { background: 'white', color: '#6B7280', borderColor: '#E5E7EB' }}>
                    {lbl}
                  </button>
                ))}
              </div>
              {form.assigned_to_type === 'client' && form.company_id && (
                <p className="text-xs text-gray-400 px-1">Assigned to: <span className="font-semibold">{clients.find(c => c.id === form.company_id)?.name || '—'}</span></p>
              )}
              {form.assigned_to_type === 'client' && !form.company_id && (
                <p className="text-xs text-amber-600 px-1">Select a linked client above first</p>
              )}
              {form.assigned_to_type === 'other' && (
                <input placeholder="Enter name…" value={form.assigned_to_label}
                  onChange={e => setForm(f => ({ ...f, assigned_to_label: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: '#0042AA' }}>{saving ? 'Saving…' : 'Add Task'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1">
          {[['open','Open'],['done','Done'],['all','All']].map(([val,lbl]) => (
            <button key={val} onClick={() => setFilter(val)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={filter === val ? { background: '#0042AA', color: 'white' } : { background: '#F3F4F6', color: '#6B7280' }}>
              {lbl}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setPriorityFilter('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={priorityFilter === 'all' ? { background: '#0A1628', color: 'white' } : { background: '#F3F4F6', color: '#6B7280' }}>
            All priorities
          </button>
          {PRIORITIES.map(p => (
            <button key={p.id} onClick={() => setPriorityFilter(p.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={priorityFilter === p.id
                ? { background: p.bg, color: p.color, outline: `1px solid ${p.color}` }
                : { background: '#F3F4F6', color: '#6B7280' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading tasks…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400 text-sm">{filter === 'done' ? 'No completed tasks.' : 'No open tasks. Hit "+ New Task" to get started.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const pri = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1]
            const overdue = isOverdue(task)
            return (
              <div key={task.id} className="bg-white rounded-xl p-4 shadow-sm border flex items-start gap-3"
                style={{ borderColor: overdue ? '#FCA5A5' : '#F3F4F6' }}>
                <button onClick={() => toggle(task)}
                  className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                  style={task.status === 'done' ? { background: '#10B981', borderColor: '#10B981' } : { borderColor: '#D1D5DB' }}>
                  {task.status === 'done' && <span className="text-white text-xs font-bold">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}
                      style={task.status !== 'done' ? { color: '#0A1628' } : {}}>{task.title}</span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                      style={{ background: pri.bg, color: pri.color }}>{pri.label}</span>
                    {overdue && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: '#FEF2F2', color: '#EF4444' }}>Overdue</span>}
                  </div>
                  {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {task.due_date && (
                      <p className="text-xs" style={{ color: overdue ? '#EF4444' : '#9CA3AF' }}>
                        📅 {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                    {task.assigned_to_label && <p className="text-xs text-gray-400">👤 {task.assigned_to_label}</p>}
                    {task.company && (
                      <button onClick={() => navigate(`/clients/${task.company.id}`)}
                        className="text-xs font-semibold hover:underline" style={{ color: '#0042AA' }}>
                        🏢 {task.company.name}
                      </button>
                    )}
                    {task.contact && (
                      <span className="text-xs text-gray-400">👤 {task.contact.first_name} {task.contact.last_name}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => del(task.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
