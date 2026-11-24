/**
 * Copyright 2026 Mike Odnis
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
 * Domain Intelligence & DNS Posture Checker Module
 * Inspired by lissy93/web-check (`whois.js`, `dnssec.js`, `caa-records.js`, `txt-records.js`, `mail-config.js`).
 *
 * Runs parallel, fail-open domain intelligence queries (6-hour cache per registrable domain):
 *  - IANA RDAP (`https://rdap.org/domain/<domain>`): exact domain creation age, registrar,
 *    and registry/registrar suspension flags (`server hold` hard-blocks, `client hold` warns).
 *  - DNSSEC validation (`AD` flag via Cloudflare DoH with `do=1`).
 *  - CAA (Certificate Authority Authorization) records via `dns.resolveCaa`.
 *  - Email authentication posture (`SPF` and `_dmarc` `DMARC` policy via `dns.resolveTxt`).
 */

import dns from "node:dns/promises";
import { Schema as S } from "effect";
import NodeCache from "node-cache";
import { classifyIpAddress } from "./ip-utils";

export class DomainIntelCheckResult extends S.Class<DomainIntelCheckResult>(
	"DomainIntelCheckResult",
)({
	isValid: S.Boolean,
	domain: S.String,
	registeredAt: S.NullOr(S.String),
	domainAgeDays: S.NullOr(S.Number),
	registrar: S.NullOr(S.String),
	statuses: S.Array(S.String),
	isSuspended: S.Boolean,
	isNewlyRegistered: S.Boolean,
	dnssecEnabled: S.NullOr(S.Boolean),
	hasCaaRecord: S.Boolean,
	caaIssuers: S.Array(S.String),
	hasSpf: S.Boolean,
	hasDmarc: S.Boolean,
	dmarcPolicy: S.NullOr(S.String),
	errors: S.Array(S.String),
	warnings: S.Array(S.String),
	checkTime: S.Number,
}) {}

const DEFAULT_TIMEOUT_MS = 2500;
const NEW_DOMAIN_HIGH_RISK_DAYS = 7;
const NEW_DOMAIN_WARN_DAYS = 30;
const domainIntelCache = new NodeCache({ stdTTL: 21_600 }); // 6 hours

// Common multi-label public suffixes for accurate RDAP / apex domain extraction
const MULTI_PART_PUBLIC_SUFFIXES = new Set([
	"co.uk",
	"org.uk",
	"gov.uk",
	"ac.uk",
	"me.uk",
	"net.uk",
	"com.au",
	"net.au",
	"org.au",
	"edu.au",
	"gov.au",
	"co.nz",
	"org.nz",
	"co.jp",
	"or.jp",
	"ne.jp",
	"ac.jp",
	"go.jp",
	"com.br",
	"org.br",
	"net.br",
	"gov.br",
	"co.in",
	"org.in",
	"net.in",
	"com.cn",
	"org.cn",
	"net.cn",
	"com.mx",
	"com.sg",
	"com.hk",
	"com.tw",
	"co.za",
	"co.kr",
	"co.il",
	"com.tr",
	"com.ar",
	"com.co",
	"com.ua",
	"com.pl",
]);

/**
 * Extract the registrable apex domain from a hostname (e.g. `docs.api.example.co.uk` -> `example.co.uk`).
 */
export function extractRegistrableDomain(hostname: string): string {
	const cleaned = hostname.trim().toLowerCase().replace(/\.+$/, "");
	if (!cleaned || classifyIpAddress(cleaned).isIp) {
		return cleaned;
	}

	const parts = cleaned.split(".");
	if (parts.length <= 2) {
		return cleaned;
	}

	const lastTwo = parts.slice(-2).join(".");
	if (MULTI_PART_PUBLIC_SUFFIXES.has(lastTwo) && parts.length >= 3) {
		return parts.slice(-3).join(".");
	}

	return lastTwo;
}

interface RdapEvent {
	readonly eventAction?: string;
	readonly eventDate?: string;
}

interface RdapEntity {
	readonly roles?: readonly string[];
	readonly vcardArray?: readonly unknown[];
}

interface RdapResponse {
	readonly status?: readonly string[];
	readonly events?: readonly RdapEvent[];
	readonly entities?: readonly RdapEntity[];
}

function extractRegistrarFromRdap(entities?: readonly RdapEntity[]): string | null {
	if (!Array.isArray(entities)) return null;
	for (const entity of entities) {
		if (!entity.roles?.includes("registrar")) continue;
		const vcard = entity.vcardArray;
		if (Array.isArray(vcard) && Array.isArray(vcard[1])) {
			for (const entry of vcard[1]) {
				if (Array.isArray(entry) && entry[0] === "fn" && typeof entry[3] === "string") {
					return entry[3].trim() || null;
				}
			}
		}
	}
	return null;
}

function normalizeEppStatus(status: string): string {
	return status.toLowerCase().replace(/[\s_-]+/g, "");
}

async function queryRdap(
	domain: string,
	timeoutMs: number,
): Promise<{
	registeredAt: string | null;
	domainAgeDays: number | null;
	registrar: string | null;
	statuses: string[];
	serverHold: boolean;
	clientHold: boolean;
}> {
	const response = await fetch(
		`https://rdap.org/domain/${encodeURIComponent(domain)}`,
		{
			method: "GET",
			headers: {
				Accept: "application/rdap+json, application/json",
				"User-Agent": "LinksSecurityVerifier/2.0 (+https://links.mikeodnis.dev)",
			},
			signal: AbortSignal.timeout(timeoutMs),
		},
	);

	if (!response.ok) {
		throw new Error(`RDAP HTTP ${response.status}`);
	}

	const data = (await response.json()) as RdapResponse;
	const statuses = Array.isArray(data.status)
		? data.status.map((s) => String(s))
		: [];
	const normalizedStatuses = statuses.map(normalizeEppStatus);

	const serverHold = normalizedStatuses.includes("serverhold");
	const clientHold = normalizedStatuses.includes("clienthold");

	let registeredAt: string | null = null;
	let domainAgeDays: number | null = null;

	if (Array.isArray(data.events)) {
		const regEvent = data.events.find(
			(ev) =>
				ev.eventAction?.toLowerCase() === "registration" &&
				typeof ev.eventDate === "string",
		);
		if (regEvent?.eventDate) {
			const parsedDate = new Date(regEvent.eventDate);
			if (!Number.isNaN(parsedDate.getTime())) {
				registeredAt = parsedDate.toISOString();
				domainAgeDays = Math.max(
					0,
					Math.floor((Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24)),
				);
			}
		}
	}

	const registrar = extractRegistrarFromRdap(data.entities);

	return {
		registeredAt,
		domainAgeDays,
		registrar,
		statuses,
		serverHold,
		clientHold,
	};
}

async function queryDnssec(
	domain: string,
	timeoutMs: number,
): Promise<boolean | null> {
	try {
		const response = await fetch(
			`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A&do=1`,
			{
				method: "GET",
				headers: {
					Accept: "application/dns-json",
					"User-Agent": "LinksSecurityVerifier/2.0 (+https://links.mikeodnis.dev)",
				},
				signal: AbortSignal.timeout(timeoutMs),
			},
		);
		if (!response.ok) return null;
		const data = (await response.json()) as { AD?: boolean };
		return typeof data.AD === "boolean" ? data.AD : null;
	} catch {
		return null;
	}
}

async function queryCaa(domain: string): Promise<string[]> {
	try {
		const records = await dns.resolveCaa(domain);
		const issuers = new Set<string>();
		for (const rec of records) {
			if (rec.issue) issuers.add(rec.issue);
			if (rec.issuewild) issuers.add(rec.issuewild);
		}
		return Array.from(issuers);
	} catch {
		return [];
	}
}

async function queryEmailAuth(domain: string): Promise<{
	hasSpf: boolean;
	hasDmarc: boolean;
	dmarcPolicy: string | null;
}> {
	const [txtResult, dmarcResult] = await Promise.allSettled([
		dns.resolveTxt(domain),
		dns.resolveTxt(`_dmarc.${domain}`),
	]);

	let hasSpf = false;
	if (txtResult.status === "fulfilled") {
		hasSpf = txtResult.value.some((chunks) =>
			/^v=spf1\b/i.test(chunks.join("").trim()),
		);
	}

	let hasDmarc = false;
	let dmarcPolicy: string | null = null;
	if (dmarcResult.status === "fulfilled") {
		for (const chunks of dmarcResult.value) {
			const record = chunks.join("").trim();
			if (/^v=dmarc1\b/i.test(record)) {
				hasDmarc = true;
				const pMatch = /(?:^|;\s*)p\s*=\s*(none|quarantine|reject)\b/i.exec(
					record,
				);
				if (pMatch?.[1]) {
					dmarcPolicy = pMatch[1].toLowerCase();
				}
				break;
			}
		}
	}

	return { hasSpf, hasDmarc, dmarcPolicy };
}

/**
 * Inspect RDAP registration age/status, DNSSEC, CAA, SPF, and DMARC for a hostname.
 */
export async function checkDomainIntel(
	hostname: string,
	options: { timeoutMs?: number; skipCache?: boolean } = {},
): Promise<DomainIntelCheckResult> {
	const startTime = Date.now();
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const domain = extractRegistrableDomain(hostname);

	if (!domain || classifyIpAddress(domain).isIp) {
		return new DomainIntelCheckResult({
			isValid: true,
			domain,
			registeredAt: null,
			domainAgeDays: null,
			registrar: null,
			statuses: [],
			isSuspended: false,
			isNewlyRegistered: false,
			dnssecEnabled: null,
			hasCaaRecord: false,
			caaIssuers: [],
			hasSpf: false,
			hasDmarc: false,
			dmarcPolicy: null,
			errors: [],
			warnings: [],
			checkTime: Date.now() - startTime,
		});
	}

	if (!options.skipCache) {
		const cached = domainIntelCache.get<DomainIntelCheckResult>(domain);
		if (cached) {
			return cached;
		}
	}

	const errors: string[] = [];
	const warnings: string[] = [];

	const [rdapSettled, dnssecSettled, caaSettled, emailSettled] =
		await Promise.allSettled([
			queryRdap(domain, timeoutMs),
			queryDnssec(domain, timeoutMs),
			queryCaa(domain),
			queryEmailAuth(domain),
		]);

	let registeredAt: string | null = null;
	let domainAgeDays: number | null = null;
	let registrar: string | null = null;
	let statuses: string[] = [];
	let isSuspended = false;
	let isNewlyRegistered = false;

	if (rdapSettled.status === "fulfilled") {
		const rdap = rdapSettled.value;
		registeredAt = rdap.registeredAt;
		domainAgeDays = rdap.domainAgeDays;
		registrar = rdap.registrar;
		statuses = rdap.statuses;

		if (rdap.serverHold) {
			isSuspended = true;
			errors.push(
				`Domain ${domain} is suspended by registry (EPP serverHold — often abuse/phishing takedown)`,
			);
		} else if (rdap.clientHold) {
			isSuspended = true;
			warnings.push(
				`Domain ${domain} has registrar hold status (EPP clientHold)`,
			);
		}

		if (domainAgeDays !== null) {
			if (domainAgeDays < NEW_DOMAIN_HIGH_RISK_DAYS) {
				isNewlyRegistered = true;
				warnings.push(
					`Domain was registered ${domainAgeDays} day(s) ago (< 7 days — elevated phishing risk)`,
				);
			} else if (domainAgeDays < NEW_DOMAIN_WARN_DAYS) {
				isNewlyRegistered = true;
				warnings.push(
					`Newly registered domain (${domainAgeDays} days old)`,
				);
			}
		}
	}

	const dnssecEnabled =
		dnssecSettled.status === "fulfilled" ? dnssecSettled.value : null;
	const caaIssuers = caaSettled.status === "fulfilled" ? caaSettled.value : [];
	const emailAuth =
		emailSettled.status === "fulfilled"
			? emailSettled.value
			: { hasSpf: false, hasDmarc: false, dmarcPolicy: null };

	const result = new DomainIntelCheckResult({
		isValid: errors.length === 0,
		domain,
		registeredAt,
		domainAgeDays,
		registrar,
		statuses,
		isSuspended,
		isNewlyRegistered,
		dnssecEnabled,
		hasCaaRecord: caaIssuers.length > 0,
		caaIssuers,
		hasSpf: emailAuth.hasSpf,
		hasDmarc: emailAuth.hasDmarc,
		dmarcPolicy: emailAuth.dmarcPolicy,
		errors,
		warnings,
		checkTime: Date.now() - startTime,
	});

	domainIntelCache.set(domain, result);
	return result;
}

export function clearDomainIntelCache(): void {
	domainIntelCache.flushAll();
}
