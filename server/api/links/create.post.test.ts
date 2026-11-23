import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	getHeader,
	readBody,
	getUserIdFromHeaders,
	verifyLink,
	executeMutation,
	invalidateRedirectCache,
} = vi.hoisted(() => ({
	getHeader: vi.fn(),
	readBody: vi.fn(),
	getUserIdFromHeaders: vi.fn(),
	verifyLink: vi.fn(),
	executeMutation: vi.fn(),
	invalidateRedirectCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
	getHeader,
	readBody,
}));
vi.mock("../../../server/utils/auth", () => ({ getUserIdFromHeaders }));
vi.mock("../../../server/security/verification-pipeline", () => ({
	verifyLink,
}));
vi.mock("../../../server/utils/graphql", () => ({
	executeMutation,
}));
vi.mock("../../../server/cache/redirect-cache", () => ({
	invalidateRedirectCache,
}));

import { metrics } from "../../../server/observability/metrics";
import createLinkHandler from "./create.post";

function makeEvent() {
	return { context: {}, node: { req: { headers: {} } } } as never;
}

function safeVerification(url = "https://example.com/page") {
	return {
		url,
		isVerified: true,
		overallRisk: "safe",
		riskScore: 0,
		checks: {
			urlValidation: { isValid: true, warnings: [] },
			dnsCheck: { isValid: true, warnings: [] },
			sslCheck: { isValid: true, warnings: [] },
			redirectCheck: { isValid: true, warnings: [], finalUrl: url, hopCount: 0 },
			phishingCheck: { isPhishing: false, warnings: [] },
			malwareCheck: { isSafe: true, threats: [], errors: [], warnings: [] },
		},
		summary: {
			totalErrors: 0,
			totalWarnings: 0,
			criticalIssues: [],
			recommendations: [],
		},
	};
}

describe("POST /api/links/create strict security & atomic insert enforcement", () => {
	beforeEach(() => {
		getHeader.mockReset();
		readBody.mockReset();
		getUserIdFromHeaders.mockReset();
		verifyLink.mockReset();
		executeMutation.mockReset();
		invalidateRedirectCache.mockClear();
		metrics.reset();
		delete process.env.ADMIN_BYPASS_SECRET;

		getUserIdFromHeaders.mockResolvedValue("user-123");
		readBody.mockResolvedValue({
			originalUrl: "https://example.com/page",
			customAlias: "my-alias",
		});
	});

	it("never bypasses verification when ADMIN_BYPASS_SECRET is unset or x-skip-verification is spoofed", async () => {
		getHeader.mockImplementation((_ev: unknown, name: string) =>
			name === "x-skip-verification" ? "true" : undefined,
		);
		verifyLink.mockResolvedValueOnce({
			...safeVerification(),
			isVerified: false,
			overallRisk: "critical",
			riskScore: 90,
			summary: {
				totalErrors: 1,
				totalWarnings: 0,
				criticalIssues: ["URL security check failed"],
				recommendations: [],
			},
		});

		await expect(createLinkHandler(makeEvent())).rejects.toMatchObject({
			statusCode: 403,
			statusMessage: "Security Violation",
		});
		expect(verifyLink).toHaveBeenCalledTimes(1);
	});

	it("blocks high-risk and unverified URLs even for authenticated users", async () => {
		verifyLink.mockResolvedValueOnce({
			...safeVerification(),
			isVerified: false,
			overallRisk: "high",
			riskScore: 68,
			summary: {
				totalErrors: 0,
				totalWarnings: 1,
				criticalIssues: ["Potential phishing detected (65% confidence)"],
				recommendations: [],
			},
		});

		await expect(createLinkHandler(makeEvent())).rejects.toMatchObject({
			statusCode: 403,
			statusMessage: "Security Violation",
		});
	});

	it("fails closed with 503 when the verification pipeline throws unexpectedly", async () => {
		verifyLink.mockRejectedValueOnce(new Error("upstream verifier crash"));

		await expect(createLinkHandler(makeEvent())).rejects.toMatchObject({
			statusCode: 503,
			statusMessage: "Security Verification Unavailable",
		});
		expect(executeMutation).not.toHaveBeenCalled();
	});

	it("allows admin bypass only when a strong ADMIN_BYPASS_SECRET matches and skip header is set", async () => {
		process.env.ADMIN_BYPASS_SECRET = "super-strong-admin-bypass-secret-1234";
		getHeader.mockImplementation((_ev: unknown, name: string) => {
			if (name === "x-skip-verification") return "true";
			if (name === "x-admin-bypass") return "super-strong-admin-bypass-secret-1234";
			return undefined;
		});
		executeMutation.mockResolvedValueOnce({
			data: {
				insert_short_links_one: {
					id: "550e8400-e29b-41d4-a716-446655440000",
					original_url: "https://example.com/page",
					short_url: "my-alias",
					custom_alias: "my-alias",
					created_at: "2026-01-01T00:00:00.000Z",
				},
			},
			error: null,
		});

		const result = await createLinkHandler(makeEvent());

		expect(verifyLink).not.toHaveBeenCalled();
		expect(result.shortUrl).toBe("my-alias");
		expect(invalidateRedirectCache).toHaveBeenCalledWith(["my-alias", "my-alias"]);
	});

	it("blocks reserved application route names as custom aliases", async () => {
		readBody.mockResolvedValueOnce({
			originalUrl: "https://example.com/page",
			customAlias: "dashboard",
		});

		await expect(createLinkHandler(makeEvent())).rejects.toMatchObject({
			statusCode: 400,
			message: expect.stringContaining("reserved"),
		});
		expect(verifyLink).not.toHaveBeenCalled();
	});

	it("ignores spoofed userId in request body and enforces anonymous 1-year expiry cap", async () => {
		getUserIdFromHeaders.mockResolvedValueOnce(null);
		const twoYearsFromNow = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000);
		readBody.mockResolvedValueOnce({
			originalUrl: "https://EXAMPLE.COM/page",
			customAlias: "anon-too-long",
			expiresAt: twoYearsFromNow.toISOString(),
		});

		await expect(createLinkHandler(makeEvent())).rejects.toMatchObject({
			statusCode: 400,
			message: expect.stringContaining("1 year"),
		});

		// Valid anonymous creation normalizes host and strips spoofed userId
		getUserIdFromHeaders.mockResolvedValueOnce(null);
		readBody.mockResolvedValueOnce({
			originalUrl: "HTTPS://EXAMPLE.COM/page",
			customAlias: "anon-link",
			userId: "550e8400-e29b-41d4-a716-446655440000",
		});
		verifyLink.mockResolvedValueOnce(safeVerification());
		executeMutation.mockResolvedValueOnce({
			data: {
				insert_short_links_one: {
					id: "550e8400-e29b-41d4-a716-446655440001",
					original_url: "https://example.com/page",
					short_url: "anon-link",
					custom_alias: "anon-link",
					created_at: "2026-01-01T00:00:00.000Z",
				},
			},
			error: null,
		});

		await createLinkHandler(makeEvent());

		expect(executeMutation).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				userId: null,
				originalUrl: "https://example.com/page",
			}),
		);
	});

	it("retries atomically on random code UNIQUE collisions and returns 409 on custom alias conflicts", async () => {
		// Random code: 1st INSERT collides -> retries automatically and succeeds on 2nd
		readBody.mockResolvedValueOnce({ originalUrl: "https://example.com/retry" });
		verifyLink.mockResolvedValueOnce(safeVerification("https://example.com/retry"));
		executeMutation
			.mockResolvedValueOnce({
				data: null,
				error: new Error("Uniqueness violation. duplicate key value violates unique constraint"),
			})
			.mockResolvedValueOnce({
				data: {
					insert_short_links_one: {
						id: "550e8400-e29b-41d4-a716-446655440002",
						original_url: "https://example.com/retry",
						short_url: "aB92xK7",
						custom_alias: null,
						created_at: "2026-01-01T00:00:00.000Z",
					},
				},
				error: null,
			});

		const created = await createLinkHandler(makeEvent());
		expect(created.shortUrl).toBe("aB92xK7");
		expect(executeMutation).toHaveBeenCalledTimes(2);
		expect(metrics.codeGenCollisions).toBe(1);
		expect(metrics.codeGenRetries).toBe(1);

		// Custom alias collision: fails immediately with 409 (no retries)
		executeMutation.mockReset();
		readBody.mockResolvedValueOnce({
			originalUrl: "https://example.com/taken",
			customAlias: "taken-alias",
		});
		verifyLink.mockResolvedValueOnce(safeVerification("https://example.com/taken"));
		executeMutation.mockResolvedValueOnce({
			data: null,
			error: new Error("Uniqueness violation (23505)"),
		});

		await expect(createLinkHandler(makeEvent())).rejects.toMatchObject({
			statusCode: 409,
			statusMessage: "Conflict",
		});
		expect(executeMutation).toHaveBeenCalledTimes(1);
	});
});
