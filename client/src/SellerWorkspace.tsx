import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Upload, BookOpen, ShoppingBag, Wallet, BarChart3, Star, Tag, CreditCard, User, Settings, LifeBuoy, LogOut, Bell, Menu, X, ChevronRight, Download } from 'lucide-react'
import { api,logoutSession,clearToken } from './lib'
import {SellerPage} from './SellerPages'

const nav=[
 ['Dashboard','/dashboard',LayoutDashboard],['Upload Notes','/seller/upload',Upload],['My Materials','/seller/materials',BookOpen],['My Sales','/seller/sales',ShoppingBag],['Earnings & Payouts','/seller/earnings',Wallet],['Analytics','/seller/analytics',BarChart3],['Reviews & Ratings','/seller/reviews',Star],['Promotions','/seller/promotions',Tag],['Subscription & Plan','/seller/subscription',CreditCard],['My Profile','/seller/profile',User],['Settings','/seller/settings',Settings],['Help & Support','/seller/support',LifeBuoy]
] as const

export default function SellerWorkspace(){
 const location=useLocation(); const navigate=useNavigate(); const [me,setMe]=useState<any>(null); const [mobile,setMobile]=useState(false)
 useEffect(()=>{if(!sessionStorage.getItem('noteora_token')){navigate('/login?reason=session-expired');return}api.get('/users/me').then(r=>setMe(r.data)).catch(()=>navigate('/login?reason=session-expired'))},[navigate])
 const logout=async()=>{try{await logoutSession();navigate('/')}catch{alert('Sign out could not be confirmed. Please retry.')}}
 const title=nav.find(([,to])=>to===location.pathname)?.[0]||'Seller workspace'
 return <div className="min-h-screen bg-[#f4f0e8] pb-[76px] md:pb-0">
  <aside className="fixed bottom-4 left-4 top-4 z-[60] hidden w-[260px] flex-col rounded-[24px] border border-black/5 bg-white p-3 shadow-xl md:flex">
   <Link to="/" className="flex h-[62px] items-center border-b border-black/5 px-3"><img src="/noteora-logo.png" className="h-11 w-auto object-contain" alt="Noteora"/></Link>
   <p className="px-3 pb-2 pt-5 text-[10px] font-black uppercase tracking-[.18em] text-black/35">Seller workspace</p>
   <nav className="flex-1 space-y-1 overflow-y-auto pr-1">{nav.map(([label,to,Icon])=>{const active=location.pathname===to;return <Link key={to} to={to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active?'bg-[#171717] text-white':'text-black/75 hover:bg-black/5'}`}><Icon size={18}/><span>{label}</span>{active&&<ChevronRight className="ml-auto" size={15}/>}</Link>})}</nav>
   <div className="mt-2 border-t border-black/5 pt-2"><Link to="/materials" className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-[#f47b35]">Switch to Buyer View</Link><button onClick={logout} className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-600"><LogOut size={18}/>Logout</button></div>
  </aside>
  <nav className="fixed bottom-0 left-0 right-0 z-[70] flex overflow-x-auto border-t bg-white px-1 py-2 md:hidden">{nav.map(([label,to,Icon])=>{const active=location.pathname===to;return <Link key={to} to={to} className={`mx-0.5 flex min-w-[74px] flex-col items-center rounded-xl px-2 py-2 text-[9px] font-bold ${active?'bg-[#171717] text-white':'text-black/55'}`}><Icon size={17}/><span className="mt-1 whitespace-nowrap">{label.replace(' & ',' ')}</span></Link>})}</nav>
  <main className="min-h-screen md:ml-[280px]"><div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 md:px-8 md:py-7">
   <header className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#f47b35]">Seller workspace</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h1></div><div className="flex items-center gap-2"><Link to="/materials" className="btn border text-sm md:hidden">Browse</Link><button className="btn border text-sm md:hidden" onClick={logout}>Logout</button><Link to="/notifications" className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white" aria-label="Notifications"><Bell size={18}/></Link><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f47b35] font-black text-white">{me?.name?.slice(0,1)?.toUpperCase()||'S'}</div></div></header>
   <SellerPage path={location.pathname} me={me} setMe={setMe}/>
  </div></main>
 </div>
}
