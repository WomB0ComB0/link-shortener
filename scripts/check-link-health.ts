#!/usr/bin/env bun
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
 * Existing Links Pass-Through Auditor
 *
 * Audits every active short link in Railway Hasura using the IP-pinned SSRF-safe
 * link-health probe (and optionally the 6-stage security pipeline with `--security`),
 * updates the fenced Upstash Redis link-health cache, and prints a report.
 *
 * Usage:
 *   bun scripts/check-link-health.ts
 *   bun scripts/check-link-health.ts --security
 */

import { probeLink } from "../server/link-health/probe";
import { type LinkRecord, nextRecord, readRecord } from "../server/link-health/state";
import { connectLinkHealthStore } from "../server/link-health/store";
import { normalizeLinkUrl } from "../server/link-health/url";
import { verifyLink } from "../server/security/verification-pipeline";

const includeSecurity = process.argv.includes("--security");

const endpoint = process.env.HASURA_GRAPHQL_ENDPOINT;
const secret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

if (!endpoint || !secret) {
	console.error("Missing HASURA_GRAPHQL_ENDPOINT or HASURA_GRAPHQL_ADMIN_SECRET");
	process.exit(1);
}

const queryRes = await fetch(endpoint, {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		"x-hasura-admin-secret": secret,
	},
	body: JSON.stringify({
		query: `
			query AuditActiveLinks {
				short_links(where: { is_active: { _eq: true } }, order_by: { created_at: desc }, limit: 500) {
					id
					short_url
					original_url
					expires_at
				}
			}
		`,
	}),
});

if (!queryRes.ok) {
	console.error(`Hasura query failed (${queryRes.status})`);
	process.exit(1);
}

const payload = (await queryRes.json()) as {
	data?: {
		short_links: Array<{
			id: string;
			short_url: string;
			original_url: string;
			expires_at: string | null;
		}>;
	};
};

const links = payload.data?.short_links ?? [];
console.log(`Auditing ${links.length} active short link(s)...`);

const store = connectLinkHealthStore(
	process.env.UPSTASH_REDIS_REST_URL,
	process.env.UPSTASH_REDIS_REST_TOKEN,
);

const existingRaw = store ? await store.read("public") : null;
const existingMap =
	existingRaw && typeof existingRaw === "object"
		? (existingRaw as Record<string, unknown>)
		: {};

const updatedRecords: Record<string, LinkRecord> = {};
const now = Date.now();
let flaggedCount = 0;

for (const link of links) {
	const canonical = normalizeLinkUrl(link.original_url);
	const expired =
		link.expires_at !== null && new Date(link.expires_at).getTime() < now;

	if (!canonical) {
		flaggedCount += 1;
		console.log(`  [INVALID ] /${link.short_url} -> ${link.original_url}`);
		continue;
	}

	const prev = readRecord(existingMap[canonical]);
	const obs = await probeLink(canonical);
	const record = nextRecord(prev, obs, now);
	updatedRecords[canonical] = record;

	let securitySummary = "";
	if (includeSecurity) {
		const verification = await verifyLink(canonical, { skipCache: true });
		securitySummary = ` | security=${verification.overallRisk} (${verification.riskScore}/100)`;
		if (!verification.isVerified) flaggedCount += 1;
	}

	if (obs.kind !== "reachable" || expired) {
		flaggedCount += 1;
	}

	const tag = expired
		? "EXPIRED "
		: obs.kind === "reachable"
			? "OK      "
			: obs.kind === "missing"
				? "MISSING "
				: "TEMP    ";

	console.log(
		`  [${tag}] /${link.short_url} -> ${canonical} (http=${obs.httpStatus ?? "n/a"}, status=${record.status}${securitySummary})`,
	);
}

if (store && Object.keys(updatedRecords).length > 0) {
	const lease = await store.acquire();
	if (lease) {
		await store.write("public", updatedRecords, lease);
		console.log(
			`Updated Upstash Redis link-health cache (${Object.keys(updatedRecords).length} URL(s)).`,
		);
	} else {
		console.warn("Could not acquire link-health Redis lease (another refresh active).");
	}
}

console.log(
	`Pass-through complete: ${links.length} checked, ${flaggedCount} flagged.`,
);
