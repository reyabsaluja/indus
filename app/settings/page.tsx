"use client";

import { LogOut, Monitor, Moon, Palette, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/stores/auth-store";

interface SettingSection {
	id: "profile" | "appearance";
	title: string;
	icon: React.ElementType;
}

const settingSections: SettingSection[] = [
	{ id: "profile", title: "Profile & Account", icon: User },
	{ id: "appearance", title: "Appearance", icon: Palette },
];

const themes = [
	{ id: "light", label: "Light", icon: Sun },
	{ id: "dark", label: "Dark", icon: Moon },
	{ id: "system", label: "System", icon: Monitor },
] as const;

export default function Settings() {
	const [activeSection, setActiveSection] = useState<SettingSection["id"]>("profile");
	const { theme, setTheme } = useTheme();
	const { user, signOut } = useAuth();

	useEffect(() => {
		const syncSection = () => {
			const section = window.location.hash.slice(1);
			if (settingSections.some(({ id }) => id === section)) {
				setActiveSection(section as SettingSection["id"]);
			}
		};
		syncSection();
		window.addEventListener("hashchange", syncSection);
		return () => window.removeEventListener("hashchange", syncSection);
	}, []);

	const selectSection = (section: SettingSection["id"]) => {
		setActiveSection(section);
		window.history.replaceState(null, "", `#${section}`);
	};

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
			<h1 className="text-3xl font-bold tracking-tight">Settings</h1>

			<div className="grid gap-5 lg:grid-cols-[220px_1fr]">
				<nav aria-label="Settings" className="flex gap-2 lg:flex-col">
					{settingSections.map((section) => (
						<button
							key={section.id}
							type="button"
							onClick={() => selectSection(section.id)}
							className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors lg:flex-none ${
								activeSection === section.id
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
							}`}
						>
							<section.icon className="size-4" />
							{section.title}
						</button>
					))}
				</nav>

				<Card id={activeSection} className="scroll-mt-20">
					<CardHeader>
						<CardTitle>{settingSections.find(({ id }) => id === activeSection)?.title}</CardTitle>
					</CardHeader>
					<CardContent>
						{activeSection === "profile" ? (
							<div className="space-y-6">
								<div className="rounded-xl border border-border/70 bg-muted/20 p-4">
									<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
										Signed in as
									</p>
									<p className="mt-2 break-all font-medium">{user?.email ?? "Unknown account"}</p>
								</div>
								<Button variant="outline" onClick={() => void signOut()}>
									<LogOut className="size-4" />
									Log out
								</Button>
							</div>
						) : (
							<div className="grid gap-3 sm:grid-cols-3">
								{themes.map((option) => (
									<button
										key={option.id}
										type="button"
										onClick={() => setTheme(option.id)}
										aria-pressed={theme === option.id}
										className={`flex items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors ${
											theme === option.id
												? "border-primary bg-primary/10"
												: "border-border hover:bg-muted/50"
										}`}
									>
										<option.icon className="size-4" />
										{option.label}
									</button>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
