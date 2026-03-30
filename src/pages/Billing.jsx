import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateInvoicePDF } from '../lib/generateInvoicePDF'

const STATUS_COLORS = {
  draft:   { bg: '#F3F4F6', text: '#6B7280' },
  sent:    { bg: '#EFF6FF', text: '#3B82F6' },
  paid:    { bg: '#ECFDF5', text: '#10B981' },
  overdue: { bg: '#FEF2F2', text: '#EF4444' },
  void:    { bg: '#F3F4F6', text: '#9CA3AF' },
}

function daysOverdue(dueDate) {
  if (!dueDate) return null
  const diff = (new Date() - new Date(dueDate)) / 86400000
  return diff > 0 ? Math.floor(diff) : null
}

function InvoiceRow({ invoice, clients, profile, onStatusChange }) {
  const client = clients.find(c => c.id === invoice.client_id)
  const sc = STATUS_COLORS[invoice.status] || STATUS_COLORS.draft
  const overdueDays = daysOverdue(invoice.due_date)

  const downloadPDF = async () => {
    const doc = await generateInvoicePDF({ invoice, client, profile })
    doc.save(`${invoice.invoice_number}_${client?.name || 'Invoice'}.pdf`)
  }

  const markPaid = async () => {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoice.id)
    onStatusChange()
  }

  const sendInvoice = async () => {
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
    onStatusChange()
  }

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
        {overdueDays >= 120 && (
          <span className="ml-1.5 text-xs font-bold" style={{ color: '#EF4444' }}>120D+</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">
        {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
        {overdueDays > 0 && invoice.status !== 'paid' && (
          <span className="ml-1 text-xs" style={{ color: overdueDays >= 120 ? '#EF4444' : '#F59E0B' }}>
            ({overdueDays}d)
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-gray-400">{invoice.billing_type}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <button onClick={downloadPDF}
            className="text-xs px-2 py-1 rounded-lg font-semibold hover:opacity-80 transition-opacity"
            style={{ background: '#EFF6FF', color: '#3B82F6' }}>
            PDF
          </button>
          {invoice.status === 'draft' && (
            <button onClick={sendInvoice}
              className="text-xs px-2 py-1 rounded-lg font-semibold hover:opacity-80"
              style={{ background: '#EEF2FF', color: '#6366F1' }}>
              Send
            </button>
          )}
          {['sent', 'overdue'].includes(invoice.status) && (
            <button onClick={markPaid}
              className="text-xs px-2 py-1 rounded-lg font-semibold hover:opacity-80"
              style={{ background: '#ECFDF5', color: '#10B981' }}>
              Paid
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function AddInvoiceModal({ onClose, onSave, clients }) {
  const [form, setForm] = useState({
    client_id: '', invoice_number: `INV-${String(Date.now()).slice(-5)}`,
    amount: '', billing_type: 'hourly', due_date: '', status: 'draft', notes: '',
    tax_rate: 0,
  })
  const [hours, setHours] = useState('')
  const [rate, setRate] = useState('')
  const { user } = useAuth()

  // Auto-calc amount for hourly
  useEffect(() => {
    if (form.billing_type === 'hourly' && hours && rate) {
      setForm(f => ({ ...f, amount: (parseFloat(hours) * parseFloat(rate)).toFixed(2) }))
    }
  }, [hours, rate, form.billing_type])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('invoices').insert({ ...form, user_id: user.id, amount: Number(form.amount) })
    if (!error) { onSave(); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4" style={{ color: '#0A1628' }}>New Invoice</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="">Select client (optional)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Invoice number" value={form.invoice_number}
            onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <select value={form.billing_type} onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="hourly">Hourly</option>
            <option value="flat">Flat fee</option>
            <option value="retainer">Retainer</option>
            <option value="adhoc">Ad-hoc</option>
          </select>

          {form.billing_type === 'hourly' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Hours</label>
                <input type="number" placeholder="0.0" value={hours} onChange={e => setHours(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Rate ($/hr)</label>
                <input type="number" placeholder="0.00" value={rate} onChange={e => setRate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Amount ($)</label>
            <input required type="number" placeholder="0.00" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Due date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Tax rate (%)</label>
              <input type="number" placeholder="0" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
          </div>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option>
          </select>
          <textarea placeholder="Description / notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm h-20 resize-none" />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
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
  const [profile, setProfile] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const load = async () => {
    const [invRes, cliRes, profRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, email, phone, address, contact_name'),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])
    setInvoices(invRes.data || [])
    setClients(cliRes.data || [])
    setProfile(profRes.data)
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  const openAR = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0)
  const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)
  const overdue120 = invoices.filter(i => {
    const d = daysOverdue(i.due_date)
    return d >= 120 && i.status !== 'paid'
  }).reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0A1628' }}>Billing</h1>
        <button onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
          style={{ background: '#0042AA' }}>+ New Invoice</button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open AR', value: `$${openAR.toLocaleString()}`, color: '#0042AA' },
          { label: 'Collected', value: `$${paid.toLocaleString()}`, color: '#10B981' },
          { label: 'Open Invoices', value: invoices.filter(i => ['draft','sent','overdue'].includes(i.status)).length, color: '#F59E0B' },
          { label: '120D+ Overdue', value: `$${overdue120.toLocaleString()}`, color: '#EF4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No invoices yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Invoice #', 'Client', 'Amount', 'Status', 'Due', 'Type', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <InvoiceRow key={inv.id} invoice={inv} clients={clients} profile={profile} onStatusChange={load} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <AddInvoiceModal onClose={() => setShowModal(false)} onSave={load} clients={clients} />}
    </div>
  )
}
