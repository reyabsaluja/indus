import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
	return (
		<Image
			src="/logo.svg"
			alt=""
			width={28}
			height={28}
			className={cn("size-7 shrink-0", className)}
			aria-hidden="true"
			draggable={false}
		/>
	);
}
