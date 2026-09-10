import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("Next.js server package configuration", () => {
	it("keeps native provider clients outside the server bundle", () => {
		expect(nextConfig.serverExternalPackages).toEqual(
			expect.arrayContaining(["@alpacahq/alpaca-trade-api", "yahoo-finance2"]),
		);
	});
});
