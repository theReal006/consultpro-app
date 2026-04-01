import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const FREQ_LABELS = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' }

function nextDueDate(frequency, from = new Date()) {
  const d = new Date(from)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3)
  return d.toISOString().split('T')[0]
}

// ── Hours sub-tab ──────────────────────────────────────────────────────────────
function HoursTab({ clientId, client }) {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ entry_date: new Date().toISOString().split('T')[0], hours: '', rate: client?.hourly_rate || '', description: '', project_name: '' })
  const [saving, setSaving] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1'

  const load = async () => {
    const { data } = await supabase.from('time_entries')
      .select('*').eq('client_id', clientId).order('entry_date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  useEffect(() => { if (user && clientId) load() }, [user, clientId])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('time_entries').insert({
      user_id: user.id,
      client_id: clientId,
      entry_date: form.entry_date,
      hours: parseFloat(form.hours),
      rate: parseFloat(form.rate) || null,
      description: form.description,
      project_name: form.project_name,
      billed: false,
    })
    setForm({ entry_date: new Date().toISOString().split('T')[0], hours: '', rate: client?.hourly_rate || '', description: '', project_name: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const deleteEntry = async (id) => {
    await supabase.from('time_entries').delete().eq('id', id)
    load()
  }

  const toggleBilled = async (id, billed) => {
    await supabase.from('time_entries').update({ billed: !billed }).eq('id', id)
    load()
  }

  const createInvoiceFromHours = async () => {
    const unbilled = entries.filter(e => !e.billed)
    if (unbilled.length === 0) { alert('No unbilled hours to invoice.'); return }
    setCreatingInvoice(true)

    const totalAmount = unbilled.reduce((sum, e) => sum + (parseFloat(e.hours) * parseFloat(e.rate || 0)), 0)
    const lineItems = unbilled.map(e =>
      `${e.entry_date}: ${e.hours}h × $${e.rate || 0}/hr${e.description ? ` — ${e.description}` : ''}`
    ).join('\n')

    // Get next invoice number
    const { data: existing } = await supabase.from('invoices').select('invoice_number').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    const lastNum = existing?.[0]?.invoice_number ? parseInt(existing[0].invoice_number.replace(/\D/g, '')) || 0 : 0
    const invoiceNumber = `INV-${String(lastNum + 1).padStart(4, '0')}`

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const { data: invoice } = await supabase.from('invoices').insert({
      user_id: user.id,
      client_id: clientId,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      amount: totalAmount,
      status: 'draft',
      billing_type: 'hourly',
      notes: `Billable hours:\n${lineItems}`,
    }).select().single()

    if (invoice) {
      // Mark entries as billed
      await supabase.from('time_entries').update({ billed: true, invoice_id: invoice.id })
        .in('id', unbilled.map(e => e.id))
    }
    setCreatingInvoice(false)
    load()
    alert(`Invoice ${invoiceNumber} created as a draft in Billing. Total: $${totalAmount.toFixed(2)}`)
  }

  const unbilledTotal = entries.filter(e => !e.billed).reduce((s, e) => s + parseFloat(e.hours) * parseFloat(e.rate || 0), 0)
  const unbilledHours = entries.filter(e => !e.billed).reduce((s, e) => s + parseFloat(e.hours), 0)

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>

  return (
    <div>
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Unbilled Hours', value: `${unbilledHours.toFixed(1)}h` },
          { label: 'Unbilled Amount', value: `$${unbilledTotal.toFixed(2)}` },
          { label: 'Total Entries', value: entries.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-semibold text-gray-400">{label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: '#0042AA' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">Log time and create invoices from billable hours.</span>
        <div className="flex gap-2">
          {entries.some(e => !e.billed) && (
            <button onClick={createInvoiceFromHours} disabled={creatingInvoice}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50"
              style={{ background: '#10B981' }}>
              {creatingInvoice ? 'Creating…' : '⚡ Create Invoice'}
            </button>
          )}
          <button onClick={() => setShowForm(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
            style={{ background: '#0042AA' }}>
            + Log Hours
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <h4 className="font-bold text-sm mb-3" style={{ color: '#0A1628' }}>Log Hours</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" required value={form.entry_date} onChange={set('entry_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hours *</label>
              <input type="number" required min="0.1" step="0.25" value={form.hours} onChange={set('hours')} placeholder="e.g. 2.5" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Rate ($/hr)</label>
              <input type="number" min="0" step="0.01" value={form.rate} onChange={set('rate')} placeholder="e.g. 150" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Project</label>
              <input value={form.project_name} onChange={set('project_name')} placeholder="Optional" className={inputCls} />
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Description</label>
            <input value={form.description} onChange={set('description')} placeholder="What did you work on?" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: '#0042AA' }}>{saving ? 'Saving…' : 'Log Hours'}</button>
          </div>
        </form>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
          <p className="text-2xl mb-2">⏱</p>
          <p className="font-semibold">No hours logged yet</p>
          <p className="text-sm mt-1">Click "Log Hours" to start tracking billable time.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Description', 'Hours', 'Rate', 'Amount', 'Status', ''].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-bold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const amount = parseFloat(e.hours) * parseFloat(e.rate || 0)
                return (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(e.entry_date).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="text-sm text-gray-800">{e.description || '—'}</p>
                      {e.project_name && <p className="text-xs text-gray-400">{e.project_name}</p>}
                    </td>
                    <td className="py-2.5 px-3 text-sm font-semibold text-gray-700">{e.hours}h</td>
                    <td className="py-2.5 px-3 text-sm text-gray-500">{e.rate ? `$${e.rate}` : '—'}</td>
                    <td className="py-2.5 px-3 text-sm font-semibold" style={{ color: '#0042AA' }}>
                      {e.rate ? `$${amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <button onClick={() => toggleBilled(e.id, e.billed)}
                        className="text-xs font-semibold px-2 py-0.5 rounded-full hover:opacity-80"
                        style={e.billed ? { background: '#ECFDF5', color: '#10B981' } : { background: '#FEF3C7', color: '#D97706' }}>
                        {e.billed ? '✓ Billed' : 'Unbilled'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <button onClick={() => deleteEntry(e.id)} className="text-gray-300 hover:text-red-400 text-base">×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Recurring sub-tab ──────────────────────────────────────────────────────────
function RecurringTab({ clientId }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState({ title: '', amount: '', tax_rate: '', frequency: 'monthly', next_due_date: nextDueDate('monthly'), auto_send: false, notes: '' })
  const [saving, setSaving] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }))
  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300'
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1'

  const load = async () => {
    const { data } = await supabase.from('recurring_invoices').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { if (user && clientId) load() }, [user, clientId])

  const openNew = () => {
    setForm({ title: '', amount: '', tax_rate: '', frequency: 'monthly', next_due_date: nextDueDate('monthly'), auto_send: false, notes: '' })
    setEditingItem(null)
    setShowForm(true)
  }

  const openEdit = (item) => {
    setForm({ title: item.title, amount: item.amount, tax_rate: item.tax_rate || '', frequency: item.frequency, next_due_date: item.next_due_date, auto_send: item.auto_send, notes: item.notes || '' })
    setEditingItem(item)
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      title: form.title,
      amount: parseFloat(form.amount),
      tax_rate: parseFloat(form.tax_rate) || 0,
      frequency: form.frequency,
      next_due_date: form.next_due_date,
      auto_send: form.auto_send,
      notes: form.notes,
      user_id: user.id,
      client_id: clientId,
      active: true,
      updated_at: new Date().toISOString(),
    }
    if (editingItem?.id) {
      await supabase.from('recurring_invoices').update(payload).eq('id', editingItem.id)
    } else {
      await supabase.from('recurring_invoices').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    setEditingItem(null)
    load()
  }

  const toggleActive = async (id, active) => {
    await supabase.from('recurring_invoices').update({ active: !active }).eq('id', id)
    load()
  }

  const deleteItem = async (id) => {
    if (!confirm('Delete this recurring invoice?')) return
    await supabase.from('recurring_invoices').delete().eq('id', id)
    load()
  }

  const generateNow = async (item) => {
    // Create a draft invoice from recurring config
    const { data: existing } = await supabase.from('invoices').select('invoice_number').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
    const lastNum = existing?.[0]?.invoice_number ? parseInt(existing[0].invoice_number.replace(/\D/g, '')) || 0 : 0
    const invoiceNumber = `INV-${String(lastNum + 1).padStart(4, '0')}`
    const tax = (item.amount * (item.tax_rate || 0)) / 100
    const dueDate = new Date(item.next_due_date)
    dueDate.setDate(dueDate.getDate() + 30)

    await supabase.from('invoices').insert({
      user_id: user.id,
      client_id: clientId,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      amount: item.amount + tax,
      tax_rate: item.tax_rate || 0,
      status: 'draft',
      billing_type: 'recurring',
      notes: item.notes || `Recurring: ${item.title}`,
    })

    // Advance next_due_date
    await supabase.from('recurring_invoices').update({
      next_due_date: nextDueDate(item.frequency, new Date(item.next_due_date)),
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)

    load()
    alert(`Draft invoice ${invoiceNumber} created! Go to Billing to review and send.`)
  }

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Set up recurring invoices. They generate as drafts on schedule.</p>
        {!showForm && (
          <button onClick={openNew}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
            style={{ background: '#0042AA' }}>
            + New Recurring Invoice
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <h4 className="font-bold text-sm mb-4" style={{ color: '#0A1628' }}>
            {editingItem ? 'Edit Recurring Invoice' : 'New Recurring Invoice'}
          </h4>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Title *</label>
              <input required value={form.title} onChange={set('title')} placeholder="e.g. Monthly Retainer" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Amount ($) *</label>
                <input required type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tax Rate (%)</label>
                <input type="number" min="0" max="100" step="0.1" value={form.tax_rate} onChange={set('tax_rate')} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Frequency</label>
                <select value={form.frequency} onChange={e => {
                  const freq = e.target.value
                  setForm(f => ({ ...f, frequency: freq, next_due_date: nextDueDate(freq) }))
                }} className={inputCls}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>First Due Date</label>
                <input type="date" required value={form.next_due_date} onChange={set('next_due_date')} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input value={form.notes} onChange={set('notes')} placeholder="Optional description" className={inputCls} />
            </div>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50">
              <input type="checkbox" checked={form.auto_send} onChange={setCheck('auto_send')} className="w-4 h-4 rounded" style={{ accentColor: '#0042AA' }} />
              <div>
                <p className="text-sm font-semibold text-gray-700">Auto-send to client</p>
                <p className="text-xs text-gray-400">When enabled, invoice will be emailed automatically on due date instead of waiting as a draft.</p>
              </div>
            </label>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={() => { setShowForm(false); setEditingItem(null) }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: '#0042AA' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      {items.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
          <p className="text-2xl mb-2">🔄</p>
          <p className="font-semibold">No recurring invoices yet</p>
          <p className="text-sm mt-1">Set up automatic invoices for retainer clients.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const tax = (item.amount * (item.tax_rate || 0)) / 100
            const total = item.amount + tax
            return (
              <div key={item.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm" style={{ color: '#0A1628' }}>{item.title}</h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={item.active ? { background: '#ECFDF5', color: '#10B981' } : { background: '#F3F4F6', color: '#9CA3AF' }}>
                        {item.active ? '● Active' : '○ Paused'}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                        {FREQ_LABELS[item.frequency]}
                      </span>
                      {item.auto_send && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: '#FDF4FF', color: '#9333EA' }}>Auto-send</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="text-base font-bold" style={{ color: '#0042AA' }}>${total.toFixed(2)}</span>
                      {item.tax_rate > 0 && <span>(incl. {item.tax_rate}% tax)</span>}
                      <span>· Next: {new Date(item.next_due_date).toLocaleDateString()}</span>
                    </div>
                    {item.notes && <p className="text-xs text-gray-400 mt-1">{item.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-wrap justify-end">
                    <button onClick={() => generateNow(item)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-80"
                      style={{ background: '#EFF6FF', color: '#0042AA' }}>
                      ⚡ Generate Now
                    </button>
                    <button onClick={() => openEdit(item)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-80"
                      style={{ background: '#F3F4F6', color: '#374151' }}>
                      Edit
                    </button>
                    <button onClick={() => toggleActive(item.id, item.active)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-80"
                      style={item.active ? { background: '#FFFBEB', color: '#D97706' } : { background: '#ECFDF5', color: '#10B981' }}>
                      {item.active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-400 text-base">×</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main BillingTab ────────────────────────────────────────────────────────────
export default function BillingTab({ clientId, client }) {
  const [sub, setSub] = useState('hours')

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
        {[{ id: 'hours', label: '⏱ Billable Hours' }, { id: 'recurring', label: '🔄 Recurring Invoices' }].map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={sub === t.id ? { background: '#0042AA', color: 'white' } : { color: '#6B7280' }}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'hours' && <HoursTab clientId={clientId} client={client} />}
      {sub === 'recurring' && <RecurringTab clientId={clientId} />}
    </div>
  )
}
