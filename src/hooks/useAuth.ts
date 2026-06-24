import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth, isFirebaseConfigured } from '../lib/firebase'
import { getAuthErrorMessage } from '../lib/authErrors'

/** Popup sign-in codes that mean the user simply dismissed the flow — not real errors. */
const SILENT_AUTH_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
])

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(auth))
  const [error, setError] = useState<string | null>(null)
  const [, setReloadTick] = useState(0)

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
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await sendEmailVerification(credential.user)
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

  const signInWithGoogle = async () => {
    if (!auth) {
      setError('Firebase is not configured. Add your credentials to .env.local')
      return false
    }
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      return true
    } catch (err) {
      // Closing/cancelling the popup isn't a real failure — stay quiet.
      if (err instanceof FirebaseError && SILENT_AUTH_CODES.has(err.code)) {
        return false
      }
      setError(getAuthErrorMessage(err, 'Google sign-in failed'))
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

  const resendVerification = async () => {
    if (!auth?.currentUser) return false
    setError(null)
    try {
      await sendEmailVerification(auth.currentUser)
      return true
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Could not send verification email'))
      return false
    }
  }

  /** Refresh the signed-in user (e.g. after they verify in their inbox). Returns the new verified status. */
  const reloadUser = async (): Promise<boolean> => {
    if (!auth?.currentUser) return false
    await auth.currentUser.reload()
    setUser(auth.currentUser)
    setReloadTick((tick) => tick + 1)
    return auth.currentUser.emailVerified
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
    signInWithGoogle,
    resetPassword,
    resendVerification,
    reloadUser,
    logOut,
    isConfigured: isFirebaseConfigured,
  }
}
