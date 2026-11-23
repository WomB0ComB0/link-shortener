import { describe, expect, it, vi } from "vitest";
import {
	classifyRequest,
	createApiGuard,
	type GuardBackend,
	GuardTimeoutError,
} from "./api-guard";
import { PERMANENT_BAN_SCORE } from "./ban-keys";
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
			redirect: makeLimiter(ok),
			ai: makeLimiter(ok),
			slow: makeLimiter(slow),
		},
	};
}

describe("API guard & Redis guard client", () => {
	it("configures fresh per-request AbortSignal factory and zero retries", () => {
		const cfg = guardRedisConfig("https://example.upstash.io", "token");
		expect(typeof cfg.signal).toBe("function");
		expect(cfg.retry).toEqual({ retries: 0 });
		expect(cfg.readYourWrites).toBe(false);
		expect(cfg.enableTelemetry).toBe(false);
		expect(GUARD_BUDGET_MS).toBe(300);
	});

	it("classifies API routes cleanly", () => {
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
		).resolves.toEqual({
			kind: "limit",
			limit: 1,
			remaining: 0,
			reset: 999999,
		});
	});

	it("opens the circuit breaker after consecutive timeouts and recovers after cooldown", async () => {
		let clock = 10_000;
		const lookup = vi.fn().mockImplementation(
			() => new Promise(() => undefined), // never resolves -> triggers timeout
		);
		const report = vi.fn();
		const backend = makeBackend({ lookup });
		const guard = createApiGuard({
			getBackend: () => backend,
			now: () => clock,
			budgetMs: 15,
			cooldownMs: 30_000,
			failureThreshold: 2,
			report,
		});

		const req = {
			method: "GET",
			pathname: "/api/links/public",
			clientIp: "198.51.100.20",
		};

		// 1st timeout -> fails open, does not open circuit yet
		await expect(guard.check(req)).resolves.toEqual({ kind: "allow" });
		expect(report).not.toHaveBeenCalled();

		// 2nd timeout -> trips circuit breaker
		clock += 100;
		await expect(guard.check(req)).resolves.toEqual({ kind: "allow" });
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0]?.[0]).toBeInstanceOf(GuardTimeoutError);

		// During cooldown -> skips Redis completely (lookup call count unchanged)
		const callsBeforeCooldown = lookup.mock.calls.length;
		clock += 5_000;
		await expect(guard.check(req)).resolves.toEqual({ kind: "allow" });
		expect(lookup.mock.calls.length).toBe(callsBeforeCooldown);
	});
});
