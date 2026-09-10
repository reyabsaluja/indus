import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <header className="mb-7"><p className="eyebrow">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1><p className="muted mt-2 max-w-2xl">{children}</p></header>
}
export function LoadingState({ label = 'Loading data' }: { label?: string }) { return <div role="status" className="card animate-pulse muted">{label}…</div> }
export function ErrorState({ retry }: { retry: () => void }) { return <div role="alert" className="card"><h2 className="font-semibold">Data is temporarily unavailable</h2><p className="muted mt-2 text-sm">Your account is safe. Try the request again.</p><button onClick={retry} className="mt-4 rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950">Retry</button></div> }
export function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="card text-center"><h2 className="font-semibold">{title}</h2><p className="muted mt-2 text-sm">{detail}</p></div> }
