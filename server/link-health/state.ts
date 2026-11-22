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

import type {
	LinkHealthEntry,
	LinkHealthStatus,
	LinkObservation,
} from "./types";

const MINUTE = 60_000;
export const WARNING_MAX_AGE = 24 * 60 * MINUTE;
export const CONFIRM_AFTER = 2 * MINUTE;

export interface LinkRecord {
	readonly kind: LinkObservation["kind"];
	readonly status: LinkHealthStatus;
	readonly checkedAt: number;
	readonly nextCheckAt: number;
	readonly missingSince?: number;
}

/**
 * Two-pass state machine matching portfolio's link-health engine:
 * - A single 404/410 ('missing') stays 'unknown' and schedules reconfirmation in 2 min.
 * - Consecutive 'missing' >= 2 min promotes status to 'unavailable' (re-checked every 60 min).
 * - 'temporary' re-checks every 15 min; 'reachable' re-checks every 6 hours.
 */
export function nextRecord(
	previous: LinkRecord | undefined,
	observation: LinkObservation,
	now: number,
): LinkRecord {
	const { kind } = observation;
	if (kind === "missing") {
		const consecutive =
			previous?.kind === "missing" &&
			previous.checkedAt <= now &&
			now - previous.checkedAt < WARNING_MAX_AGE;
		const missingSince = consecutive ? (previous.missingSince ?? now) : now;
		const confirmed = consecutive && now - missingSince >= CONFIRM_AFTER;
		return {
			kind,
			status: confirmed ? "unavailable" : "unknown",
			checkedAt: now,
			nextCheckAt: now + (confirmed ? 60 * MINUTE : CONFIRM_AFTER),
			missingSince,
		};
	}

	return {
		kind,
		status: kind,
		checkedAt: now,
		nextCheckAt: now + (kind === "temporary" ? 15 : 360) * MINUTE,
	};
}

/** Strictly validate deserialized Redis cache records; discard anything malformed. */
export function readRecord(value: unknown): LinkRecord | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as Partial<LinkRecord>;
	const isTime = (v: unknown): v is number =>
		typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

	if (!isTime(record.checkedAt) || !isTime(record.nextCheckAt)) {
		return undefined;
	}
	if (
		record.nextCheckAt < record.checkedAt ||
		record.nextCheckAt - record.checkedAt > WARNING_MAX_AGE
	) {
		return undefined;
	}

	if (record.kind === "missing") {
		if (record.status !== "unknown" && record.status !== "unavailable") {
			return undefined;
		}
		if (!isTime(record.missingSince) || record.missingSince > record.checkedAt) {
			return undefined;
		}
		if (
			record.status === "unavailable" &&
			record.checkedAt - record.missingSince < CONFIRM_AFTER
		) {
			return undefined;
		}
	} else if (
		!["reachable", "temporary", "unknown"].includes(record.kind ?? "") ||
		record.status !== record.kind
	) {
		return undefined;
	}

	return record as LinkRecord;
}

/** Convert an internal record to a public API entry, expiring entries older than 24h. */
export function publicEntry(
	record: LinkRecord,
	now: number,
): LinkHealthEntry | undefined {
	if (record.checkedAt > now || now - record.checkedAt >= WARNING_MAX_AGE) {
		return undefined;
	}
	return {
		status: record.status,
		checkedAt: new Date(record.checkedAt).toISOString(),
	};
}
