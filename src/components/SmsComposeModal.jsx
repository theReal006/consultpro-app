import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * SMS compose modal — sends via Textbelt API (send-sms edge fn).
 *
 * Props:
 *   toPhone  – recipient phone number (pre-filled, editable)
 *   toName   – recipient display name
 *   onClose  – called when modal is dismissed
 *   onSent   – optional callback after successful send
 */
export default function SmsComposeModal({ toPhone, toName, onClose, onSent }) {
  const [to, setTo] = useState(toPhone || '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(null)

  const send = async () => {
    if (!to.trim() || !message.trim()) {
      setErr('Phone number and message are required.')
      return
    }
    setSending(true); setErr(null)

    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: { to: to.trim(), message: message.trim() },
    })

    if (error || !data?.success) {
      setErr(data?.error || error?.message || 'Failed to send. Check TEXTBELT_KEY in Supabase secrets.')
      setSending(false)
      return
    }

    setSending(false)
    setSent(true)
    if (onSent) onSent()
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#0A1628' }}>
              <span style={{ color: '#0042AA' }}>💬</span>
              Text Message
            </h2>
            {toName && <p className="text-xs text-gray-400 mt-0.5">To: {toName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {sent ? (
          <div className="px-6 py-16 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-base font-semibold" style={{ color: '#0A1628' }}>Message sent!</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-3">
            {err && (
              <div className="text-xs text-red-600 px-3 py-2 rounded-lg bg-red-50 border border-red-100">{err}</div>
            )}

            {/* To */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-400 w-12 flex-shrink-0">To</span>
              <input
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="Phone number *"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-300"
              />
            </div>

            {/* Message */}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your message…"
              rows={7}
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
                disabled={sending || !to.trim() || !message.trim()}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#0042AA' }}>
                {sending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    💬 Send Text
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
