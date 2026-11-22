import { describe, expect, it, vi } from "vitest";

const {
	executeMutation,
	executeQuery,
	getClientIP,
	getHeader,
	getIpLocation,
	getRouterParam,
	sendRedirect,
	setResponseHeader,
} = vi.hoisted(() => ({
	executeMutation: vi.fn(),
	executeQuery: vi.fn(),
	getClientIP: vi.fn(),
	getHeader: vi.fn(),
	getIpLocation: vi.fn(),
	getRouterParam: vi.fn(),
	sendRedirect: vi.fn(),
	setResponseHeader: vi.fn(),
}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	createError: (input: Record<string, unknown>) =>
		Object.assign(new Error(String(input.message)), input),
	getHeader,
	getRouterParam,
	sendRedirect,
	setResponseHeader,
}));
vi.mock("../../server/utils/graphql", () => ({ executeMutation, executeQuery }));
vi.mock("../../lib/get-ip", () => ({ getClientIP, getIpLocation }));

import redirectHandler from "./[code].get";

describe("short-link redirect endpoint", () => {
	it("requires a short-link code", async () => {
		getRouterParam.mockReturnValueOnce(undefined);

		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 400,
		});
	});

	it("rejects missing, disabled, and expired links", async () => {
		getRouterParam.mockReturnValueOnce("missing");
		executeQuery.mockResolvedValueOnce({ data: { short_links: [] }, error: null });
		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 404,
		});

		getRouterParam.mockReturnValueOnce("disabled");
		executeQuery.mockResolvedValueOnce({
			data: { short_links: [{ is_active: false }] },
			error: null,
		});
		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 410,
		});

		getRouterParam.mockReturnValueOnce("expired");
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						is_active: true,
						expires_at: "2020-01-01T00:00:00.000Z",
					},
				],
			},
			error: null,
		});
		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 410,
		});
	});

	it("blocks stored unsafe redirect targets at redirect time", async () => {
		getRouterParam.mockReturnValueOnce("badlink");
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "link-bad",
						is_active: true,
						expires_at: null,
						original_url: "http://169.254.169.254/latest/meta-data/",
					},
				],
			},
			error: null,
		});

		await expect(redirectHandler({} as never)).rejects.toMatchObject({
			statusCode: 403,
		});
		expect(sendRedirect).not.toHaveBeenCalled();
	});

	it("records analytics, sets security headers, and redirects active links", async () => {
		getRouterParam.mockReturnValueOnce("abc123");
		getHeader.mockImplementation((_event: unknown, name: string) =>
			name === "user-agent" ? "Playwright" : "https://referrer.example",
		);
		getClientIP.mockReturnValueOnce("127.0.0.1");
		getIpLocation.mockResolvedValueOnce({ country: "US", city: "New York" });
		executeQuery.mockResolvedValueOnce({
			data: {
				short_links: [
					{
						id: "link-id",
						is_active: true,
						expires_at: null,
						original_url: "https://example.com/target",
					},
				],
			},
			error: null,
		});
		executeMutation.mockResolvedValueOnce({ data: null, error: null });
		sendRedirect.mockReturnValueOnce("redirected");

		await expect(redirectHandler({} as never)).resolves.toBe("redirected");
		expect(setResponseHeader).toHaveBeenCalledWith(
			{},
			"Referrer-Policy",
			"no-referrer",
		);
		expect(setResponseHeader).toHaveBeenCalledWith(
			{},
			"X-Robots-Tag",
			"noindex, nofollow",
		);
		expect(sendRedirect).toHaveBeenCalledWith(
			{},
			"https://example.com/target",
			302,
		);
		expect(executeMutation).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				shortLinkId: "link-id",
				userAgent: "Playwright",
				ipAddress: "127.0.0.1",
				country: "US",
			}),
		);
	});
});
