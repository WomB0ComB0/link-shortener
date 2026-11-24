/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Distributed per-request ban and rate-limit API guard.
 *
 * Runs one parallel Redis round trip per API request:
 * - Pipelined read of `bans:ip`, `bans:slow`, and active `bans:cidr` ranges
 * - Concurrent distributed rate-limit check (Token Bucket for bursty reads,
 *   Sliding Window for strict/expensive/auth routes), keyed by authenticated
 *   identity (`user:<id>` or `apikey:<hash>`) or normalized client IP.
 *
 * Resilient failure handling:
 * - Raced against a strict 300ms time budget with a circuit breaker
 *   (2 consecutive failures -> 30s cooldown).
 * - When Redis times out, errors, or the circuit breaker is open, falls back
 *   to an in-process bounded sliding-window counter (`LocalSlidingWindowLimiter`)
 *   with strict per-instance caps on sensitive routes (`auth`, `create`, `verify`)
 *   so Redis hiccups never stall traffic AND never disable brute-force protection.
 */

import type { Redis } from "@upstash/redis";
import { BAN_KEYS, isActiveScore, MAX_ACTIVE_CIDRS } from "./ban-keys";
import { findMatchingCidr, isLoopbackIp, normalizeIp, rateLimitKey } from "./ip";
import { LocalSlidingWindowLimiter } from "./local-fallback-limiter";
import {
	getLimiters,
	type LimiterKind,
	type Limiters,
	RATE_LIMITS,
	type RateLimitResult,
} from "./rate-limit";
import { GUARD_BUDGET_MS, getGuardRedis } from "./redis-guard";

/** Cooldown duration (ms) once Redis failures reach threshold. */
export const GUARD_COOLDOWN_MS = 30_000;

/** Consecutive failed/timed-out lookups before opening the circuit breaker. */
export const GUARD_FAILURE_THRESHOLD = 2;

/** Fallback rate-limit identifier when client IP is missing/unparseable. */
export const UNKNOWN_CLIENT_KEY = "unknown";

export interface BanLookupResult {
	readonly ipScore: unknown;
	readonly slowScore: unknown;
	readonly cidrs: readonly unknown[];
}

export interface BanLookup {
	lookup(
		ip: string,
		now: number,
		maxCidrs: number,
	): Promise<BanLookupResult>;
}

export interface GuardBackend {
	readonly bans: BanLookup;
	readonly limiters: Limiters;
}

export interface GuardHeaders {
	readonly limit: number;
	readonly remaining: number;
	readonly reset: number;
	readonly windowSeconds?: number;
	readonly policy?: LimiterKind;
	readonly fallback?: boolean;
}

export type GuardVerdict =
	| { readonly kind: "allow"; readonly rateLimit?: GuardHeaders }
	| { readonly kind: "ban" }
	| {
			readonly kind: "limit";
			readonly limit: number;
			readonly remaining: number;
			readonly reset: number;
			readonly windowSeconds?: number;
			readonly policy?: LimiterKind;
			readonly fallback?: boolean;
	  };

export interface GuardPolicy {
	readonly checkBans: boolean;
	readonly limiter: Exclude<LimiterKind, "slow">;
}

export interface GuardRequest {
	readonly method: string;
	readonly pathname: string;
	readonly clientIp: string;
	/**
	 * Optional identity-scoped rate-limit key (e.g. `user:<id>` or `apikey:<sha256-prefix>`).
	 * NEVER pass a raw bearer token or raw API key.
	 */
	readonly identityKey?: string;
}

export interface GuardTelemetryEvent {
	readonly policy: LimiterKind;
	readonly verdict: GuardVerdict["kind"];
	readonly durationMs: number;
	readonly storeError?: boolean;
	readonly storeTimeout?: boolean;
	readonly circuitOpened?: boolean;
	readonly usedLocalFallback?: boolean;
}

export interface ApiGuardOptions {
	readonly getBackend: () => GuardBackend | null;
	readonly now?: () => number;
	readonly budgetMs?: number;
	readonly cooldownMs?: number;
	readonly failureThreshold?: number;
	readonly report?: (error: unknown) => void;
	readonly onEvent?: (event: GuardTelemetryEvent) => void;
	/** Enable bounded in-process fallback when Redis is degraded/circuit-open (default: true). */
	readonly enableLocalFallback?: boolean;
}

export interface ApiGuard {
	/** Never throws: on any internal failure falls back safely. */
	check(request: GuardRequest): Promise<GuardVerdict>;
}

export class GuardTimeoutError extends Error {
	constructor(budgetMs: number) {
		super(`API guard lookup exceeded ${budgetMs} ms`);
		this.name = "GuardTimeoutError";
	}
}

const ALLOW: GuardVerdict = { kind: "allow" };
const BAN: GuardVerdict = { kind: "ban" };
const NOT_LISTED: BanLookupResult = {
	ipScore: null,
	slowScore: null,
	cidrs: [],
};
const TIMED_OUT = Symbol("timed-out");

const isUnder = (pathname: string, prefix: string): boolean =>
	pathname === prefix || pathname.startsWith(`${prefix}/`);

const API_RESERVED_FIRST_SEGMENTS = new Set([
	"admin",
	"auth",
	"health",
	"keys",
	"links",
	"og",
	"security",
]);

/**
 * Classify an incoming request into its guard policy, or `null` if unguarded.
 *
 * - Non-API routes, CORS preflights (`OPTIONS`), `/api/health`, and `/api/og` are unguarded.
 * - `/api/admin/*` skips ban/slow lists (prevents operator lockout) and uses `auth`.
 * - `/api/auth/*` uses `auth` (5 req / 10s, strict sliding window).
 * - `/api/links/create` and `PATCH /api/links/update` use `create` (10 req / 60s, runs 9-stage verifier).
 * - `/api/security/verify` uses `verify` (15 req / 60s, runs 9-stage OSINT verifier).
 * - `/api/links/analytics` uses `ai` (20 req / 24h).
 * - `/api/<code>` redirect hot path uses `redirect` (100 req / 60s, token bucket).
 * - All other `/api/*` routes use `api` (30 req / 60s, token bucket).
 */
export function classifyRequest(
	method: string,
	rawPathname: string,
): GuardPolicy | null {
	const pathname = rawPathname.split("?")[0] || rawPathname;
	if (!pathname.startsWith("/api/")) return null;
	const upperMethod = method.toUpperCase();
	if (upperMethod === "OPTIONS") return null;
	if (isUnder(pathname, "/api/health")) return null;
	if (isUnder(pathname, "/api/og")) return null;
	if (isUnder(pathname, "/api/admin")) {
		return { checkBans: false, limiter: "auth" };
	}
	if (isUnder(pathname, "/api/auth")) {
		return { checkBans: true, limiter: "auth" };
	}
	if (
		pathname === "/api/links/create" ||
		(pathname === "/api/links/update" && upperMethod === "PATCH")
	) {
		return { checkBans: true, limiter: "create" };
	}
	if (isUnder(pathname, "/api/security/verify")) {
		return { checkBans: true, limiter: "verify" };
	}
	if (isUnder(pathname, "/api/links/analytics")) {
		return { checkBans: true, limiter: "ai" };
	}
	const rest = pathname.slice("/api/".length);
	if (
		(upperMethod === "GET" || upperMethod === "HEAD") &&
		rest.length > 0 &&
		!rest.includes("/") &&
		!API_RESERVED_FIRST_SEGMENTS.has(rest.toLowerCase())
	) {
		return { checkBans: true, limiter: "redirect" };
	}
	return { checkBans: true, limiter: "api" };
}

function toLimitVerdict(
	result: RateLimitResult,
	policy: LimiterKind,
	fallback = false,
): GuardVerdict {
	return {
		kind: "limit",
		limit: result.limit,
		remaining: Math.max(0, result.remaining),
		reset: result.reset,
		windowSeconds: RATE_LIMITS[policy].windowSeconds,
		policy,
		...(fallback ? { fallback: true } : {}),
	};
}

function attempt<T>(call: () => Promise<T>): Promise<T> {
	try {
		return call();
	} catch (error) {
		return Promise.reject(error);
	}
}

interface Evaluation {
	readonly verdict: GuardVerdict;
	readonly failed: boolean;
	readonly error?: unknown;
}

function buildEffectiveKey(ip: string | null, identityKey?: string): string {
	const trimmedIdentity = identityKey?.trim();
	if (trimmedIdentity) {
		return trimmedIdentity;
	}
	return ip ? rateLimitKey(ip) : UNKNOWN_CLIENT_KEY;
}

async function evaluate(
	{ bans, limiters }: GuardBackend,
	policy: GuardPolicy,
	ip: string | null,
	identityKey: string | undefined,
	now: number,
): Promise<Evaluation> {
	const key = buildEffectiveKey(ip, identityKey);
	const banIp = policy.checkBans ? ip : null;
	const policyCfg = RATE_LIMITS[policy.limiter];

	// Run pipelined ban lookup and distributed rate-limit check concurrently (1 RTT)
	const [banRead, limitRead] = await Promise.allSettled([
		banIp
			? attempt(() => bans.lookup(banIp, now, MAX_ACTIVE_CIDRS))
			: Promise.resolve(NOT_LISTED),
		attempt(() => limiters[policy.limiter].limit(key)),
	]);

	const rejected = [banRead, limitRead].find((r) => r.status === "rejected");
	const failure = rejected
		? { failed: true, error: rejected.reason }
		: { failed: false };
	const { ipScore, slowScore, cidrs } =
		banRead.status === "fulfilled" ? banRead.value : NOT_LISTED;

	if (banIp) {
		const ipBanned = isActiveScore(ipScore, now);
		const cidr = ipBanned ? null : findMatchingCidr(banIp, cidrs);
		if (ipBanned || cidr) {
			console.info("Blocked banned client", {
				ip: banIp,
				...(cidr ? { cidr } : {}),
			});
			return { verdict: BAN, ...failure };
		}
	}

	if (limitRead.status === "fulfilled" && !limitRead.value.success) {
		return {
			verdict: toLimitVerdict(limitRead.value, policy.limiter),
			...failure,
		};
	}

	if (banIp && isActiveScore(slowScore, now)) {
		try {
			const slowed = await limiters.slow.limit(key);
			if (!slowed.success) {
				return { verdict: toLimitVerdict(slowed, "slow"), ...failure };
			}
			return {
				verdict: {
					kind: "allow",
					rateLimit: {
						limit: slowed.limit,
						remaining: slowed.remaining,
						reset: slowed.reset,
						windowSeconds: RATE_LIMITS.slow.windowSeconds,
						policy: "slow",
					},
				},
				...failure,
			};
		} catch (error) {
			return {
				verdict: ALLOW,
				...(failure.failed ? failure : { failed: true, error }),
			};
		}
	}

	const rateLimit =
		limitRead.status === "fulfilled"
			? {
					limit: limitRead.value.limit,
					remaining: limitRead.value.remaining,
					reset: limitRead.value.reset,
					windowSeconds: policyCfg.windowSeconds,
					policy: policy.limiter,
				}
			: undefined;

	return { verdict: { kind: "allow", rateLimit }, ...failure };
}

/**
 * Create an API guard instance with timeout budget, circuit breaker,
 * per-policy local fallback limiter, and observability hooks.
 */
export function createApiGuard({
	getBackend,
	now = () => Date.now(),
	budgetMs = GUARD_BUDGET_MS,
	cooldownMs = GUARD_COOLDOWN_MS,
	failureThreshold = GUARD_FAILURE_THRESHOLD,
	report,
	onEvent,
	enableLocalFallback = true,
}: ApiGuardOptions): ApiGuard {
	let skipUntil = 0;
	let consecutiveFailures = 0;
	const localLimiter = new LocalSlidingWindowLimiter(2048);

	const emitEvent = (event: GuardTelemetryEvent): void => {
		if (!onEvent) return;
		try {
			onEvent(event);
		} catch {
			// Observability must never affect request flow.
		}
	};

	const evaluateLocalFallback = (
		policy: GuardPolicy,
		ip: string | null,
		identityKey: string | undefined,
		at: number,
	): GuardVerdict => {
		if (!enableLocalFallback) return ALLOW;
		const cfg = RATE_LIMITS[policy.limiter];
		const key = `${policy.limiter}:${buildEffectiveKey(ip, identityKey)}`;
		const local = localLimiter.consume(
			key,
			cfg.localFallbackLimit,
			cfg.windowSeconds * 1000,
			at,
		);
		if (!local.success) {
			return toLimitVerdict(local, policy.limiter, true);
		}
		return {
			kind: "allow",
			rateLimit: {
				limit: local.limit,
				remaining: local.remaining,
				reset: local.reset,
				windowSeconds: cfg.windowSeconds,
				policy: policy.limiter,
				fallback: true,
			},
		};
	};

	const trip = (error: unknown, at: number): boolean => {
		consecutiveFailures += 1;
		if (consecutiveFailures < failureThreshold) {
			console.warn("API guard lookup failed; activating fallback", {
				consecutiveFailures,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
		const alreadyOpen = now() < skipUntil;
		skipUntil = Math.max(skipUntil, at + cooldownMs);
		if (alreadyOpen) return false;
		console.warn(
			"API guard circuit open; falling back to in-process limiter for cooldown window",
			{
				cooldownMs,
				error: error instanceof Error ? error.message : String(error),
			},
		);
		if (report) {
			try {
				report(error);
			} catch {
				// Reporting must never affect request flow.
			}
		}
		return true;
	};

	const check = async (request: GuardRequest): Promise<GuardVerdict> => {
		let policy: GuardPolicy | null;
		let ip: string | null;
		let backend: GuardBackend | null;
		const startedAt = now();
		const perfStart = performance.now();

		try {
			policy = classifyRequest(request.method, request.pathname);
			if (!policy) return ALLOW;
			ip = normalizeIp(request.clientIp);
			if (ip && isLoopbackIp(ip)) return ALLOW;

			if (startedAt < skipUntil) {
				const fallbackVerdict = evaluateLocalFallback(
					policy,
					ip,
					request.identityKey,
					startedAt,
				);
				emitEvent({
					policy: policy.limiter,
					verdict: fallbackVerdict.kind,
					durationMs: performance.now() - perfStart,
					usedLocalFallback: enableLocalFallback,
				});
				return fallbackVerdict;
			}

			backend = getBackend();
			if (!backend) {
				const fallbackVerdict = evaluateLocalFallback(
					policy,
					ip,
					request.identityKey,
					startedAt,
				);
				emitEvent({
					policy: policy.limiter,
					verdict: fallbackVerdict.kind,
					durationMs: performance.now() - perfStart,
					usedLocalFallback: enableLocalFallback,
				});
				return fallbackVerdict;
			}
		} catch (error) {
			console.error("API guard could not inspect request", error);
			return ALLOW;
		}

		const lookup = evaluate(
			backend,
			policy,
			ip,
			request.identityKey,
			startedAt,
		);
		// Prevent unhandled rejection if deadline wins the race
		lookup.catch(() => undefined);

		let timer: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
			timer = setTimeout(() => resolve(TIMED_OUT), budgetMs);
		});

		try {
			const outcome = await Promise.race([lookup, deadline]);
			if (outcome === TIMED_OUT) {
				const circuitOpened = trip(new GuardTimeoutError(budgetMs), startedAt);
				const fallbackVerdict = evaluateLocalFallback(
					policy,
					ip,
					request.identityKey,
					startedAt,
				);
				emitEvent({
					policy: policy.limiter,
					verdict: fallbackVerdict.kind,
					durationMs: performance.now() - perfStart,
					storeTimeout: true,
					circuitOpened,
					usedLocalFallback: enableLocalFallback,
				});
				return fallbackVerdict;
			}

			let circuitOpened = false;
			if (outcome.failed) {
				circuitOpened = trip(outcome.error, startedAt);
			} else {
				consecutiveFailures = 0;
			}

			// If the Redis limiter call itself failed (no rateLimit headers produced), protect with local fallback
			if (
				outcome.failed &&
				outcome.verdict.kind === "allow" &&
				!outcome.verdict.rateLimit
			) {
				const fallbackVerdict = evaluateLocalFallback(
					policy,
					ip,
					request.identityKey,
					startedAt,
				);
				emitEvent({
					policy: policy.limiter,
					verdict: fallbackVerdict.kind,
					durationMs: performance.now() - perfStart,
					storeError: true,
					circuitOpened,
					usedLocalFallback: enableLocalFallback,
				});
				return fallbackVerdict;
			}

			emitEvent({
				policy: policy.limiter,
				verdict: outcome.verdict.kind,
				durationMs: performance.now() - perfStart,
				storeError: outcome.failed || undefined,
				circuitOpened: circuitOpened || undefined,
			});
			return outcome.verdict;
		} catch (error) {
			const circuitOpened = trip(error, startedAt);
			const fallbackVerdict = evaluateLocalFallback(
				policy,
				ip,
				request.identityKey,
				startedAt,
			);
			emitEvent({
				policy: policy.limiter,
				verdict: fallbackVerdict.kind,
				durationMs: performance.now() - perfStart,
				storeError: true,
				circuitOpened,
				usedLocalFallback: enableLocalFallback,
			});
			return fallbackVerdict;
		} finally {
			clearTimeout(timer);
		}
	};

	return { check };
}

/**
 * Single-HTTP-pipeline Redis ban lookup (ip score + slow score + active CIDRs).
 */
export function redisBanLookup(redis: Redis): BanLookup {
	return {
		lookup: async (ip, now, maxCidrs) => {
			const [ipScore, slowScore, cidrs] = await redis
				.pipeline()
				.zscore(BAN_KEYS.ip, ip)
				.zscore(BAN_KEYS.slow, ip)
				.zrange(BAN_KEYS.cidr, `(${now}` as `(${number}`, "+inf", {
					byScore: true,
					offset: 0,
					count: maxCidrs,
				})
				.exec<[unknown, unknown, unknown[]]>();
			return { ipScore, slowScore, cidrs: Array.isArray(cidrs) ? cidrs : [] };
		},
	};
}

let defaultBackend: GuardBackend | null | undefined;
let telemetryListener: ((event: GuardTelemetryEvent) => void) | null = null;

/** Register a global telemetry observer for the default production `apiGuard`. */
export function setApiGuardTelemetryListener(
	listener: ((event: GuardTelemetryEvent) => void) | null,
): void {
	telemetryListener = listener;
}

function getDefaultBackend(): GuardBackend | null {
	if (defaultBackend !== undefined) return defaultBackend;
	const redis = getGuardRedis();
	defaultBackend = redis
		? { bans: redisBanLookup(redis), limiters: getLimiters(redis) }
		: null;
	return defaultBackend;
}

/** Default production API guard backed by the dedicated guard Redis client. */
export const apiGuard: ApiGuard = createApiGuard({
	getBackend: getDefaultBackend,
	onEvent: (event) => {
		telemetryListener?.(event);
	},
});
