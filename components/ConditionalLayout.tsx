"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/Header";

interface ConditionalLayoutProps {
  children: React.ReactNode;
  defaultOpen: boolean;
}

export function ConditionalLayout({
  children,
  defaultOpen,
}: ConditionalLayoutProps) {
  const pathname = usePathname();

  // Routes that should NOT have the sidebar (landing page and auth)
  const routesWithoutSidebar = ["/", "/auth", "/auth/auth-code-error"];

  const shouldShowSidebar = pathname
    ? !routesWithoutSidebar.some(
        (route) => pathname === route || pathname.startsWith("/auth")
      )
    : true;

  if (!shouldShowSidebar) {
    // Render without sidebar for landing page
    return (
      <main className="min-h-screen overflow-x-hidden">
        <div className="overflow-x-hidden">{children}</div>
      </main>
    );
  }

  // Render with sidebar for dashboard and other pages
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="overflow-x-hidden">
        <main className="min-h-screen overflow-x-hidden">
          <Header />
          <div className="overflow-x-hidden">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
