import { describe, expect, it } from "vitest";
import { classifyIpAddress, isBlockedHostname } from "./ip-utils";

describe("IP and hostname SSRF classifier", () => {
	it("blocks all private, loopback, link-local, metadata, CGNAT, and reserved IPv4 ranges", () => {
		const restrictedIpv4 = [
			"0.0.0.0",
			"10.0.0.1",
			"100.64.0.1",
			"100.127.255.254",
			"127.0.0.1",
			"127.255.255.1",
			"169.254.169.254",
			"172.16.0.1",
			"172.20.14.5",
			"172.31.255.254",
			"192.0.2.1",
			"192.168.1.1",
			"198.18.0.1",
			"224.0.0.1",
			"240.0.0.1",
			"255.255.255.255",
		];

		for (const ip of restrictedIpv4) {
			const result = classifyIpAddress(ip);
			expect(result.isIp, ip).toBe(true);
			expect(result.isRestricted, ip).toBe(true);
		}
	});

	it("allows public IPv4 addresses", () => {
		for (const ip of ["1.1.1.1", "8.8.8.8", "172.32.0.1", "100.63.255.255"]) {
			const result = classifyIpAddress(ip);
			expect(result.isIp, ip).toBe(true);
			expect(result.isRestricted, ip).toBe(false);
		}
	});

	it("blocks restricted IPv6 ranges including bracketed and IPv4-mapped forms", () => {
		const restrictedIpv6 = [
			"::",
			"::1",
			"[::1]",
			"fc00::1",
			"fd12:3456:789a::1",
			"fe80::1",
			"[fe80::1%eth0]",
			"ff02::1",
			"::ffff:127.0.0.1",
			"[::ffff:169.254.169.254]",
			"::ffff:7f00:1",
			"64:ff9b::10.0.0.1",
		];

		for (const ip of restrictedIpv6) {
			const result = classifyIpAddress(ip);
			expect(result.isIp, ip).toBe(true);
			expect(result.isRestricted, ip).toBe(true);
		}
	});

	it("allows public IPv6 addresses", () => {
		const result = classifyIpAddress("2606:4700:4700::1111");
		expect(result.isIp).toBe(true);
		expect(result.version).toBe(6);
		expect(result.isRestricted).toBe(false);
	});

	it("blocks localhost, internal, cloud metadata, and self-shortener hostnames", () => {
		expect(isBlockedHostname("localhost").blocked).toBe(true);
		expect(isBlockedHostname("sub.localhost").blocked).toBe(true);
		expect(isBlockedHostname("metadata.google.internal").blocked).toBe(true);
		expect(isBlockedHostname("service.local").blocked).toBe(true);
		expect(isBlockedHostname("db.internal").blocked).toBe(true);
		expect(isBlockedHostname("links.mikeodnis.dev").blocked).toBe(true);
		expect(isBlockedHostname("mikeodnis.dev").blocked).toBe(false);
	});
});
