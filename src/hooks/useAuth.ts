import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../lib/firebase'
import { getAuthErrorMessage } from '../lib/authErrors'

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
      return false
    }
    setError(null)
    try {
      await createUserWithEmailAndPassword(auth, email, password)
      return true
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Sign up failed'))
      return false
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!auth) {
      setError('Firebase is not configured. Add your credentials to .env.local')
      return false
    }
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Sign in failed'))
      return false
    }
  }

  const resetPassword = async (email: string) => {
    if (!auth) {
      setError('Firebase is not configured. Add your credentials to .env.local')
      return false
    }
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email)
      return true
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Could not send reset email'))
      return false
    }
  }

  const logOut = async () => {
    if (!auth) return
    setError(null)
    try {
      await signOut(auth)
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Sign out failed'))
    }
  }

  return {
    user,
    loading,
    error,
    signUp,
    signIn,
    resetPassword,
    logOut,
    isConfigured: isFirebaseConfigured,
  }
}
