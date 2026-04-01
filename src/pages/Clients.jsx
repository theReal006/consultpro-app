import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import EmailComposeModal from '../components/EmailComposeModal'

const STATUS_COLORS = {
  active:   { bg: '#ECFDF5', text: '#10B981' },
  inactive: { bg: '#F3F4F6', text: '#6B7280' },
  prospect: { bg: '#EEF2FF', text: '#6366F1' },
}

const CRM_STAGES = ['nurture','active','quoted','won','lost']

const FILTERS = [
  { id: 'active',        label: 'Active',           desc: 'Status = active' },
  { id: 'prospect',      label: 'Prospects',        desc: 'Status = prospect' },
  { id: 'inactive',      label: 'Inactive',         desc: 'Status = inactive' },
  { id: 'billed_12mo',   label: 'Billed (12 mo)',   desc: 'Has invoice in last 12 months' },
  { id: 'no_contact_30', label: 'No contact 30d+',  desc: 'Last contact ≥ 30 days ago' },
  { id: 'no_contact_60', label: 'No contact 60d+',  desc: 'Last contact ≥ 60 days ago' },
  { id: 'no_contact_90', label: 'No contact 90d+',  desc: 'Last contact ≥ 90 days ago' },
  { id: 'dormant',       label: 'Dormant 100d+',    desc: 'No contact in 100+ days — at risk' },
  { id: 'crm',           label: 'In CRM Pipeline',  desc: 'Has a CRM stage set' },
  { id: 'all',           label: 'All',              desc: 'Show everything' },
]

function AddClientModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', contact_name: '', email: '', phone: '',
    industry: '', billing_type: 'hourly', hourly_rate: '',
    status: 'active', notes: '',
  })
  const [addToCRM, setAddToCRM] = useState(false)
  const [crmStage, setCrmStage] = useState('nurture')
  const [pipelineValue, setPipelineValue] = useState('')
  const { user } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...form, user_id: user.id, hourly_rate: form.hourly_rate || null }
    if (addToCRM) {
      payload.crm_stage = crmStage
      payload.pipeline_value = parseFloat(pipelineValue) || 0
      payload.status = 'prospect'
    }
    const { error } = await supabase.from('clients').insert(payload)
    if (!error) { onSave(); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4" style={{ color: '#0A1628' }}>Add New Client</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Company name *" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="col-span-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input placeholder="Contact name" value={form.contact_name}
              onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input type="email" placeholder="Email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input placeholder="Phone" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <input placeholder="Industry" value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <select value={form.billing_type}
              onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
              <option value="hourly">Hourly</option>
              <option value="flat">Flat fee</option>
              <option value="retainer">Retainer</option>
            </select>
            <input type="number" placeholder="Hourly rate ($)" value={form.hourly_rate}
              onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <select value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="prospect">Prospect</option>
            </select>
          </div>
          <textarea placeholder="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm h-20 resize-none" />

          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setAddToCRM(v => !v)}>
              <div className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0"
                style={{ background: addToCRM ? '#0042AA' : '#E5E7EB' }}>
                <div className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm"
                  style={{ left: addToCRM ? '22px' : '4px' }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: '#0A1628' }}>Also add to CRM pipeline</span>
            </div>
            {addToCRM && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <select value={crmStage} onChange={e => setCrmStage(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
                  {CRM_STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <input type="number" placeholder="Pipeline value ($)" value={pipelineValue}
                  onChange={e => setPipelineValue(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#0042AA' }}>Add Client</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddToCRMModal({ client, onClose, onSave }) {
  const [stage, setStage] = useState('nurture')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    await supabase.from('clients').update({ crm_stage: stage, pipeline_value: parseFloat(value) || 0 }).eq('id', client.id)
    onSave(); onClose()
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-1" style={{ color: '#0A1628' }}>Add to CRM Pipeline</h2>
        <p className="text-sm text-gray-400 mb-4">{client.name}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Stage</label>
            <select value={stage} onChange={e => setStage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
              {CRM_STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Pipeline value ($)</label>
            <input type="number" placeholder="0" value={value} onChange={e => setValue(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: '#0042AA' }}>{saving ? 'Saving…' : 'Add to CRM'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Clients() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [invoiceClientIds, setInvoiceClientIds] = useState(new Set())
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState(new Set(['active']))
  const [showModal, setShowModal] = useState(false)
  const [crmTarget, setCrmTarget] = useState(null)
  const [emailTarget, setEmailTarget] = useState(null) // { email, name }
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [clientsRes, invoicesRes] = await Promise.all([
      supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('invoices').select('client_id')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()),
    ])
    setClients(clientsRes.data || [])
    setInvoiceClientIds(new Set((invoicesRes.data || []).map(i => i.client_id)))
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  const daysSince = (date) => {
    if (!date) return Infinity
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  }

  const toggleFilter = (id) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (id === 'all') return new Set(['all'])
      next.delete('all')
      if (next.has(id)) {
        next.delete(id)
        if (next.size === 0) next.add('all')
      } else {
        next.add(id)
      }
      return next
    })
  }

  const matchesFilter = (c, filterId) => {
    const d = daysSince(c.last_contacted_at)
    switch (filterId) {
      case 'active':        return c.status === 'active'
      case 'prospect':      return c.status === 'prospect'
      case 'inactive':      return c.status === 'inactive'
      case 'billed_12mo':   return invoiceClientIds.has(c.id)
      case 'no_contact_30': return d >= 30
      case 'no_contact_60': return d >= 60
      case 'no_contact_90': return d >= 90
      case 'dormant':       return d >= 100
      case 'crm':           return !!c.crm_stage
      default:              return true
    }
  }

  const applyFilters = (c) => {
    if (activeFilters.has('all')) return true
    return [...activeFilters].some(fid => matchesFilter(c, fid))
  }

  const filtered = clients.filter(c =>
    applyFilters(c) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) ||
     (c.contact_name || '').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0A1628' }}>Clients</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} shown</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
          style={{ background: '#0042AA' }}>+ Add Client</button>
      </div>

      {/* Filter bar — multi-select */}
      <div className="flex gap-2 flex-wrap mb-4">
        {FILTERS.map(f => {
          const isOn = activeFilters.has(f.id)
          return (
            <button key={f.id} onClick={() => toggleFilter(f.id)} title={f.desc}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
              style={isOn
                ? { background: '#0042AA', color: 'white', borderColor: '#0042AA' }
                : { background: 'white', color: '#6B7280', borderColor: '#E5E7EB' }}>
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="mb-5">
        <input placeholder="Search by company or contact name…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm" />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading clients…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          {search ? 'No clients match your search.' : 'No clients match the selected filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => {
            const sc = STATUS_COLORS[client.status] || STATUS_COLORS.active
            const days = daysSince(client.last_contacted_at)
            const dormant = days >= 60 && client.status === 'active'
            return (
              <div key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="bg-white rounded-2xl p-5 shadow-sm border hover:shadow-md transition-all cursor-pointer"
                style={{ borderColor: dormant ? '#FCA5A5' : '#F3F4F6' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = dormant ? '#FCA5A5' : '#BFDBFE' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = dormant ? '#FCA5A5' : '#F3F4F6' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-base" style={{ color: '#0A1628' }}>{client.name}</h3>
                    {client.contact_name && <p className="text-sm text-gray-500">{client.contact_name}</p>}
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-2"
                    style={{ background: sc.bg, color: sc.text }}>{client.status}</span>
                </div>
                <div className="space-y-1 text-sm text-gray-500 mb-3">
                  {client.email && (
                    <p>✉️ <button
                      onClick={e => { e.stopPropagation(); setEmailTarget({ email: client.email, name: client.contact_name || client.name }) }}
                      className="hover:underline text-left"
                      style={{ color: '#0042AA' }}>
                      {client.email}
                    </button></p>
                  )}
                  {client.phone && <p>📞 {client.phone}</p>}
                  {client.industry && <p>🏢 {client.industry}</p>}
                </div>
                {dormant && (
                  <div className="mb-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#FEF2F2', color: '#EF4444' }}>
                    ⚠️ No contact in {days === Infinity ? '—' : days} days
                  </div>
                )}
                {client.crm_stage && (
                  <div className="mb-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#EEF2FF', color: '#6366F1' }}>
                    📊 CRM: {client.crm_stage}
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">
                    {client.billing_type}{client.hourly_rate ? ` · $${client.hourly_rate}/hr` : ''}
                  </span>
                  <div className="flex gap-1.5">
                    {!client.crm_stage && (
                      <button
                        onClick={e => { e.stopPropagation(); setCrmTarget(client) }}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:opacity-80"
                        style={{ background: '#EEF2FF', color: '#6366F1' }}>+ CRM</button>
                    )}
                    <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{ background: '#EFF6FF', color: '#0042AA' }}>View →</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && <AddClientModal onClose={() => setShowModal(false)} onSave={load} />}
      {crmTarget && <AddToCRMModal client={crmTarget} onClose={() => setCrmTarget(null)} onSave={load} />}
      {emailTarget && (
        <EmailComposeModal
          toEmail={emailTarget.email}
          toName={emailTarget.name}
          onClose={() => setEmailTarget(null)}
        />
      )}
    </div>
  )
}
