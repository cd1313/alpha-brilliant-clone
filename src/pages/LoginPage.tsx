import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AsymptoteLogo } from '../components/auth/AsymptoteLogo'

type AuthMode = 'signin' | 'signup' | 'reset'

const VALUE_PROPS = [
  'Interactive lessons you learn by doing',
  'Adaptive Smart Review targets your weak spots',
  'Track your daily streak as you progress',
]

export function LoginPage() {
  const { user, signIn, signUp, signInWithGoogle, resetPassword, error, isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>('signin')
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

  const handleGoogleSignIn = async () => {
    setSubmitting(true)
    setResetSent(false)
    await signInWithGoogle()
    setSubmitting(false)
  }

  return (
    <div className="login-layout">
      <aside className="login-hero" aria-hidden="true">
        <svg className="login-hero-art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
          <path d="M-20 300 C 80 120, 160 120, 200 200 C 240 280, 320 280, 420 100" />
          <path d="M0 360 C 100 360, 140 60, 200 60 C 260 60, 300 360, 400 360" opacity="0.7" />
          <circle cx="200" cy="200" r="120" opacity="0.5" />
          <ellipse cx="200" cy="200" rx="170" ry="90" opacity="0.35" />
        </svg>

        <div className="login-hero-content">
          <div className="brand-lockup">
            <AsymptoteLogo className="brand-logo" />
            <span className="brand-wordmark">Asymptote</span>
          </div>
          <p className="login-hero-tagline">Learn precalculus by doing.</p>
          <ul className="login-valueprops">
            {VALUE_PROPS.map((prop) => (
              <li key={prop}>{prop}</li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="login-panel">
        <div className="page-card">
          <div className="brand-lockup brand-lockup-compact">
            <AsymptoteLogo className="brand-logo" />
            <span className="brand-wordmark">Asymptote</span>
          </div>
          <h1>
            {mode === 'signin' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'reset' && 'Reset your password'}
          </h1>
          <p className="subtitle">
            {mode === 'signin' && 'Sign in to continue your precalculus journey.'}
            {mode === 'signup' && 'Start learning precalculus by doing.'}
            {mode === 'reset' && "We'll email you a reset link."}
          </p>

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
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
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

        {mode !== 'reset' && (
          <>
            <div className="auth-divider">
              <span>or</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-google"
              onClick={handleGoogleSignIn}
              disabled={submitting || !isConfigured}
            >
              <svg className="google-icon" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9574C.3477 6.1731 0 7.5477 0 9s.3477 2.8269.9574 4.0418L3.964 10.71z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5813C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9574 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
                />
              </svg>
              Continue with Google
            </button>
          </>
        )}

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
      </main>
    </div>
  )
}
