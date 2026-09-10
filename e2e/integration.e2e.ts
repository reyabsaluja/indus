import { expect, test } from "@playwright/test";

test("@integration public navigation reaches authentication", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("link", { name: "Open Indus" }).click();
	await expect(page).toHaveURL(/\/auth$/);
	await expect(page.getByRole("heading", { name: "Continue your research." })).toBeVisible();
});

test("@integration protected pages redirect anonymous users", async ({ page }) => {
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/auth(?:\?|$)/);
});

test("@integration API boundaries reject malformed input", async ({ request }) => {
	const missingMetric = await request.get("/api/metric-definition");
	expect(missingMetric.status()).toBe(400);

	const invalidSymbol = await request.get("/api/stock-data?symbol=%24INVALID");
	expect(invalidSymbol.status()).toBe(400);
});

test("@integration public metric definitions remain available", async ({ request }) => {
	const response = await request.get("/api/metric-definition?metric=P%2FE%20Ratio");
	expect(response.status()).toBe(200);
	await expect(response.json()).resolves.toHaveProperty("definition");
});
