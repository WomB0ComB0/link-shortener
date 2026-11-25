import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildBreadcrumbJsonLd,
	buildSiteGraphJsonLd,
	SITE_FAQS,
} from "../../app/utils/structured-data";

describe("SEO / AEO / GEO artifacts & Schema.org structured data", () => {
	const root = process.cwd();

	it("robots.txt allows dynamic OG cards, manifest, and llms.txt while protecting private routes", () => {
		const robots = readFileSync(join(root, "public/robots.txt"), "utf8");
		expect(robots).toContain("Allow: /api/og");
		expect(robots).toContain("Allow: /manifest.webmanifest");
		expect(robots).toContain("Allow: /llms.txt");
		expect(robots).toContain("Allow: /llms-full.txt");
		expect(robots).toContain("Disallow: /api/");
		expect(robots).toContain("Disallow: /dashboard");
		expect(robots).toContain("Disallow: /keys");
		expect(robots).not.toContain("Disallow: /manifest.webmanifest");
		expect(robots).toContain("Sitemap: https://links.mikeodnis.dev/sitemap.xml");
	});

	it("sitemap.xml lists only indexable public pages (no robots-blocked routes)", () => {
		const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
		expect(sitemap).toContain("<loc>https://links.mikeodnis.dev/</loc>");
		expect(sitemap).toContain("<loc>https://links.mikeodnis.dev/create</loc>");
		expect(sitemap).toContain("<loc>https://links.mikeodnis.dev/auth</loc>");
		expect(sitemap).not.toContain("/dashboard");
		expect(sitemap).not.toContain("/keys");
		expect(sitemap).not.toContain("/manifest.json");
	});

	it("llms.txt and llms-full.txt follow llmstxt.org format and reflect current stack", () => {
		const llms = readFileSync(join(root, "public/llms.txt"), "utf8");
		const llmsFull = readFileSync(join(root, "public/llms-full.txt"), "utf8");

		expect(llms.startsWith("# Links - Mike Odnis\n\n> ")).toBe(true);
		expect(llms).toContain("https://links.mikeodnis.dev/llms-full.txt");
		expect(llms).not.toContain("Nuxt 3");
		expect(llms).not.toContain("Proprietary");

		expect(llmsFull).toContain("Nuxt 4");
		expect(llmsFull).toContain("Apache License 2.0");
		expect(llmsFull).toContain("9-Stage Synchronous URL Security & OSINT Pipeline");
		expect(llmsFull).toContain("ip_address: null");
	});

	it("emits valid WebSite, Person, WebApplication, FAQPage, and BreadcrumbList JSON-LD", () => {
		const graph = buildSiteGraphJsonLd();
		expect(graph["@context"]).toBe("https://schema.org");
		const items = graph["@graph"] as Array<Record<string, unknown>>;
		const types = items.map((item) => item["@type"]);
		expect(types).toEqual(["Person", "WebSite", "WebApplication", "FAQPage"]);

		const faq = items.find((item) => item["@type"] === "FAQPage");
		expect((faq?.mainEntity as unknown[]).length).toBe(SITE_FAQS.length);

		const crumb = buildBreadcrumbJsonLd("/create", "Create Short Link");
		expect(crumb["@type"]).toBe("BreadcrumbList");
		expect((crumb.itemListElement as unknown[]).length).toBe(2);
	});
});
