import { NextResponse } from "next/server";
import { finishRequestLog, getRequestHeaders, startRequestLog } from "@/lib/observability/request";
import { alpacaEnvSchema, geminiEnvSchema, supabaseEnvSchema } from "@/lib/schemas/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

function readinessConfiguration() {
	const source = {
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
		ALPACA_API_KEY: process.env.ALPACA_API_KEY ?? process.env.NEXT_PUBLIC_ALPACA_API_KEY,
		ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY ?? process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY,
		ALPACA_IS_PAPER:
			process.env.ALPACA_IS_PAPER ?? process.env.NEXT_PUBLIC_ALPACA_IS_PAPER ?? "true",
		GEMINI_API_KEY: process.env.GEMINI_API_KEY,
	};

	return {
		supabase: supabaseEnvSchema.safeParse(source).success ? "configured" : "invalid",
		alpaca: alpacaEnvSchema.safeParse(source).success ? "configured" : "invalid",
		gemini: geminiEnvSchema.safeParse(source).success ? "configured" : "invalid",
	} as const;
}

export async function GET(request: Request) {
	const requestLog = startRequestLog(request, "/api/health");
	const headers = {
		...getRequestHeaders(requestLog),
		"Cache-Control": "no-store",
	};

	const mode = new URL(request.url).searchParams.get("mode") === "live" ? "live" : "ready";
	const checks = {
		process: "ok" as const,
		...(mode === "ready" ? readinessConfiguration() : {}),
	};
	const ready =
		mode === "live" ||
		Object.values(checks).every((value) => value === "ok" || value === "configured");
	const status = ready ? 200 : 503;
	finishRequestLog(requestLog, status, { mode, ready });

	return NextResponse.json(
		{
			status: ready ? "ok" : "degraded",
			mode,
			checks,
			uptimeSeconds: Math.floor(process.uptime()),
			version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "development",
			timestamp: new Date().toISOString(),
		},
		{ status, headers },
	);
}
