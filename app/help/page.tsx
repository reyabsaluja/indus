import { BrainCircuit, FileText, Search, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const guides = [
	{
		title: "Find a company",
		icon: Search,
		steps: [
			"Open Search and enter a ticker such as AAPL.",
			"Select a result to open its chart and financial metrics.",
		],
	},
	{
		title: "Save a company",
		icon: Star,
		steps: [
			"Select the star beside a company name.",
			"Open Dashboard to return to saved companies.",
		],
	},
	{
		title: "Ask the analyst",
		icon: BrainCircuit,
		steps: [
			"Select a financial value or a question in the Analyst panel.",
			"Review the source data shown with the answer before relying on it.",
		],
	},
	{
		title: "Create a report",
		icon: FileText,
		steps: [
			"Open Reports, enter a ticker, and select Generate Report.",
			"Open a completed report and use Export PDF to download it.",
		],
	},
];

export default function HelpPage() {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
			<div>
				<p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
					Help
				</p>
				<h1 className="mt-2 text-3xl font-bold tracking-tight">Using Indus</h1>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				{guides.map((guide) => (
					<Card key={guide.title}>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								<guide.icon className="size-4 text-primary" />
								{guide.title}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
								{guide.steps.map((step) => (
									<li key={step}>{step}</li>
								))}
							</ol>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
