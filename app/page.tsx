import {
	ArrowRight,
	BrainCircuit,
	Check,
	ChevronRight,
	CircleGauge,
	DatabaseZap,
	Layers3,
	LockKeyhole,
	Search,
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { BackToTopButton } from "@/components/landing/BackToTopButton";
import { Button } from "@/components/ui/button";

const researchSteps = [
	{
		number: "01",
		icon: Search,
		title: "Search a company",
		description: "Open live and historical prices.",
	},
	{
		number: "02",
		icon: Layers3,
		title: "Review the fundamentals",
		description: "Compare valuation, margins, growth, and debt.",
	},
	{
		number: "03",
		icon: BrainCircuit,
		title: "Ask about the data",
		description: "Ask questions about the data shown.",
	},
];

function ProductPreview() {
	return (
		<div className="relative mx-auto w-full max-w-[760px] animate-rise-in [animation-delay:180ms]">
			<div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_13%,transparent),transparent_64%)] blur-2xl" />
			<div className="overflow-hidden rounded-[1.5rem] border border-border/80 bg-card/90 shadow-[0_32px_120px_-48px_rgba(0,0,0,0.8)] backdrop-blur-xl">
				<div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<span className="size-2 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_15%,transparent)]" />
						Company research preview
					</div>
					<div className="flex gap-1.5" aria-hidden="true">
						<span className="size-1 rounded-full bg-muted-foreground/40" />
						<span className="size-1 rounded-full bg-muted-foreground/40" />
						<span className="size-1 rounded-full bg-muted-foreground/40" />
					</div>
				</div>

				<div className="grid gap-4 p-4 md:grid-cols-[1.55fr_0.85fr] md:p-5">
					<div className="rounded-2xl border border-border/70 bg-background/55 p-4">
						<div className="mb-6 flex items-start justify-between gap-4">
							<div>
								<div className="flex items-center gap-2">
									<span className="font-mono text-xs font-semibold tracking-[0.18em] text-primary">
										AAPL
									</span>
									<span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
										NASDAQ
									</span>
								</div>
								<p className="mt-1 text-sm font-semibold">Apple Inc.</p>
							</div>
							<div className="text-right">
								<p className="font-mono text-xl font-semibold tracking-tight">$213.32</p>
								<p className="font-mono text-xs text-primary">+1.28%</p>
							</div>
						</div>

						<div className="relative h-48 overflow-hidden" aria-hidden="true">
							<div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--foreground)_5%,transparent)_1px,transparent_1px)] bg-[size:48px_48px]" />
							<svg viewBox="0 0 520 190" className="absolute inset-0 h-full w-full" fill="none">
								<title>Illustrative upward price chart</title>
								<defs>
									<linearGradient id="landing-chart-fill" x1="0" y1="0" x2="0" y2="1">
										<stop stopColor="currentColor" stopOpacity="0.25" />
										<stop offset="1" stopColor="currentColor" stopOpacity="0" />
									</linearGradient>
								</defs>
								<path
									d="M0 151 C31 145 44 157 74 137 C104 117 122 130 149 109 C177 87 199 101 222 94 C254 84 267 116 300 91 C333 66 347 79 375 57 C402 36 424 62 447 39 C472 14 492 29 520 8 V190 H0 Z"
									className="fill-[url(#landing-chart-fill)] text-primary"
								/>
								<path
									d="M0 151 C31 145 44 157 74 137 C104 117 122 130 149 109 C177 87 199 101 222 94 C254 84 267 116 300 91 C333 66 347 79 375 57 C402 36 424 62 447 39 C472 14 492 29 520 8"
									className="stroke-primary"
									strokeWidth="3"
									strokeLinecap="round"
								/>
							</svg>
						</div>

						<div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/70 pt-4">
							{[
								["Market cap", "$3.19T"],
								["P/E", "33.1×"],
								["Net margin", "24.3%"],
							].map(([label, value]) => (
								<div key={label}>
									<p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
										{label}
									</p>
									<p className="mt-1 font-mono text-sm font-medium">{value}</p>
								</div>
							))}
						</div>
					</div>

					<div className="flex flex-col rounded-2xl border border-primary/25 bg-primary/[0.055] p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-xs font-semibold">
								<BrainCircuit className="size-4 text-primary" />
								Indus analyst
							</div>
							<span className="rounded-full bg-primary/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
								Current data
							</span>
						</div>
						<div className="my-5 h-px bg-primary/15" />
						<p className="font-display text-xl leading-snug">
							“How does this margin compare with the valuation?”
						</p>
						<p className="mt-4 text-xs leading-relaxed text-muted-foreground">
							A 24.3% net margin and 33.1× P/E connect profitability to the price paid for earnings.
							Compare earnings growth next; it is the missing piece in this view.
						</p>
						<div className="mt-auto pt-6">
							<div className="flex items-center gap-2 border-t border-primary/15 pt-3 text-[10px] text-muted-foreground">
								<Check className="size-3 text-primary" />
								Based on the metrics shown
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function LandingPage() {
	return (
		<div id="top" className="relative min-h-screen overflow-hidden bg-background">
			<div className="landing-grid pointer-events-none absolute inset-x-0 top-0 -z-0 h-[900px] opacity-70" />
			<div className="pointer-events-none absolute left-1/2 top-[-360px] h-[720px] w-[900px] -translate-x-1/2 rounded-full bg-primary/[0.08] blur-[140px]" />

			<header className="relative z-20 border-b border-border/60 bg-background/75 backdrop-blur-xl">
				<nav
					className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8"
					aria-label="Main navigation"
				>
					<Link href="/" className="flex items-center gap-2.5" aria-label="Indus home">
						<BrandMark />
						<span className="text-lg font-bold tracking-[-0.04em]">Indus</span>
					</Link>

					<div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
						<a href="#product" className="transition-colors hover:text-foreground">
							Product
						</a>
						<a href="#workflow" className="transition-colors hover:text-foreground">
							Workflow
						</a>
						<a href="#principles" className="transition-colors hover:text-foreground">
							Principles
						</a>
					</div>

					<div className="flex items-center gap-2">
						<Button variant="ghost" asChild>
							<Link href="/auth">Sign in</Link>
						</Button>
						<Button asChild className="rounded-full px-5">
							<Link href="/auth">
								Open Indus
								<ArrowRight className="size-4" />
							</Link>
						</Button>
					</div>
				</nav>
			</header>

			<main className="relative z-10">
				<section className="mx-auto max-w-7xl px-5 pb-20 pt-20 lg:px-8 lg:pb-28 lg:pt-28">
					<div className="mx-auto max-w-4xl text-center">
						<h1
							aria-label="Financial intelligence, in context."
							className="font-display animate-rise-in text-balance text-6xl font-medium leading-[0.92] tracking-[-0.045em] [animation-delay:60ms] md:text-8xl lg:text-[7.2rem]"
						>
							Financial intelligence, <span className="block italic text-primary">in context.</span>
						</h1>
						<p className="animate-rise-in mx-auto mt-7 max-w-2xl text-balance text-base leading-7 text-muted-foreground [animation-delay:120ms] md:text-lg">
							Live price action, durable company fundamentals, and AI analytics all in{" "}
							<span className="underline decoration-primary decoration-2 underline-offset-4">
								one
							</span>{" "}
							workspace for moving from signal to understanding.
						</p>
						<div className="animate-rise-in mt-9 flex flex-col justify-center gap-3 [animation-delay:160ms] sm:flex-row">
							<Button size="lg" asChild className="h-12 rounded-full px-7 text-sm">
								<Link href="/auth">
									Start researching
									<ArrowRight className="size-4" />
								</Link>
							</Button>
							<Button
								size="lg"
								variant="outline"
								asChild
								className="h-12 rounded-full px-7 text-sm"
							>
								<Link href="/auth">
									Explore an example
									<ChevronRight className="size-4" />
								</Link>
							</Button>
						</div>
					</div>

					<div id="product" className="scroll-mt-24 pt-16 lg:pt-20">
						<ProductPreview />
					</div>
				</section>

				<section id="workflow" className="scroll-mt-20 border-y border-border/70 bg-card/35">
					<div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
						<div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
							<div>
								<p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
									Company research in one view
								</p>
								<h2 className="font-display mt-4 max-w-lg text-balance text-4xl font-medium leading-[1.02] tracking-[-0.035em] md:text-6xl">
									Research a company without switching tools.
								</h2>
							</div>

							<div className="divide-y divide-border/70 border-y border-border/70">
								{researchSteps.map((step) => (
									<div
										key={step.number}
										className="group grid grid-cols-[auto_1fr] gap-5 py-7 sm:grid-cols-[70px_auto_1fr] sm:items-start"
									>
										<span className="hidden font-mono text-xs text-muted-foreground sm:block">
											{step.number}
										</span>
										<span className="flex size-10 items-center justify-center rounded-full border border-border bg-background transition-colors group-hover:border-primary/50 group-hover:text-primary">
											<step.icon className="size-4" />
										</span>
										<div>
											<h3 className="font-semibold tracking-tight">{step.title}</h3>
											<p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
												{step.description}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

				<section
					id="principles"
					className="scroll-mt-20 mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"
				>
					<div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
						<div>
							<p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
								Clear data boundaries
							</p>
							<h2 className="font-display mt-4 text-4xl font-medium tracking-[-0.035em] md:text-6xl">
								Know what the product is showing.
							</h2>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-3">
						{[
							{
								icon: DatabaseZap,
								title: "Clear market status",
								copy: "See whether chart data is live, reconnecting, or historical.",
							},
							{
								icon: CircleGauge,
								title: "Financial data in one view",
								copy: "Open definitions and analysis from each metric.",
							},
							{
								icon: LockKeyhole,
								title: "Answers tied to current data",
								copy: "The analyst uses the fundamentals and chart data on the page.",
							},
						].map((principle) => (
							<div
								key={principle.title}
								className="surface-hairline rounded-2xl border border-border/70 bg-card p-6 lg:p-7"
							>
								<principle.icon className="size-5 text-primary" />
								<h3 className="mt-10 font-semibold tracking-tight">{principle.title}</h3>
								<p className="mt-3 text-sm leading-6 text-muted-foreground">{principle.copy}</p>
							</div>
						))}
					</div>
				</section>
			</main>

			<footer className="relative z-10 border-t border-border/70">
				<div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
					<div className="flex items-center gap-2.5 text-foreground">
						<BrandMark />
						<span className="font-semibold">Indus</span>
					</div>
					<p>Market data, company fundamentals, and AI analysis in one workspace.</p>
					<p className="font-mono text-xs">© {new Date().getFullYear()} Indus</p>
				</div>
			</footer>
			<BackToTopButton />
		</div>
	);
}
