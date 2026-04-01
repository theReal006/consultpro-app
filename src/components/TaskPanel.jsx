import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PRIORITIES = [
  { id: 'low',    label: 'Low',    color: '#6B7280', bg: '#F3F4F6' },
  { id: 'normal', label: 'Normal', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'high',   label: 'High',   color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'urgent', label: 'Urgent', color: '#EF4444', bg: '#FEF2F2' },
]

const EMPTY = { title: '', description: '', due_date: '', priority: 'normal', assigned_to_type: 'self', assigned_to_label: '' }
const SUB_EMPTY = { title: '', description: '', due_date: '', assigned_to_type: 'self', assigned_to_label: '' }

function isOverdue(task) {
  return task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString())
}

export default function TaskPanel({ contactId, companyId, companyName }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])       // top-level tasks
  const [subtaskMap, setSubtaskMap] = useState({}) // parentId → [subtasks]
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('open')
  const [addingSubtaskFor, setAddingSubtaskFor] = useState(null) // taskId
  const [subForm, setSubForm] = useState(SUB_EMPTY)
  const [savingSub, setSavingSub] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState(new Set())

  const load = async () => {
    let q = supabase.from('tasks').select('*').eq('user_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false })
    if (contactId) q = q.eq('contact_id', contactId)
    else if (companyId) q = q.eq('company_id', companyId)
    const { data } = await q
    const all = data || []
    const topLevel = all.filter(t => !t.parent_task_id)
    const smap = {}
    all.filter(t => t.parent_task_id).forEach(t => {
      if (!smap[t.parent_task_id]) smap[t.parent_task_id] = []
      smap[t.parent_task_id].push(t)
    })
    setTasks(topLevel)
    setSubtaskMap(smap)
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user, contactId, companyId])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const assignedLabel =
      form.assigned_to_type === 'self' ? 'Me' :
      form.assigned_to_type === 'client' ? (companyName || 'Client') :
      form.assigned_to_label || 'Other'
    const payload = {
      ...form,
      user_id: user.id,
      assigned_to: form.assigned_to_type === 'self' ? user.id : null,
      assigned_to_label: assignedLabel,
      due_date: form.due_date || null,
    }
    if (contactId) payload.contact_id = contactId
    if (companyId) payload.company_id = companyId
    await supabase.from('tasks').insert(payload)
    setForm(EMPTY)
    setShowForm(false)
    setSaving(false)
    load()
  }

  const saveSubtask = async (parentId) => {
    if (!subForm.title.trim()) return
    setSavingSub(true)
    const assignedLabel =
      subForm.assigned_to_type === 'self' ? 'Me' :
      subForm.assigned_to_type === 'client' ? (companyName || 'Client') :
      subForm.assigned_to_label || 'Other'
    const payload = {
      title: subForm.title,
      description: subForm.description || null,
      due_date: subForm.due_date || null,
      priority: 'normal',
      status: 'open',
      user_id: user.id,
      assigned_to: subForm.assigned_to_type === 'self' ? user.id : null,
      assigned_to_label: assignedLabel,
      assigned_to_type: subForm.assigned_to_type,
      parent_task_id: parentId,
    }
    if (contactId) payload.contact_id = contactId
    if (companyId) payload.company_id = companyId
    await supabase.from('tasks').insert(payload)
    setSubForm(SUB_EMPTY)
    setAddingSubtaskFor(null)
    setSavingSub(false)
    // Auto-expand to show new subtask
    setExpandedTasks(prev => new Set([...prev, parentId]))
    load()
  }

  const toggle = async (task) => {
    const status = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({ status, completed_at: status === 'done' ? new Date().toISOString() : null }).eq('id', task.id)
    load()
  }

  const del = async (id) => { await supabase.from('tasks').delete().eq('id', id); load() }

  const toggleExpand = (taskId) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const openCount = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length
  const overdueCount = tasks.filter(isOverdue).length
  const filtered = tasks.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.status === 'done' : t.status !== 'done' && t.status !== 'cancelled'
  )

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Loading tasks…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">{openCount} open task{openCount !== 1 ? 's' : ''}</p>
          {overdueCount > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#EF4444' }}>
              {overdueCount} overdue
            </span>
          )}
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: '#0042AA' }}>
          + Add Task
        </button>
      </div>

      <div className="flex gap-1 mb-4">
        {[['open','Open'],['done','Done'],['all','All']].map(([val,lbl]) => (
          <button key={val} onClick={() => setFilter(val)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={filter === val ? { background: '#0042AA', color: 'white' } : { background: '#F3F4F6', color: '#6B7280' }}>
            {lbl}
          </button>
        ))}
      </div>

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
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Assign to</label>
              <div className="flex gap-2 mb-2">
                {[['self','Me'],['client','Client'],['other','Other']].map(([val,lbl]) => (
                  <button key={val} type="button" onClick={() => setForm(f => ({ ...f, assigned_to_type: val, assigned_to_label: '' }))}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                    style={form.assigned_to_type === val
                      ? { background: '#0042AA', color: 'white', borderColor: '#0042AA' }
                      : { background: 'white', color: '#6B7280', borderColor: '#E5E7EB' }}>
                    {lbl}
                  </button>
                ))}
              </div>
              {form.assigned_to_type === 'client' && (
                <p className="text-xs text-gray-400 px-1">Assigned to: <span className="font-semibold">{companyName || 'this company'}</span></p>
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

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          {filter === 'done' ? 'No completed tasks yet.' : 'No open tasks. Hit "+ Add Task" to create a follow-up.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const pri = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1]
            const overdue = isOverdue(task)
            const subs = subtaskMap[task.id] || []
            const isExpanded = expandedTasks.has(task.id)
            const openSubs = subs.filter(s => s.status !== 'done').length
            return (
              <div key={task.id}>
                {/* Main task row */}
                <div className="bg-white rounded-xl p-4 shadow-sm border"
                  style={{ borderColor: overdue ? '#FCA5A5' : '#F3F4F6' }}>
                  <div className="flex items-start gap-3">
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
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {task.due_date && (
                          <p className="text-xs" style={{ color: overdue ? '#EF4444' : '#9CA3AF' }}>
                            📅 {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                        {task.assigned_to_label && (
                          <p className="text-xs text-gray-400">👤 {task.assigned_to_label}</p>
                        )}
                      </div>

                      {/* Subtask controls */}
                      <div className="flex items-center gap-3 mt-2">
                        {subs.length > 0 && (
                          <button onClick={() => toggleExpand(task.id)}
                            className="text-xs font-semibold px-2 py-1 rounded-lg transition-all"
                            style={{ background: '#F3F4F6', color: '#6B7280' }}>
                            {isExpanded ? '▾' : '▸'} {subs.length} subtask{subs.length !== 1 ? 's' : ''}
                            {openSubs > 0 && <span className="ml-1 text-blue-500">({openSubs} open)</span>}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setAddingSubtaskFor(addingSubtaskFor === task.id ? null : task.id)
                            setSubForm(SUB_EMPTY)
                            if (!isExpanded && subs.length > 0) toggleExpand(task.id)
                          }}
                          className="text-xs font-semibold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                          style={{ background: '#EFF6FF', color: '#0042AA' }}>
                          + Subtask
                        </button>
                      </div>
                    </div>
                    <button onClick={() => del(task.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
                  </div>
                </div>

                {/* Subtasks */}
                {(isExpanded || subs.length > 0 && expandedTasks.has(task.id)) && subs.length > 0 && (
                  <div className="ml-7 mt-1 space-y-1">
                    {subs.map(sub => {
                      const subOverdue = isOverdue(sub)
                      return (
                        <div key={sub.id}
                          className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5 border"
                          style={{ borderColor: subOverdue ? '#FCA5A5' : '#F3F4F6' }}>
                          <button onClick={() => toggle(sub)}
                            className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                            style={sub.status === 'done' ? { background: '#10B981', borderColor: '#10B981' } : { borderColor: '#D1D5DB' }}>
                            {sub.status === 'done' && <span className="text-white text-xs leading-none">✓</span>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-semibold ${sub.status === 'done' ? 'line-through text-gray-400' : ''}`}
                              style={sub.status !== 'done' ? { color: '#0A1628' } : {}}>
                              {sub.title}
                            </span>
                            {sub.description && <p className="text-xs text-gray-400 mt-0.5">{sub.description}</p>}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {sub.due_date && (
                                <span className="text-xs" style={{ color: subOverdue ? '#EF4444' : '#9CA3AF' }}>
                                  📅 {new Date(sub.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {sub.assigned_to_label && <span className="text-xs text-gray-400">👤 {sub.assigned_to_label}</span>}
                            </div>
                          </div>
                          <button onClick={() => del(sub.id)} className="text-gray-300 hover:text-red-400 text-base leading-none flex-shrink-0">×</button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add subtask form */}
                {addingSubtaskFor === task.id && (
                  <div className="ml-7 mt-1 bg-blue-50 rounded-xl p-3 border border-blue-100 space-y-2">
                    <input
                      autoFocus
                      value={subForm.title}
                      onChange={e => setSubForm(f => ({ ...f, title: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveSubtask(task.id) } if (e.key === 'Escape') { setAddingSubtaskFor(null); setSubForm(SUB_EMPTY) } }}
                      placeholder="Subtask title… (Enter to save)"
                      className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                    />
                    <textarea
                      value={subForm.description}
                      onChange={e => setSubForm(f => ({ ...f, description: e.target.value }))}
                      rows={2}
                      placeholder="Description (optional)…"
                      className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:border-blue-400 bg-white resize-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Due date</label>
                        <input type="date" value={subForm.due_date}
                          onChange={e => setSubForm(f => ({ ...f, due_date: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:border-blue-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Assign to</label>
                        <div className="flex gap-1">
                          {[['self','Me'],['client','C'],['other','…']].map(([val,lbl]) => (
                            <button key={val} type="button"
                              onClick={() => setSubForm(f => ({ ...f, assigned_to_type: val, assigned_to_label: '' }))}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                              style={subForm.assigned_to_type === val
                                ? { background: '#0042AA', color: 'white', borderColor: '#0042AA' }
                                : { background: 'white', color: '#6B7280', borderColor: '#E5E7EB' }}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {subForm.assigned_to_type === 'other' && (
                      <input value={subForm.assigned_to_label}
                        onChange={e => setSubForm(f => ({ ...f, assigned_to_label: e.target.value }))}
                        placeholder="Enter name…"
                        className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none bg-white" />
                    )}
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => { setAddingSubtaskFor(null); setSubForm(SUB_EMPTY) }}
                        className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 bg-white">
                        Cancel
                      </button>
                      <button
                        onClick={() => saveSubtask(task.id)}
                        disabled={savingSub || !subForm.title.trim()}
                        className="flex-1 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
                        style={{ background: '#0042AA' }}>
                        {savingSub ? 'Saving…' : 'Add Subtask'}
                      </button>
                    </div>
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
