import { useEffect, useState } from 'react'
import { db } from './dbClient'

/**
 * Tasks.js
 * Full CRUD example against the `tasks` table, which now lives in RDS.
 * Every call goes through the `db` Edge Function (see src/dbClient.js and
 * supabase/functions/db/index.ts) instead of `supabase.from('tasks')`,
 * since RDS has no PostgREST layer of its own.
 * - Create: insert a new task
 * - Read:   fetch the signed-in user's tasks on mount
 * - Update: toggle a task's completion state
 * - Delete: remove a task
 */
export default function Tasks({ session }) {
  const { user } = session

  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function fetchTasks() {
      try {
        setLoading(true)
        setError(null)

        // READ
        const data = await db.tasks.list()
        if (isMounted) setTasks(data ?? [])
      } catch (err) {
        if (isMounted) setError(err.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchTasks()
    return () => {
      isMounted = false
    }
  }, [user.id])

  async function addTask(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return

    try {
      setAdding(true)
      setError(null)

      // CREATE
      const data = await db.tasks.create(title)
      setTasks((current) => [data, ...current])
      setNewTitle('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function toggleTask(task) {
    try {
      setBusyId(task.id)
      setError(null)

      // UPDATE
      const data = await db.tasks.update(task.id, { is_complete: !task.is_complete })
      setTasks((current) => current.map((t) => (t.id === task.id ? data : t)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function deleteTask(task) {
    try {
      setBusyId(task.id)
      setError(null)

      // DELETE
      await db.tasks.remove(task.id)
      setTasks((current) => current.filter((t) => t.id !== task.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card profile-card">
      <h2 className="card-title">Tasks</h2>
      <p className="text-sm font-light" style={{ marginTop: '-10px', marginBottom: '16px' }}>
        A minimal create / read / update / delete example backed by the <code>tasks</code> table
        in RDS, scoped to your account by the <code>db</code> Edge Function.
      </p>

      <form className="flex row items-center" style={{ gap: 8, marginBottom: 16 }} onSubmit={addTask}>
        <input
          type="text"
          placeholder="Add a new task…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={adding}
          style={{ flex: 1 }}
        />
        <button className="button primary" type="submit" disabled={adding || !newTitle.trim()}>
          {adding ? 'Adding …' : 'Add'}
        </button>
      </form>

      {error && <div className="auth-message error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p className="text-sm font-light">Loading tasks …</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm font-light">No tasks yet — add one above.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex row items-center"
              style={{
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid var(--custom-border, #333)',
              }}
            >
              <input
                type="checkbox"
                checked={task.is_complete}
                onChange={() => toggleTask(task)}
                disabled={busyId === task.id}
              />
              <span
                className="flex-1"
                style={{
                  flex: 1,
                  textDecoration: task.is_complete ? 'line-through' : 'none',
                  opacity: task.is_complete ? 0.6 : 1,
                }}
              >
                {task.title}
              </span>
              <button
                className="button"
                type="button"
                onClick={() => deleteTask(task)}
                disabled={busyId === task.id}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
