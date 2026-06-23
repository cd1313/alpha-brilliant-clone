import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(auth))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) {
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signUp = async (email: string, password: string) => {
    if (!auth) {
      setError('Firebase is not configured. Add your credentials to .env.local')
      return
    }
    setError(null)
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!auth) {
      setError('Firebase is not configured. Add your credentials to .env.local')
      return
    }
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    }
  }

  const logOut = async () => {
    if (!auth) return
    setError(null)
    try {
      await signOut(auth)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed')
    }
  }

  return {
    user,
    loading,
    error,
    signUp,
    signIn,
    logOut,
    isConfigured: isFirebaseConfigured,
  }
}
