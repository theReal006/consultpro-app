import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)

      // When the user signs in with Google, persist the provider_token so it
      // survives page refreshes (Supabase drops it from the session after the first load).
      if (event === 'SIGNED_IN' && session?.provider_token && session?.user?.id) {
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
    })

    return () => subscription.unsubscribe()
  }, [])

  // Request calendar.readonly so the stored token can read Google Calendar.
  // access_type=offline + prompt=consent ensures a fresh token with full scopes every sign-in.
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'email profile https://www.googleapis.com/auth/calendar.readonly',
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
