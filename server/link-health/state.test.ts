import { describe, expect, it } from "vitest";
import {
	CONFIRM_AFTER,
	nextRecord,
	publicEntry,
	readRecord,
	WARNING_MAX_AGE,
} from "./state";

describe("link-health two-pass state machine", () => {
	const t0 = 1_700_000_000_000;

	it("requires two consecutive missing observations >= 2 minutes apart before marking unavailable", () => {
		const first = nextRecord(undefined, { kind: "missing", httpStatus: 404 }, t0);
		expect(first.kind).toBe("missing");
		expect(first.status).toBe("unknown");
		expect(first.nextCheckAt).toBe(t0 + CONFIRM_AFTER);

		// Too soon (< 2 min) stays unknown
		const tooSoon = nextRecord(first, { kind: "missing", httpStatus: 404 }, t0 + 60_000);
		expect(tooSoon.status).toBe("unknown");

		// After CONFIRM_AFTER (>= 2 min) promotes to unavailable
		const confirmed = nextRecord(
			first,
			{ kind: "missing", httpStatus: 404 },
			t0 + CONFIRM_AFTER,
		);
		expect(confirmed.status).toBe("unavailable");
		expect(confirmed.missingSince).toBe(t0);
	});

	it("recovers immediately to reachable and schedules 6-hour recheck", () => {
		const missing = nextRecord(undefined, { kind: "missing" }, t0);
		const recovered = nextRecord(missing, { kind: "reachable", httpStatus: 200 }, t0 + 10_000);
		expect(recovered.status).toBe("reachable");
		expect(recovered.nextCheckAt).toBe(t0 + 10_000 + 360 * 60_000);
	});

	it("validates deserialized cache records strictly and expires entries after 24h", () => {
		const valid = nextRecord(undefined, { kind: "temporary" }, t0);
		expect(readRecord(valid)).toEqual(valid);
		expect(readRecord(null)).toBeUndefined();
		expect(readRecord({ kind: "missing", status: "unavailable", checkedAt: t0, nextCheckAt: t0 + 1000, missingSince: t0 })).toBeUndefined();
		expect(readRecord({ kind: "reachable", status: "unavailable", checkedAt: t0, nextCheckAt: t0 + 1000 })).toBeUndefined();

		expect(publicEntry(valid, t0 + 1_000)?.status).toBe("temporary");
		expect(publicEntry(valid, t0 + WARNING_MAX_AGE)).toBeUndefined();
	});
});
