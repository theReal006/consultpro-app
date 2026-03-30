import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STATUS_COLORS = {
  active: { bg: '#ECFDF5', text: '#10B981' },
  inactive: { bg: '#F3F4F6', text: '#6B7280' },
  prospect: { bg: '#EEF2FF', text: '#6366F1' },
}

function AddClientModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', contact_name: '', email: '', phone: '',
    industry: '', billing_type: 'hourly', hourly_rate: '',
    status: 'active', notes: '',
  })
  const { user } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('clients').insert({
      ...form,
      user_id: user.id,
      hourly_rate: form.hourly_rate || null,
    })
    if (!error) { onSave(); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
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
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
              <option value="hourly">Hourly</option>
              <option value="flat">Flat fee</option>
              <option value="retainer">Retainer</option>
            </select>
            <input type="number" placeholder="Hourly rate ($)" value={form.hourly_rate}
              onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <select value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="prospect">Prospect</option>
            </select>
          </div>
          <textarea placeholder="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm h-20 resize-none" />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#0042AA' }}>
              Add Client
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0A1628' }}>Clients</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
          style={{ background: '#0042AA' }}
        >
          + Add Client
        </button>
      </div>

      <div className="mb-4">
        <input
          placeholder="Search by company or contact name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading clients...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {search ? 'No clients match your search.' : 'No clients yet. Add your first client to get started.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => {
            const sc = STATUS_COLORS[client.status] || STATUS_COLORS.active
            return (
              <div key={client.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-base" style={{ color: '#0A1628' }}>{client.name}</h3>
                    {client.contact_name && (
                      <p className="text-sm text-gray-500">{client.contact_name}</p>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.text }}>
                    {client.status}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-gray-500 mb-4">
                  {client.email && <p>✉️ {client.email}</p>}
                  {client.phone && <p>📞 {client.phone}</p>}
                  {client.industry && <p>🏢 {client.industry}</p>}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">
                    {client.billing_type}
                    {client.hourly_rate ? ` · $${client.hourly_rate}/hr` : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <AddClientModal onClose={() => setShowModal(false)} onSave={load} />
      )}
    </div>
  )
}
