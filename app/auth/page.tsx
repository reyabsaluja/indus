"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type LoadingAction = "email" | "google" | null;

export default function AuthPage() {
	const [isSignUp, setIsSignUp] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
	const [message, setMessage] = useState("");
	const router = useRouter();
	const supabase = createClient();

	const handleAuth = async (event: React.FormEvent) => {
		event.preventDefault();
		setLoadingAction("email");
		setMessage("");

		try {
			if (isSignUp) {
				const { error } = await supabase.auth.signUp({
					email,
					password,
					options: {
						emailRedirectTo: `${window.location.origin}/auth/callback`,
						data: {
							first_name: firstName,
							last_name: lastName,
							full_name: `${firstName} ${lastName}`.trim(),
						},
					},
				});
				if (error) throw error;
				setMessage("Check your email to confirm your account, then return here to sign in.");
			} else {
				const { error } = await supabase.auth.signInWithPassword({ email, password });
				if (error) throw error;
				router.push("/dashboard");
			}
		} catch (authError: unknown) {
			setMessage(
				authError instanceof Error ? authError.message : "We couldn’t complete that request.",
			);
		} finally {
			setLoadingAction(null);
		}
	};

	const handleGoogleSignIn = async () => {
		setLoadingAction("google");
		setMessage("");
		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: { redirectTo: `${window.location.origin}/auth/callback` },
			});
			if (error) throw error;
		} catch (authError: unknown) {
			setMessage(
				authError instanceof Error ? authError.message : "We couldn’t complete that request.",
			);
			setLoadingAction(null);
		}
	};

	const isSuccess = message.startsWith("Check your email");

	return (
		<div className="grid min-h-screen bg-background lg:grid-cols-[0.92fr_1.08fr]">
			<section
				className="relative hidden overflow-hidden border-r border-border/70 bg-card lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14"
				aria-label="Indus product summary"
			>
				<div className="landing-grid pointer-events-none absolute inset-0 opacity-70" />
				<div className="pointer-events-none absolute -left-40 top-1/3 size-[520px] rounded-full bg-primary/[0.1] blur-[130px]" />
				<Link href="/" className="relative z-10 flex items-center gap-2.5" aria-label="Indus home">
					<BrandMark className="size-8" />
					<span className="text-lg font-bold tracking-[-0.04em]">Indus</span>
				</Link>

				<div className="relative z-10 max-w-xl">
					<h1 className="font-display text-balance text-6xl font-medium leading-[0.96] tracking-[-0.045em] xl:text-7xl">
						Research companies.
						<br />
						<span className="italic text-primary">Keep the data together.</span>
					</h1>
					<p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
						Save companies, generate reports, and revisit your research.
					</p>
					<div className="mt-9 flex items-center gap-2 text-xs text-muted-foreground">
						<ShieldCheck className="size-4 text-primary" />
						Provider credentials and model prompts stay server-side.
					</div>
				</div>

				<p className="relative z-10 font-mono text-[10px] text-muted-foreground">
					INDUS / FINANCIAL INTELLIGENCE
				</p>
			</section>

			<main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
				<div className="w-full max-w-[440px]">
					<div className="mb-10 flex items-center justify-between lg:hidden">
						<Link href="/" className="flex items-center gap-2.5" aria-label="Indus home">
							<BrandMark className="size-8" />
							<span className="text-lg font-bold tracking-[-0.04em]">Indus</span>
						</Link>
						<Button variant="ghost" size="sm" asChild className="rounded-full">
							<Link href="/">
								<ArrowLeft className="size-4" />
								Home
							</Link>
						</Button>
					</div>

					<div>
						<p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
							{isSignUp ? "Create workspace" : "Welcome back"}
						</p>
						<h2 className="font-display mt-3 text-4xl font-medium tracking-[-0.035em] sm:text-5xl">
							{isSignUp ? "Start your research." : "Continue your research."}
						</h2>
						<p className="mt-3 text-sm leading-6 text-muted-foreground">
							{isSignUp
								? "Create an account to save companies and generated research."
								: "Sign in to return to your watchlist, reports, and company analysis."}
						</p>
					</div>

					<Button
						variant="outline"
						onClick={() => void handleGoogleSignIn()}
						disabled={loadingAction !== null}
						className="mt-8 h-11 w-full rounded-xl bg-card"
					>
						{loadingAction === "google" ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
								<path
									fill="currentColor"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="currentColor"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="currentColor"
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								/>
								<path
									fill="currentColor"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								/>
							</svg>
						)}
						Continue with Google
					</Button>

					<div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
						<span className="h-px flex-1 bg-border" />
						Or use email
						<span className="h-px flex-1 bg-border" />
					</div>

					<form onSubmit={handleAuth} className="space-y-4">
						{isSignUp && (
							<div className="grid grid-cols-2 gap-3">
								<label className="space-y-2 text-xs font-medium">
									<span>First name</span>
									<Input
										type="text"
										placeholder="First Name"
										autoComplete="given-name"
										value={firstName}
										onChange={(event) => setFirstName(event.target.value)}
										required
										className="h-11 rounded-xl bg-card"
									/>
								</label>
								<label className="space-y-2 text-xs font-medium">
									<span>Last name</span>
									<Input
										type="text"
										placeholder="Last Name"
										autoComplete="family-name"
										value={lastName}
										onChange={(event) => setLastName(event.target.value)}
										required
										className="h-11 rounded-xl bg-card"
									/>
								</label>
							</div>
						)}

						<label className="block space-y-2 text-xs font-medium">
							<span>Email</span>
							<div className="relative">
								<Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									type="email"
									placeholder="Email"
									autoComplete="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									required
									className="h-11 rounded-xl bg-card pl-10"
								/>
							</div>
						</label>

						<div className="space-y-2 text-xs font-medium">
							<label htmlFor="password">Password</label>
							<div className="relative">
								<Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									placeholder="Password"
									autoComplete={isSignUp ? "new-password" : "current-password"}
									minLength={8}
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									required
									className="h-11 rounded-xl bg-card pl-10 pr-10"
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={() => setShowPassword((value) => !value)}
									className="absolute right-1.5 top-1/2 size-8 -translate-y-1/2 rounded-full"
									aria-label={showPassword ? "Hide password" : "Show password"}
								>
									{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
								</Button>
							</div>
						</div>

						{message && (
							<p
								role={isSuccess ? "status" : "alert"}
								className={`rounded-xl border p-3 text-xs leading-5 ${isSuccess ? "border-primary/25 bg-primary/[0.07] text-primary" : "border-destructive/25 bg-destructive/[0.07] text-destructive"}`}
							>
								{message}
							</p>
						)}

						<Button
							type="submit"
							disabled={loadingAction !== null}
							className="h-11 w-full rounded-xl"
						>
							{loadingAction === "email" ? <Loader2 className="size-4 animate-spin" /> : null}
							{isSignUp ? "Create account" : "Sign In"}
							{loadingAction !== "email" && <ArrowRight className="size-4" />}
						</Button>
					</form>

					<div className="mt-6 text-center">
						<Button
							variant="link"
							onClick={() => {
								setIsSignUp((value) => !value);
								setMessage("");
							}}
							className="text-xs text-muted-foreground"
						>
							{isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
						</Button>
					</div>
				</div>
			</main>
		</div>
	);
}
