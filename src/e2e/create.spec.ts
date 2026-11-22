import { expect, test } from "@playwright/test";

test("create-link page exposes the anonymous creation form", async ({ page }) => {
	await page.goto("/create");
	await page.waitForTimeout(2000);
	await page.waitForTimeout(500);

	await expect(
		page.getByRole("heading", { name: "Create Short Link" }),
	).toBeVisible();
	await expect(page.getByLabel("Master Password")).toBeVisible();
	await expect(page.getByLabel("Original URL")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Create Short Link" }),
	).toBeDisabled();
});

test("anonymous creation form accepts password and URL input", async ({
	page,
}) => {
	await page.goto("/create");

	await page.locator("#masterPassword").fill("master-password");
	await page.locator("#originalUrl").fill("https://example.com");
	await expect(page.locator("#masterPassword")).toHaveValue("master-password");
	await expect(page.locator("#originalUrl")).toHaveValue("https://example.com");
});

test("successful link creation renders the generated short link", async ({ page }) => {
	await page.route("**/api/links/public**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: "[]",
		});
	});
	await page.route("**/api/links/create", async (route) => {
		expect(route.request().postDataJSON()).toEqual({
			originalUrl: "https://example.com",
		});
		expect(route.request().headers()["x-master-password"]).toBe("master-password");
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				id: "550e8400-e29b-41d4-a716-446655440000",
				shortUrl: "abc123",
				originalUrl: "https://example.com",
				customAlias: null,
				createdAt: "2026-01-01T00:00:00.000Z",
			}),
		});
	});

	await page.goto("/create");
	await page.waitForTimeout(2500);
	await page.locator("#masterPassword").fill("master-password");
	await page.locator("#originalUrl").fill("https://example.com");
	const submit = page.getByRole("button", { name: "Create Short Link" });
	await expect(submit).toBeEnabled();
	await submit.click();

	await expect(page.getByText("Link created successfully!")).toBeVisible();
	await expect(page.locator("input[readonly]")).toHaveValue(/\/abc123$/);
});

test("failed link creation keeps the form and displays the HTTP error", async ({ page }) => {
	await page.route("**/api/links/public**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: "[]",
		});
	});
	await page.route("**/api/links/create", async (route) => {
		await route.fulfill({
			status: 422,
			contentType: "application/json",
			body: JSON.stringify({ message: "URL verification failed" }),
		});
	});

	await page.goto("/create");
	await page.waitForTimeout(2500);
	await page.locator("#masterPassword").fill("master-password");
	await page.locator("#originalUrl").fill("https://blocked.example");
	const submit = page.getByRole("button", { name: "Create Short Link" });
	await expect(submit).toBeEnabled();
	await submit.click();

	await expect(page.getByText(/HTTP 422/)).toBeVisible();
	await expect(page.getByText("Link created successfully!")).not.toBeVisible();
});

test("security violation renders risk score and per-stage check statuses", async ({
	page,
}) => {
	await page.route("**/api/links/public**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: "[]",
		});
	});
	await page.route("**/api/links/create", async (route) => {
		await route.fulfill({
			status: 403,
			contentType: "application/json",
			body: JSON.stringify({
				statusCode: 403,
				statusMessage: "Security Violation",
				message:
					"URL failed security verification: Potential phishing detected (65% confidence)",
				data: {
					verification: {
						isVerified: false,
						overallRisk: "critical",
						riskScore: 85,
						checks: {
							url: { passed: true, warnings: 0 },
							dns: { passed: true, warnings: 0 },
							ssl: { passed: true, warnings: 0 },
							redirects: { passed: true, warnings: 0 },
							phishing: { passed: false, warnings: 0 },
							malware: { passed: true, warnings: 0 },
						},
					},
				},
			}),
		});
	});

	await page.goto("/create");
	await page.waitForTimeout(2500);
	await page.locator("#masterPassword").fill("master-password");
	await page.locator("#originalUrl").fill("https://paypa1.com/login");
	const submit = page.getByRole("button", { name: "Create Short Link" });
	await expect(submit).toBeEnabled();
	await submit.click();

	await expect(page.getByText(/Potential phishing detected/)).toBeVisible();
	await expect(page.getByText("Risk 85/100")).toBeVisible();
	await expect(
		page.locator("li", { hasText: "Phishing & homograph heuristics" }).getByText("Blocked"),
	).toBeVisible();
	await expect(
		page.locator("li", { hasText: "URL format & SSRF guard" }).getByText("Verified"),
	).toBeVisible();
});

test("invalid master password error does not falsely mark security pipeline checks as blocked", async ({
	page,
}) => {
	await page.route("**/api/links/public**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: "[]",
		});
	});
	await page.route("**/api/links/create", async (route) => {
		await route.fulfill({
			status: 403,
			contentType: "application/json",
			body: JSON.stringify({
				statusCode: 403,
				statusMessage: "Forbidden",
				message: "Invalid master password",
			}),
		});
	});

	await page.goto("/create");
	await page.waitForTimeout(2500);
	await page.locator("#masterPassword").fill("wrong-password");
	await page.locator("#originalUrl").fill("https://mikeodnis.dev/projects");
	const submit = page.getByRole("button", { name: "Create Short Link" });
	await expect(submit).toBeEnabled();
	await submit.click();

	await expect(page.getByText(/Invalid master password/)).toBeVisible();
	await expect(
		page.locator("li", { hasText: "URL format & SSRF guard" }).getByText("Valid syntax"),
	).toBeVisible();
	await expect(page.getByText("Blocked")).toHaveCount(0);
});
