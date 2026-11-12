import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from './lib'
import { Activity, Building2, KeyRound, ShieldCheck, Users, Webhook } from 'lucide-react'

const gatewayUrl = (import.meta as any).env?.VITE_GATEWAY_API_URL || 'http://localhost:5100/api/v1'

export function GatewayAdmin(){
  const [overview,setOverview]=useState<any>(null);const [merchants,setMerchants]=useState<any[]>([]);const [error,setError]=useState('')
  useEffect(()=>{void (async()=>{try{
    const me=await api.get('/users/me')
    if(!['ADMIN','SUPER_ADMIN'].includes(me.data.role))throw new Error('Administrator sign-in required.')
    const headers={Authorization:'Bearer '+sessionStorage.getItem('noteora_token')}
    const [list,summary]=await Promise.all([fetch(`${gatewayUrl}/admin/merchants`,{headers}),fetch(`${gatewayUrl}/admin/overview`,{headers})])
    if(!list.ok||!summary.ok)throw new Error('Gateway administrator access unavailable. Check your session and gateway authentication configuration.')
    setMerchants(await list.json());setOverview(await summary.json())
  }catch(e:any){setError(e.message||'Unable to load gateway administration')}})()},[])

  const cards=[['Total',overview?.total??0,Building2],['Pending',overview?.pending??0,Users],['Approved',overview?.approved??0,ShieldCheck],['Suspended',overview?.suspended??0,Activity]] as const
  return <main className="min-h-screen bg-[#F7F1E8] text-[#171717]"><div className="mx-auto max-w-7xl px-4 py-10"><div className="flex items-center justify-between"><div><p className="font-bold text-[#F47B35]">Payment Gateway</p><h1 className="mt-1 text-4xl font-black">Merchant Administration</h1></div><Link className="rounded-xl bg-[#171717] px-5 py-3 font-bold text-white" to="/admin">Marketplace Admin</Link></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label,value,Icon])=><div key={label} className="rounded-2xl bg-white p-5 shadow-sm"><Icon className="text-[#F47B35]"/><p className="mt-4 text-sm font-bold text-black/50">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>)}</div>{error&&<p role="alert" className="mt-5 text-red-700">{error} <Link to="/login">Sign in</Link></p>}<section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b border-black/5 px-6 py-5"><h2 className="text-xl font-black">Merchant applications</h2></div><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-black/[.025] text-xs uppercase text-black/50"><tr><th className="px-6 py-3">Business</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Contact</th><th className="px-6 py-3">Created</th></tr></thead><tbody>{merchants.map(m=><tr key={m.id} className="border-t border-black/5"><td className="px-6 py-4 font-bold">{m.businessName||m.name}</td><td className="px-6 py-4"><span className="rounded-full bg-orange/10 px-3 py-1 text-xs font-black text-orange">{m.status}</span></td><td className="px-6 py-4 text-sm">{m.contactEmail||'—'}</td><td className="px-6 py-4 text-sm">{new Date(m.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>{!merchants.length&&<p className="p-8 text-center text-black/50">No merchant applications yet.</p>}  </div></section></div></main>}

function MerchantDashboard(){return <main className="min-h-screen bg-[#F7F1E8] text-[#171717]"><div className="mx-auto max-w-6xl px-4 py-10"><p className="font-bold text-[#F47B35]">Noteora Gateway</p><h1 className="mt-1 text-4xl font-black">Merchant Developer Dashboard</h1><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[[Building2,'Merchant Profile','Review and update business details'],[KeyRound,'API Keys','Test/live credentials and rotation'],[Webhook,'Webhooks','Endpoint and signing configuration'],[Activity,'Activity','Security and merchant events']].map(([Icon,title,body]:any)=><article key={title} className="rounded-2xl bg-white p-6 shadow-sm"><Icon className="text-[#F47B35]"/><h2 className="mt-5 text-lg font-black">{title}</h2><p className="mt-2 text-sm text-black/55">{body}</p></article>)}</div><div className="mt-8 rounded-2xl border border-[#F47B35]/20 bg-white p-6"><p className="font-black text-[#F47B35]">Payment processing status</p><p className="mt-2 text-black/60">No live payment processing is enabled in Phase 5C.</p></div></div></main>}


// Merchant access tokens and sessions never share marketplace administrator storage.
export function GatewayMerchant(){
  const [ready,setReady]=useState(false);const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [status,setStatus]=useState('');const [busy,setBusy]=useState(false)
  const call=async(path:string,body?:object,token?:string)=>{
    const response=await fetch(gatewayUrl+path,{method:body?'POST':'GET',credentials:'include',headers:{'Content-Type':'application/json','X-Noteora-CSRF':'1',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})})
    const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Merchant authentication failed'),{status:response.status});return data
  }
  useEffect(()=>{void (async()=>{try{
    const renew=async()=>{const r=await call('/auth/refresh',{});sessionStorage.setItem('noteora_gateway_token',r.token)}
    await (navigator.locks?navigator.locks.request('noteora-gateway-refresh',renew):renew())
    await call('/merchant/me',undefined,sessionStorage.getItem('noteora_gateway_token')||'');setReady(true)
  }catch{sessionStorage.removeItem('noteora_gateway_token')}})()},[])
  const login=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setStatus('');try{const r=await call('/auth/login',{email,password});sessionStorage.setItem('noteora_gateway_token',r.token);setPassword('');setReady(true)}catch(e:any){setStatus(e.message)}finally{setBusy(false)}}
  const logout=async()=>{try{const r=await call('/auth/refresh',{});sessionStorage.setItem('noteora_gateway_token',r.token);await call('/auth/logout',{},r.token);sessionStorage.removeItem('noteora_gateway_token');setReady(false)}catch(e:any){if(e.status===401){sessionStorage.removeItem('noteora_gateway_token');setReady(false)}else setStatus(e.message)}}
  if(ready)return <><div className="container pt-5"><button className="btn border" onClick={logout}>Sign out merchant session</button>{status&&<p role="alert">{status}</p>}</div><MerchantDashboard/></>
  return <main className="container max-w-lg py-16"><form className="card p-8" onSubmit={login}><h1 className="text-3xl font-black">Merchant sign in</h1><p className="mt-3 text-sm">Use your gateway merchant account.</p><label className="mt-4 block">Email<input type="email" autoComplete="username" required className="mt-2 w-full rounded-xl border p-3" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="mt-4 block">Password<input type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border p-3" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy} className="btn mt-5 bg-ink text-white">{busy?'Signing in?':'Sign in'}</button>{status&&<p role="alert" className="mt-4">{status}</p>}</form></main>
}
