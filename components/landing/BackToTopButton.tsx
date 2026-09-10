"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

const VISIBILITY_THRESHOLD = 480;

export function BackToTopButton() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const updateVisibility = () => setVisible(window.scrollY >= VISIBILITY_THRESHOLD);
		updateVisibility();
		window.addEventListener("scroll", updateVisibility, { passive: true });
		return () => window.removeEventListener("scroll", updateVisibility);
	}, []);

	return (
		<a
			href="#top"
			aria-label="Back to top"
			inert={!visible}
			tabIndex={visible ? 0 : -1}
			data-visible={visible}
			className={`fixed bottom-5 right-5 z-50 inline-flex size-11 items-center justify-center rounded-full border border-border/80 bg-card/90 text-foreground shadow-lg backdrop-blur-xl transition-[opacity,transform,background-color] duration-300 ease-out hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none sm:bottom-7 sm:right-7 ${
				visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
			}`}
		>
			<ArrowUp className="size-4" aria-hidden="true" />
			<span className="sr-only">Back to top</span>
		</a>
	);
}
