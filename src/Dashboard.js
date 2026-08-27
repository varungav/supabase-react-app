import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { db } from './dbClient'
import Avatar from './Avatar'
import Tasks from './Tasks'

function formatDate(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function Dashboard({ session }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [username, setUsername] = useState('')
  const [website, setWebsite] = useState('')
  const [avatar_url, setAvatarUrl] = useState(null)
  const [savedMessage, setSavedMessage] = useState(null)
  const [fnLoading, setFnLoading] = useState(false)
  const [fnResult, setFnResult] = useState(null)
  const [fnError, setFnError] = useState(null)

  const { user } = session

  useEffect(() => {
    let isMounted = true

    async function getProfile() {
      try {
        setLoading(true)
        const data = await db.profiles.get()

        if (isMounted && data) {
          setUsername(data.username || '')
          setWebsite(data.website || '')
          setAvatarUrl(data.avatar_url)
        }
      } catch (error) {
        console.warn(error.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    getProfile()
    return () => {
      isMounted = false
    }
  }, [user.id])

  async function updateProfile(e, { username, website, avatar_url }) {
    if (e) e.preventDefault()
    try {
      setSaving(true)
      setSavedMessage(null)

      await db.profiles.upsert({ username, website, avatar_url })

      setSavedMessage({ type: 'success', text: 'Profile updated!' })
    } catch (error) {
      setSavedMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  async function callHelloWorld() {
    setFnLoading(true)
    setFnError(null)
    setFnResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('hello-world', {
        body: { name: username || undefined },
      })
      if (error) throw error
      setFnResult(data)
    } catch (error) {
      setFnError(error.message)
    } finally {
      setFnLoading(false)
    }
  }

  const emailConfirmed = Boolean(user.confirmed_at || user.email_confirmed_at)
  const provider = user.app_metadata?.provider || 'email'
  const displayName = username || user.email.split('@')[0]

  return (
    <div className="dashboard">
      <header className="dashboard-topbar">
        <div className="dashboard-brand">Supabase + React</div>
        <div className="dashboard-topbar-right">
          <div className="dashboard-avatar-chip">
            <Avatar url={avatar_url} size={36} onUpload={() => {}} hideUploadButton />
            <span>{displayName}</span>
          </div>
          <button className="button" onClick={() => supabase.auth.signOut()}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <h1 className="mainHeader">Welcome back, {displayName} 👋</h1>

        <div className="stat-grid">
          <div className="card stat-card">
            <div className="stat-label">Email</div>
            <div className="stat-value stat-value-sm">{user.email}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Email Verified</div>
            <div className={`stat-value ${emailConfirmed ? 'stat-good' : 'stat-warn'}`}>
              {emailConfirmed ? 'Verified' : 'Pending'}
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Auth Provider</div>
            <div className="stat-value">{provider}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Member Since</div>
            <div className="stat-value stat-value-sm">{formatDate(user.created_at)}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Last Sign In</div>
            <div className="stat-value stat-value-sm">{formatDate(user.last_sign_in_at)}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">User ID</div>
            <div className="stat-value stat-value-xs" title={user.id}>
              {user.id.slice(0, 8)}…
            </div>
          </div>
        </div>

        <div className="card profile-card">
          <h2 className="card-title">Your Profile</h2>
          <form
            className="form-widget"
            onSubmit={(e) => updateProfile(e, { username, website, avatar_url })}
          >
            <Avatar
              url={avatar_url}
              size={120}
              onUpload={(url) => {
                setAvatarUrl(url)
                updateProfile(null, { username, website, avatar_url: url })
              }}
            />
            <div>
              <label htmlFor="username">Name</label>
              <input
                id="username"
                type="text"
                value={username}
                disabled={loading}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                value={website}
                disabled={loading}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {savedMessage && (
              <div className={`auth-message ${savedMessage.type}`}>{savedMessage.text}</div>
            )}

            <div>
              <button className="button block primary" type="submit" disabled={loading || saving}>
                {saving ? 'Saving ...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <Tasks session={session} />

        <div className="card profile-card">
          <h2 className="card-title">Edge Function</h2>
          <p className="text-sm font-light" style={{ marginTop: '-10px', marginBottom: '16px' }}>
            Calls the <code>hello-world</code> Supabase Edge Function, which verifies your JWT
            server-side and returns a personalized, server-generated response.
          </p>
          <button className="button primary" onClick={callHelloWorld} disabled={fnLoading}>
            {fnLoading ? 'Calling ...' : 'Invoke Edge Function'}
          </button>

          {fnError && <div className="auth-message error" style={{ marginTop: '16px' }}>{fnError}</div>}

          {fnResult && (
            <pre className="fn-result">{JSON.stringify(fnResult, null, 2)}</pre>
          )}
        </div>
      </main>
    </div>
  )
}
