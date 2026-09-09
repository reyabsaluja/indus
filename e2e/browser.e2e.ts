import { expect, test } from "@playwright/test";

test("@browser landing page exposes the primary product path", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: /Financial intelligence, in context/ }),
	).toBeVisible();
	for (const name of ["Sign in", "Open Indus", "Start researching", "Explore an example"]) {
		await expect(page.getByRole("link", { name })).toHaveAttribute("href", "/auth");
	}
	await expect(page.getByText("Review a company in one place.", { exact: true })).toHaveCount(0);
	await expect(
		page.getByText("Research a company without switching tools.", { exact: true }).first(),
	).toBeVisible();
	await expect(
		page.getByText("Know what the product is showing.", { exact: true }).first(),
	).toBeVisible();
	await expect(
		page.getByText("Charts, fundamentals, and AI analysis", { exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Indus home" }).first().locator('img[src*="indus-water"]'),
	).toBeVisible();
	await expect(page.locator('link[rel="icon"][href*="indus-water.svg"]')).toHaveCount(1);
});

test("@browser landing navigation scrolls between sections and returns to the top", async ({
	page,
}) => {
	await page.goto("/");
	await expect
		.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior))
		.toBe("smooth");

	for (const [name, hash] of [
		["Product", "#product"],
		["Workflow", "#workflow"],
		["Principles", "#principles"],
	] as const) {
		await expect(page.locator(`nav a[href="${hash}"]`).first()).toHaveText(name);
	}

	await page
		.locator('nav a[href="#principles"]')
		.first()
		.evaluate((link: HTMLAnchorElement) => link.click());
	await expect(page).toHaveURL(/#principles$/);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(480);

	const backToTop = page.getByRole("link", { name: "Back to top" });
	await expect(backToTop).toHaveAttribute("data-visible", "true");
	await backToTop.click();
	await expect(page).toHaveURL(/#top$/);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
	await expect(page.locator('a[aria-label="Back to top"]')).toHaveAttribute(
		"data-visible",
		"false",
	);
});

test("@browser public pages do not overflow the viewport", async ({ page }) => {
	for (const path of ["/", "/auth", "/help"]) {
		await page.goto(path);
		const dimensions = await page.evaluate(() => ({
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: document.documentElement.clientWidth,
		}));
		expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
	}
});

test("@browser authentication mode can be changed without a reload", async ({ page }) => {
	await page.goto("/auth");
	await expect(
		page.getByText("Charts, fundamentals, and AI analysis", { exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Indus home" }).first().locator('img[src*="indus-water"]'),
	).toBeVisible();
	await page.getByRole("button", { name: "Don't have an account? Sign up" }).click();
	await expect(page.getByRole("heading", { name: "Start your research." })).toBeVisible();
	await expect(page.getByPlaceholder("First Name")).toBeVisible();
});
