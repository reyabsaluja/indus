const AI_FUNCTIONS = ["batch-explain", "context-chat", "generate-report"] as const;

export type AiFunctionName = (typeof AI_FUNCTIONS)[number];

export interface AiAccessClient {
	auth: {
		getUser: () => Promise<{
			data: { user: { id: string } | null };
			error: unknown;
		}>;
	};
	rpc: (
		name: "consume_ai_quota",
		params: { p_function_name: AiFunctionName },
	) => Promise<{
		data: Array<{ allowed: boolean; remaining: number; reset_at: string }> | null;
		error: unknown;
	}>;
}

export function getAiQuotaHeaders(result: AiAccessResult): Record<string, string> {
	const resetAt = result.resetAt;
	if (!resetAt) return {};

	const headers: Record<string, string> = {
		"X-RateLimit-Reset": resetAt,
	};

	if (result.allowed) {
		headers["X-RateLimit-Remaining"] = result.remaining.toString();
	} else {
		const retryAfterSeconds = Math.max(
			1,
			Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000),
		);
		headers["Retry-After"] = retryAfterSeconds.toString();
	}

	return headers;
}

export type AiAccessResult =
	| { allowed: true; userId: string; remaining: number; resetAt: string }
	| { allowed: false; status: 401 | 429 | 503; error: string; resetAt?: string };

export async function checkAiAccess(
	client: AiAccessClient,
	functionName: AiFunctionName,
): Promise<AiAccessResult> {
	const {
		data: { user },
		error: userError,
	} = await client.auth.getUser();

	if (userError || !user) {
		return { allowed: false, status: 401, error: "Unauthorized" };
	}

	const { data, error } = await client.rpc("consume_ai_quota", {
		p_function_name: functionName,
	});
	const quota = data?.[0];

	if (error || !quota) {
		return { allowed: false, status: 503, error: "AI quota service unavailable" };
	}

	if (!quota.allowed) {
		return {
			allowed: false,
			status: 429,
			error: "AI request quota exceeded",
			resetAt: quota.reset_at,
		};
	}

	return {
		allowed: true,
		userId: user.id,
		remaining: quota.remaining,
		resetAt: quota.reset_at,
	};
}
