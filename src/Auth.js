import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('sign_in') // 'sign_in' | 'sign_up' | 'magic_link'
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null) // { type: 'error' | 'success', text }

  const resetMessage = () => setMessage(null)

  const handleSignIn = async (e) => {
    e.preventDefault()
    resetMessage()
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (error) {
      setMessage({ type: 'error', text: error.error_description || error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    resetMessage()
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.PUBLIC_URL,
        },
      })
      if (error) throw error
      if (data?.user && !data.user.confirmed_at && !data.session) {
        setMessage({
          type: 'success',
          text: 'Account created! Check your email to confirm your address before signing in.',
        })
      } else {
        setMessage({ type: 'success', text: 'Account created! You are now signed in.' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.error_description || error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    resetMessage()
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: process.env.PUBLIC_URL,
        },
      })
      if (error) throw error
      setMessage({ type: 'success', text: 'Check your email for the login link!' })
    } catch (error) {
      setMessage({ type: 'error', text: error.error_description || error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    resetMessage()
    if (!email) {
      setMessage({ type: 'error', text: 'Enter your email above first, then click "Forgot password?".' })
      return
    }
    try {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: process.env.PUBLIC_URL,
      })
      if (error) throw error
      setMessage({ type: 'success', text: 'Password reset email sent!' })
    } catch (error) {
      setMessage({ type: 'error', text: error.error_description || error.message })
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    resetMessage()
  }

  const submitHandlers = {
    sign_in: handleSignIn,
    sign_up: handleSignUp,
    magic_link: handleMagicLink,
  }

  return (
    <div className="row flex flex-center">
      <div className="col-6 form-widget">
        <h1 className="header">Supabase + React</h1>
        <p className="description">
          {mode === 'sign_in' && 'Sign in to your account'}
          {mode === 'sign_up' && 'Create a new account'}
          {mode === 'magic_link' && 'Sign in via a magic link sent to your email'}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'sign_in' ? 'active' : ''}`}
            onClick={() => switchMode('sign_in')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'sign_up' ? 'active' : ''}`}
            onClick={() => switchMode('sign_up')}
          >
            Sign Up
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'magic_link' ? 'active' : ''}`}
            onClick={() => switchMode('magic_link')}
          >
            Magic Link
          </button>
        </div>

        <form onSubmit={submitHandlers[mode]}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="inputField"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== 'magic_link' && (
            <div>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="inputField"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}

          {mode === 'sign_up' && (
            <div>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                className="inputField"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}

          {mode === 'sign_in' && (
            <div className="text-right text-sm">
              <button
                type="button"
                className="link-button"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>
          )}

          {message && (
            <div className={`auth-message ${message.type}`}>{message.text}</div>
          )}

          <div>
            <button className="button block primary" disabled={loading}>
              {loading
                ? 'Loading ...'
                : mode === 'sign_in'
                ? 'Sign In'
                : mode === 'sign_up'
                ? 'Sign Up'
                : 'Send Magic Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
