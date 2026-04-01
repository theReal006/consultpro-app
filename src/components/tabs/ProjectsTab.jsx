import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const PROJECT_STATUS = ['planning', 'active', 'on_hold', 'completed']
const PROJECT_STATUS_STYLES = {
  planning:  { bg: '#F3F4F6', text: '#6B7280',  label: 'Planning'   },
  active:    { bg: '#ECFDF5', text: '#10B981',  label: 'Active'     },
  on_hold:   { bg: '#FFFBEB', text: '#F59E0B',  label: 'On Hold'    },
  completed: { bg: '#EFF6FF', text: '#3B82F6',  label: 'Completed'  },
}

const MILESTONE_COLS = [
  { id: 'todo',        label: 'To Do',       color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  { id: 'in_progress', label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'done',        label: 'Done',        color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
]

// ── Inline milestone row used inside ProjectForm ───────────────────────────────
function MilestoneRow({ ms, idx, onChange, onRemove }) {
  const inputCls = 'px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300 bg-white'
  return (
    <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-200">
      <span className="text-xs font-bold text-gray-400 w-5 text-center flex-shrink-0">{idx + 1}</span>
      <input
        value={ms.title}
        onChange={e => onChange(idx, 'title', e.target.value)}
        placeholder="Milestone title *"
        required
        className={inputCls + ' flex-1 min-w-0'}
      />
      <input
        value={ms.assigned_to}
        onChange={e => onChange(idx, 'assigned_to', e.target.value)}
        placeholder="Assigned to"
        className={inputCls + ' w-32 flex-shrink-0'}
      />
      <input
        type="date"
        value={ms.due_date}
        onChange={e => onChange(idx, 'due_date', e.target.value)}
        className={inputCls + ' w-36 flex-shrink-0'}
      />
      <button type="button" onClick={() => onRemove(idx)}
        className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0 px-1">×</button>
    </div>
  )
}

// ── Project create / edit form ─────────────────────────────────────────────────
function ProjectForm({ clientId, userId, project, initialMilestones, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:        project?.name        || '',
    description: project?.description || '',
    status:      project?.status      || 'planning',
    start_date:  project?.start_date  || '',
    end_date:    project?.end_date    || '',
    budget:      project?.budget      || '',
    notes:       project?.notes       || '',
  })
  const [milestones, setMilestones] = useState(
    initialMilestones?.length
      ? initialMilestones.map(m => ({ title: m.title, assigned_to: m.assigned_to || '', due_date: m.due_date || '', status: m.status || 'todo', id: m.id }))
      : []
  )
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const addMilestone = () => setMilestones(ms => [...ms, { title: '', assigned_to: '', due_date: '', status: 'todo' }])
  const changeMilestone = (idx, key, val) => setMilestones(ms => ms.map((m, i) => i === idx ? { ...m, [key]: val } : m))
  const removeMilestone = (idx) => setMilestones(ms => ms.filter((_, i) => i !== idx))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, budget: parseFloat(form.budget) || null, user_id: userId, client_id: clientId, updated_at: new Date().toISOString() }

    let projectId = project?.id
    if (projectId) {
      await supabase.from('projects').update(payload).eq('id', projectId)
      // Delete old milestones that were removed
      const keepIds = milestones.filter(m => m.id).map(m => m.id)
      const { data: existing } = await supabase.from('milestones').select('id').eq('project_id', projectId)
      const toDelete = (existing || []).filter(m => !keepIds.includes(m.id)).map(m => m.id)
      if (toDelete.length) await supabase.from('milestones').delete().in('id', toDelete)
    } else {
      const { data } = await supabase.from('projects').insert(payload).select().single()
      projectId = data?.id
    }

    // Upsert milestones
    if (projectId && milestones.length > 0) {
      const toUpsert = milestones
        .filter(m => m.title.trim())
        .map((m, i) => ({
          ...(m.id ? { id: m.id } : {}),
          project_id: projectId,
          user_id: userId,
          title: m.title.trim(),
          assigned_to: m.assigned_to || null,
          due_date: m.due_date || null,
          status: m.status || 'todo',
          order_index: i,
          updated_at: new Date().toISOString(),
        }))
      if (toUpsert.length) await supabase.from('milestones').upsert(toUpsert)
    }

    setSaving(false)
    onSave()
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1'

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-5">
      <h3 className="font-bold text-base mb-4" style={{ color: '#0A1628' }}>
        {project?.id ? 'Edit Project' : 'New Project'}
      </h3>

      {/* Project fields */}
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Project Name *</label>
          <input required value={form.name} onChange={set('name')} placeholder="e.g. Brand Identity Redesign" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea value={form.description} onChange={set('description')} rows={2}
            placeholder="What is this project about?" className={`${inputCls} resize-none`} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={set('status')} className={inputCls}>
              {PROJECT_STATUS.map(s => <option key={s} value={s}>{PROJECT_STATUS_STYLES[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Budget ($)</label>
            <input type="number" min="0" step="0.01" value={form.budget} onChange={set('budget')} placeholder="Optional" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={form.start_date} onChange={set('start_date')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" value={form.end_date} onChange={set('end_date')} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* Milestones section */}
      <div className="mt-5 pt-5 border-t border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Milestones</label>
          <button type="button" onClick={addMilestone}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80"
            style={{ background: '#EFF6FF', color: '#0042AA' }}>
            + Add Milestone
          </button>
        </div>
        {milestones.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">No milestones yet — click "Add Milestone" to get started.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[24px_1fr_128px_144px_32px] gap-2 px-2">
              <span />
              <span className="text-xs font-semibold text-gray-400">Title</span>
              <span className="text-xs font-semibold text-gray-400">Assigned To</span>
              <span className="text-xs font-semibold text-gray-400">Due Date</span>
              <span />
            </div>
            {milestones.map((ms, idx) => (
              <MilestoneRow key={idx} ms={ms} idx={idx} onChange={changeMilestone} onRemove={removeMilestone} />
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-5">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: '#0042AA' }}>{saving ? 'Saving…' : 'Save Project'}</button>
      </div>
    </form>
  )
}

// ── Draggable Milestone Card ───────────────────────────────────────────────────
function MilestoneCard({ milestone, onEdit, onDelete, dragHandlers }) {
  const overdue = milestone.due_date && new Date(milestone.due_date) < new Date() && milestone.status !== 'done'
  return (
    <div
      draggable
      onDragStart={e => dragHandlers.onDragStart(e, milestone.id)}
      onDragEnd={dragHandlers.onDragEnd}
      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-2 cursor-grab active:cursor-grabbing active:opacity-60 active:shadow-lg transition-all group select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-gray-300 mt-0.5 text-sm flex-shrink-0">⠿</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{milestone.title}</p>
            {milestone.assigned_to && (
              <p className="text-xs text-gray-400 mt-0.5">👤 {milestone.assigned_to}</p>
            )}
            {milestone.due_date && (
              <p className="text-xs mt-1" style={{ color: overdue ? '#EF4444' : '#9CA3AF' }}>
                📅 {new Date(milestone.due_date + 'T12:00:00').toLocaleDateString()}
                {overdue && ' · Overdue'}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onEdit(milestone)} className="text-gray-300 hover:text-blue-400 text-xs p-0.5">✎</button>
          <button onClick={() => onDelete(milestone.id)} className="text-gray-300 hover:text-red-400 text-sm leading-none p-0.5">×</button>
        </div>
      </div>
    </div>
  )
}

// ── Inline milestone quick-add form ───────────────────────────────────────────
function QuickMilestoneForm({ projectId, userId, defaultStatus, onSave, onCancel, editMilestone }) {
  const [form, setForm] = useState({
    title:       editMilestone?.title       || '',
    assigned_to: editMilestone?.assigned_to || '',
    due_date:    editMilestone?.due_date    || '',
    status:      editMilestone?.status      || defaultStatus || 'todo',
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-300'

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, project_id: projectId, user_id: userId, updated_at: new Date().toISOString() }
    if (editMilestone?.id) {
      await supabase.from('milestones').update(payload).eq('id', editMilestone.id)
    } else {
      await supabase.from('milestones').insert(payload)
    }
    setSaving(false)
    onSave()
  }

  return (
    <form onSubmit={handleSave} className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 mb-2">
      <input required autoFocus value={form.title} onChange={set('title')}
        placeholder="Milestone title *" className={inputCls + ' mb-2'} />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={form.assigned_to} onChange={set('assigned_to')}
          placeholder="Assigned to" className={inputCls} />
        <input type="date" value={form.due_date} onChange={set('due_date')} className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 bg-white">Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 py-1.5 rounded-lg text-white text-xs font-semibold"
          style={{ background: '#0042AA' }}>{saving ? '…' : editMilestone ? 'Update' : 'Add'}</button>
      </div>
    </form>
  )
}

// ── Project detail with drag-and-drop Kanban ──────────────────────────────────
function ProjectDetail({ project, userId, onBack, onEdit, onDelete }) {
  const [milestones, setMilestones] = useState([])
  const [view, setView] = useState('kanban')
  const [addingInCol, setAddingInCol] = useState(null)
  const [editingMilestone, setEditingMilestone] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const dragId = useRef(null)

  const load = async () => {
    const { data } = await supabase.from('milestones').select('*').eq('project_id', project.id).order('order_index')
    setMilestones(data || [])
  }

  useEffect(() => { load() }, [project.id])

  // Drag handlers
  const dragHandlers = {
    onDragStart: (e, id) => {
      dragId.current = id
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnd: () => {
      dragId.current = null
      setDragOver(null)
    },
  }

  const handleDragOver = (e, colId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(colId)
  }

  const handleDrop = async (e, colId) => {
    e.preventDefault()
    setDragOver(null)
    if (!dragId.current) return
    await supabase.from('milestones').update({ status: colId, updated_at: new Date().toISOString() }).eq('id', dragId.current)
    dragId.current = null
    load()
  }

  const deleteMilestone = async (id) => {
    if (!confirm('Delete this milestone?')) return
    await supabase.from('milestones').delete().eq('id', id)
    load()
  }

  const sc = PROJECT_STATUS_STYLES[project.status] || PROJECT_STATUS_STYLES.planning
  const done = milestones.filter(m => m.status === 'done').length
  const total = milestones.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onBack} className="text-sm font-semibold hover:opacity-70" style={{ color: '#0042AA' }}>← Projects</button>
          <span className="text-gray-300">/</span>
          <h2 className="font-bold text-base" style={{ color: '#0A1628' }}>{project.name}</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(project)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-80"
            style={{ background: '#EFF6FF', color: '#3B82F6' }}>Edit</button>
          <button onClick={() => onDelete(project.id)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold text-gray-400 hover:text-red-500 hover:bg-red-50">Delete</button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Progress',    value: `${pct}%` },
            { label: 'Milestones', value: `${done}/${total}` },
            { label: 'Budget',     value: project.budget ? `$${Number(project.budget).toLocaleString()}` : '—' },
            { label: 'Due',        value: project.end_date ? new Date(project.end_date + 'T12:00:00').toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400">{label}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: '#0042AA' }}>{value}</p>
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="mt-3">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: '#0042AA' }} />
            </div>
          </div>
        )}
        {project.description && <p className="text-sm text-gray-500 mt-3">{project.description}</p>}
      </div>

      {/* View toggle */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
        {[{ id: 'kanban', label: '⬛ Kanban' }, { id: 'list', label: '☰ List' }].map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={view === v.id ? { background: '#0042AA', color: 'white' } : { color: '#6B7280' }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Kanban view ── */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MILESTONE_COLS.map(col => {
            const cards = milestones.filter(m => m.status === col.id)
            const isOver = dragOver === col.id
            return (
              <div
                key={col.id}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, col.id)}
                className="rounded-2xl p-3 min-h-48 transition-all"
                style={{
                  background: isOver ? col.border : col.bg,
                  border: `2px solid ${isOver ? col.color : col.border}`,
                  transform: isOver ? 'scale(1.01)' : 'scale(1)',
                }}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: col.color }}>{col.label}</span>
                  <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white"
                    style={{ background: col.color }}>{cards.length}</span>
                </div>

                {cards.map(m => (
                  editingMilestone?.id === m.id
                    ? <QuickMilestoneForm key={m.id} projectId={project.id} userId={userId}
                        editMilestone={m}
                        onSave={() => { setEditingMilestone(null); load() }}
                        onCancel={() => setEditingMilestone(null)} />
                    : <MilestoneCard key={m.id} milestone={m}
                        dragHandlers={dragHandlers}
                        onEdit={setEditingMilestone}
                        onDelete={deleteMilestone} />
                ))}

                {addingInCol === col.id
                  ? <QuickMilestoneForm projectId={project.id} userId={userId} defaultStatus={col.id}
                      onSave={() => { setAddingInCol(null); load() }}
                      onCancel={() => setAddingInCol(null)} />
                  : (
                    <button onClick={() => setAddingInCol(col.id)}
                      className="w-full text-xs font-semibold py-2 rounded-xl border-2 border-dashed mt-1 hover:opacity-70"
                      style={{ borderColor: col.color, color: col.color }}>
                      + Add Milestone
                    </button>
                  )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {milestones.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No milestones yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Milestone', 'Assigned To', 'Status', 'Due Date', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {milestones.map(m => {
                  const col = MILESTONE_COLS.find(c => c.id === m.status) || MILESTONE_COLS[0]
                  return (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="text-sm font-semibold text-gray-800">{m.title}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{m.assigned_to || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: col.bg, color: col.color }}>{col.label}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-400">
                        {m.due_date ? new Date(m.due_date + 'T12:00:00').toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <button onClick={() => deleteMilestone(m.id)} className="text-gray-300 hover:text-red-400 text-base">×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div className="p-3 border-t border-gray-100">
            {addingInCol === 'list'
              ? <QuickMilestoneForm projectId={project.id} userId={userId}
                  onSave={() => { setAddingInCol(null); load() }}
                  onCancel={() => setAddingInCol(null)} />
              : <button onClick={() => setAddingInCol('list')} className="text-sm font-semibold hover:opacity-70" style={{ color: '#0042AA' }}>+ Add Milestone</button>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ProjectsTab ───────────────────────────────────────────────────────────
export default function ProjectsTab({ clientId }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [editingMilestones, setEditingMilestones] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  useEffect(() => { if (user && clientId) load() }, [user, clientId])

  const handleSave = () => {
    setShowForm(false)
    setEditingProject(null)
    setEditingMilestones([])
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this project and all its milestones?')) return
    await supabase.from('projects').delete().eq('id', id)
    setSelectedProject(null)
    load()
  }

  const handleEdit = async (p) => {
    const { data: ms } = await supabase.from('milestones').select('*').eq('project_id', p.id).order('order_index')
    setEditingProject(p)
    setEditingMilestones(ms || [])
    setSelectedProject(null)
    setShowForm(false)
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading projects…</div>

  if (selectedProject) {
    const current = projects.find(p => p.id === selectedProject)
    if (!current) { setSelectedProject(null); return null }
    return <ProjectDetail project={current} userId={user.id} onBack={() => setSelectedProject(null)} onEdit={handleEdit} onDelete={handleDelete} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Track projects and milestones for this client.</p>
        {!showForm && !editingProject && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#0042AA' }}>+ New Project</button>
        )}
      </div>

      {(showForm || editingProject) && (
        <ProjectForm
          clientId={clientId}
          userId={user.id}
          project={editingProject}
          initialMilestones={editingMilestones}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingProject(null); setEditingMilestones([]) }}
        />
      )}

      {projects.length === 0 && !showForm ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="font-semibold">No projects yet</p>
          <p className="text-sm mt-1">Click "New Project" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(p => {
            const sc = PROJECT_STATUS_STYLES[p.status] || PROJECT_STATUS_STYLES.planning
            return (
              <button key={p.id} onClick={() => setSelectedProject(p.id)}
                className="w-full text-left bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm" style={{ color: '#0A1628' }}>{p.name}</h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    </div>
                    {p.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{p.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {p.start_date && <span>Start: {new Date(p.start_date + 'T12:00:00').toLocaleDateString()}</span>}
                      {p.end_date && <span>Due: {new Date(p.end_date + 'T12:00:00').toLocaleDateString()}</span>}
                      {p.budget && <span className="font-semibold" style={{ color: '#0042AA' }}>Budget: ${Number(p.budget).toLocaleString()}</span>}
                    </div>
                  </div>
                  <span className="text-gray-300 text-lg ml-3">›</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
