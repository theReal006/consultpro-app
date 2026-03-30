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

// ─── Send invoice via SendGrid ────────────────────────────────────────────────
async function sendInvoiceEmail({ invoice, client, profile, settings }) {
  const token = (await supabase.auth.getSession()).data?.session?.access_token
  const clientEmail = client?.email
  if (!clientEmail) return { error: 'Client has no email address' }

  const invoiceDate = invoice.invoice_date
    ? new Date(invoice.invoice_date).toLocaleDateString()
    : new Date().toLocaleDateString()
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString()
    : 'upon receipt'

  const body = `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0A1628;">
      <div style="background: #0042AA; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">${profile?.business_name || 'ConsultPro'}</h1>
      </div>
      <div style="padding: 32px; background: #F8FAFC; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px;">Dear ${client?.name || 'Client'},</p>
        <p style="margin: 0 0 16px;">Please find your invoice details below.</p>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
          <tr style="background: #EFF6FF;">
            <td style="padding: 12px 16px; font-weight: bold;">Invoice #</td>
            <td style="padding: 12px 16px;">${invoice.invoice_number}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-weight: bold;">Amount Due</td>
            <td style="padding: 12px 16px; color: #0042AA; font-weight: bold; font-size: 18px;">$${Number(invoice.amount).toLocaleString()}</td>
          </tr>
          <tr style="background: #EFF6FF;">
            <td style="padding: 12px 16px; font-weight: bold;">Invoice Date</td>
            <td style="padding: 12px 16px;">${invoiceDate}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-weight: bold;">Due Date</td>
            <td style="padding: 12px 16px;">${dueDate}</td>
          </tr>
          ${invoice.notes ? `<tr style="background: #EFF6FF;"><td style="padding: 12px 16px; font-weight: bold;">Notes</td><td style="padding: 12px 16px;">${invoice.notes}</td></tr>` : ''}
        </table>
        <p style="margin: 0 0 8px; color: #6B7280; font-size: 14px;">Thank you for your business.</p>
        ${profile?.business_name ? `<p style="margin: 0; font-weight: bold;">${profile.business_name}</p>` : ''}
        ${profile?.phone ? `<p style="margin: 0; color: #6B7280; font-size: 14px;">${profile.phone}</p>` : ''}
        ${profile?.email ? `<p style="margin: 0; color: #6B7280; font-size: 14px;">${profile.email}</p>` : ''}
      </div>
    </div>
  `

  const res = await supabase.functions.invoke('send-invoice', {
    body: {
      to: clientEmail,
      to_name: client?.name,
      subject: `Invoice ${invoice.invoice_number} from ${profile?.business_name || 'ConsultPro'}`,
      body,
      from_email: settings?.from_email || undefined,
      from_name: settings?.from_name || profile?.business_name || undefined,
      invoice_number: invoice.invoice_number,
    },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  return res.data || res.error
}

// ─── Reminder settings panel ──────────────────────────────────────────────────
function ReminderSettings({ settings, onChange, onSave, saving }) {
  const toggles = [
    { key: 'send_on_create',      label: 'Email invoice when created/sent',     desc: 'Sends immediately when you click Send' },
    { key: 'reminder_30d',        label: '30-day overdue reminder',              desc: 'Auto-email client at 30 days past due' },
    { key: 'reminder_60d',        label: '60-day overdue reminder',              desc: 'Auto-email client at 60 days past due' },
    { key: 'reminder_90d',        label: '90-day overdue alert',                 desc: 'Notifies you at 90 days past due' },
    { key: 'retainer_auto_invoice', label: 'Auto-create retainer invoices (1st of month)', desc: 'Generates invoice for retainer clients monthly' },
  ]

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm" style={{ color: '#0A1628' }}>Email & Reminder Settings</h3>
        <button onClick={onSave} disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50"
          style={{ background: '#0042AA' }}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">From Email (SendGrid verified sender)</label>
          <input
            type="email"
            value={settings.from_email || ''}
            onChange={e => onChange({ ...settings, from_email: e.target.value })}
            placeholder="billing@yourcompany.com"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">From Name</label>
          <input
            type="text"
            value={settings.from_name || ''}
            onChange={e => onChange({ ...settings, from_name: e.target.value })}
            placeholder="Your Business Name"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        {toggles.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#0A1628' }}>{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <button
              onClick={() => onChange({ ...settings, [key]: !settings[key] })}
              className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-4"
              style={{ background: settings[key] ? '#0042AA' : '#D1D5DB' }}>
              <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ transform: settings[key] ? 'translateX(20px)' : 'translateX(2px)' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Invoice row ──────────────────────────────────────────────────────────────
function InvoiceRow({ invoice, clients, profile, settings, onStatusChange }) {
  const client = clients.find(c => c.id === invoice.client_id)
  const sc = STATUS_COLORS[invoice.status] || STATUS_COLORS.draft
  const overdueDays = daysOverdue(invoice.due_date)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  const downloadPDF = async () => {
    const doc = await generateInvoicePDF({ invoice, client, profile })
    doc.save(`${invoice.invoice_number}_${client?.name || 'Invoice'}.pdf`)
  }

  const markPaid = async () => {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoice.id)
    onStatusChange()
  }

  const handleSend = async () => {
    setSending(true)
    setSendResult(null)
    // Mark as sent in DB
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)

    // Send via SendGrid if enabled
    if (settings?.send_on_create && client?.email) {
      const result = await sendInvoiceEmail({ invoice, client, profile, settings })
      setSendResult(result?.success ? '✅ Sent' : result?.error ? `❌ ${result.error}` : '✅ Sent')
    } else if (!client?.email) {
      setSendResult('⚠️ No client email')
    } else {
      setSendResult('✅ Marked sent')
    }

    onStatusChange()
    setSending(false)
    setTimeout(() => setSendResult(null), 4000)
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
        <div className="flex items-center gap-2 flex-wrap">
          {sendResult && (
            <span className="text-xs font-semibold">{sendResult}</span>
          )}
          <button onClick={downloadPDF}
            className="text-xs px-2 py-1 rounded-lg font-semibold hover:opacity-80 transition-opacity"
            style={{ background: '#EFF6FF', color: '#3B82F6' }}>
            PDF
          </button>
          {invoice.status === 'draft' && (
            <button onClick={handleSend} disabled={sending}
              className="text-xs px-2 py-1 rounded-lg font-semibold hover:opacity-80 disabled:opacity-50"
              style={{ background: '#EEF2FF', color: '#6366F1' }}>
              {sending ? '…' : 'Send'}
            </button>
          )}
          {['sent', 'overdue'].includes(invoice.status) && (
            <button onClick={markPaid}
              className="text-xs px-2 py-1 rounded-lg font-semibold hover:opacity-80"
              style={{ background: '#ECFDF5', color: '#10B981' }}>
              Paid
            </button>
          )}
          {['sent', 'overdue'].includes(invoice.status) && client?.email && (
            <button onClick={handleSend} disabled={sending}
              className="text-xs px-2 py-1 rounded-lg font-semibold hover:opacity-80 disabled:opacity-50"
              style={{ background: '#FEF3C7', color: '#D97706' }}>
              {sending ? '…' : 'Resend'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Add invoice modal ────────────────────────────────────────────────────────
function AddInvoiceModal({ onClose, onSave, clients }) {
  const [form, setForm] = useState({
    client_id: '', invoice_number: `INV-${String(Date.now()).slice(-5)}`,
    amount: '', billing_type: 'hourly', due_date: '', status: 'draft', notes: '',
    tax_rate: 0,
  })
  const [hours, setHours] = useState('')
  const [rate, setRate] = useState('')
  const { user } = useAuth()

  useEffect(() => {
    if (form.billing_type === 'hourly' && hours && rate) {
      setForm(f => ({ ...f, amount: (parseFloat(hours) * parseFloat(rate)).toFixed(2) }))
    }
  }, [hours, rate, form.billing_type])

  // Auto-pull client's hourly rate
  useEffect(() => {
    if (form.client_id && form.billing_type === 'hourly') {
      const client = clients.find(c => c.id === form.client_id)
      if (client?.hourly_rate) setRate(String(client.hourly_rate))
    }
  }, [form.client_id, form.billing_type])

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

          {form.billing_type === 'hourly' && (
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
          )}

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
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
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

// ─── Main Billing page ────────────────────────────────────────────────────────
export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState({
    from_email: '', from_name: '',
    send_on_create: true, reminder_30d: true,
    reminder_60d: true, reminder_90d: true,
    retainer_auto_invoice: false,
  })
  const [showModal, setShowModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const { user } = useAuth()

  const load = async () => {
    const [invRes, cliRes, profRes, setRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, email, phone, address, contact_name, hourly_rate'),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('billing_settings').select('*').eq('user_id', user.id).single(),
    ])
    setInvoices(invRes.data || [])
    setClients(cliRes.data || [])
    setProfile(profRes.data)
    if (setRes.data) setSettings(setRes.data)
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  const saveSettings = async () => {
    setSavingSettings(true)
    const payload = { ...settings, user_id: user.id, updated_at: new Date().toISOString() }
    await supabase.from('billing_settings').upsert(payload, { onConflict: 'user_id' })
    setSavingSettings(false)
  }

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
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(s => !s)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm border border-gray-200 hover:bg-gray-50"
            style={{ color: '#6B7280' }}>
            ⚙ Settings
          </button>
          <button onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
            style={{ background: '#0042AA' }}>
            + New Invoice
          </button>
        </div>
      </div>

      {/* Reminder settings panel */}
      {showSettings && (
        <ReminderSettings
          settings={settings}
          onChange={setSettings}
          onSave={saveSettings}
          saving={savingSettings}
        />
      )}

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
          <div className="text-center py-16 text-gray-400">No invoices yet. Create your first one.</div>
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
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  clients={clients}
                  profile={profile}
                  settings={settings}
                  onStatusChange={load}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <AddInvoiceModal onClose={() => setShowModal(false)} onSave={load} clients={clients} />}
    </div>
  )
}
