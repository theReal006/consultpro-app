import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STAGES = ['nurture', 'active', 'quoted', 'won', 'lost']

const STAGE_COLORS = {
  nurture: { bg: '#EEF2FF', text: '#6366F1', border: '#6366F1' },
  active: { bg: '#ECFDF5', text: '#10B981', border: '#10B981' },
  quoted: { bg: '#FFFBEB', text: '#F59E0B', border: '#F59E0B' },
  won: { bg: '#ECFDF5', text: '#059669', border: '#059669' },
  lost: { bg: '#FEF2F2', text: '#EF4444', border: '#EF4444' },
}

function LeadCard({ lead, onMove }) {
  const sc = STAGE_COLORS[lead.status]
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-bold text-sm" style={{ color: '#0A1628' }}>{lead.company_name}</h4>
          {lead.contact_name && <p className="text-xs text-gray-500">{lead.contact_name}</p>}
        </div>
        {lead.pipeline_value > 0 && (
          <span className="text-xs font-bold" style={{ color: '#0042AA' }}>
            ${Number(lead.pipeline_value).toLocaleString()}
          </span>
        )}
      </div>
      {lead.contact_email && (
        <p className="text-xs text-gray-400 mb-3 truncate">✉️ {lead.contact_email}</p>
      )}
      <div className="flex gap-2 flex-wrap">
        {STAGES.filter(s => s !== lead.status).map(s => (
          <button key={s} onClick={() => onMove(lead.id, s)}
            className="text-xs px-2 py-1 rounded-lg border hover:opacity-80 transition-opacity"
            style={{ borderColor: STAGE_COLORS[s].border, color: STAGE_COLORS[s].text }}>
            → {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function AddLeadModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    company_name: '', contact_name: '', contact_email: '',
    contact_phone: '', pipeline_value: '', source: '', status: 'nurture',
  })
  const { user } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('leads').insert({
      ...form,
      user_id: user.id,
      pipeline_value: form.pipeline_value || 0,
    })
    if (!error) { onSave(); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4" style={{ color: '#0A1628' }}>Add Lead</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Company name *" value={form.company_name}
            onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input placeholder="Contact name" value={form.contact_name}
            onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input type="email" placeholder="Contact email" value={form.contact_email}
            onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input placeholder="Contact phone" value={form.contact_phone}
            onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input type="number" placeholder="Pipeline value ($)" value={form.pipeline_value}
            onChange={e => setForm(f => ({ ...f, pipeline_value: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <select value={form.source}
            onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="">Source (optional)</option>
            <option>Referral</option><option>LinkedIn</option>
            <option>Website</option><option>Cold outreach</option><option>Other</option>
          </select>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#0042AA' }}>Add Lead</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CRM() {
  const [leads, setLeads] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const moveStage = async (id, newStatus) => {
    await supabase.from('leads').update({ status: newStatus }).eq('id', id)
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status: newStatus } : l))
  }

  const byStage = (stage) => leads.filter(l => l.status === stage)

  const totalPipeline = leads
    .filter(l => !['won', 'lost'].includes(l.status))
    .reduce((s, l) => s + Number(l.pipeline_value), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0A1628' }}>CRM & Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            {leads.length} leads · Open pipeline: <span className="font-bold" style={{ color: '#0042AA' }}>${totalPipeline.toLocaleString()}</span>
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
          style={{ background: '#0042AA' }}>
          + Add Lead
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading leads...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const sc = STAGE_COLORS[stage]
            const stagLeads = byStage(stage)
            const stageVal = stagLeads.reduce((s, l) => s + Number(l.pipeline_value), 0)
            return (
              <div key={stage} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                    style={{ background: sc.bg, color: sc.text }}>
                    {stage} ({stagLeads.length})
                  </span>
                  {stageVal > 0 && (
                    <span className="text-xs font-semibold text-gray-500">${stageVal.toLocaleString()}</span>
                  )}
                </div>
                <div className="space-y-0">
                  {stagLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onMove={moveStage} />
                  ))}
                  {stagLeads.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
                      No leads
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && <AddLeadModal onClose={() => setShowModal(false)} onSave={load} />}
    </div>
  )
}
