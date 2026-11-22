import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	getHeader,
	readBody,
	getUserIdFromHeaders,
	verifyLink,
	executeQuery,
	executeMutation,
} = vi.hoisted(() => ({
	getHeader: vi.fn(),
	readBody: vi.fn(),
	getUserIdFromHeaders: vi.fn(),
	verifyLink: vi.fn(),
	executeQuery: vi.fn(),
	executeMutation: vi.fn(),
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
	executeQuery,
	executeMutation,
}));

import createLinkHandler from "./create.post";

function makeEvent() {
	return { context: {}, node: { req: { headers: {} } } } as any;
}

describe("POST /api/links/create strict security enforcement", () => {
	beforeEach(() => {
		getHeader.mockReset();
		readBody.mockReset();
		getUserIdFromHeaders.mockReset();
		verifyLink.mockReset();
		executeQuery.mockReset();
		executeMutation.mockReset();
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
			url: "https://example.com/page",
			isVerified: false,
			overallRisk: "critical",
			riskScore: 90,
			checks: {
				urlValidation: { isValid: false, warnings: [] },
				dnsCheck: { isValid: false, warnings: [] },
				sslCheck: { isValid: false, warnings: [] },
				redirectCheck: { isValid: false, warnings: [], finalUrl: "https://example.com/page", hopCount: 0 },
				phishingCheck: { isPhishing: false, warnings: [] },
				malwareCheck: { isSafe: true, warnings: [] },
			},
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
			url: "https://example.com/page",
			isVerified: false,
			overallRisk: "high",
			riskScore: 68,
			checks: {
				urlValidation: { isValid: true, warnings: [] },
				dnsCheck: { isValid: true, warnings: [] },
				sslCheck: { isValid: true, warnings: [] },
				redirectCheck: { isValid: true, warnings: [], finalUrl: "https://example.com/page", hopCount: 0 },
				phishingCheck: { isPhishing: true, warnings: [] },
				malwareCheck: { isSafe: true, warnings: [] },
			},
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
		executeQuery
			.mockResolvedValueOnce({ data: { short_links: [] }, error: null })
			.mockResolvedValueOnce({ data: { short_links: [] }, error: null });
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

	it("ignores spoofed userId in request body for anonymous master-password requests", async () => {
		getUserIdFromHeaders.mockResolvedValueOnce(null);
		readBody.mockResolvedValueOnce({
			originalUrl: "https://example.com/page",
			customAlias: "anon-link",
			userId: "550e8400-e29b-41d4-a716-446655440000",
		});
		verifyLink.mockResolvedValueOnce({
			url: "https://example.com/page",
			isVerified: true,
			overallRisk: "safe",
			riskScore: 0,
			checks: {
				urlValidation: { isValid: true, warnings: [] },
				dnsCheck: { isValid: true, warnings: [] },
				sslCheck: { isValid: true, warnings: [] },
				redirectCheck: { isValid: true, warnings: [], finalUrl: "https://example.com/page", hopCount: 0 },
				phishingCheck: { isPhishing: false, warnings: [] },
				malwareCheck: { isSafe: true, threats: [], errors: [], warnings: [] },
			},
			summary: {
				totalErrors: 0,
				totalWarnings: 0,
				criticalIssues: [],
				recommendations: [],
			},
		});
		executeQuery
			.mockResolvedValueOnce({ data: { short_links: [] }, error: null })
			.mockResolvedValueOnce({ data: { short_links: [] }, error: null });
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
			expect.objectContaining({ userId: null }),
		);
	});
});
