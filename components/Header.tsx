"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const current =
    segments.length > 0
      ? segments[segments.length - 1].charAt(0).toUpperCase() +
        segments[segments.length - 1].slice(1)
      : "Dashboard";

  return (
    <div className="flex items-center gap-3 px-6 py-4 bg-background text-muted-foreground">
      <SidebarTrigger />
      <Breadcrumb>
        <BreadcrumbList className="flex items-center space-x-1">
          <BreadcrumbItem>
            <BreadcrumbPage className="text-muted-foreground">
              {current}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
