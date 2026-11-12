import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, clearToken, logoutSession } from './lib'

export function AccountTokenPage({ reset = false }: { reset?: boolean }) {
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') || '')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => { history.replaceState(null, '', location.pathname) }, [])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true)
    try {
      const result = await api.post(reset ? '/auth/reset-password' : '/auth/verify', reset ? { token, password } : { token })
      if (reset) clearToken()
      setDone(true); setStatus(result.data.message || 'Email verified successfully.')
    } catch (error: any) { setStatus(error.response?.data?.message || 'Unable to complete request.') }
    finally { setBusy(false) }
  }
  return <main className="container max-w-lg py-16"><form onSubmit={submit} className="card p-8"><h1 className="text-3xl font-black">{reset ? 'Choose a new password' : 'Verify your email'}</h1>
    {!token && <p className="mt-4">Open the link from your account email. This link is missing its token.</p>}
    {reset && !done && <label className="mt-5 block">New password<input className="mt-2 w-full rounded-xl border p-3" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /></label>}
    {!done && <button disabled={busy || !token} className="btn mt-5 bg-orange text-white">{busy ? 'Please wait…' : reset ? 'Reset password' : 'Confirm email address'}</button>}
    {status && <p role="status" className="mt-4">{status}</p>}<Link className="mt-5 block font-bold" to="/login">Sign in</Link>
  </form></main>
}
export function SecuritySessions() {
  const [sessions, setSessions] = useState<any[]>([])
  const [verified, setVerified] = useState(false)
  const [status, setStatus] = useState('')
  const load = async () => { try { const [s, u] = await Promise.all([api.get('/auth/sessions'), api.get('/users/me')]); setSessions(s.data); setVerified(u.data.verified) } catch { setStatus('Sign in to manage account security.') } }
  useEffect(() => { void load() }, [])
  const act = async (action: () => Promise<any>) => { try { await action(); setStatus('Request completed.'); await load() } catch (e: any) { setStatus(e.response?.data?.message || 'Request failed.') } }
  return <section className="card mt-5 max-w-3xl p-6"><h2 className="text-xl font-black">Account security</h2>
    {!verified && <button className="btn mt-4 border" onClick={() => act(async () => { const r = await api.post('/auth/resend-verification'); alert(r.data.message) })}>Resend verification link</button>}
    <h3 className="mt-5 font-bold">Active sessions</h3>{sessions.map(s => <div key={s._id} className="mt-3 flex items-center justify-between gap-3 border-b pb-3"><span className="break-all text-sm">{s.userAgent || 'Unknown device'} · {s.ip} · expires {new Date(s.expiresAt).toLocaleString()}</span><button className="font-bold text-red-700" onClick={() => act(() => api.delete('/auth/sessions/' + s._id))}>Revoke</button></div>)}
    <button className="btn mt-5 bg-ink text-white" onClick={() => act(async () => { await logoutSession(true); location.href = '/login' })}>Sign out all sessions</button>
    {status && <p role="status" className="mt-4">{status}</p>}
  </section>
}
