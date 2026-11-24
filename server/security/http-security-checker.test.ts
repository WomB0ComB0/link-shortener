import { EventEmitter } from "node:events";
import https from "node:https";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	checkHttpSecurity,
	inspectHtmlSnippet,
	parseContentDispositionFilename,
	parseHstsHeader,
	scoreSecurityHeaders,
} from "./http-security-checker";

function mockHttpsResponse(options: {
	statusCode: number;
	headers: Record<string, string | string[]>;
	body?: string;
}) {
	return vi
		.spyOn(https, "request")
		.mockImplementation(((_reqOpts: unknown, cb?: (res: any) => void) => {
			const req = new EventEmitter() as any;
			req.destroy = vi.fn();
			req.end = vi.fn(() => {
				const res = new EventEmitter() as any;
				res.statusCode = options.statusCode;
				res.headers = options.headers;
				res.destroy = vi.fn();
				cb?.(res);
				if (options.body !== undefined) {
					queueMicrotask(() => {
						res.emit("data", Buffer.from(options.body!, "utf8"));
						res.emit("end");
					});
				}
			});
			return req;
		}) as any);
}

describe("HTTP security headers, drive-by payload & HTML cloaking checker", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("scores strong HTTPS security headers as A+ and weak ones as F", () => {
		const strong = scoreSecurityHeaders(
			{
				"strict-transport-security":
					"max-age=31536000; includeSubDomains; preload",
				"content-security-policy": "default-src 'self'; frame-ancestors 'none'",
				"x-frame-options": "DENY",
				"x-content-type-options": "nosniff",
				"referrer-policy": "strict-origin-when-cross-origin",
				"permissions-policy": "geolocation=()",
				"cross-origin-opener-policy": "same-origin",
			},
			true,
		);
		expect(strong.headerScore).toBe(100);
		expect(strong.securityGrade).toBe("A+");
		expect(strong.headers.hstsPreload).toBe(true);

		const weak = scoreSecurityHeaders({}, true);
		expect(weak.headerScore).toBe(0);
		expect(weak.securityGrade).toBe("F");
	});

	it("parses Content-Disposition filenames (quoted, bare, and RFC 5987)", () => {
		expect(
			parseContentDispositionFilename('attachment; filename="invoice.exe"'),
		).toBe("invoice.exe");
		expect(
			parseContentDispositionFilename(
				"attachment; filename*=UTF-8''receipt%202026.pdf.exe",
			),
		).toBe("receipt 2026.pdf.exe");
		expect(parseContentDispositionFilename("inline")).toBeNull();
	});

	it("parses HSTS directives accurately", () => {
		const hsts = parseHstsHeader("max-age=63072000; includeSubDomains; preload");
		expect(hsts).toEqual({
			present: true,
			maxAge: 63072000,
			includeSubDomains: true,
			preload: true,
		});
	});

	it("detects HTML meta-refresh cloaking, mixed content, and insecure form actions", () => {
		const html = `<!doctype html><html><head>
			<meta http-equiv="refresh" content="0; url=https://phish.example/steal" />
		</head><body>
			<script src="http://cdn.insecure.test/app.js"></script>
			<form action="http://harvest.test/login" method="post"></form>
		</body></html>`;

		const parsed = inspectHtmlSnippet(html, "https://clean.example/page");
		expect(parsed.metaRefreshResolvedUrl).toBe("https://phish.example/steal");
		expect(parsed.hasMixedContent).toBe(true);
		expect(parsed.hasInsecureFormAction).toBe(true);
	});

	it("hard-blocks drive-by executable downloads hidden behind clean URLs", async () => {
		mockHttpsResponse({
			statusCode: 200,
			headers: {
				"content-type": "application/x-msdownload",
				"content-disposition": 'attachment; filename="invoice.pdf.exe"',
			},
		});

		const result = await checkHttpSecurity("https://clean-url.example/invoice");

		expect(result.isValid).toBe(false);
		expect(result.contentType).toBe("application/x-msdownload");
		expect(result.contentDispositionFilename).toBe("invoice.pdf.exe");
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});

	it("hard-blocks HTML meta-refresh cloaked redirects to SSRF/private IPs or HTTP downgrades", async () => {
		mockHttpsResponse({
			statusCode: 200,
			headers: { "content-type": "text/html; charset=utf-8" },
			body: '<html><head><meta http-equiv="refresh" content="0;url=http://169.254.169.254/latest/meta-data/"></head></html>',
		});

		const ssrfMeta = await checkHttpSecurity("https://cloak.example/go");
		expect(ssrfMeta.isValid).toBe(false);
		expect(ssrfMeta.errors[0]).toMatch(/meta-refresh cloaked redirect/i);

		vi.restoreAllMocks();
		mockHttpsResponse({
			statusCode: 200,
			headers: { "content-type": "text/html" },
			body: '<html><head><meta http-equiv="refresh" content="0;url=http://downgrade.example/login"></head></html>',
		});

		const downgradeMeta = await checkHttpSecurity("https://cloak.example/http");
		expect(downgradeMeta.isValid).toBe(false);
		expect(downgradeMeta.errors[0]).toMatch(/downgrades from HTTPS/i);
	});

	it("passes normal HTML pages cleanly and grades their security headers", async () => {
		mockHttpsResponse({
			statusCode: 200,
			headers: {
				"content-type": "text/html; charset=utf-8",
				"strict-transport-security": "max-age=31536000; includeSubDomains",
				"content-security-policy": "default-src 'self'",
				"x-content-type-options": "nosniff",
				"x-frame-options": "SAMEORIGIN",
				"referrer-policy": "no-referrer",
			},
			body: "<!doctype html><html><head><title>Safe Page</title></head><body>Hello</body></html>",
		});

		const result = await checkHttpSecurity("https://safe.example/");

		expect(result.isValid).toBe(true);
		expect(result.securityGrade).toBe("A");
		expect(result.headerScore).toBe(90);
		expect(result.errors).toHaveLength(0);
	});
});
