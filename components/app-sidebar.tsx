"use client";

import {
	Bitcoin,
	ChartNoAxesCombined,
	ChevronUp,
	FileText,
	HelpCircle,
	LogOut,
	Search,
	Settings,
	User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/stores/auth-store";

const mainItems = [
	{ title: "Dashboard", url: "/dashboard", icon: ChartNoAxesCombined },
	{ title: "Search", url: "/search", icon: Search },
];

const docItems = [
	{ title: "Crypto", url: "/crypto", icon: Bitcoin },
	{ title: "Reports", url: "/reports", icon: FileText },
];

const footerItems = [
	{ title: "Settings", url: "/settings", icon: Settings },
	{ title: "Get Help", url: "/help", icon: HelpCircle },
];

export function AppSidebar() {
	const pathname = usePathname();
	const { user, signOut } = useAuth();

	return (
		<Sidebar variant="sidebar" collapsible="icon" className="border-r border-sidebar-border/80">
			<SidebarContent>
				{/* Main Section */}
				<SidebarGroup>
					<SidebarGroupLabel className="mb-5 mt-3 h-9 text-lg font-bold tracking-[-0.04em] text-sidebar-foreground">
						<div className="flex items-center gap-2.5">
							<BrandMark />
							<span className="group-data-[collapsible=icon]:hidden">Indus</span>
						</div>
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{mainItems.map((item) => {
								const isActive = pathname === item.url;
								return (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton asChild>
											<Link
												href={item.url}
												aria-label={item.title}
												className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
													isActive
														? "bg-sidebar-accent text-sidebar-accent-foreground"
														: "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
												}`}
											>
												<item.icon className="w-5 h-5" />
												<span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Documents Section */}
				<SidebarGroup>
					<SidebarGroupLabel className="mb-2 mt-5 px-3 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
						Research
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{docItems.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild isActive={pathname === item.url}>
										<Link
											href={item.url}
											aria-label={item.title}
											className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
										>
											<item.icon className="w-5 h-5" />
											<span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
										</Link>
									</SidebarMenuButton>
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
								<Link
									href={item.url}
									aria-label={item.title}
									className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
								>
									<item.icon className="w-5 h-5" />
									<span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
								</Link>
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
						<DropdownMenuItem asChild>
							<a href="/settings#profile">
								<User className="mr-2 h-4 w-4" />
								<span>Account</span>
							</a>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-600">
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
							aria-label="Open account menu"
						>
							{user?.email?.[0]?.toUpperCase() || "U"}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="center" className="w-56">
						<DropdownMenuLabel>My Account</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<a href="/settings#profile">
								<User className="mr-2 h-4 w-4" />
								<span>Account</span>
							</a>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-600">
							<LogOut className="mr-2 h-4 w-4" />
							<span>Sign out</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
