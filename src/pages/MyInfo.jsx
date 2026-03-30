import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import QRCode from 'qrcode'

export default function MyInfo() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    full_name: '', business_name: '', email: '',
    phone: '', website: '', title: '',
    calendly_url: '', standard_rate: 150, premium_rate: 200,
    address_line1: '', address_line2: '', city: '', state: '', zip: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) setForm(f => ({ ...f, ...data }))
        setLoading(false)
      })
  }, [user])

  useEffect(() => {
    if (form.calendly_url) {
      QRCode.toDataURL(form.calendly_url, { width: 200 }).then(setQrUrl).catch(() => setQrUrl(''))
    } else {
      setQrUrl('')
    }
  }, [form.calendly_url])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').upsert({ ...form, id: user.id, updated_at: new Date().toISOString() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const embedSnippet = form.calendly_url
    ? `<div class="calendly-inline-widget" data-url="${form.calendly_url}" style="min-width:320px;height:630px;"></div>\n<script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>`
    : ''

  if (loading) return <div className="text-center py-16 text-gray-400">Loading profile...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0A1628' }}>My Info</h1>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — main form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-base mb-4" style={{ color: '#0A1628' }}>Business Profile</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Full Name</label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Business Name</label>
                <input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Website</label>
                <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-base mb-4" style={{ color: '#0A1628' }}>Address</h2>
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Address line 1" value={form.address_line1}
                onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))}
                className="col-span-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              <input placeholder="Address line 2" value={form.address_line2}
                onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))}
                className="col-span-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              <input placeholder="City" value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              <div className="flex gap-2">
                <input placeholder="State" value={form.state}
                  onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                <input placeholder="ZIP" value={form.zip}
                  onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                  className="w-24 px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-base mb-4" style={{ color: '#0A1628' }}>Billing Rates</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Standard Rate ($/hr)</label>
                <input type="number" value={form.standard_rate}
                  onChange={e => setForm(f => ({ ...f, standard_rate: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Premium Rate ($/hr)</label>
                <input type="number" value={form.premium_rate}
                  onChange={e => setForm(f => ({ ...f, premium_rate: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl text-white font-semibold transition-opacity disabled:opacity-60"
            style={{ background: '#0042AA' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Profile'}
          </button>
        </div>

        {/* Right — Calendly */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-base mb-4" style={{ color: '#0A1628' }}>Calendly</h2>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Calendly URL</label>
            <input value={form.calendly_url}
              onChange={e => setForm(f => ({ ...f, calendly_url: e.target.value }))}
              placeholder="https://calendly.com/yourname"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm mb-4" />

            {form.calendly_url && (
              <>
                {/* Copy link */}
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Share link</p>
                  <div className="flex gap-2">
                    <input readOnly value={form.calendly_url}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50" />
                    <button type="button"
                      onClick={() => navigator.clipboard.writeText(form.calendly_url)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{ background: '#0042AA' }}>
                      Copy
                    </button>
                  </div>
                </div>

                {/* QR code */}
                {qrUrl && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">QR Code</p>
                    <img src={qrUrl} alt="Calendly QR" className="w-32 h-32 rounded-xl border border-gray-200" />
                    <a href={qrUrl} download="calendly-qr.png"
                      className="block mt-1 text-xs font-semibold"
                      style={{ color: '#0042AA' }}>
                      Download QR
                    </a>
                  </div>
                )}

                {/* Embed snippet */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Embed snippet</p>
                  <textarea readOnly value={embedSnippet}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 font-mono h-24 resize-none" />
                  <button type="button"
                    onClick={() => navigator.clipboard.writeText(embedSnippet)}
                    className="mt-1 text-xs font-semibold"
                    style={{ color: '#0042AA' }}>
                    Copy snippet
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
