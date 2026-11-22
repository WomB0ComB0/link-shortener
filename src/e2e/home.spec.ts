import { expect, test } from "@playwright/test";

test("landing page renders the primary action", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("link", { name: "Create Link" })).toBeVisible();
});

test("landing page links to authentication", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("link", { name: "Login" }).click();
	await expect(page).toHaveURL(/\/auth$/);
	await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
});

test("create page shows recent-links loading skeleton while fetching and retry card on error", async ({
	page,
}) => {
	let shouldFail = true;
	await page.route("**/api/links/public**", async (route) => {
		if (shouldFail) {
			await new Promise((r) => setTimeout(r, 150));
			await route.fulfill({
				status: 400,
				contentType: "application/json",
				body: JSON.stringify({ message: "Database temporarily unavailable" }),
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify([
				{
					id: "550e8400-e29b-41d4-a716-446655440001",
					shortUrl: "recovered",
					originalUrl: "https://mikeodnis.dev",
					customAlias: "recovered",
					createdAt: "2026-01-01T00:00:00.000Z",
					totalClicks: 4,
				},
			]),
		});
	});

	await page.goto("/create");
	await expect(page.locator("[data-placeholder]").first()).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Could not load recent links" }),
	).toBeVisible();
	shouldFail = false;
	await page.getByRole("button", { name: "Retry" }).click();
	await expect(page.getByText("/recovered")).toBeVisible();
});

test("link cards show non-blocking health badge only for unavailable or temporary destinations", async ({
	page,
}) => {
	await page.route("**/api/links/public**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify([
				{
					id: "550e8400-e29b-41d4-a716-446655440010",
					shortUrl: "healthy",
					originalUrl: "https://mikeodnis.dev/projects",
					customAlias: "healthy",
					createdAt: "2026-01-01T00:00:00.000Z",
					totalClicks: 2,
				},
				{
					id: "550e8400-e29b-41d4-a716-446655440011",
					shortUrl: "broken",
					originalUrl: "https://dead.example/gone",
					customAlias: "broken",
					createdAt: "2026-01-01T00:00:00.000Z",
					totalClicks: 0,
				},
			]),
		});
	});
	await page.route("**/api/links/health**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				links: {
					"https://mikeodnis.dev/projects": {
						status: "reachable",
						checkedAt: "2026-11-22T12:00:00.000Z",
					},
					"https://dead.example/gone": {
						status: "unavailable",
						checkedAt: "2026-11-22T12:00:00.000Z",
					},
				},
			}),
		});
	});

	await page.goto("/create");
	await expect(page.getByText("/healthy")).toBeVisible();
	await expect(page.getByText("/broken")).toBeVisible();
	await expect(page.locator('[data-link-health="unavailable"]')).toBeVisible();
	await expect(page.locator('[data-link-health="reachable"]')).toHaveCount(0);
});
