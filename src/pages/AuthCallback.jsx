import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Landing page after Google OAuth redirect.
 * At this exact moment the Supabase client has provider_token in the session
 * (PKCE exchange just happened). We save it to user_google_tokens before
 * Supabase drops it, then send the user to the calendar.
 */
export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const run = async () => {
      // getSession() here triggers the PKCE code exchange if needed and returns
      // the full session including provider_token from Google.
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.provider_token && session?.user?.id) {
        const expiresAt = session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null
        await supabase.from('user_google_tokens').upsert(
          {
            user_id: session.user.id,
            access_token: session.provider_token,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      }

      // Go to calendar so they immediately see the result
      navigate('/calendar', { replace: true })
    }

    run()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F8' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse" style={{ background: '#0042AA' }}>
          <span className="text-white font-bold text-lg">C</span>
        </div>
        <p className="text-sm font-semibold" style={{ color: '#9CA3AF' }}>Connecting Google Calendar…</p>
      </div>
    </div>
  )
}
