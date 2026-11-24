import { describe, expect, it, vi } from "vitest";
import {
	classifyRequest,
	createApiGuard,
	type GuardBackend,
	type GuardTelemetryEvent,
	GuardTimeoutError,
} from "./api-guard";
import { PERMANENT_BAN_SCORE } from "./ban-keys";
import { buildRateLimitHeaders } from "./rate-limit";
import { GUARD_BUDGET_MS, guardRedisConfig } from "./redis-guard";

function makeBackend(
	overrides: Partial<{
		lookup: GuardBackend["bans"]["lookup"];
		limitResult: {
			success: boolean;
			limit: number;
			remaining: number;
			reset: number;
		};
		slowResult: {
			success: boolean;
			limit: number;
			remaining: number;
			reset: number;
		};
	}> = {},
): GuardBackend {
	const ok = overrides.limitResult ?? {
		success: true,
		limit: 30,
		remaining: 29,
		reset: Date.now() + 60_000,
	};
	const slow = overrides.slowResult ?? {
		success: true,
		limit: 1,
		remaining: 0,
		reset: Date.now() + 30_000,
	};
	const makeLimiter = (res: typeof ok) => ({
		limit: vi.fn().mockResolvedValue(res),
	});
	return {
		bans: {
			lookup:
				overrides.lookup ??
				vi.fn().mockResolvedValue({ ipScore: null, slowScore: null, cidrs: [] }),
		},
		limiters: {
			api: makeLimiter(ok),
			auth: makeLimiter(ok),
			create: makeLimiter(ok),
			verify: makeLimiter(ok),
			redirect: makeLimiter(ok),
			ai: makeLimiter(ok),
			slow: makeLimiter(slow),
		},
	};
}

describe("API guard & distributed rate limiter", () => {
	it("configures fresh per-request AbortSignal factory and zero retries", () => {
		const cfg = guardRedisConfig("https://example.upstash.io", "token");
		expect(typeof cfg.signal).toBe("function");
		expect(cfg.retry).toEqual({ retries: 0 });
		expect(cfg.readYourWrites).toBe(false);
		expect(cfg.enableTelemetry).toBe(false);
		expect(GUARD_BUDGET_MS).toBe(300);
	});

	it("classifies API routes cleanly including dedicated verify & update policies", () => {
		expect(classifyRequest("GET", "/dashboard")).toBeNull();
		expect(classifyRequest("OPTIONS", "/api/links/create")).toBeNull();
		expect(classifyRequest("GET", "/api/health")).toBeNull();
		expect(classifyRequest("GET", "/api/og")).toBeNull();
		expect(classifyRequest("GET", "/api/og?title=Dashboard")).toBeNull();
		expect(classifyRequest("POST", "/api/admin/ban")).toEqual({
			checkBans: false,
			limiter: "auth",
		});
		expect(classifyRequest("POST", "/api/auth/login")).toEqual({
			checkBans: true,
			limiter: "auth",
		});
		expect(classifyRequest("POST", "/api/links/create")).toEqual({
			checkBans: true,
			limiter: "create",
		});
		expect(classifyRequest("PATCH", "/api/links/update")).toEqual({
			checkBans: true,
			limiter: "create",
		});
		expect(classifyRequest("GET", "/api/security/verify")).toEqual({
			checkBans: true,
			limiter: "verify",
		});
		expect(classifyRequest("GET", "/api/links/analytics")).toEqual({
			checkBans: true,
			limiter: "ai",
		});
		expect(classifyRequest("GET", "/api/links/public")).toEqual({
			checkBans: true,
			limiter: "api",
		});
		expect(classifyRequest("GET", "/api/aB92xK7")).toEqual({
			checkBans: true,
			limiter: "redirect",
		});
	});

	it("keys authenticated callers by identityKey while preserving IP ban checks", async () => {
		const backend = makeBackend();
		const guard = createApiGuard({ getBackend: () => backend });

		await guard.check({
			method: "POST",
			pathname: "/api/links/create",
			clientIp: "203.0.113.50",
			identityKey: "apikey:abcdef0123456789",
		});

		expect(backend.bans.lookup).toHaveBeenCalledWith(
			"203.0.113.50",
			expect.any(Number),
			expect.any(Number),
		);
		expect(backend.limiters.create.limit).toHaveBeenCalledWith(
			"apikey:abcdef0123456789",
		);
	});

	it("blocks directly banned IPs and CIDR-banned ranges", async () => {
		const ipBanned = createApiGuard({
			getBackend: () =>
				makeBackend({
					lookup: vi.fn().mockResolvedValue({
						ipScore: PERMANENT_BAN_SCORE,
						slowScore: null,
						cidrs: [],
					}),
				}),
		});
		await expect(
			ipBanned.check({
				method: "POST",
				pathname: "/api/links/create",
				clientIp: "203.0.113.5",
			}),
		).resolves.toEqual({ kind: "ban" });

		const cidrBanned = createApiGuard({
			getBackend: () =>
				makeBackend({
					lookup: vi.fn().mockResolvedValue({
						ipScore: null,
						slowScore: null,
						cidrs: ["203.0.113.0/24"],
					}),
				}),
		});
		await expect(
			cidrBanned.check({
				method: "GET",
				pathname: "/api/links/public",
				clientIp: "203.0.113.99",
			}),
		).resolves.toEqual({ kind: "ban" });
	});

	it("enforces slow-mode and sliding-window rate limits", async () => {
		const slowed = createApiGuard({
			getBackend: () =>
				makeBackend({
					lookup: vi.fn().mockResolvedValue({
						ipScore: null,
						slowScore: PERMANENT_BAN_SCORE,
						cidrs: [],
					}),
					slowResult: { success: false, limit: 1, remaining: 0, reset: 999999 },
				}),
		});
		await expect(
			slowed.check({
				method: "GET",
				pathname: "/api/links/public",
				clientIp: "198.51.100.7",
			}),
		).resolves.toMatchObject({
			kind: "limit",
			limit: 1,
			remaining: 0,
			reset: 999999,
			policy: "slow",
		});
	});

	it("opens the circuit breaker on timeouts and enforces strict local fallback on auth routes", async () => {
		let clock = 10_000;
		const lookup = vi.fn().mockImplementation(
			() => new Promise(() => undefined), // never resolves -> triggers timeout
		);
		const report = vi.fn();
		const events: GuardTelemetryEvent[] = [];
		const backend = makeBackend({ lookup });
		const guard = createApiGuard({
			getBackend: () => backend,
			now: () => clock,
			budgetMs: 15,
			cooldownMs: 30_000,
			failureThreshold: 2,
			report,
			onEvent: (ev) => events.push(ev),
		});

		const authReq = {
			method: "POST",
			pathname: "/api/auth/login",
			clientIp: "198.51.100.20",
		};

		// 1st & 2nd timeout -> trips circuit breaker, local fallback allows up to strict cap (3)
		const first = await guard.check(authReq);
		expect(first.kind).toBe("allow");
		expect(first.kind === "allow" && first.rateLimit?.fallback).toBe(true);
		expect(report).not.toHaveBeenCalled();

		clock += 100;
		const second = await guard.check(authReq);
		expect(second.kind).toBe("allow");
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0]?.[0]).toBeInstanceOf(GuardTimeoutError);

		// During cooldown -> skips Redis completely (lookup call count unchanged)
		const callsBeforeCooldown = lookup.mock.calls.length;
		clock += 100;
		const third = await guard.check(authReq);
		expect(third.kind).toBe("allow");
		expect(lookup.mock.calls.length).toBe(callsBeforeCooldown);

		// 4th auth request within 10s window -> local strict fallback blocks with 429!
		clock += 100;
		const fourth = await guard.check(authReq);
		expect(fourth.kind).toBe("limit");
		expect(fourth.kind === "limit" && fourth.fallback).toBe(true);
		expect(events.some((e) => e.circuitOpened)).toBe(true);
		expect(events.some((e) => e.usedLocalFallback && e.verdict === "limit")).toBe(
			true,
		);
	});

	it("builds standard IETF RateLimit-* + RateLimit-Policy + legacy X-RateLimit-* headers", () => {
		const nowMs = 1_700_000_000_000;
		const headers = buildRateLimitHeaders(
			{ limit: 15, remaining: 0, reset: nowMs + 42_000, windowSeconds: 60 },
			{ isLimited: true, nowMs },
		);

		expect(headers).toEqual({
			"RateLimit-Limit": "15",
			"RateLimit-Remaining": "0",
			"RateLimit-Reset": "42",
			"RateLimit-Policy": "15;w=60",
			"X-RateLimit-Limit": "15",
			"X-RateLimit-Remaining": "0",
			"X-RateLimit-Reset": String(nowMs + 42_000),
			"Retry-After": "42",
		});
	});
});
