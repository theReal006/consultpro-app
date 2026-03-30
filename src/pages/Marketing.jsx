import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const WORKFLOW_TYPES = [
  { id: 'magazine', label: 'Magazine Ads', icon: '📰' },
  { id: 'newspaper', label: 'Newspaper Ads', icon: '🗞️' },
  { id: 'directmail', label: 'Direct Mail', icon: '📬' },
  { id: 'events', label: 'Events / Sponsorships', icon: '🎪' },
  { id: 'online', label: 'Online / Digital', icon: '💻' },
  { id: 'social', label: 'Social Media', icon: '📱' },
  { id: 'custom', label: 'Custom', icon: '✨' },
]

const STATUS_COLORS = {
  draft: { bg: '#F3F4F6', text: '#6B7280' },
  submitted: { bg: '#EFF6FF', text: '#3B82F6' },
  approved: { bg: '#ECFDF5', text: '#10B981' },
  paid: { bg: '#F0FDF4', text: '#059669' },
}

function IntakeModal({ type, clients, onClose, onSave }) {
  const [form, setForm] = useState({
    workflow_type: type.id,
    workflow_name: type.id === 'custom' ? '' : type.label,
    vendor_name: '', program_name: '', submission_deadline: '',
    total_budget: '', coop_percentage: '', expected_reimbursement: '',
    publication: '', ad_format: '', run_start: '', run_end: '',
    vendor_contact: '', vendor_email: '', client_id: '', notes: '',
    status: 'draft',
  })
  const { user } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('marketing_intakes').insert({
      ...form,
      user_id: user.id,
      total_budget: form.total_budget || null,
      coop_percentage: form.coop_percentage || null,
      expected_reimbursement: form.expected_reimbursement || null,
    })
    if (!error) { onSave(); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-1" style={{ color: '#0A1628' }}>
          {type.icon} {type.label} Intake
        </h2>
        <p className="text-sm text-gray-400 mb-4">Fill in the co-op program details below.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {type.id === 'custom' && (
              <input required placeholder="Workflow name *" value={form.workflow_name}
                onChange={e => setForm(f => ({ ...f, workflow_name: e.target.value }))}
                className="col-span-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            )}
            <select value={form.client_id}
              onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
              <option value="">Client (optional)</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Vendor name" value={form.vendor_name}
              onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input placeholder="Program name" value={form.program_name}
              onChange={e => setForm(f => ({ ...f, program_name: e.target.value }))}
              className="col-span-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <div>
              <label className="text-xs text-gray-400 block mb-1">Submission deadline</label>
              <input type="date" value={form.submission_deadline}
                onChange={e => setForm(f => ({ ...f, submission_deadline: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
            <input type="number" placeholder="Total budget ($)" value={form.total_budget}
              onChange={e => setForm(f => ({ ...f, total_budget: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input type="number" placeholder="Co-op %" value={form.coop_percentage}
              onChange={e => setForm(f => ({ ...f, coop_percentage: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input type="number" placeholder="Expected reimbursement ($)" value={form.expected_reimbursement}
              onChange={e => setForm(f => ({ ...f, expected_reimbursement: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input placeholder="Publication / platform" value={form.publication}
              onChange={e => setForm(f => ({ ...f, publication: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input placeholder="Ad format / size" value={form.ad_format}
              onChange={e => setForm(f => ({ ...f, ad_format: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <div>
              <label className="text-xs text-gray-400 block mb-1">Run start</label>
              <input type="date" value={form.run_start}
                onChange={e => setForm(f => ({ ...f, run_start: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Run end</label>
              <input type="date" value={form.run_end}
                onChange={e => setForm(f => ({ ...f, run_end: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
            <input placeholder="Vendor contact name" value={form.vendor_contact}
              onChange={e => setForm(f => ({ ...f, vendor_contact: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input type="email" placeholder="Vendor email" value={form.vendor_email}
              onChange={e => setForm(f => ({ ...f, vendor_email: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          </div>
          <textarea placeholder="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm h-20 resize-none" />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#0042AA' }}>Save Intake</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Marketing() {
  const [intakes, setIntakes] = useState([])
  const [clients, setClients] = useState([])
  const [activeType, setActiveType] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [intRes, cliRes] = await Promise.all([
      supabase.from('marketing_intakes').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name'),
    ])
    setIntakes(intRes.data || [])
    setClients(cliRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#0A1628' }}>Marketing / Co-op Portal</h1>
      <p className="text-sm text-gray-400 mb-6">Create and track co-op marketing intake submissions.</p>

      {/* Workflow type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {WORKFLOW_TYPES.map(wt => (
          <button key={wt.id} onClick={() => setActiveType(wt)}
            className="flex flex-col items-center gap-1.5 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
            <span className="text-2xl">{wt.icon}</span>
            <span className="text-xs font-semibold text-center" style={{ color: '#0A1628' }}>{wt.label}</span>
          </button>
        ))}
      </div>

      {/* Intakes list */}
      <h2 className="font-bold text-base mb-3" style={{ color: '#0A1628' }}>Recent Intakes</h2>
      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : intakes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
          No intakes yet. Click a workflow type above to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {intakes.map(intake => {
            const sc = STATUS_COLORS[intake.status] || STATUS_COLORS.draft
            const wt = WORKFLOW_TYPES.find(w => w.id === intake.workflow_type)
            const clientName = clients.find(c => c.id === intake.client_id)?.name
            return (
              <div key={intake.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{wt?.icon || '📋'}</span>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#0A1628' }}>
                        {intake.workflow_name || wt?.label}
                        {clientName && <span className="text-gray-400 font-normal"> · {clientName}</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {intake.vendor_name && `${intake.vendor_name} · `}
                        {intake.total_budget ? `$${Number(intake.total_budget).toLocaleString()} budget` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: sc.bg, color: sc.text }}>
                    {intake.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeType && (
        <IntakeModal
          type={activeType}
          clients={clients}
          onClose={() => setActiveType(null)}
          onSave={load}
        />
      )}
    </div>
  )
}
