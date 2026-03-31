import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const saveGoogleToken = async (session) => {
    if (!session?.user?.id) return
    // provider_token is only available immediately after OAuth redirect.
    // Supabase drops it from the session on any subsequent load, so we must
    // persist it to the DB the moment we first see it.
    const token = session.provider_token
    if (!token) return
    const expiresAt = session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : null
    await supabase.from('user_google_tokens').upsert(
      {
        user_id: session.user.id,
        access_token: token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  }

  useEffect(() => {
    // getSession() on mount will have provider_token if this is the page load
    // immediately after the OAuth redirect (before Supabase drops it).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      await saveGoogleToken(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      // Catch it here too in case the event fires before getSession resolves
      if (event === 'SIGNED_IN') {
        await saveGoogleToken(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Request calendar.readonly so the stored token can read Google Calendar.
  // access_type=offline + prompt=consent ensures a fresh token with full scopes every sign-in.
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // /auth/callback captures the provider_token immediately after redirect,
        // before Supabase drops it from the session on any subsequent load.
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })

  const signInWithEmail = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUpWithEmail = (email, password) =>
    supabase.auth.signUp({ email, password })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
