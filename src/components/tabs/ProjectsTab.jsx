import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const PROJECT_STATUS = ['planning', 'active', 'on_hold', 'completed']
const PROJECT_STATUS_STYLES = {
  planning:  { bg: '#F3F4F6', text: '#6B7280', label: 'Planning' },
  active:    { bg: '#ECFDF5', text: '#10B981', label: 'Active' },
  on_hold:   { bg: '#FFFBEB', text: '#F59E0B', label: 'On Hold' },
  completed: { bg: '#EFF6FF', text: '#3B82F6', label: 'Completed' },
}

const MILESTONE_COLS = [
  { id: 'todo',        label: 'To Do',       color: '#6B7280', bg: '#F9FAFB' },
  { id: 'in_progress', label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'done',        label: 'Done',        color: '#10B981', bg: '#ECFDF5' },
]

function ProjectForm({ clientId, userId, project, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    status: project?.status || 'planning',
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
    budget: project?.budget || '',
    notes: project?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1'

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, budget: parseFloat(form.budget) || null, user_id: userId, client_id: clientId, updated_at: new Date().toISOString() }
    let result
    if (project?.id) {
      result = await supabase.from('projects').update(payload).eq('id', project.id).select().single()
    } else {
      result = await supabase.from('projects').insert(payload).select().single()
    }
    setSaving(false)
    onSave(result.data)
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-5">
      <h3 className="font-bold text-base mb-4" style={{ color: '#0A1628' }}>
        {project?.id ? 'Edit Project' : 'New Project'}
      </h3>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Project Name *</label>
          <input required value={form.name} onChange={set('name')} placeholder="e.g. Brand Identity Redesign" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea value={form.description} onChange={set('description')} rows={2} placeholder="What is this project about?" className={`${inputCls} resize-none`} />
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

function MilestoneCard({ milestone, onMove, onDelete, onEdit }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-2 group">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800 flex-1">{milestone.title}</p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onEdit(milestone)} className="text-gray-300 hover:text-blue-400 text-xs px-1">✎</button>
          <button onClick={() => onDelete(milestone.id)} className="text-gray-300 hover:text-red-400 text-sm leading-none px-1">×</button>
        </div>
      </div>
      {milestone.description && <p className="text-xs text-gray-400 mt-1">{milestone.description}</p>}
      {milestone.due_date && (
        <p className="text-xs mt-2" style={{ color: new Date(milestone.due_date) < new Date() && milestone.status !== 'done' ? '#EF4444' : '#9CA3AF' }}>
          📅 {new Date(milestone.due_date).toLocaleDateString()}
        </p>
      )}
      {/* Move buttons */}
      <div className="flex gap-1 mt-2">
        {MILESTONE_COLS.filter(c => c.id !== milestone.status).map(col => (
          <button key={col.id} onClick={() => onMove(milestone.id, col.id)}
            className="text-xs px-2 py-0.5 rounded-lg font-semibold hover:opacity-80"
            style={{ background: col.bg, color: col.color }}>
            → {col.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function MilestoneForm({ projectId, userId, milestone, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: milestone?.title || '',
    description: milestone?.description || '',
    due_date: milestone?.due_date || '',
    status: milestone?.status || 'todo',
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, project_id: projectId, user_id: userId, updated_at: new Date().toISOString() }
    if (milestone?.id) {
      await supabase.from('milestones').update(payload).eq('id', milestone.id)
    } else {
      await supabase.from('milestones').insert(payload)
    }
    setSaving(false)
    onSave()
  }

  return (
    <form onSubmit={handleSave} className="bg-blue-50 rounded-xl p-3 mb-2 border border-blue-200">
      <input required value={form.title} onChange={set('title')} placeholder="Milestone title *"
        className={inputCls + ' mb-2'} autoFocus />
      <input value={form.description} onChange={set('description')} placeholder="Description (optional)"
        className={inputCls + ' mb-2'} />
      <input type="date" value={form.due_date} onChange={set('due_date')} className={inputCls + ' mb-2'} />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 bg-white">Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
          style={{ background: '#0042AA' }}>{saving ? '…' : 'Add'}</button>
      </div>
    </form>
  )
}

function ProjectDetail({ project, userId, onBack, onEdit, onDelete }) {
  const [milestones, setMilestones] = useState([])
  const [view, setView] = useState('kanban')
  const [addingInCol, setAddingInCol] = useState(null)
  const [editingMilestone, setEditingMilestone] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('milestones').select('*').eq('project_id', project.id).order('order_index')
    setMilestones(data || [])
  }

  useEffect(() => { load() }, [project.id])

  const moveMilestone = async (id, newStatus) => {
    await supabase.from('milestones').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
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
      {/* Project header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-sm font-semibold hover:opacity-70" style={{ color: '#0042AA' }}>
            ← Projects
          </button>
          <span className="text-gray-300">/</span>
          <h2 className="font-bold text-base" style={{ color: '#0A1628' }}>{project.name}</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
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

      {/* Project meta */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Progress', value: `${pct}%` },
            { label: 'Milestones', value: `${done}/${total}` },
            { label: 'Budget', value: project.budget ? `$${Number(project.budget).toLocaleString()}` : '—' },
            { label: 'Due', value: project.end_date ? new Date(project.end_date).toLocaleDateString() : '—' },
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
        {['kanban', 'list'].map(v => (
          <button key={v} onClick={() => setView(v)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all"
            style={view === v ? { background: '#0042AA', color: 'white' } : { color: '#6B7280' }}>
            {v === 'kanban' ? '⬛ Kanban' : '☰ List'}
          </button>
        ))}
      </div>

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MILESTONE_COLS.map(col => {
            const colMilestones = milestones.filter(m => m.status === col.id)
            return (
              <div key={col.id} className="rounded-2xl p-3 min-h-48" style={{ background: col.bg }}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: col.color }}>{col.label}</span>
                  <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white"
                    style={{ background: col.color }}>{colMilestones.length}</span>
                </div>

                {/* Milestone cards */}
                {colMilestones.map(m => (
                  editingMilestone?.id === m.id
                    ? <MilestoneForm key={m.id} projectId={project.id} userId={userId} milestone={m}
                        onSave={() => { setEditingMilestone(null); load() }}
                        onCancel={() => setEditingMilestone(null)} />
                    : <MilestoneCard key={m.id} milestone={m}
                        onMove={moveMilestone}
                        onDelete={deleteMilestone}
                        onEdit={setEditingMilestone} />
                ))}

                {/* Add form or button */}
                {addingInCol === col.id
                  ? <MilestoneForm projectId={project.id} userId={userId}
                      milestone={{ status: col.id }}
                      onSave={() => { setAddingInCol(null); load() }}
                      onCancel={() => setAddingInCol(null)} />
                  : (
                    <button onClick={() => setAddingInCol(col.id)}
                      className="w-full text-xs font-semibold py-2 rounded-xl border-2 border-dashed mt-1 hover:opacity-70 transition-opacity"
                      style={{ borderColor: col.color, color: col.color }}>
                      + Add Milestone
                    </button>
                  )
                }
              </div>
            )
          })}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {milestones.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No milestones yet. Switch to Kanban to add some.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Milestone', 'Status', 'Due Date', ''].map(h => (
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
                        {m.description && <p className="text-xs text-gray-400">{m.description}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: col.bg, color: col.color }}>{col.label}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-400">
                        {m.due_date ? new Date(m.due_date).toLocaleDateString() : '—'}
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
              ? <MilestoneForm projectId={project.id} userId={userId}
                  onSave={() => { setAddingInCol(null); load() }}
                  onCancel={() => setAddingInCol(null)} />
              : (
                <button onClick={() => setAddingInCol('list')}
                  className="text-sm font-semibold hover:opacity-70" style={{ color: '#0042AA' }}>
                  + Add Milestone
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProjectsTab({ clientId }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  useEffect(() => { if (user && clientId) load() }, [user, clientId])

  const handleSave = (saved) => {
    setShowForm(false)
    setEditingProject(null)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this project and all its milestones?')) return
    await supabase.from('projects').delete().eq('id', id)
    setSelectedProject(null)
    load()
  }

  const handleEdit = (p) => {
    setEditingProject(p)
    setSelectedProject(null)
    setShowForm(false)
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Loading projects…</div>

  // Show selected project detail
  if (selectedProject) {
    const current = projects.find(p => p.id === selectedProject) || null
    if (!current) { setSelectedProject(null); return null }
    return (
      <ProjectDetail
        project={current}
        userId={user.id}
        onBack={() => setSelectedProject(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Track projects and milestones for this client.</p>
        {!showForm && !editingProject && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#0042AA' }}>
            + New Project
          </button>
        )}
      </div>

      {(showForm || editingProject) && (
        <ProjectForm
          clientId={clientId}
          userId={user.id}
          project={editingProject}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingProject(null) }}
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
                      {p.start_date && <span>Start: {new Date(p.start_date).toLocaleDateString()}</span>}
                      {p.end_date && <span>Due: {new Date(p.end_date).toLocaleDateString()}</span>}
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
