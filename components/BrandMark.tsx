import { ChartNoAxesCombined } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
	return (
		<ChartNoAxesCombined
			className={cn("size-7 shrink-0 text-primary", className)}
			aria-hidden="true"
		/>
	);
}
