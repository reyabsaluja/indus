"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
	const pathname = usePathname();
	const segments = (pathname ?? "").split("/").filter(Boolean);

	const current =
		segments.length > 0
			? segments[segments.length - 1].charAt(0).toUpperCase() +
				segments[segments.length - 1].slice(1)
			: "Dashboard";

	return (
		<header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 text-muted-foreground backdrop-blur-xl sm:px-6">
			<div className="flex items-center gap-3">
				<SidebarTrigger />
				<div className="h-4 w-px bg-border" />
				<Breadcrumb>
					<BreadcrumbList className="flex items-center space-x-1">
						<BreadcrumbItem>
							<BreadcrumbPage className="text-muted-foreground">{current}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</div>
			<Button variant="outline" size="sm" asChild className="rounded-full bg-card/70">
				<Link href="/search" aria-label="Search companies">
					<Search className="size-3.5" />
					<span className="hidden sm:inline">Search companies</span>
				</Link>
			</Button>
		</header>
	);
}
