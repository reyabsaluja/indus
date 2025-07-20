"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname } from "next/navigation";
import {
  Search,
  Settings,
  HelpCircle,
  MoreHorizontal,
  FolderKanban,
  FileBarChart,
  LogOut,
  User,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { Button } from "@/components/ui/button";

import Image from "next/image";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: FileBarChart },
  { title: "Search", url: "/search", icon: Search },
];

const docItems = [
  { title: "Reports", url: "/reports", icon: FileBarChart },
  {
    title: "Assistant",
    url: "/word",
    icon: FolderKanban,
    badge: "Coming soon",
  },
  { title: "More", url: "/more", icon: MoreHorizontal },
];

const footerItems = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Get Help", url: "/help", icon: HelpCircle },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarContent>
        {/* Main Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[19px] font-semibold tracking-tight text-white mt-2 mb-3 -ml-1">
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="Indus Logo"
                width={32}
                height={32}
                className="rounded-full"
              />
              <span>Indus</span>
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a
                        href={item.url}
                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-muted text-foreground"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Documents Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm text-muted-foreground mt-6 mb-2 px-3">
            Documents
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {docItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.badge === "Coming soon" ? (
                    <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground/60 cursor-not-allowed">
                      <item.icon className="w-5 h-5 opacity-50" />
                      <span className="group-data-[collapsible=icon]:hidden opacity-50">
                        {item.title}
                      </span>
                      <span className="ml-auto rounded-md bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </span>
                    </div>
                  ) : (
                    <SidebarMenuButton asChild>
                      <a
                        href={item.url}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted text-muted-foreground"
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                            {item.badge}
                          </span>
                        )}
                      </a>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarMenu>
          {footerItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <a
                  href={item.url}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted text-muted-foreground"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {item.title}
                  </span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="mt-4 flex items-center gap-3 px-3 py-2 h-auto justify-start group-data-[collapsible=icon]:hidden w-full"
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="text-xs leading-tight flex-1 text-left">
                <p className="font-medium text-foreground">
                  {user?.user_metadata?.full_name || "User"}
                </p>
                <p className="text-muted-foreground truncate">
                  {user?.email || "user@example.com"}
                </p>
              </div>
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Collapsed sidebar profile button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="mt-4 h-8 w-8 rounded-full bg-muted group-data-[collapsible=icon]:flex hidden mx-auto"
            >
              {user?.email?.[0]?.toUpperCase() || "U"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
