"use client";

import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default function Loading() {
	return (
		<div className="min-h-screen bg-background flex items-center justify-center">
			<div className="text-center">
				<div className="flex items-center justify-center space-x-2 mb-4">
					<BrandMark className="size-10" />
					<span className="text-2xl font-bold">Indus</span>
				</div>
				<Loader2 className="h-8 w-8 animate-spin mx-auto" />
				<p className="text-muted-foreground mt-2">Loading...</p>
			</div>
		</div>
	);
}
