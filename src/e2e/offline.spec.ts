import { expect, test } from "@playwright/test";

test("offline page exposes recovery actions", async ({ page }) => {
	await page.goto("/offline");

	await expect(page.getByRole("heading", { name: "You're Offline" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Go Home" })).toBeVisible();
});
