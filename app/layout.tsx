// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import { ConditionalLayout } from "@/components/ConditionalLayout";
import { AuthProvider } from "@/lib/context/AuthContext";
import { FavoritesProvider } from "@/lib/context/FavoritesContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Indus",
  description: "AI-powered stock trading dashboard",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Indus",
    description: "AI-powered stock trading dashboard",
    url: "https://indus-trade.vercel.app", // replace with actual URL
    siteName: "Indus",
    images: [
      {
        url: "https://indus-trade.vercel.app", // replace with your image URL
        width: 1200,
        height: 630,
        alt: "Indus Dashboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Indus",
    description: "AI-powered stock trading dashboard",
    images: ["https://indus-trade.vercel.app/og-image.png"], // same image or another
    creator: "@reyabsaluja"  // optional
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} text-white antialiased overflow-x-hidden`}
      >
        <AuthProvider>
          <FavoritesProvider>
            <ConditionalLayout defaultOpen={defaultOpen}>
              {children}
            </ConditionalLayout>
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
