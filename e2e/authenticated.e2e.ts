import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const email = process.env.E2E_AUTH_EMAIL;
const password = process.env.E2E_AUTH_PASSWORD;

const companyFixture = {
	symbol: "AAPL",
	longName: "Apple Inc.",
	shortName: "Apple",
	regularMarketPrice: 213.32,
	regularMarketChange: 2.7,
	regularMarketChangePercent: 1.28,
	currency: "USD",
	longBusinessSummary:
		"Apple designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and services. The company serves consumer, small-business, education, enterprise, and government markets around the world.",
	website: "https://apple.com",
	sector: "Technology",
	industry: "Consumer Electronics",
	city: "Cupertino",
	state: "California",
	country: "United States",
	marketCap: 3_190_000_000_000,
	enterpriseValue: 3_240_000_000_000,
	sharesOutstanding: 14_950_000_000,
	revenue: 391_000_000_000,
	employees: 164_000,
	peRatio: 33.1,
	forwardPE: 29.4,
	priceToBook: 48.2,
	priceToSales: 8.2,
	evToSales: 8.3,
	evToEbitda: 24.6,
	pegRatio: 2.1,
	grossMargins: 0.466,
	ebitdaMargins: 0.34,
	operatingMargins: 0.315,
	netProfitMargins: 0.243,
	returnOnAssets: 0.226,
	returnOnEquity: 1.57,
	totalCash: 65_000_000_000,
	totalDebt: 101_000_000_000,
	debtToEquity: 187,
	revenueGrowth: 0.061,
	earningsGrowth: 0.089,
	dividendYield: 0.0045,
	dividendRate: 1,
	payoutRatio: 0.149,
	beta: 1.18,
};

async function mockCompanyResearch(page: Page) {
	const requestedTimeframes: string[] = [];
	const historyRequests: string[] = [];
	const analystQuestions: string[] = [];
	const explanationRequests: Array<Array<{ symbol: string; metric: string; value: number }>> = [];
	await page.route("**/api/stock-data?**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ data: companyFixture }),
		});
	});
	await page.route("**/api/alpaca?**", async (route) => {
		const url = new URL(route.request().url());
		historyRequests.push(url.toString());
		requestedTimeframes.push(url.searchParams.get("timeframe") ?? "");
		if (url.searchParams.has("end")) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ data: [], isEmpty: true, totalBars: 0 }),
			});
			return;
		}
		const now = Number(url.searchParams.get("end")) || Math.floor(Date.now() / 1000);
		const data = Array.from({ length: 80 }, (_, index) => {
			const open = 192 + index * 0.25;
			return {
				time: now - (79 - index) * 60 * 30,
				open,
				high: open + 1.2,
				low: open - 0.8,
				close: open + 0.55,
				volume: 1_000_000 + index * 2_000,
			};
		});
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data,
				isEmpty: false,
				totalBars: data.length,
				earliestTimestamp: data[0].time,
			}),
		});
	});
	await page.route("**/api/batch-explain", async (route) => {
		const items = route.request().postDataJSON() as Array<{
			symbol: string;
			metric: string;
			value: number;
		}>;
		explanationRequests.push(items);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				explanations: Object.fromEntries(
					items.map((item) => [
						`${item.symbol}_${item.metric}`,
						JSON.stringify({
							metric_display: `**${item.metric}: ${item.value}**`,
							insight: `AI review for ${item.metric}.`,
							evaluation: "neutral",
							source: "model",
						}),
					]),
				),
			}),
		});
	});
	await page.route("**/api/context-chat", async (route) => {
		const body = route.request().postDataJSON() as { newMessage: string };
		analystQuestions.push(body.newMessage);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ response: `Analyst answer ${analystQuestions.length}.` }),
		});
	});
	await page.route("**/api/stream/**", async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
			body: "event: stream-error\ndata: {}\n\n",
		});
	});
	return { analystQuestions, explanationRequests, historyRequests, requestedTimeframes };
}

test.beforeEach(async ({ page }) => {
	if (!email || !password) {
		throw new Error("Authenticated test credentials are required");
	}

	await page.goto("/auth");
	const signInForm = page.locator("form:visible");
	await signInForm.getByRole("textbox", { name: "Email", exact: true }).fill(email);
	await signInForm.getByPlaceholder("Password").fill(password);
	await signInForm.getByRole("button", { name: "Sign In", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
});

test("@authenticated dashboard loads with a verified session", async ({ page }) => {
	await expect(page.getByRole("heading", { name: "Company research" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Your Favorites" })).toBeVisible();
});

test("@authenticated auth page redirects an existing session", async ({ page }) => {
	await page.goto("/auth");
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(page.getByRole("heading", { name: "Company research" })).toBeVisible();
});

test("@authenticated queryless crypto route renders its empty state", async ({ page }) => {
	await page.goto("/crypto");
	await expect(page).toHaveURL(/\/crypto$/);
	await expect(page.getByText("No Cryptocurrency Selected", { exact: true })).toBeVisible();
});

test("@authenticated reports route renders for the current tenant", async ({ page }) => {
	await page.goto("/reports");
	await expect(page).toHaveURL(/\/reports$/);
	await expect(page.getByRole("heading", { name: "Research Reports" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Your Reports" })).toBeVisible();
});

test("@authenticated reports API returns only the current tenant collection", async ({ page }) => {
	const response = await page.request.get("/api/reports");

	expect(response.status()).toBe(200);
	expect(await response.json()).toEqual({ reports: [] });
});

test("@authenticated structured reports render fully and download PDF export", async ({ page }) => {
	const reportContent = JSON.stringify({
		version: 2,
		executiveSummary:
			"Apple produces consumer devices. The supplied snapshot provides current market and financial figures without a peer comparison.",
		financialSnapshot: [
			{
				label: "Market capitalization",
				value: "$4.75T",
				analysis: "This final metric explanation must remain visible.",
			},
		],
		analysisAndWatchpoints: ["Track margins alongside future growth updates."],
		recentNews: [
			{
				headline: "Apple announces a product update",
				publisher: "Example News",
				publishedAt: "2026-09-02T10:00:00.000Z",
				url: "https://example.test/apple-update",
				impact: "The update may affect product expectations, but the direction is uncertain.",
			},
		],
		dataLimitations: ["No historical comparison was supplied."],
	});
	await page.route(/\/api\/reports$/, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				reports: [
					{
						id: "4d606955-c4bc-4b20-9ea9-a3715060212a",
						symbol: "AAPL",
						company_name: "Apple Inc.",
						report_content: reportContent,
						created_at: "2026-09-02T12:00:00.000Z",
						status: "completed",
						summary:
							"A complete report summary that remains readable without fixed-height clipping.",
					},
				],
			}),
		});
	});
	const pdfRoute = /\/api\/reports\/[^/]+\/pdf$/;
	await page.route(pdfRoute, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/pdf; charset=binary",
			headers: {
				"Content-Disposition": 'attachment; filename="AAPL-research-report-2026-09-02.pdf"',
			},
			body: "%PDF-1.4 test",
		});
	});

	await page.goto("/reports");
	await expect(page.getByText(/complete report summary/)).toBeVisible();
	await page.getByRole("button", { name: "View Report" }).click();
	await expect(page.getByRole("heading", { name: "Executive Summary" })).toBeVisible();
	await expect(page.getByText("$4.75T")).toBeVisible();
	await expect(page.getByText(/final metric explanation must remain visible/)).toBeVisible();
	await expect(page.getByRole("heading", { name: "Analysis and Watchpoints" })).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Recent News and Potential Impact" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Apple announces a product update" }),
	).toHaveAttribute("href", "https://example.test/apple-update");
	await expect
		.poll(() =>
			page
				.locator("[data-report-document]")
				.evaluate((report) => report.scrollWidth <= report.clientWidth),
		)
		.toBe(true);

	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export PDF" }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe("AAPL-research-report-2026-09-02.pdf");

	await page.unroute(pdfRoute);
	await page.route(pdfRoute, async (route) => {
		await route.fulfill({
			status: 500,
			contentType: "application/json",
			body: JSON.stringify({ error: "Unable to export report" }),
		});
	});
	await page.getByRole("button", { name: "Export PDF" }).click();
	await expect(
		page.getByText("PDF export failed. Please try again.", { exact: true }),
	).toBeVisible();
});

test("@authenticated incomplete legacy reports are not presented as complete", async ({ page }) => {
	await page.route(/\/api\/reports$/, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				reports: [
					{
						id: "4d606955-c4bc-4b20-9ea9-a3715060212b",
						symbol: "AAPL",
						company_name: "Apple Inc.",
						report_content: "## Executive Summary\nApple has a market capitalization of 4,",
						created_at: "2026-09-03T08:59:16.000Z",
						status: "completed",
						summary: "An incomplete provider response",
					},
				],
			}),
		});
	});

	await page.goto("/reports");
	await page.getByRole("button", { name: "View Report" }).click();
	await expect(
		page.getByRole("heading", { name: "Report Generation Was Incomplete" }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(0);
});

test("@authenticated settings route renders for the current tenant", async ({ page }) => {
	await page.goto("/settings");
	await expect(page).toHaveURL(/\/settings$/);
	await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});

test("@authenticated stock search stays focused on search and results", async ({ page }) => {
	await page.goto("/search");
	const form = page
		.locator("form")
		.filter({ has: page.getByPlaceholder("Type any stock symbol...") });
	await expect(form).toBeVisible();
	await expect(page.getByText("Search Tips:")).toHaveCount(0);
	await expect(page.getByRole("heading", { name: "Browse by Category" })).toBeVisible();
});

test("@authenticated account menu opens Profile & Account settings", async ({ page }) => {
	await page.goto("/settings");
	await page.getByRole("button", { name: "Appearance" }).click();
	await expect(page).toHaveURL(/\/settings#appearance$/);
	await page.getByRole("button", { name: "Open account menu" }).click();
	const accountLink = page.getByRole("menuitem", { name: "Account", exact: true });
	await expect(accountLink).toHaveAttribute("href", "/settings#profile");
	await accountLink.click();
	await expect(page).toHaveURL(/\/settings#profile$/);
	await expect(page.locator("#profile")).toContainText("Profile & Account");
});

test("@authenticated account settings provide a working log out button", async ({ page }) => {
	await page.goto("/settings#profile");
	await page.getByRole("button", { name: "Log out" }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("@authenticated company research connects chart ranges to the analyst", async ({ page }) => {
	const { analystQuestions, explanationRequests, historyRequests, requestedTimeframes } =
		await mockCompanyResearch(page);
	await page.goto("/dashboard");
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
	await page.getByRole("link", { name: /AAPL Apple/ }).click();

	await expect(page.getByRole("heading", { name: "Apple Inc." })).toBeVisible();
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
	await expect(page.getByRole("region", { name: "AAPL price chart" })).toBeVisible();
	await expect
		.poll(() =>
			page
				.getByText("O", { exact: true })
				.evaluate((element) => getComputedStyle(element).fontSize),
		)
		.toBe("12px");
	await expect(page.getByText("Ask about the company.", { exact: true })).toBeVisible();
	await expect(
		page.getByText("Cupertino, California, United States", { exact: true }),
	).toBeVisible();
	expect(explanationRequests).toHaveLength(0);

	await page.getByRole("button", { name: "1Y" }).click();
	await expect.poll(() => requestedTimeframes).toContain("1Day");
	await page.waitForTimeout(400);
	expect(historyRequests.some((requestUrl) => new URL(requestUrl).searchParams.has("end"))).toBe(
		false,
	);
	const chart = page.getByRole("img", { name: /AAPL 1Y chart/ });
	await chart.scrollIntoViewIfNeeded();
	const chartBounds = await chart.boundingBox();
	expect(chartBounds).not.toBeNull();
	if (chartBounds) {
		const y = chartBounds.y + chartBounds.height / 2;
		for (let attempt = 0; attempt < 3; attempt += 1) {
			await page.mouse.move(chartBounds.x + chartBounds.width * 0.2, y);
			await page.mouse.down();
			await page.mouse.move(chartBounds.x + chartBounds.width * 0.9, y, { steps: 8 });
			await page.mouse.up();
		}
	}

	await page.getByText("33.1", { exact: true }).last().hover();
	await expect(page.getByText("AI review for pe_ratio.", { exact: true })).toBeVisible();
	expect(explanationRequests).toEqual([[{ symbol: "AAPL", metric: "pe_ratio", value: 33.1 }]]);
	await expect(page.getByText("Neutral", { exact: true })).toBeVisible();
	await expect(page.getByText(/^\{\s*"1"/)).toHaveCount(0);
	await expect(page.getByText("Context needed", { exact: true })).toHaveCount(0);

	await page.getByRole("button", { name: /Valuation/ }).click();
	await expect
		.poll(() => analystQuestions)
		.toContain("What expectations are embedded in this valuation?");
	const analyst = page.getByRole("dialog", { name: /Valuation/ });
	await expect(analyst).toBeVisible();
	await expect(analyst.getByText("Analyst answer 1.", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Hide Indus Analyst" }).click();
	await expect(analyst).toBeHidden();
	await page.getByRole("button", { name: "Show Indus Analyst" }).click();
	await expect(analyst).toBeVisible();
	await expect(analyst.getByText("Analyst answer 1.", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Hide Indus Analyst" }).click();
	await page.getByRole("button", { name: /Profitability/ }).click();
	await expect
		.poll(() => analystQuestions)
		.toContain("What does this margin say about earnings quality?");
	await expect(page.getByRole("dialog")).toHaveCount(1);
	await expect(page.getByText("Analyst answer 1.", { exact: true })).toBeVisible();
	await expect(page.getByText("Analyst answer 2.", { exact: true })).toBeVisible();
	await expect
		.poll(() => historyRequests.some((requestUrl) => new URL(requestUrl).searchParams.has("end")))
		.toBe(true);
	await expect(page.getByText("Oldest available data reached", { exact: true })).toBeVisible();
});

for (const path of ["/dashboard", "/crypto", "/reports", "/search", "/settings"]) {
	test(`@authenticated ${path} has no serious accessibility violations`, async ({ page }) => {
		await page.goto(path);
		await expect(page).toHaveTitle(/Indus/);
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		const seriousViolations = results.violations.filter(({ impact }) =>
			["serious", "critical"].includes(impact ?? ""),
		);

		expect(seriousViolations, `${path} accessibility violations`).toEqual([]);
	});
}
