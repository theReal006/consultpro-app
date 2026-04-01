import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Reusable email compose modal — sends via SendGrid through the send-invoice edge function.
 *
 * Props:
 *   toEmail    – recipient email address (pre-filled, editable)
 *   toName     – recipient display name (pre-filled, editable)
 *   subject    – optional default subject line
 *   onClose    – called when modal is dismissed
 *   onSent     – optional callback after successful send
 */
export default function EmailComposeModal({ toEmail, toName, subject: defaultSubject = '', onClose, onSent }) {
  const { user } = useAuth()
  const [to, setTo] = useState(toEmail || '')
  const [name, setName] = useState(toName || '')
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(null)

  const send = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setErr('To, Subject, and Message are all required.')
      return
    }
    setSending(true); setErr(null)

    // Convert plain-text body to simple HTML (preserve line breaks)
    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
          ${body.split('\n').map(line => line.trim() ? `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6">${line}</p>` : '<br/>').join('')}
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px">Sent via ConsultPro</p>
      </div>`

    const { error } = await supabase.functions.invoke('send-invoice', {
      body: {
        to: to.trim(),
        to_name: name.trim() || to.trim(),
        subject: subject.trim(),
        body: htmlBody,
        from_name: 'ConsultPro',
      },
    })

    if (error) {
      setErr('Send failed: ' + (error.message || 'Unknown error'))
      setSending(false)
      return
    }

    setSending(false)
    setSent(true)
    if (onSent) onSent()
    setTimeout(onClose, 1200)
  }

  const cls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300 bg-white'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold" style={{ color: '#0A1628' }}>✉️ New Email</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {sent ? (
          <div className="px-6 py-16 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-base font-semibold" style={{ color: '#0A1628' }}>Email sent!</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-3">
            {err && (
              <div className="text-xs text-red-600 px-3 py-2 rounded-lg bg-red-50 border border-red-100">{err}</div>
            )}

            {/* To */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">To</span>
              <div className="flex-1 flex gap-2">
                <input
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  placeholder="Email address *"
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300"
                />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Name"
                  className="w-36 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300"
                />
              </div>
            </div>

            {/* Subject */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">Subject</span>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject line *"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300"
              />
            </div>

            {/* Body */}
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={9}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300 resize-none"
            />

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#0042AA' }}>
                {sending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </>
                ) : '📤 Send Email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
