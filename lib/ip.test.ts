import { describe, expect, it } from "vitest";
import {
	findMatchingCidr,
	isLoopbackIp,
	normalizeCidr,
	normalizeIp,
	rateLimitKey,
} from "./ip";

describe("IP and CIDR helpers", () => {
	it("normalizes IPv4, IPv6, and IPv4-mapped IPv6 addresses", () => {
		expect(normalizeIp("203.0.113.9")).toBe("203.0.113.9");
		expect(normalizeIp("2001:DB8:0:0::1")).toBe("2001:db8::1");
		expect(normalizeIp("::ffff:203.0.113.9")).toBe("203.0.113.9");
		expect(normalizeIp("203.0.113.9%eth0")).toBeNull();
		expect(normalizeIp(" 203.0.113.9 ")).toBeNull();
		expect(normalizeIp("010.0.0.1")).toBeNull();
		expect(normalizeIp("not-an-ip")).toBeNull();
	});

	it("normalizes CIDR ranges by clearing host bits", () => {
		expect(normalizeCidr("203.0.113.77/24")).toBe("203.0.113.0/24");
		expect(normalizeCidr("2001:db8:abcd::55/32")).toBe("2001:db8::/32");
		expect(normalizeCidr("::ffff:203.0.113.77/120")).toBe("203.0.113.0/24");
		expect(normalizeCidr("203.0.113.1")).toBeNull();
		expect(normalizeCidr("203.0.113.0/33")).toBeNull();
	});

	it("matches IPs against IPv4 and IPv6 CIDR lists", () => {
		const cidrs = ["203.0.113.0/24", "2001:db8::/32"];
		expect(findMatchingCidr("203.0.113.42", cidrs)).toBe("203.0.113.0/24");
		expect(findMatchingCidr("::ffff:203.0.113.99", cidrs)).toBe("203.0.113.0/24");
		expect(findMatchingCidr("2001:db8:1234::1", cidrs)).toBe("2001:db8::/32");
		expect(findMatchingCidr("198.51.100.5", cidrs)).toBeNull();
	});

	it("derives IPv6 /64 rate-limit keys and identifies loopbacks", () => {
		expect(rateLimitKey("203.0.113.9")).toBe("203.0.113.9");
		expect(rateLimitKey("2001:db8:aa:bb:11:22:33:44")).toBe(
			"2001:db8:aa:bb::/64",
		);
		expect(isLoopbackIp("127.0.0.1")).toBe(true);
		expect(isLoopbackIp("127.42.0.1")).toBe(true);
		expect(isLoopbackIp("::1")).toBe(true);
		expect(isLoopbackIp("203.0.113.9")).toBe(false);
	});
});
