import { Link, Outlet, useRouter } from '@tanstack/react-router'
import { BarChart3, FileText, Heart, LayoutDashboard, LogOut, Menu, Search, Settings, WalletCards, X } from 'lucide-react'
import { useState } from 'react'
import { useAppContext } from '../app-context'

const links = [
  ['/dashboard', 'Overview', LayoutDashboard], ['/search', 'Discover', Search], ['/crypto', 'Crypto', BarChart3],
  ['/favorites', 'Favorites', Heart], ['/portfolios', 'Portfolios', WalletCards], ['/reports', 'Reports', FileText], ['/settings', 'Settings', Settings],
] as const

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { auth } = useAppContext()
  const router = useRouter()
  const signOut = async () => { await auth.signOut(); await router.navigate({ to: '/auth' }) }
  return <div className="min-h-screen md:grid md:grid-cols-[16rem_1fr]">
    <a href="#main" className="fixed -top-20 left-4 z-50 rounded bg-sky-400 px-4 py-2 text-slate-950 focus:top-4">Skip to content</a>
    <header className="flex h-16 items-center justify-between border-b border-slate-800 px-5 md:hidden">
      <Brand /><button aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </header>
    <aside className={`${open ? 'flex' : 'hidden'} fixed inset-x-0 top-16 z-40 h-[calc(100vh-4rem)] flex-col border-r border-slate-800 bg-slate-950 p-5 md:sticky md:top-0 md:flex md:h-screen`}>
      <div className="hidden md:block"><Brand /></div>
      <nav aria-label="Primary" className="mt-8 flex flex-1 flex-col gap-1">
        {links.map(([to, label, Icon]) => <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white [&.active]:bg-sky-400/10 [&.active]:text-sky-300"><Icon size={17} aria-hidden />{label}</Link>)}
      </nav>
      <button onClick={signOut} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-900 hover:text-white"><LogOut size={17} />Sign out</button>
    </aside>
    <main id="main" className="min-w-0 p-5 md:p-8 lg:p-10"><Outlet /></main>
  </div>
}

function Brand() { return <Link to="/dashboard" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-400 font-black text-slate-950">I</span>Indus</Link> }
