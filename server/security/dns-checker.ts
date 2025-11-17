/**
 * DNS Security Checker Module
 * Validates DNS records and detects suspicious configurations with Effect Schema
 */

import dns from "node:dns/promises";
import * as S from "@effect/schema/Schema";

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
 * Comprehensive DNS validation and security checks
 */
export async function checkDns(hostname: string): Promise<DnsCheckResult> {
	const errors: string[] = [];
	const warnings: string[] = [];
	const startTime = Date.now();

	let aRecords: string[] = [];
	let aaaaRecords: string[] = [];
	let mxRecords: Array<{ exchange: string; priority: number }> = [];
	let cnameRecords: string[] = [];

	// Check A records (IPv4)
	try {
		aRecords = await dns.resolve4(hostname);
	} catch (error: any) {
		if (error.code === "ENOTFOUND") {
			errors.push("Domain does not exist (no DNS records found)");
		} else if (error.code === "ENODATA") {
			warnings.push("No A (IPv4) records found");
		}
	}

	// Check AAAA records (IPv6)
	try {
		aaaaRecords = await dns.resolve6(hostname);
	} catch (error: any) {
		// IPv6 is not required, so we just note it
		if (error.code !== "ENODATA" && error.code !== "ENOTFOUND") {
			warnings.push("Could not resolve IPv6 records");
		}
	}

	// Check MX records (email)
	try {
		const mx = await dns.resolveMx(hostname);
		mxRecords = mx.map((record) => ({
			exchange: record.exchange,
			priority: record.priority,
		}));
	} catch (error: any) {
		// MX records are not required for all domains
		if (error.code !== "ENODATA" && error.code !== "ENOTFOUND") {
			warnings.push("Could not resolve MX records");
		}
	}

	// Check CNAME records
	try {
		cnameRecords = await dns.resolveCname(hostname);
	} catch (error: any) {
		// CNAME is optional
		if (error.code !== "ENODATA" && error.code !== "ENOTFOUND") {
			warnings.push("Could not resolve CNAME records");
		}
	}

	// Validation checks
	if (
		aRecords.length === 0 &&
		aaaaRecords.length === 0 &&
		cnameRecords.length === 0
	) {
		errors.push("No valid DNS records found for this domain");
	}

	// Check for suspicious IP ranges
	const suspiciousRanges = [
		{ prefix: "0.", reason: "Reserved (current network)" },
		{ prefix: "10.", reason: "Private network" },
		{ prefix: "127.", reason: "Loopback" },
		{ prefix: "169.254.", reason: "Link-local" },
		{ prefix: "172.16.", reason: "Private network" },
		{ prefix: "172.31.", reason: "Private network" },
		{ prefix: "192.168.", reason: "Private network" },
		{ prefix: "224.", reason: "Multicast" },
		{ prefix: "240.", reason: "Reserved" },
	];

	for (const ip of aRecords) {
		for (const range of suspiciousRanges) {
			if (ip.startsWith(range.prefix)) {
				errors.push(`Domain resolves to ${range.reason} IP address: ${ip}`);
			}
		}
	}

	// Check for newly registered domains (no MX records often indicates new/suspicious domain)
	if (mxRecords.length === 0 && aRecords.length > 0) {
		warnings.push("Domain has no email (MX) records, may be newly registered");
	}

	// Check for excessive A records (could indicate CDN or load balancing, or could be suspicious)
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
