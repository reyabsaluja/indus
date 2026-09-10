import { RadioTower } from 'lucide-react'
import { useLivePrice } from '../hooks/use-live-price'

const statusCopy = {
  connecting: 'Connecting securely',
  live: 'Live',
  stale: 'Feed stale',
  reconnecting: 'Reconnecting',
  unauthorized: 'Sign in required',
} as const

export function LivePriceCard({ symbol }: { symbol: string }) {
  const { tick, status } = useLivePrice(symbol)
  return <section className="card" aria-live="polite" role="status">
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-semibold"><RadioTower className="text-sky-300" size={18} />Live market</h2>
      <span className={`rounded-full px-3 py-1 text-xs ${status === 'live' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{statusCopy[status]}</span>
    </div>
    <p className="muted mt-3 text-sm">{symbol}</p>
    <p className="mt-1 text-3xl font-semibold">{tick ? money(tick.price) : '—'}</p>
    <p className="muted mt-2 text-xs">{tick ? `Updated ${new Date(tick.timestamp).toLocaleTimeString()}` : 'Waiting for the next normalized market event.'}</p>
  </section>
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}
