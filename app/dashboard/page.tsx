import { ArrowRight, ArrowUpRight, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { FavoritesSection } from "@/components/FavoritesSection";
import { Button } from "@/components/ui/button";

const RESEARCH_STARTERS = [
	{ symbol: "AAPL", name: "Apple", lens: "Margins & capital return", group: "Consumer tech" },
	{ symbol: "MSFT", name: "Microsoft", lens: "Cloud growth & valuation", group: "Enterprise" },
	{
		symbol: "NVDA",
		name: "NVIDIA",
		lens: "Growth quality & expectations",
		group: "Semiconductors",
	},
	{ symbol: "AMZN", name: "Amazon", lens: "Operating leverage", group: "Commerce" },
	{ symbol: "GOOGL", name: "Alphabet", lens: "Cash generation & AI spend", group: "Platforms" },
	{ symbol: "TSLA", name: "Tesla", lens: "Margins & volatility", group: "Mobility" },
];

export default function Dashboard() {
	return (
		<div className="mx-auto w-full max-w-[1500px] space-y-8 px-4 pb-12 pt-2 sm:px-6 lg:px-8">
			<section className="relative overflow-hidden rounded-[1.6rem] border border-border/70 bg-card px-5 py-7 shadow-sm sm:px-8 sm:py-9">
				<div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_13%,transparent),transparent_68%)] md:block" />
				<div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
					<div>
						<p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
							Dashboard
						</p>
						<h1 className="font-display mt-3 text-balance text-4xl font-medium leading-none tracking-[-0.035em] sm:text-5xl">
							Company research
						</h1>
						<p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
							Search for a company or continue with one of your favorites.
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Button asChild className="h-11 rounded-full px-5">
							<Link href="/search">
								<Search className="size-4" />
								Search companies
							</Link>
						</Button>
						<Button variant="outline" asChild className="h-11 rounded-full px-5">
							<Link href="/company/AAPL">
								Open example
								<ArrowUpRight className="size-4" />
							</Link>
						</Button>
					</div>
				</div>
			</section>

			<FavoritesSection />

			<section aria-labelledby="starters-heading">
				<div className="mb-4 flex items-end justify-between gap-4">
					<div>
						<div className="flex items-center gap-2 text-primary">
							<Sparkles className="size-4" />
							<p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
								Research starters
							</p>
						</div>
						<h2 id="starters-heading" className="mt-1 text-xl font-semibold tracking-[-0.025em]">
							Well-known names, useful questions
						</h2>
					</div>
					<Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
						<Link href="/search">
							Search all
							<ArrowRight className="size-3.5" />
						</Link>
					</Button>
				</div>

				<div className="grid overflow-hidden rounded-2xl border border-border/70 bg-card sm:grid-cols-2 lg:grid-cols-3">
					{RESEARCH_STARTERS.map((stock) => (
						<Link
							key={stock.symbol}
							href={`/company/${stock.symbol}`}
							className="group min-w-0 border-b border-border/70 p-5 transition-colors hover:bg-accent/40 sm:odd:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-mono text-sm font-bold tracking-[0.08em]">
											{stock.symbol}
										</span>
										<span className="truncate text-xs text-muted-foreground">{stock.name}</span>
									</div>
									<p className="mt-6 text-sm font-medium">{stock.lens}</p>
									<p className="mt-1 text-xs text-muted-foreground">{stock.group}</p>
								</div>
								<ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
							</div>
						</Link>
					))}
				</div>
			</section>
		</div>
	);
}
