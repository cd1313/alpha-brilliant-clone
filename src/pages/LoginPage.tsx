import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

type AuthMode = 'signin' | 'signup' | 'reset'

export function LoginPage() {
  const { user, signIn, signUp, resetPassword, error, isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>('signin')
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setResetSent(false)

    if (mode === 'reset') {
      const ok = await resetPassword(email)
      if (ok) setResetSent(true)
    } else if (mode === 'signin') {
      await signIn(email, password)
    } else {
      await signUp(email, password)
    }

    setSubmitting(false)
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setResetSent(false)
  }

  return (
    <div className="page login-page">
      <div className="page-card">
        <h1>Asymptote</h1>
        <p className="subtitle">Learn precalculus by doing</p>

        {!isConfigured && (
          <p className="error-banner">
            Firebase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your credentials.
          </p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          {mode !== 'reset' && (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </label>
          )}

          {resetSent && (
            <p className="success-text">Check your email for a password reset link.</p>
          )}

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting || !isConfigured}>
            {mode === 'signin' && 'Sign In'}
            {mode === 'signup' && 'Sign Up'}
            {mode === 'reset' && 'Send Reset Link'}
          </button>
        </form>

        {mode === 'signin' && (
          <>
            <button type="button" className="btn btn-link" onClick={() => switchMode('signup')}>
              Need an account? Sign up
            </button>
            <button type="button" className="btn btn-link" onClick={() => switchMode('reset')}>
              Forgot password?
            </button>
          </>
        )}

        {mode === 'signup' && (
          <button type="button" className="btn btn-link" onClick={() => switchMode('signin')}>
            Already have an account? Sign in
          </button>
        )}

        {mode === 'reset' && (
          <button type="button" className="btn btn-link" onClick={() => switchMode('signin')}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
