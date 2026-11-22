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
 * DNS Security Checker Module
 * Validates DNS records and detects private/reserved IPv4 & IPv6 rebinding and CNAME cloaking.
 */

import dns from "node:dns/promises";
import * as S from "@effect/schema/Schema";
import { classifyIpAddress, isBlockedHostname } from "./ip-utils";

// Effect Schema for MX record
export class MxRecord extends S.Class<MxRecord>("MxRecord")({
	exchange: S.String,
	priority: S.Number,
}) {}

// Effect Schema for DNS check result
export class DnsCheckResult extends S.Class<DnsCheckResult>("DnsCheckResult")({
	isValid: S.Boolean,
	hostname: S.String,
	hasARecord: S.Boolean,
	hasAAAARecord: S.Boolean,
	hasMxRecord: S.Boolean,
	hasCnameRecord: S.Boolean,
	aRecords: S.Array(S.String),
	aaaaRecords: S.Array(S.String),
	mxRecords: S.Array(
		S.Struct({
			exchange: S.String,
			priority: S.Number,
		}),
	),
	cnameRecords: S.Array(S.String),
	errors: S.Array(S.String),
	warnings: S.Array(S.String),
	resolutionTime: S.Number,
}) {}

/**
 * Comprehensive DNS validation and SSRF/rebinding security checks
 */
export async function checkDns(hostname: string): Promise<DnsCheckResult> {
	const errors: string[] = [];
	const warnings: string[] = [];
	const startTime = Date.now();

	let aRecords: string[] = [];
	let aaaaRecords: string[] = [];
	let mxRecords: Array<{ exchange: string; priority: number }> = [];
	let cnameRecords: string[] = [];

	// If hostname is itself an IP literal, validate it directly without DNS resolution
	const literalIp = classifyIpAddress(hostname);
	if (literalIp.isIp) {
		if (literalIp.isRestricted) {
			errors.push(
				`Domain resolves to ${literalIp.reason} IP address: ${literalIp.normalized}`,
			);
		}
		if (literalIp.version === 4) {
			aRecords = [literalIp.normalized];
		} else if (literalIp.version === 6) {
			aaaaRecords = [literalIp.normalized];
		}
		return new DnsCheckResult({
			isValid: errors.length === 0,
			hostname,
			hasARecord: aRecords.length > 0,
			hasAAAARecord: aaaaRecords.length > 0,
			hasMxRecord: false,
			hasCnameRecord: false,
			aRecords,
			aaaaRecords,
			mxRecords,
			cnameRecords,
			errors,
			warnings,
			resolutionTime: Date.now() - startTime,
		});
	}

	// Run DNS record lookups in parallel
	const [aResult, aaaaResult, mxResult, cnameResult] = await Promise.allSettled([
		dns.resolve4(hostname),
		dns.resolve6(hostname),
		dns.resolveMx(hostname),
		dns.resolveCname(hostname),
	]);

	if (aResult.status === "fulfilled") {
		aRecords = aResult.value;
	} else {
		const code = aResult.reason?.code;
		if (code === "ENOTFOUND") {
			errors.push("Domain does not exist (no DNS records found)");
		} else if (code === "ENODATA") {
			warnings.push("No A (IPv4) records found");
		} else if (code === "ESERVFAIL" || code === "EREFUSED" || code === "ETIMEOUT") {
			warnings.push(`IPv4 DNS lookup failed (${code})`);
		}
	}

	if (aaaaResult.status === "fulfilled") {
		aaaaRecords = aaaaResult.value;
	} else {
		const code = aaaaResult.reason?.code;
		if (code && code !== "ENODATA" && code !== "ENOTFOUND") {
			warnings.push("Could not resolve IPv6 records");
		}
	}

	if (mxResult.status === "fulfilled") {
		mxRecords = mxResult.value.map((record) => ({
			exchange: record.exchange,
			priority: record.priority,
		}));
	} else {
		const code = mxResult.reason?.code;
		if (code && code !== "ENODATA" && code !== "ENOTFOUND") {
			warnings.push("Could not resolve MX records");
		}
	}

	if (cnameResult.status === "fulfilled") {
		cnameRecords = cnameResult.value;
	} else {
		const code = cnameResult.reason?.code;
		if (code && code !== "ENODATA" && code !== "ENOTFOUND") {
			warnings.push("Could not resolve CNAME records");
		}
	}

	// Must resolve to at least one A or AAAA record (dangling CNAME with no IP is unsafe/broken)
	if (aRecords.length === 0 && aaaaRecords.length === 0) {
		if (cnameRecords.length > 0) {
			errors.push("Domain has a dangling CNAME with no resolvable IP records");
		} else {
			errors.push("No valid DNS records found for this domain");
		}
	}

	// Validate ALL resolved IPv4 and IPv6 addresses against full SSRF/private/reserved ranges
	for (const ip of [...aRecords, ...aaaaRecords]) {
		const classification = classifyIpAddress(ip);
		if (classification.isRestricted) {
			errors.push(
				`Domain resolves to ${classification.reason} IP address: ${ip}`,
			);
		}
	}

	// Block CNAME cloaking targeting internal/local/metadata domains
	for (const target of cnameRecords) {
		const blocked = isBlockedHostname(target);
		if (blocked.blocked) {
			errors.push(`CNAME record points to restricted host: ${target}`);
		}
	}

	// Newly registered domain signal
	if (mxRecords.length === 0 && (aRecords.length > 0 || aaaaRecords.length > 0)) {
		warnings.push("Domain has no email (MX) records, may be newly registered");
	}

	// Fast-flux / excessive A records signal
	if (aRecords.length > 10) {
		warnings.push(`Domain has ${aRecords.length} A records, verify legitimacy`);
	}

	const resolutionTime = Date.now() - startTime;

	return new DnsCheckResult({
		isValid: errors.length === 0,
		hostname,
		hasARecord: aRecords.length > 0,
		hasAAAARecord: aaaaRecords.length > 0,
		hasMxRecord: mxRecords.length > 0,
		hasCnameRecord: cnameRecords.length > 0,
		aRecords,
		aaaaRecords,
		mxRecords,
		cnameRecords,
		errors,
		warnings,
		resolutionTime,
	});
}

/**
 * Quick DNS existence check
 */
export async function domainExists(hostname: string): Promise<boolean> {
	try {
		const aRecords = await dns.resolve4(hostname);
		return aRecords.length > 0;
	} catch {
		try {
			const aaaaRecords = await dns.resolve6(hostname);
			return aaaaRecords.length > 0;
		} catch {
			return false;
		}
	}
}
