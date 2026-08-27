import './index.css'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Dashboard from './Dashboard'

export default function Home() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener?.subscription?.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="container flex flex-center" style={{ padding: '50px 0 100px 0' }}>
        <p>Loading ...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container" style={{ padding: '50px 0 100px 0' }}>
        <Auth />
      </div>
    )
  }

  return <Dashboard key={session.user.id} session={session} />
}
