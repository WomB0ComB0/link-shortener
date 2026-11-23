import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeQuery, getGuardRedis, setResponseHeader, setResponseStatus } =
	vi.hoisted(() => ({
		executeQuery: vi.fn(),
		getGuardRedis: vi.fn(),
		setResponseHeader: vi.fn(),
		setResponseStatus: vi.fn(),
	}));

vi.mock("h3", () => ({
	defineEventHandler: (handler: unknown) => handler,
	setResponseHeader,
	setResponseStatus,
}));
vi.mock("../utils/graphql", () => ({ executeQuery }));
vi.mock("../../lib/redis-guard", () => ({ getGuardRedis }));

import healthHandler from "./health.get";

describe("GET /api/health", () => {
	beforeEach(() => {
		executeQuery.mockReset();
		getGuardRedis.mockReset();
		setResponseHeader.mockReset();
		setResponseStatus.mockReset();
	});

	it("returns 200 healthy with dependency latencies and metrics snapshot", async () => {
		getGuardRedis.mockReturnValueOnce({ ping: vi.fn().mockResolvedValue("PONG") });
		executeQuery.mockResolvedValueOnce({ data: { short_links: [] }, error: null });

		const body = await healthHandler({} as never);
		expect(setResponseStatus).toHaveBeenCalledWith({}, 200);
		expect(body.status).toBe("healthy");
		expect(body.dependencies.hasura.status).toBe("ok");
		expect(body.dependencies.redis.status).toBe("ok");
		expect(body.metrics.redirects).toBeDefined();
	});

	it("returns 503 degraded when Hasura DB is unreachable", async () => {
		getGuardRedis.mockReturnValueOnce(null);
		executeQuery.mockResolvedValueOnce({
			data: null,
			error: new Error("timeout"),
		});

		const body = await healthHandler({} as never);
		expect(setResponseStatus).toHaveBeenCalledWith({}, 503);
		expect(body.status).toBe("degraded");
		expect(body.dependencies.hasura.status).toBe("degraded");
		expect(body.dependencies.redis.status).toBe("unconfigured");
	});
});
