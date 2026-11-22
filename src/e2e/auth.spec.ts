import { expect, test } from "@playwright/test";

test("auth page renders the login form", async ({ page }) => {
	await page.goto("/auth");
	await page.waitForTimeout(2000);
	await page.waitForTimeout(500);

	await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
	await expect(page.getByLabel("Email")).toBeVisible();
	await expect(page.getByLabel("Password")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Don't have an account? Sign up" }),
	).toBeVisible();
});

test("login form accepts credential input", async ({ page }) => {
	await page.goto("/auth");

	const submit = page.getByRole("button", { name: "Login", exact: true });
	await expect(submit).toBeDisabled();
	await page.locator("#email").fill("user@example.com");
	await page.locator("#password").fill("StrongPass1");
	await expect(page.locator("#email")).toHaveValue("user@example.com");
	await expect(page.locator("#password")).toHaveValue("StrongPass1");
});

test("successful login uses HttpOnly session (never localStorage) and redirects to the dashboard", async ({
	page,
}) => {
	await page.route("**/api/auth/login", async (route) => {
		expect(route.request().postDataJSON()).toEqual({
			email: "user@example.com",
			password: "StrongPass1",
		});
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				user: {
					id: "550e8400-e29b-41d4-a716-446655440000",
					email: "user@example.com",
					displayName: "Test User",
					photoUrl: null,
					createdAt: "2026-01-01T00:00:00.000Z",
				},
				token: "signed-session-token-123",
			}),
		});
	});
	await page.route("**/api/links/me", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: "[]",
		});
	});

	await page.goto("/auth");
	await page.waitForTimeout(2500);
	const submit = page.getByRole("button", { name: "Login", exact: true });
	await page.locator("#email").fill("user@example.com");
	await page.locator("#password").fill("StrongPass1");
	await expect(submit).toBeEnabled();
	await submit.click();

	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(
		page.evaluate(() => localStorage.getItem("auth_token")),
	).resolves.toBeNull();
});

test("failed login keeps the user on the auth page and displays the HTTP error", async ({
	page,
}) => {
	await page.route("**/api/auth/login", async (route) => {
		await route.fulfill({
			status: 401,
			contentType: "application/json",
			body: JSON.stringify({ message: "Invalid credentials" }),
		});
	});

	await page.goto("/auth");
	await page.waitForTimeout(2500);
	await page.locator("#email").fill("user@example.com");
	await page.locator("#password").fill("WrongPass1");
	const submit = page.getByRole("button", { name: "Login", exact: true });
	await expect(submit).toBeEnabled();
	await submit.click();

	await expect(page).toHaveURL(/\/auth$/);
	await expect(page.getByText(/HTTP 401/)).toBeVisible();
	await expect(page.evaluate(() => localStorage.getItem("auth_token"))).resolves.toBeNull();
});
