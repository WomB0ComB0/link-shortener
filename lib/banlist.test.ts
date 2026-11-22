import { beforeEach, describe, expect, it, vi } from "vitest";
import { BAN_KEYS, PERMANENT_BAN_SCORE } from "./ban-keys";
import {
	banCidr,
	banIp,
	getBannedCidrs,
	getBannedIps,
	getBanMetadata,
	isIdentifierBanned,
	isIdentifierSlowed,
	slowIp,
	unbanCidr,
	unbanIp,
	unslowIp,
} from "./banlist";
import { redis } from "./redis";

vi.mock("./redis", () => ({
	redis: {
		zscore: vi.fn(),
		zadd: vi.fn(),
		zrem: vi.fn(),
		zrange: vi.fn(),
		zremrangebyscore: vi.fn(),
		set: vi.fn(),
		del: vi.fn(),
		get: vi.fn(),
	},
}));

describe("sorted-set ban list store", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(redis.zremrangebyscore).mockResolvedValue(0);
	});

	it("ignores loopback addresses for ban and slow-mode checks", async () => {
		await expect(isIdentifierBanned("127.0.0.1")).resolves.toBe(false);
		await expect(isIdentifierSlowed("::1")).resolves.toBe(false);
		await banIp("127.0.0.1", "test");
		await slowIp("::1", "test");

		expect(redis.zscore).not.toHaveBeenCalled();
		expect(redis.zadd).not.toHaveBeenCalled();
	});

	it("checks active expiry scores and fails open on Redis errors", async () => {
		vi.mocked(redis.zscore).mockResolvedValueOnce(PERMANENT_BAN_SCORE);
		await expect(isIdentifierBanned("203.0.113.1")).resolves.toBe(true);

		// Expired score in the past -> inactive
		vi.mocked(redis.zscore).mockResolvedValueOnce(1_000);
		await expect(isIdentifierBanned("203.0.113.1")).resolves.toBe(false);

		vi.mocked(redis.zscore).mockRejectedValueOnce(new Error("redis down"));
		await expect(isIdentifierSlowed("203.0.113.1")).resolves.toBe(false);
	});

	it("writes, lists, and removes temporary IP bans, slow entries, and CIDR bans", async () => {
		await banIp("203.0.113.2", "abuse", 60, "admin");
		expect(redis.zadd).toHaveBeenCalledWith(
			BAN_KEYS.ip,
			expect.objectContaining({ member: "203.0.113.2" }),
		);
		expect(redis.set).toHaveBeenCalledWith(
			BAN_KEYS.meta("ip", "203.0.113.2"),
			expect.objectContaining({ reason: "abuse", bannedBy: "admin" }),
			expect.objectContaining({ pxat: expect.any(Number) }),
		);

		vi.mocked(redis.zrange).mockResolvedValueOnce(["203.0.113.2"]);
		await expect(getBannedIps()).resolves.toEqual(["203.0.113.2"]);

		vi.mocked(redis.get).mockResolvedValueOnce({
			reason: "abuse",
			ts: 1,
			expiresAt: 61_000,
		});
		await expect(getBanMetadata("203.0.113.2")).resolves.toMatchObject({
			reason: "abuse",
		});

		await slowIp("203.0.113.2", "suspicious");
		await unslowIp("203.0.113.2");
		await unbanIp("203.0.113.2");
		expect(redis.zrem).toHaveBeenCalledWith(BAN_KEYS.ip, "203.0.113.2");
		expect(redis.zrem).toHaveBeenCalledWith(BAN_KEYS.slow, "203.0.113.2");

		// CIDR ban normalizes host bits before storing
		vi.mocked(redis.zrange).mockResolvedValueOnce([]);
		await banCidr("203.0.113.77/24", "botnet");
		expect(redis.zadd).toHaveBeenCalledWith(
			BAN_KEYS.cidr,
			expect.objectContaining({
				member: "203.0.113.0/24",
				score: PERMANENT_BAN_SCORE,
			}),
		);
		vi.mocked(redis.zrange).mockResolvedValueOnce(["203.0.113.0/24"]);
		await expect(getBannedCidrs()).resolves.toEqual(["203.0.113.0/24"]);

		await unbanCidr("203.0.113.99/24");
		expect(redis.zrem).toHaveBeenCalledWith(BAN_KEYS.cidr, "203.0.113.0/24");
	});
});
