import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { user, signIn, signUp, error, isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    if (mode === 'signin') {
      await signIn(email, password)
    } else {
      await signUp(email, password)
    }
    setSubmitting(false)
  }

  return (
    <div className="page login-page">
      <div className="page-card">
        <h1>Alpha Brilliant</h1>
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

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting || !isConfigured}>
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <button
          type="button"
          className="btn btn-link"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
