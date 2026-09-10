import { describe, expect, it } from "vitest";
import { makeBatchPrompt } from "@/lib/prompts";

describe("makeBatchPrompt", () => {
	it("formats debt-to-equity in the percentage-point unit supplied by Yahoo", () => {
		const prompt = makeBatchPrompt([{ symbol: "AAPL", metric: "debt_to_equity", value: 147 }]);

		expect(prompt).toContain("AAPL debt-to-equity: 147.0%");
	});

	it("keeps the sign when compacting negative currency values", () => {
		const prompt = makeBatchPrompt([
			{ symbol: "TEST", metric: "total_cash", value: -2_500_000_000 },
		]);

		expect(prompt).toContain("TEST total cash: -$2.50B");
	});
});
