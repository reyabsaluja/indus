// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Geist_Mono, Manrope, Newsreader } from "next/font/google";
import { cookies } from "next/headers";

import { AppProviders } from "@/components/AppProviders";
import { ConditionalLayout } from "@/components/ConditionalLayout";

const manrope = Manrope({
	variable: "--font-manrope",
	subsets: ["latin"],
});
const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});
const newsreader = Newsreader({
	variable: "--font-newsreader",
	subsets: ["latin"],
	style: ["normal", "italic"],
});

export const metadata: Metadata = {
	metadataBase: new URL("https://indus-trade.vercel.app"),
	title: {
		default: "Indus | Financial intelligence, in context",
		template: "%s | Indus",
	},
	description:
		"Research public companies with live market charts, durable financial context, and AI analytics that work from the data in view.",
	icons: {
		icon: [{ url: "/indus-water.svg", type: "image/svg+xml" }],
		shortcut: "/indus-water.svg",
		apple: "/logo.png",
	},
	openGraph: {
		title: "Indus | Financial intelligence, in context",
		description: "Move from market signal to financial context without leaving your research.",
		url: "/",
		siteName: "Indus",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "Indus financial research workspace",
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Indus | Financial intelligence, in context",
		description: "Move from market signal to financial context without leaving your research.",
		images: ["/og-image.png"],
	},
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const cookieStore = await cookies();
	const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${manrope.variable} ${geistMono.variable} ${newsreader.variable} overflow-x-hidden antialiased`}
			>
				<AppProviders>
					<ConditionalLayout defaultOpen={defaultOpen}>{children}</ConditionalLayout>
				</AppProviders>
			</body>
		</html>
	);
}
