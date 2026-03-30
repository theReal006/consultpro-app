import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STATUS_COLORS = {
  draft: { bg: '#F3F4F6', text: '#6B7280' },
  sent: { bg: '#EFF6FF', text: '#3B82F6' },
  paid: { bg: '#ECFDF5', text: '#10B981' },
  overdue: { bg: '#FEF2F2', text: '#EF4444' },
  void: { bg: '#F3F4F6', text: '#9CA3AF' },
}

function InvoiceRow({ invoice, clients }) {
  const client = clients.find(c => c.id === invoice.client_id)
  const sc = STATUS_COLORS[invoice.status] || STATUS_COLORS.draft
  const now = new Date()
  const due = invoice.due_date ? new Date(invoice.due_date) : null
  const daysOverdue = due && invoice.status !== 'paid' ? Math.floor((now - due) / 86400000) : null

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4 font-semibold text-sm" style={{ color: '#0A1628' }}>
        {invoice.invoice_number}
      </td>
      <td className="py-3 px-4 text-sm text-gray-600">{client?.name || '—'}</td>
      <td className="py-3 px-4 text-sm font-bold" style={{ color: '#0042AA' }}>
        ${Number(invoice.amount).toLocaleString()}
      </td>
      <td className="py-3 px-4">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.text }}>
          {invoice.status}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">
        {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
        {daysOverdue > 120 && (
          <span className="ml-2 text-xs font-bold" style={{ color: '#EF4444' }}>120D+</span>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-gray-400">{invoice.billing_type}</td>
    </tr>
  )
}

function AddInvoiceModal({ onClose, onSave, clients }) {
  const [form, setForm] = useState({
    client_id: '',
    invoice_number: `INV-${String(Date.now()).slice(-5)}`,
    amount: '',
    billing_type: 'hourly',
    due_date: '',
    status: 'draft',
    notes: '',
  })
  const { user } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('invoices').insert({
      ...form,
      user_id: user.id,
      amount: Number(form.amount),
    })
    if (!error) { onSave(); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4" style={{ color: '#0A1628' }}>New Invoice</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select value={form.client_id}
            onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="">Select client (optional)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Invoice number" value={form.invoice_number}
            onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input required type="number" placeholder="Amount ($)" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <select value={form.billing_type}
            onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="hourly">Hourly</option>
            <option value="flat">Flat fee</option>
            <option value="retainer">Retainer</option>
            <option value="adhoc">Ad-hoc</option>
          </select>
          <input type="date" placeholder="Due date" value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <select value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>
          <textarea placeholder="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm h-20 resize-none" />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#0042AA' }}>Create Invoice</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [invRes, cliRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name'),
    ])
    setInvoices(invRes.data || [])
    setClients(cliRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAR = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0)
  const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0A1628' }}>Billing</h1>
        <button onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
          style={{ background: '#0042AA' }}>
          + New Invoice
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-semibold mb-1">Open AR</p>
          <p className="text-xl font-bold" style={{ color: '#0042AA' }}>${openAR.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-semibold mb-1">Total Paid</p>
          <p className="text-xl font-bold" style={{ color: '#10B981' }}>${paid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-semibold mb-1">Total Invoices</p>
          <p className="text-xl font-bold" style={{ color: '#0A1628' }}>{invoices.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No invoices yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Invoice #</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Client</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Due</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Type</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <InvoiceRow key={inv.id} invoice={inv} clients={clients} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <AddInvoiceModal onClose={() => setShowModal(false)} onSave={load} clients={clients} />}
    </div>
  )
}
