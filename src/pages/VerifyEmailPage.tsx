import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function VerifyEmailPage() {
  const { user, loading, resendVerification, reloadUser, logOut, error } = useAuth()
  const [sent, setSent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [stillUnverified, setStillUnverified] = useState(false)

  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.emailVerified) {
    return <Navigate to="/" replace />
  }

  const handleResend = async () => {
    setStillUnverified(false)
    const ok = await resendVerification()
    if (ok) setSent(true)
  }

  const handleRefresh = async () => {
    setSent(false)
    setChecking(true)
    const verified = await reloadUser()
    setChecking(false)
    // When verified, the redirect above takes over on re-render.
    if (!verified) setStillUnverified(true)
  }

  return (
    <div className="page login-page">
      <div className="page-card">
        <h1>Verify your email</h1>
        <p className="subtitle">
          We sent a verification link to <strong>{user.email}</strong>. Open it, then come back
          and continue.
        </p>
        <p className="hint-text">
          Don't see it? Check your spam or junk folder — it sometimes ends up there.
        </p>

        {error && <p className="error-text">{error}</p>}
        {sent && <p className="success-text">Verification email sent. Check your inbox.</p>}
        {stillUnverified && (
          <p className="error-text">
            Not verified yet. Check your inbox and spam folder, then try again.
          </p>
        )}

        <div className="auth-form">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRefresh}
            disabled={checking}
          >
            {checking ? 'Checking…' : "I've verified — continue"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleResend}>
            Resend verification email
          </button>
          <button type="button" className="btn btn-link" onClick={() => void logOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
