import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PWA_MANIFEST, THEME_COLOR } from "../../app/config/pwa";
import { buildOgImageUrl } from "../../app/composables/use-page-seo";
import { createPageCard, createSiteCard } from "./cards";
import { OG_IMAGE_SIZE, SITE_TAGLINE } from "./constants";
import { clearOgRenderCache, renderCardCached, renderOgPng } from "./render";
import { clipText, fitDescription, fitTitle, readPageCard } from "./text";

function readPngDimensions(png: Uint8Array): { width: number; height: number } {
	// PNG signature: 89 50 4E 47 0D 0A 1A 0A; IHDR width at bytes 16..19, height at 20..23
	const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	for (let i = 0; i < sig.length; i++) {
		expect(png[i]).toBe(sig[i]);
	}
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	return {
		width: view.getUint32(16, false),
		height: view.getUint32(20, false),
	};
}

describe("Dynamic OpenGraph cards & Live Console PWA manifest", () => {
	it("fits and clips page titles and descriptions safely", () => {
		expect(fitTitle("Dashboard")).toEqual({ text: "Dashboard", fontSize: 104 });
		expect(fitTitle("Create Short Link")).toEqual({
			text: "Create Short Link",
			fontSize: 80,
		});
		const longTitle = fitTitle(
			"A very long page heading that needs to step down to the smallest title font size safely",
		);
		expect(longTitle.fontSize).toBe(64);
		expect(longTitle.text.length).toBeLessThanOrEqual(80);
		expect(longTitle.text.endsWith("…")).toBe(true);

		const longDesc = "word ".repeat(50).trim();
		expect(fitDescription(longDesc, longTitle).length).toBeLessThanOrEqual(110);
		expect(clipText("short text", 50)).toBe("short text");

		expect(readPageCard(new URLSearchParams())).toBeNull();
		expect(readPageCard(new URLSearchParams("title=   \n\t  "))).toBeNull();
		expect(readPageCard(new URLSearchParams("title=API+Keys"))).toEqual({
			title: "API Keys",
			description: SITE_TAGLINE,
		});
	});

	it("builds canonical OG image URLs for site and subpages", () => {
		expect(
			buildOgImageUrl({
				title: "Links - Mike Odnis",
				description: SITE_TAGLINE,
				useSiteCard: true,
			}),
		).toBe("https://links.mikeodnis.dev/opengraph-image");

		expect(
			buildOgImageUrl({
				title: "Dashboard",
				description: "Manage your short links.",
			}),
		).toBe(
			"https://links.mikeodnis.dev/api/og?title=Dashboard&description=Manage+your+short+links.",
		);
	});

	it("renders valid 1200x630 PNGs for both SiteCard and dynamic PageCard", async () => {
		clearOgRenderCache();

		const siteCard = createSiteCard();
		expect(
			(siteCard.props.style as Record<string, unknown>).boxSizing,
		).toBe("border-box");

		const sitePng = await renderOgPng(siteCard);
		expect(readPngDimensions(sitePng)).toEqual(OG_IMAGE_SIZE);
		expect(sitePng.byteLength).toBeGreaterThan(5_000);

		const pagePng = await renderOgPng(
			createPageCard({
				title: "Create Short Link",
				description: "Shorten and security-verify a destination URL.",
			}),
		);
		expect(readPngDimensions(pagePng)).toEqual(OG_IMAGE_SIZE);
		expect(pagePng.byteLength).toBeGreaterThan(5_000);

		// Verify LRU cache returns identical bytes on repeat render
		const c1 = await renderCardCached({
			title: "API Keys",
			description: "Manage programmatic API keys.",
		});
		const c2 = await renderCardCached({
			title: "API Keys",
			description: "Manage programmatic API keys.",
		});
		expect(c1).toBe(c2);
	});

	it("keeps PWA manifests synced with Live Console palette and existing disk icons", () => {
		const root = process.cwd();
		const manifestJson = JSON.parse(
			readFileSync(join(root, "public/manifest.json"), "utf8"),
		);
		const manifestWeb = JSON.parse(
			readFileSync(join(root, "public/manifest.webmanifest"), "utf8"),
		);

		expect(manifestJson).toEqual(manifestWeb);
		expect(manifestJson.theme_color).toBe(THEME_COLOR);
		expect(manifestJson.background_color).toBe(THEME_COLOR);
		expect(PWA_MANIFEST.theme_color).toBe("#0c0c14");
		expect(PWA_MANIFEST.share_target.action).toBe("/create");

		for (const icon of PWA_MANIFEST.icons) {
			const iconPath = join(root, "public", icon.src);
			expect(existsSync(iconPath), `Missing icon on disk: ${icon.src}`).toBe(
				true,
			);
		}
		for (const shortcut of PWA_MANIFEST.shortcuts) {
			for (const icon of shortcut.icons) {
				const iconPath = join(root, "public", icon.src);
				expect(
					existsSync(iconPath),
					`Missing shortcut icon on disk: ${icon.src}`,
				).toBe(true);
			}
		}
	});
});
